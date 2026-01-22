import { Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL, sendAndConfirmTransaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, createBurnInstruction, createTransferInstruction, getAccount, TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, createAssociatedTokenAccountInstruction } from '@solana/spl-token';
import { keypairFromPrivateKey } from '../utils/wallet.js';
import { executeTrade, claimCreatorFees, checkCreatorFees } from '../clients/pumpportal.js';
import { solTrackerClient, Holder } from '../clients/soltracker.js';
import { Coin } from '../models/coin.js';
import dotenv from 'dotenv';

dotenv.config();

const RPC_ENDPOINT = process.env.RPC_ENDPOINT || "https://api.mainnet-beta.solana.com/";

/**
 * Helper to get token account info, trying Token2022 first, then Token
 * Also searches for token accounts if the associated token account doesn't exist
 */
async function getTokenAccountWithProgram(
  connection: Connection,
  tokenAccount: PublicKey,
  mint: PublicKey,
  owner: PublicKey
): Promise<{ account: any; programId: PublicKey; balance: number; tokenAccount: PublicKey }> {
  // Try Token2022 first (pump.fun uses Token2022)
  try {
    const accountInfo = await getAccount(connection, tokenAccount, 'confirmed', TOKEN_2022_PROGRAM_ID);
    return {
      account: accountInfo,
      programId: TOKEN_2022_PROGRAM_ID,
      balance: Number(accountInfo.amount),
      tokenAccount
    };
  } catch (error2022) {
    // Try standard Token program
    try {
      const accountInfo = await getAccount(connection, tokenAccount, 'confirmed', TOKEN_PROGRAM_ID);
      return {
        account: accountInfo,
        programId: TOKEN_PROGRAM_ID,
        balance: Number(accountInfo.amount),
        tokenAccount
      };
    } catch (errorToken) {
      // Both failed - search for token accounts
      let tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        owner,
        { mint, programId: TOKEN_2022_PROGRAM_ID },
        'confirmed'
      );
      
      let programId = TOKEN_2022_PROGRAM_ID;
      if (tokenAccounts.value.length === 0) {
        tokenAccounts = await connection.getParsedTokenAccountsByOwner(
          owner,
          { mint, programId: TOKEN_PROGRAM_ID },
          'confirmed'
        );
        programId = TOKEN_PROGRAM_ID;
      }
      
      if (tokenAccounts.value.length === 0) {
        throw new Error('No token account found');
      }
      
      const foundAccount = new PublicKey(tokenAccounts.value[0].pubkey);
      const balance = Number(tokenAccounts.value[0].account.data.parsed.info.tokenAmount.amount);
      
      // Get account info for the found account
      const accountInfo = await getAccount(connection, foundAccount, 'confirmed', programId);
      
      return {
        account: accountInfo,
        programId,
        balance,
        tokenAccount: foundAccount
      };
    }
  }
}

export interface ExecutionResult {
  success: boolean;
  signatures: string[];
  error?: string;
  amountBurned?: number; // For BURN actions (raw token amount)
  amountAirdropped?: number; // For AIRDROP_TOKENS actions (raw token amount)
  amountSent?: number; // For TREASURY_TOKENS actions (raw token amount)
}

export async function executeClaimFees(coin: Coin): Promise<ExecutionResult> {
  try {
    console.log(`💰 Claiming fees for ${coin.symbol}...`);
    
    // Don't check fees first - the check endpoint is unreliable (sometimes returns 404)
    // Just try to claim directly and let PumpPortal handle it
    // If no fees exist, the API will return an error which we handle gracefully
    const signature = await claimCreatorFees(coin.private_key, coin.mint);
    
    if (!signature) {
      return {
        success: false,
        signatures: [],
        error: 'No fees to claim or claim failed'
      };
    }

    console.log(`✅ Claimed fees successfully!`);
    
    return {
      success: true,
      signatures: [signature]
    };
  } catch (error) {
    console.error('executeClaimFees error:', error);
    return {
      success: false,
      signatures: [],
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

export async function executeBuyback(
  coin: Coin,
  amountSol: number
): Promise<ExecutionResult> {
  try {
    console.log(`💵 Executing buyback: ${amountSol} SOL for ${coin.symbol}...`);
    
    const keypair = keypairFromPrivateKey(coin.private_key);
    const publicKey = keypair.publicKey.toBase58();

    const buyResult = await executeTrade(coin.private_key, {
      action: 'buy',
      mint: coin.mint,
      amount: amountSol,
      denominatedInSol: true,
      slippage: 10, // 10% slippage tolerance
      publicKey
    });

    if (!buyResult.signature || buyResult.error) {
      return {
        success: false,
        signatures: [],
        error: buyResult.error || 'Buy transaction failed'
      };
    }

    console.log(`✅ Bought tokens with ${amountSol} SOL`);

    return {
      success: true,
      signatures: [buyResult.signature]
    };
  } catch (error) {
    console.error('executeBuyback error:', error);
    return {
      success: false,
      signatures: [],
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

export async function executeBurnTokens(
  coin: Coin,
  percentage: number = 100
): Promise<ExecutionResult> {
  try {
    console.log(`🔥 Burning ${percentage}% of held tokens for ${coin.symbol}...`);
    
    const connection = new Connection(RPC_ENDPOINT);
    const keypair = keypairFromPrivateKey(coin.private_key);
    const mintPubkey = new PublicKey(coin.mint);
    
    // Get agent's token account (try both Token and Token2022)
    const tokenAccount = await getAssociatedTokenAddress(
      mintPubkey,
      keypair.publicKey
    );
    
    // Check if token account exists and get balance
    // Try Token2022 first (since user said all tokens are Token2022)
    let balance = 0;
    let actualTokenAccount = tokenAccount;
    let tokenProgramId = TOKEN_2022_PROGRAM_ID;
    
    try {
      // Try Token2022 first
      const accountInfo = await getAccount(connection, tokenAccount, 'confirmed', TOKEN_2022_PROGRAM_ID);
      balance = Number(accountInfo.amount);
      console.log(`✅ Found Token2022 account, balance: ${balance}`);
    } catch (error2022) {
      // If Token2022 fails, try standard Token program
      try {
        const accountInfo = await getAccount(connection, tokenAccount, 'confirmed', TOKEN_PROGRAM_ID);
        balance = Number(accountInfo.amount);
        tokenProgramId = TOKEN_PROGRAM_ID;
        console.log(`✅ Found Token account, balance: ${balance}`);
      } catch (errorToken) {
        // Both failed - try to find all token accounts for this mint
        console.log(`⚠️  Associated token account not found, searching for token accounts...`);
        
        // Try to find all token accounts owned by this wallet for this mint
        // Try Token2022 first
        let tokenAccounts = await connection.getParsedTokenAccountsByOwner(
          keypair.publicKey,
          { mint: mintPubkey, programId: TOKEN_2022_PROGRAM_ID },
          'confirmed'
        );
        
        // If no Token2022 accounts, try standard Token
        if (tokenAccounts.value.length === 0) {
          tokenAccounts = await connection.getParsedTokenAccountsByOwner(
            keypair.publicKey,
            { mint: mintPubkey, programId: TOKEN_PROGRAM_ID },
            'confirmed'
          );
          tokenProgramId = TOKEN_PROGRAM_ID;
        }
        
        if (tokenAccounts.value.length === 0) {
          return {
            success: false,
            signatures: [],
            error: 'No token account found. You may not have any tokens yet. Try buying tokens first with the buyback action.'
          };
        }
        
        // Use the first token account found
        actualTokenAccount = new PublicKey(tokenAccounts.value[0].pubkey);
        // Get raw amount (already in base units, no decimals)
        balance = Number(tokenAccounts.value[0].account.data.parsed.info.tokenAmount.amount);
        
        console.log(`✅ Found token account: ${actualTokenAccount.toBase58()}, balance: ${balance}, program: ${tokenProgramId === TOKEN_2022_PROGRAM_ID ? 'Token2022' : 'Token'}`);
      }
    }
    
    if (balance === 0) {
      return {
        success: false,
        signatures: [],
        error: 'No tokens to burn (balance is zero)'
      };
    }
    
    // Calculate amount to burn
    const amountToBurn = Math.floor(balance * (percentage / 100));
    
    if (amountToBurn === 0) {
      return {
        success: false,
        signatures: [],
        error: 'Amount to burn is zero'
      };
    }
    
    console.log(`🔥 Burning ${amountToBurn} tokens (${percentage}% of ${balance})...`);
    
    // Create burn instruction using the actual token account and correct program ID
    const burnInstruction = createBurnInstruction(
      actualTokenAccount,
      mintPubkey,
      keypair.publicKey,
      BigInt(amountToBurn),
      [],
      tokenProgramId
    );
    
    const tx = new Transaction().add(burnInstruction);
    const signature = await sendAndConfirmTransaction(connection, tx, [keypair]);
    
    console.log(`✅ Burned ${amountToBurn} tokens`);
    
    return {
      success: true,
      signatures: [signature],
      amountBurned: amountToBurn // Return the amount for stats update
    };
  } catch (error) {
    console.error('executeBurnTokens error:', error);
    return {
      success: false,
      signatures: [],
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

export async function executeAirdropSol(
  coin: Coin,
  amountSol: number,
  holders: Holder[]
): Promise<ExecutionResult> {
  try {
    console.log(`[${coin.symbol}] 🎁 SOL Airdrop: ${amountSol} SOL to ${holders.length} holders`);
    
    if (holders.length === 0) {
      return {
        success: false,
        signatures: [],
        error: 'No holders to airdrop to'
      };
    }

    // IMPORTANT: Limit to top 50 holders to prevent slow airdrops
    // Sort by balance (descending) and take top 50
    const MAX_AIRDROP_HOLDERS = 50;
    const limitedHolders = holders
      .sort((a, b) => b.balance - a.balance)
      .slice(0, MAX_AIRDROP_HOLDERS);
    
    console.log(`📊 Airdropping SOL to top ${Math.min(limitedHolders.length, MAX_AIRDROP_HOLDERS)} holders (out of ${holders.length} total)`);

    // Calculate total token balance (from limited set)
    const totalBalance = limitedHolders.reduce((sum, h) => sum + h.balance, 0);
    if (totalBalance === 0) {
      return {
        success: false,
        signatures: [],
        error: 'Total holder balance is zero'
      };
    }

    // Calculate proportional distribution
    const distribution = limitedHolders.map(holder => ({
      address: holder.address,
      amount: (holder.balance / totalBalance) * amountSol
    })).filter(d => d.amount >= 0.001); // Filter out dust

    console.log(`📊 Distributing to ${distribution.length} holders (top holders only, filtered dust)`);

    const connection = new Connection(RPC_ENDPOINT);
    const keypair = keypairFromPrivateKey(coin.private_key);
    const signatures: string[] = [];

    // BATCH SOL TRANSFERS: Group multiple transfers into single transactions (MUCH faster!)
    const TRANSFERS_PER_TX = 10; // Batch 10 SOL transfers per transaction (SOL transfers are simpler than token)
    console.log(`[${coin.symbol}] 🎁 Batching ${distribution.length} SOL transfers (${TRANSFERS_PER_TX} per tx)...`);
    
    for (let batchStart = 0; batchStart < distribution.length; batchStart += TRANSFERS_PER_TX) {
      // CHECK IF PAUSED before each batch
      const database = (await import('../database.js')).default;
      const coinsCollection = database.getCollection<Coin>('coins');
      const currentCoin = await coinsCollection.findOne({ mint: coin.mint });
      if (currentCoin?.status === 'paused') {
        console.log(`[${coin.symbol}] ⏸️  PAUSED - Stopping SOL airdrop at ${batchStart}/${distribution.length}`);
        return {
          success: signatures.length > 0,
          signatures
        };
      }
      
      const batch = distribution.slice(batchStart, batchStart + TRANSFERS_PER_TX);
      const tx = new Transaction();
      
      try {
        // Add all SOL transfers to ONE transaction
        for (const recipient of batch) {
          tx.add(SystemProgram.transfer({
            fromPubkey: keypair.publicKey,
            toPubkey: new PublicKey(recipient.address),
            lamports: Math.floor(recipient.amount * LAMPORTS_PER_SOL)
          }));
        }

        // Send ONE transaction with all transfers in this batch
        const signature = await sendAndConfirmTransaction(connection, tx, [keypair]);
        signatures.push(signature);
        
        console.log(`[${coin.symbol}]    Batch ${Math.floor(batchStart / TRANSFERS_PER_TX) + 1}/${Math.ceil(distribution.length / TRANSFERS_PER_TX)} sent (${batch.length} holders)`);
        
      } catch (error) {
        console.error(`[${coin.symbol}]    ❌ Batch failed:`, error instanceof Error ? error.message : String(error));
      }
    }
    
    console.log(`[${coin.symbol}] ✅ SOL airdrop complete: ${signatures.length} batches`);

    return {
      success: signatures.length > 0,
      signatures
    };
  } catch (error) {
    console.error('executeAirdropSol error:', error);
    return {
      success: false,
      signatures: [],
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

export async function executeAirdropTokens(
  coin: Coin,
  percentage: number,
  holders: Holder[]
): Promise<ExecutionResult> {
  try {
    console.log(`[${coin.symbol}] 🎁 Airdrop: ${percentage}% to ${holders.length} holders`);
    
    if (holders.length === 0) {
      return {
        success: false,
        signatures: [],
        error: 'No holders to airdrop to'
      };
    }

    const connection = new Connection(RPC_ENDPOINT);
    const keypair = keypairFromPrivateKey(coin.private_key);
    const mintPubkey = new PublicKey(coin.mint);
    
    // Get agent's token account and balance (Token2022)
    const agentTokenAccount = await getAssociatedTokenAddress(
      mintPubkey,
      keypair.publicKey
    );
    
    const { balance: agentBalance, programId: tokenProgramId, tokenAccount: actualAgentTokenAccount } = await getTokenAccountWithProgram(
      connection,
      agentTokenAccount,
      mintPubkey,
      keypair.publicKey
    );
    
    if (agentBalance === 0) {
      return {
        success: false,
        signatures: [],
        error: 'No tokens to airdrop'
      };
    }
    
    const amountToAirdrop = Math.floor(agentBalance * (percentage / 100));
    
    if (amountToAirdrop === 0) {
      return {
        success: false,
        signatures: [],
        error: 'Amount to airdrop is zero'
      };
    }
    
    console.log(`📊 Airdropping ${amountToAirdrop} tokens (${percentage}% of ${agentBalance})`);
    
    // IMPORTANT: Limit to top 50 holders to prevent slow airdrops
    // Sort by balance (descending) and take top 50
    const MAX_AIRDROP_HOLDERS = 50;
    const limitedHolders = holders
      .sort((a, b) => b.balance - a.balance)
      .slice(0, MAX_AIRDROP_HOLDERS);
    
    console.log(`📊 Airdropping to top ${Math.min(limitedHolders.length, MAX_AIRDROP_HOLDERS)} holders (out of ${holders.length} total)`);
    
    // Calculate total holder token balance (from limited set)
    const totalHolderBalance = limitedHolders.reduce((sum, h) => sum + h.balance, 0);
    if (totalHolderBalance === 0) {
      return {
        success: false,
        signatures: [],
        error: 'Total holder balance is zero'
      };
    }

    // Calculate proportional distribution
    const distribution = limitedHolders.map(holder => ({
      address: holder.address,
      amount: Math.floor((holder.balance / totalHolderBalance) * amountToAirdrop)
    })).filter(d => d.amount > 0); // Filter out dust

    console.log(`📊 Distributing to ${distribution.length} holders (top holders only, filtered dust)`);

    const signatures: string[] = [];

    // BATCH TRANSFERS: Group multiple transfers into single transactions (MUCH faster!)
    const TRANSFERS_PER_TX = 8; // Batch 8 transfers per transaction (safe limit for compute)
    console.log(`[${coin.symbol}] 🎁 Batching ${distribution.length} transfers (${TRANSFERS_PER_TX} per tx)...`);
    
    for (let batchStart = 0; batchStart < distribution.length; batchStart += TRANSFERS_PER_TX) {
      // CHECK IF PAUSED before each batch
      const database = (await import('../database.js')).default;
      const coinsCollection = database.getCollection<Coin>('coins');
      const currentCoin = await coinsCollection.findOne({ mint: coin.mint });
      if (currentCoin?.status === 'paused') {
        console.log(`[${coin.symbol}] ⏸️  PAUSED - Stopping at ${batchStart}/${distribution.length}`);
        return {
          success: signatures.length > 0,
          signatures,
          amountAirdropped: Math.floor((batchStart / distribution.length) * amountToAirdrop)
        };
      }
      
      const batch = distribution.slice(batchStart, batchStart + TRANSFERS_PER_TX);
      const tx = new Transaction();
      
      try {
        // Add all transfers and account creations to ONE transaction
        for (const recipient of batch) {
          const recipientPubkey = new PublicKey(recipient.address);
          const recipientTokenAccount = await getAssociatedTokenAddress(
            mintPubkey,
            recipientPubkey,
            false,
            tokenProgramId
          );
          
          // Check if account exists, create if not
          try {
            await getAccount(connection, recipientTokenAccount, 'confirmed', tokenProgramId);
          } catch (error) {
            tx.add(createAssociatedTokenAccountInstruction(
              keypair.publicKey,
              recipientTokenAccount,
              recipientPubkey,
              mintPubkey,
              tokenProgramId
            ));
          }
          
          // Add transfer instruction
          tx.add(createTransferInstruction(
            actualAgentTokenAccount,
            recipientTokenAccount,
            keypair.publicKey,
            BigInt(recipient.amount),
            [],
            tokenProgramId
          ));
        }
        
        // Send ONE transaction with all transfers in this batch
        const signature = await sendAndConfirmTransaction(connection, tx, [keypair]);
        signatures.push(signature);
        
        console.log(`[${coin.symbol}]    Batch ${Math.floor(batchStart / TRANSFERS_PER_TX) + 1}/${Math.ceil(distribution.length / TRANSFERS_PER_TX)} sent (${batch.length} holders)`);
        
      } catch (error) {
        console.error(`[${coin.symbol}]    ❌ Batch failed:`, error instanceof Error ? error.message : String(error));
      }
    }
    
    console.log(`[${coin.symbol}] ✅ Airdrop complete: ${signatures.length} batches`);

    return {
      success: signatures.length > 0,
      signatures,
      amountAirdropped: amountToAirdrop // Return the amount for stats update
    };
  } catch (error) {
    console.error('executeAirdropTokens error:', error);
    return {
      success: false,
      signatures: [],
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

export async function executeSendSolToTreasury(
  coin: Coin,
  amountSol: number
): Promise<ExecutionResult> {
  try {
    if (!coin.treasury_wallet) {
      return {
        success: false,
        signatures: [],
        error: 'Treasury wallet is not configured. Cannot send to treasury without a treasury wallet.'
      };
    }
    const treasuryAddress = coin.treasury_wallet;
    console.log(`💸 Sending ${amountSol} SOL to treasury ${treasuryAddress}...`);
    
    const connection = new Connection(RPC_ENDPOINT);
    const keypair = keypairFromPrivateKey(coin.private_key);
    const treasuryPublicKey = new PublicKey(treasuryAddress);

    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: keypair.publicKey,
        toPubkey: treasuryPublicKey,
        lamports: Math.floor(amountSol * LAMPORTS_PER_SOL)
      })
    );

    const signature = await sendAndConfirmTransaction(connection, tx, [keypair]);
    
    console.log(`✅ Sent ${amountSol} SOL to treasury`);

    return {
      success: true,
      signatures: [signature]
    };
  } catch (error) {
    console.error('executeSendSolToTreasury error:', error);
    return {
      success: false,
      signatures: [],
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

export async function executeSendTokensToTreasury(
  coin: Coin,
  percentage: number
): Promise<ExecutionResult> {
  try {
    if (!coin.treasury_wallet) {
      return {
        success: false,
        signatures: [],
        error: 'Treasury wallet is not configured. Cannot send to treasury without a treasury wallet.'
      };
    }
    const treasuryAddress = coin.treasury_wallet;
    console.log(`💸 Sending ${percentage}% of held tokens to treasury ${treasuryAddress}...`);
    
    const connection = new Connection(RPC_ENDPOINT);
    const keypair = keypairFromPrivateKey(coin.private_key);
    const mintPubkey = new PublicKey(coin.mint);
    
    // Get agent's token account (Token2022)
    const agentTokenAccount = await getAssociatedTokenAddress(
      mintPubkey,
      keypair.publicKey
    );
    
    const { balance, programId: tokenProgramId, tokenAccount: actualAgentTokenAccount } = await getTokenAccountWithProgram(
      connection,
      agentTokenAccount,
      mintPubkey,
      keypair.publicKey
    );
    
    if (balance === 0) {
      return {
        success: false,
        signatures: [],
        error: 'No tokens to send'
      };
    }
    
    const amountToSend = Math.floor(balance * (percentage / 100));
    
    if (amountToSend === 0) {
      return {
        success: false,
        signatures: [],
        error: 'Amount to send is zero'
      };
    }
    
    console.log(`💸 Sending ${amountToSend} tokens (${percentage}% of ${balance}) to treasury...`);
    
    // Get treasury token account address
    const treasuryPubkey = new PublicKey(treasuryAddress);
    const treasuryTokenAccount = await getAssociatedTokenAddress(
      mintPubkey,
      treasuryPubkey,
      false, // allowOwnerOffCurve
      tokenProgramId
    );
    
    // Check if treasury token account exists, create if not
    const tx = new Transaction();
    
    try {
      await getAccount(connection, treasuryTokenAccount, 'confirmed', tokenProgramId);
      console.log(`✅ Treasury token account exists`);
    } catch (error) {
      // Account doesn't exist, create it
      console.log(`📝 Creating treasury token account...`);
      const createATAInstruction = createAssociatedTokenAccountInstruction(
        keypair.publicKey, // payer
        treasuryTokenAccount, // ata
        treasuryPubkey, // owner
        mintPubkey, // mint
        tokenProgramId
      );
      tx.add(createATAInstruction);
    }
    
    // Add transfer instruction
    const transferInstruction = createTransferInstruction(
      actualAgentTokenAccount,
      treasuryTokenAccount,
      keypair.publicKey,
      BigInt(amountToSend),
      [],
      tokenProgramId
    );
    tx.add(transferInstruction);
    
    const signature = await sendAndConfirmTransaction(connection, tx, [keypair]);
    
    console.log(`✅ Sent ${amountToSend} tokens to treasury`);
    
    return {
      success: true,
      signatures: [signature],
      amountSent: amountToSend // Return amount for stats update
    };
  } catch (error) {
    console.error('executeSendTokensToTreasury error:', error);
    return {
      success: false,
      signatures: [],
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Backward compatibility exports (deprecated)
export const executeBuybackAndBurn = executeBuyback;
export const executeAirdrop = executeAirdropSol;
export const executeSendToTreasury = executeSendSolToTreasury;
export const executeSendToCreator = executeSendSolToTreasury;
