# AgentFun MCP - Complete File Structure

## 📁 Full Package Contents

```
agentfun-mcp/
├── server.ts              # MCP Express router (API endpoints)
├── tools.ts               # MCP tool definitions (6 actions)
├── database.ts            # MongoDB connection and helpers
│
├── engine/
│   └── executor.ts        # ⭐ BLOCKCHAIN OPERATIONS
│                          # - executeBuyback() - PumpPortal trading
│                          # - executeBurnTokens() - Token2022 burn
│                          # - executeAirdropSol() - SOL distribution
│                          # - executeAirdropTokens() - Token distribution
│                          # - executeSendSolToTreasury()
│                          # - executeSendTokensToTreasury()
│
├── clients/
│   ├── pumpportal.ts      # ⭐ PUMP.FUN TRADING CLIENT
│   │                      # - executeTrade() - Buy/sell via PumpPortal
│   │                      # - checkCreatorFees()
│   │                      # - claimCreatorFees()
│   │                      # - launchToken()
│   │
│   └── soltracker.ts      # ⭐ HOLDER DATA CLIENT
│                          # - getHolders() - Fetch token holder data
│                          # - Calls SolanaTracker API
│
├── models/
│   └── coin.ts            # TypeScript interfaces
│                          # - Coin interface (mint, keys, config)
│                          # - AgentActionType enum
│
├── utils/
│   └── wallet.ts          # Wallet utilities
│                          # - keypairFromPrivateKey()
│                          # - Base58 private key handling
│
├── package.json           # NPM dependencies
├── tsconfig.json          # TypeScript config
├── .env.example           # Environment variables template
├── .gitignore             # Git ignore rules
├── README.md              # Technical documentation
└── README_GITHUB.md       # GitHub README (rename to README.md)
```

## 🔧 How It Works

### 1. MCP API Layer (server.ts + tools.ts)

**Endpoints:**
- `GET /mcp/health` - Health check
- `GET /mcp/tools` - List available tools
- `POST /mcp/tools/:toolName` - Execute a tool

**Tools Defined:**
```typescript
{
  name: "buyback",
  description: "Buy tokens using SOL",
  inputSchema: { coin_mint, amount_sol },
  handler: handleBuyback
}
```

### 2. Execution Layer (engine/executor.ts)

**Core Functions:**

```typescript
// Buy tokens via PumpPortal
export async function executeBuyback(
  coin: Coin,
  amountSol: number
): Promise<ExecutionResult>

// Burn tokens (Token2022 support)
export async function executeBurnTokens(
  coin: Coin,
  percentage: number
): Promise<ExecutionResult>

// Airdrop SOL to holders
export async function executeAirdropSol(
  coin: Coin,
  amountSol: number,
  holders: Holder[]
): Promise<ExecutionResult>

// Airdrop tokens to holders
export async function executeAirdropTokens(
  coin: Coin,
  percentage: number,
  holders: Holder[]
): Promise<ExecutionResult>
```

### 3. Trading Client (clients/pumpportal.ts)

**PumpPortal Integration:**

```typescript
export async function executeTrade(
  privateKey: string,
  request: TradeRequest
): Promise<TradeResponse> {
  // 1. Call PumpPortal API for unsigned transaction
  // 2. Deserialize transaction
  // 3. Sign with agent keypair
  // 4. Send to Solana network
  // 5. Confirm transaction
}
```

### 4. Holder Data (clients/soltracker.ts)

**SolanaTracker API:**

```typescript
export async function getHolders(mint: string): Promise<Holder[]> {
  // Fetch from https://data.solanatracker.io/tokens/{mint}/holders
  // Returns: { wallet, amount, percentage }[]
}
```

### 5. Database (database.ts)

**MongoDB Integration:**

```typescript
export class Database {
  async connect(): Promise<void>
  getCollection<T>(name: string): Collection<T>
}

// Usage:
const coin = await db.getCollection<Coin>('coins').findOne({ mint });
```

### 6. Wallet Utils (utils/wallet.ts)

**Private Key Handling:**

```typescript
export function keypairFromPrivateKey(privateKey: string): Keypair {
  // Convert Base58 private key to Keypair
  // Used to sign all transactions
}
```

## 🔐 Data Flow

### Example: Execute Buyback

```
1. AI Agent calls: POST /mcp/tools/buyback
   { coin_mint: "ABC...", amount_sol: 0.05 }
   
2. tools.ts → handleBuyback(args)
   - Validates inputs
   - Fetches coin from database
   
3. database.ts → getCollection('coins').findOne({ mint })
   - Returns coin with private_key
   
4. executor.ts → executeBuyback(coin, 0.05)
   - Calls pumpportal.executeTrade()
   
5. pumpportal.ts → executeTrade()
   - Calls PumpPortal API
   - Gets unsigned transaction
   
6. wallet.ts → keypairFromPrivateKey(coin.private_key)
   - Creates keypair for signing
   
7. pumpportal.ts:
   - Signs transaction with keypair
   - Sends to Solana
   - Waits for confirmation
   
8. Returns: { success: true, signatures: [...] }
```

## 🗄️ Database Schema

### Coins Collection

```typescript
{
  _id: ObjectId,
  mint: "2WnbKT7nZVA6Se3QrAcgka7ZtN3PbcRVxKZEYpNrP1bj",
  name: "AgentsFun",
  symbol: "AGENTFUN",
  description: "AI Agent Fun Token",
  image_url: "https://...",
  
  // Wallet info
  creator_wallet: "BJP1iNuk4FotNWqkdUJdimfjuMwxfXzXb53CxagrSbwt",
  private_key: "Base58EncodedPrivateKeyHere",
  treasury_wallet: "TreasuryWalletAddressHere",
  
  // Action config
  enabled_actions: {
    buyback: true,
    burn: true,
    airdrop_sol: false,
    airdrop_tokens: true,
    treasury_sol: true,
    treasury_tokens: true
  },
  
  // Stats
  stats: {
    rounds: 50,
    fees_claimed: 1.25,
    buyback_sol: 2.5,
    burned_tokens: 1000000000,
    airdropped_sol: 0.5,
    airdropped_tokens: 500000000
  },
  
  status: "active",
  created_at: ISODate("2024-01-01T00:00:00Z")
}
```

## 🔄 Token2022 Support

The executor automatically detects and handles Token2022:

```typescript
// Try Token2022 first (pump.fun standard)
try {
  const accountInfo = await getAccount(
    connection,
    tokenAccount,
    'confirmed',
    TOKEN_2022_PROGRAM_ID
  );
  tokenProgramId = TOKEN_2022_PROGRAM_ID;
} catch {
  // Fall back to standard Token program
  const accountInfo = await getAccount(
    connection,
    tokenAccount,
    'confirmed',
    TOKEN_PROGRAM_ID
  );
  tokenProgramId = TOKEN_PROGRAM_ID;
}

// Create accounts with correct program
createAssociatedTokenAccountInstruction(
  payer, ata, owner, mint,
  tokenProgramId  // Uses detected program
);
```

## 🚀 Deployment

### Environment Variables Required

```bash
RPC_ENDPOINT=https://api.mainnet-beta.solana.com/
MONGODB_URI=mongodb://localhost:27017
DB_NAME=agentfun
SOLANATRACKER_API_KEY=your_key
PORT=8000
```

### Start Server

```bash
npm install
npm run build
npm start
```

### Health Check

```bash
curl http://localhost:8000/mcp/health
# Returns: { status: "ok", tools: 6 }
```

## ✅ Complete Implementation

This package includes EVERYTHING needed:
- ✅ MCP server (API layer)
- ✅ Blockchain execution (Solana operations)
- ✅ Trading client (PumpPortal integration)
- ✅ Holder data (SolanaTracker API)
- ✅ Database integration (MongoDB)
- ✅ Wallet utilities (key management)
- ✅ Token2022 support (auto-detection)
- ✅ Type definitions (TypeScript)

**No external dependencies except:**
- MongoDB database
- Solana RPC endpoint
- SolanaTracker API key (optional)

Ready to deploy and use! 🎉
