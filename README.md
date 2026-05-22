# ArcBalance 🧠⚡

**Autonomous AI portfolio manager on Arc** — detects market regimes, rebalances USDC allocations, and parks idle capital in USYC. Built for the [Agora Agents Hackathon](https://agora.thecanteenapp.com) by Canteen × Circle × Arc.

## What it does

ArcBalance is an AI agent that:
1. **Detects market regimes** (Bull / Bear / Sideways / High Volatility) from live price data
2. **Reasons through allocations** using Claude, exposing the full reasoning trace as the product
3. **Queues rebalancing trades** to shift between BTC, ETH, SOL, LINK, and USYC
4. **Parks idle capital in USYC** (tokenized money market fund) during bearish/volatile regimes
5. **Settles on Arc** — sub-second finality, ~$0.01/tx in USDC via Circle Paymaster

## Why Arc?

- ~$0.01/tx makes frequent rebalancing economical (on Ethereum this would cost $10–$50 per trade)
- Sub-second deterministic finality means regime changes trigger near-instant settlement
- USDC-native: no volatile gas tokens, all fees and positions in stable dollars
- USYC: yield-bearing idle capital between trades

## Stack

- **Next.js 14** (App Router)
- **Claude claude-sonnet-4** — regime detection + reasoning traces
- **Viem** — Arc testnet wallet + contract calls
- **CoinGecko API** — live price feeds
- **Recharts** — portfolio visualization
- **Circle Gateway** (planned) — cross-chain balance unification

## Setup

### 1. Clone and install

```bash
git clone https://github.com/YOUR_HANDLE/arcbalance
cd arcbalance
npm install
```

### 2. Install Arc CLI and get your RPC key

```bash
uv tool install git+https://github.com/the-canteen-dev/ARC-cli.git
arc-canteen login
arc-canteen rpc-url   # copy this URL
```

### 3. Configure environment

```bash
cp .env.example .env.local
# Fill in:
#   ARC_RPC_URL — from arc-canteen rpc-url
#   ANTHROPIC_API_KEY — from console.anthropic.com
#   AGENT_PRIVATE_KEY — a testnet-only wallet private key
```

### 4. Run locally

```bash
npm run dev
# Open http://localhost:3000
```

### 5. Deploy to Vercel

```bash
npx vercel --prod
# Add env vars in Vercel dashboard
```

## Circle / Arc Tools Used

| Tool | Usage |
|------|-------|
| **USDC** | Base currency for all portfolio positions |
| **USYC** | Idle capital yield — allocated % rises in Bear/High-Volatility regimes |
| **Arc Testnet** | Settlement layer — all rebalances settle here |
| **Paymaster** | All transaction fees in USDC (no volatile gas) |
| **Gateway** | (Day 3) Cross-chain balance unification |
| **Wallets** | Embedded agent wallet for autonomous execution |

## Judging criteria alignment

- **Agentic Sophistication (30%)**: Claude reasons through regime detection, not just rule-based automation. The reasoning trace is exposed as the primary product.
- **Circle tool usage (20%)**: USDC, USYC, Paymaster, Arc testnet, Gateway.
- **Innovation (20%)**: Reasoning traces as a tradable/publishable product; USYC as the risk-off instrument.
- **Traction (30%)**: Share the live link, collect users, report in the submission form.

## Hackathon

Built for [Agora Agents Hackathon](https://agora.thecanteenapp.com) · May 11–25, 2025
