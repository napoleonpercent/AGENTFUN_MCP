import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

export interface WalletInfo {
  publicKey: string;
  privateKey: string;
}

export function generateWallet(): WalletInfo {
  const keypair = Keypair.generate();
  
  return {
    publicKey: keypair.publicKey.toBase58(),
    privateKey: bs58.encode(keypair.secretKey)
  };
}

export function keypairFromPrivateKey(privateKey: string): Keypair {
  const secretKey = bs58.decode(privateKey);
  return Keypair.fromSecretKey(secretKey);
}
