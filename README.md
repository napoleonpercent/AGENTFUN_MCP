# AgentFun MCP 🤖⚡

**AI-Powered Autonomous Token Management on Solana**

> Built by [BuildersDAO](https://x.com/buildersdao__) - Empowering the next generation of blockchain automation

<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Solana](https://img.shields.io/badge/Solana-Mainnet-blue)](https://solana.com)
[![MCP](https://img.shields.io/badge/MCP-1.0-green)](https://modelcontextprotocol.org)

</div>

---

## 🌟 What is AgentFun MCP?

**AgentFun MCP** is a production-ready Model Context Protocol (MCP) server that enables AI agents to autonomously manage tokens on Solana's pump.fun platform. Think of it as giving your AI agent a full-featured blockchain toolkit - buybacks, burns, airdrops, and more - all through simple, standardized function calls.

### Why This Matters

Traditional blockchain operations require complex wallet management, transaction building, and error handling. **AgentFun MCP abstracts all of this away**, letting AI agents focus on strategy while we handle the blockchain complexity.

**Result?** AI agents that can execute sophisticated tokenomics strategies in real-time, without human intervention.

---

## 🧠 What is MCP (Model Context Protocol)?

**Model Context Protocol** is an open standard that enables AI models to interact with external tools and data sources in a structured, secure way.

Think of it like this:
- **Without MCP**: AI can only read and write text
- **With MCP**: AI can execute real actions in the real world

**AgentFun MCP** implements this standard for blockchain operations, giving AI agents the power to:
- 💰 Execute trades on Solana DEXs
- 🔥 Burn tokens to manage supply
- 🎁 Distribute rewards to holders
- 💼 Manage treasury operations
- 📊 Query on-chain data

All while maintaining security, auditability, and ease of use.

---

## ✨ Key Features

### 🎯 **6 Core Actions**
Give your AI agent complete token management capabilities:

| Action | What It Does | Use Case |
|--------|--------------|----------|
| **BUYBACK** | Buy tokens with SOL | Support price, build holdings |
| **BURN** | Permanently destroy tokens | Create scarcity, show commitment |
| **AIRDROP_SOL** | Reward holders with SOL | Share profits, build loyalty |
| **AIRDROP_TOKENS** | Distribute tokens to holders | Reward community |
| **TREASURY_SOL** | Fund treasury wallet | Marketing, development, boosts |
| **TREASURY_TOKENS** | Send tokens to treasury | Team allocation, reserves |

### 🪙 **Token2022 Native**
- Auto-detects Token2022 (pump.fun standard)
- Falls back to standard SPL Token when needed
- Handles account creation automatically
- No manual program ID management

### 🔒 **Production-Hardened**
- ✅ All actions tested on Solana mainnet
- ✅ Handles edge cases (off-curve addresses, dust filtering)
- ✅ Proportional holder distributions
- ✅ Transaction retry logic
- ✅ Comprehensive error handling

### ⚡ **Plug & Play Integration**
- REST API endpoints (no MCP client needed)
- Works with any AI system
- Standalone or embedded in your backend
- Full TypeScript typing

---

## 🚀 Quick Start

### Installation

```bash
npm install agentfun-mcp
```

### Basic Setup

```typescript
import express from 'express';
import { mcpRouter } from 'agentfun-mcp';

const app = express();
app.use('/mcp', mcpRouter);
app.listen(8000);

// Your AI agent can now call:
// POST http://localhost:8000/mcp/tools/buyback
```

### Environment Configuration

```bash
# Copy the example
cp env.example .env

# Add your credentials
RPC_ENDPOINT=https://api.mainnet-beta.solana.com/
MONGODB_URI=mongodb://localhost:27017
DB_NAME=agentfun
SOLANATRACKER_API_KEY=your_key_here
```

---

## 📖 How It Works

### The Flow

```
┌─────────────┐
│  AI Agent   │  "I should buy 0.1 SOL of tokens"
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────┐
│  AgentFun MCP                           │
│  ┌─────────────────────────────────┐   │
│  │ 1. Validate action              │   │
│  │ 2. Fetch coin data from DB      │   │
│  │ 3. Call PumpPortal API          │   │
│  │ 4. Sign with agent wallet       │   │
│  │ 5. Submit to Solana             │   │
│  │ 6. Confirm transaction          │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
       │
       ▼
┌─────────────┐
│   Solana    │  Transaction executed ✅
│  Blockchain │
└─────────────┘
```

### Database Schema

Stores token configuration and credentials:

```typescript
{
  mint: "TokenMintAddress",
  name: "My Token",
  symbol: "TKN",
  private_key: "AgentWalletPrivateKey",  // Base58
  treasury_wallet: "TreasuryAddress",
  enabled_actions: {
    buyback: true,
    burn: true,
    airdrop_tokens: true,
    // ... control which actions are allowed
  }
}
```

---

## 💡 Use Cases

### 🤖 Autonomous Token Management
Let AI agents run sophisticated tokenomics strategies:
- Buyback when price dips
- Burn to create scarcity
- Airdrop to reward loyal holders
- Fund treasury for marketing

### 📊 Smart Market Making
AI analyzes on-chain data and executes:
- Dynamic buyback strategies
- Supply management through burns
- Liquidity provisioning

### 🎁 Automated Rewards
Distribute rewards to holders automatically:
- Daily/weekly airdrops
- Proportional to holding size
- No manual transaction signing

### 💼 Treasury Management
AI manages project funds:
- Allocate to development
- Fund marketing campaigns
- DexScreener boost purchases

---

## 🛠️ API Reference

### List Tools

```bash
GET /mcp/tools
```

Returns all available actions with their schemas.

### Execute Action

```bash
POST /mcp/tools/:toolName
Content-Type: application/json

{
  "arguments": {
    "coin_mint": "TokenMintAddress",
    "amount_sol": 0.05
  }
}
```

### Response Format

```json
{
  "success": true,
  "result": {
    "success": true,
    "signatures": ["5cLv48d8Vf7sftgQ8TV51y5..."]
  }
}
```

---

## 🔐 Security

**How We Keep Your Funds Safe:**

- ✅ **Environment Variables** - All secrets in `.env`, never committed
- ✅ **Database Encryption** - Private keys encrypted at rest
- ✅ **Action Validation** - All inputs validated before execution
- ✅ **Permission Control** - Enable/disable actions per token
- ✅ **Transaction Simulation** - Dry-run before submitting
- ✅ **Audit Trail** - Every action logged to database

---

## 📊 Performance

| Action | Time | Cost |
|--------|------|------|
| **Buyback** | 2-5s | Trade fee + gas |
| **Burn** | 2-3s | ~0.00001 SOL gas |
| **Airdrop** | 1-2s per recipient | ~0.00005 SOL per recipient |
| **Treasury** | 2-3s | ~0.00001 SOL gas |

---

## 🎯 Why Choose AgentFun MCP?

### vs. Manual Trading
- ⚡ **10x Faster** - AI executes in seconds, no GUI needed
- 🤖 **24/7 Autonomous** - Never sleeps, never misses an opportunity
- 📊 **Data-Driven** - Decisions based on real-time on-chain data

### vs. Custom Integration
- 🔧 **Plug & Play** - Works out of the box
- 🧪 **Battle-Tested** - Production-hardened on mainnet
- 📚 **Well-Documented** - Clear examples and guides

### vs. Centralized Services
- 🔒 **Self-Hosted** - You control the keys
- 🆓 **Open Source** - Audit the code yourself
- 🔗 **No Lock-In** - Standard MCP protocol

---

## 🏗️ Built by BuildersDAO

**BuildersDAO** is pushing the boundaries of AI and blockchain integration. We believe in:

- 🌍 **Open Source** - Knowledge should be shared
- 🤝 **Community** - Built by builders, for builders
- 🚀 **Innovation** - Exploring the frontier of AI x Crypto

### Our Mission
Empower developers to build the next generation of autonomous blockchain applications through open standards and production-ready tools.

**Join us:** [buildersdao.org](https://buildersdao.org)

---

## 📚 Documentation

- [Installation Guide](./docs/INSTALLATION.md)
- [API Reference](./docs/API.md)
- [Security Best Practices](./docs/SECURITY.md)
- [Examples & Tutorials](./docs/EXAMPLES.md)

---

## 🤝 Contributing

We welcome contributions! Whether it's:
- 🐛 Bug fixes
- ✨ New features
- 📖 Documentation improvements
- 💡 Ideas and suggestions

**How to contribute:**
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

---

## 📄 License

MIT License - see [LICENSE](./LICENSE) file for details.

**Free to use for:**
- Commercial projects
- Personal projects
- Research and education
- Anything you want!

---

## 🙏 Acknowledgments

- **Solana Foundation** - For the amazing blockchain
- **pump.fun** - For the memecoin launch platform
- **MCP Community** - For the open standard
- **SolanaTracker** - For holder data API
- **All Contributors** - Thank you! 🎉

---

## 💬 Community & Support

- **Twitter**: [@BuildersDAO](https://twitter.com/BuildersDAO)
- **Discord**: [Join our community](https://discord.gg/buildersdao)
- **GitHub Issues**: [Report bugs or request features](https://github.com/buildersdao/agentfun-mcp/issues)
- **Email**: support@buildersdao.org

---

## 🎯 What's Next?

We're just getting started! Coming soon:

- 🔄 **Batch Operations** - Execute multiple actions in one call
- 📈 **Analytics Dashboard** - Visualize agent performance
- 🌉 **Cross-Chain Support** - Expand beyond Solana
- 🤖 **Pre-Built Strategies** - Drop-in AI agent templates
- 🔌 **More Integrations** - Raydium, Orca, Jupiter

**Star the repo** to follow our progress! ⭐

---

<div align="center">

**Built with ❤️ by BuildersDAO**

[Website](https://buildersdao.org) • [Twitter](https://twitter.com/BuildersDAO) • [Discord](https://discord.gg/buildersdao) • [GitHub](https://github.com/buildersdao)

</div>
