# 🦞 mx-openclaw-template-solution

> **One Command. Live OpenClaw Agent on MultiversX.** — Fork, launch, earn.

A production-ready template that deploys a fully functioning [OpenClaw](https://github.com/openclaw/openclaw) agent with MultiversX blockchain payments — all from your laptop, running on a VPS.

---

## ⚡ One-Command Launch

```bash
git clone https://github.com/sasurobert/mx-openclaw-template-solution my-agent
cd my-agent
npm run launch
```

That's it. The script runs locally on your laptop, then installs **everything** on your VPS:

```
Step  0:  🦞  Install OpenClaw platform + MultiversX skills (on VPS)
Step  1:  📛  Name your agent, pick your LLM, enter API key
Step  2:  🔐  Generate wallet + write all configs
Step  3:  📦  Install dependencies
Step  4:  💰  Fund wallet (devnet faucet)
Step  5:  📝  Register agent on MultiversX blockchain
Step  6:  🏗️   Build manifest + mint identity NFT
Step  7:  ✅  Build TypeScript + run tests
Step  8:  🔒  Provision VPS (harden + Docker + firewall)
Step  9:  🚀  Deploy FULL agent to VPS (OpenClaw + skills + backend)
Step 10:  🏥  Verify — health check from your laptop
```

**Result:** Your OpenClaw agent is live on the VPS — accepting chat, processing jobs, earning USDC.

> **Local only?** Use `npm run launch:local` to skip VPS and run on your machine.

---

## 🏗️ Architecture (3-Layer Stack)

```
┌──────────────────────────────────────────────────────────────────────┐
│  YOUR VPS (everything runs here)                                    │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  Layer 1: OpenClaw Platform (openclaw/openclaw)               │ │
│  │  • Gateway daemon (ws://127.0.0.1:18789)                      │ │
│  │  • Channels (WhatsApp, Telegram, Discord, WebChat...)         │ │
│  │  • Memory, tools, A2A, gateway auth                           │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                              ↕                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  Layer 2: MultiversX Skills (multiversx-openclaw-skills)      │ │
│  │  • SKILL.md — agent instructions                              │ │
│  │  • moltbot-starter-kit — 14+ blockchain skills                │ │
│  │  • Identity, Payments, Escrow, Reputation, Discovery          │ │
│  │  • Installed at: ~/.openclaw/workspace/.agent/skills/          │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                              ↕                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  Layer 3: Your Agent (this template)                          │ │
│  │  • Express API (x402 payments, chat, sessions)                │ │
│  │  • Next.js frontend (chat UI, landing page)                   │ │
│  │  • Custom tools (override BaseAgent)                          │ │
│  │  • LLM integration (OpenAI / Anthropic / Google)              │ │
│  └────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
                              ↑
                     SSH/SCP from laptop
                     (launch.sh = control plane)
```

| Layer | Component | Source |
|:---|:---|:---|
| Platform | OpenClaw Gateway + runtime | `npm install -g openclaw@latest` |
| Skills | SKILL.md + references + moltbot-starter-kit | `sasurobert/multiversx-openclaw-skills` (official installer) |
| Agent | Backend API + Frontend + custom logic | This template |

---

## 🧠 After Launch: Focus on YOUR Agent

After `npm run launch`, the only file you touch:

```typescript
// backend/src/agent/your-agent.ts
import { BaseAgent, Tool } from './base-agent';

export class MarketResearchAgent extends BaseAgent {
    getSystemPrompt(): string {
        return 'You are an expert market researcher...';
    }

    getTools(): Tool[] {
        return [
            { name: 'search_web', description: 'Search the web', parameters: {}, execute: async (args) => '...' },
        ];
    }
}
```

Push your changes → CI/CD auto-deploys. Done.

---

## 📁 Project Structure

```
mx-openclaw-template-solution/
├── launch.sh                   ← ⭐ ONE COMMAND: laptop → live VPS agent
├── backend/
│   ├── src/
│   │   ├── server.ts           ← Express API: chat, upload, health
│   │   ├── agent/              ← BaseAgent (override for custom tools)
│   │   ├── llm/                ← LlmService (OpenAI / Anthropic / Google)
│   │   ├── routes/             ← Agent-Native API (capabilities, sessions)
│   │   ├── session/            ← In-memory + SQLite persistent store
│   │   ├── mx/                 ← MultiversX SDK (facilitator, validator, skills)
│   │   ├── cron/               ← Proactive task scheduler
│   │   └── mcp/                ← MCP server connection
│   └── Dockerfile
├── frontend/
│   ├── app/                    ← Next.js chat + landing page
│   ├── hooks/                  ← useChat, usePayment
│   └── services/               ← Typed API client
├── scripts/                    ← CLI lifecycle (setup, register, fund)
├── infra/
│   ├── provision.sh            ← VPS hardening (UFW, Fail2Ban, Docker)
│   ├── remote-setup.sh         ← ⭐ Runs ON THE VPS (installs everything)
│   ├── deploy.sh               ← Docker deploy
│   └── Caddyfile               ← Auto-HTTPS reverse proxy
├── .github/workflows/          ← CI + auto-deploy
└── docker-compose.yml          ← Full-stack orchestration
```

### What runs on the VPS (installed by `remote-setup.sh`)

```
~/.openclaw/                             ← OpenClaw home (created by onboard)
├── openclaw.json                        ← Model config (your LLM choice)
└── workspace/
    └── .agent/skills/multiversx/        ← MultiversX skills (official installer)
        ├── SKILL.md                     ← Agent instructions
        ├── references/                  ← Contract docs (identity, escrow, x402...)
        └── moltbot-starter-kit/         ← Implementation (14+ skills, scripts)

/opt/openclaw-agent/                     ← Your agent (cloned from this template)
├── .env                                 ← Config (SCP'd from your laptop)
├── wallet.pem                           ← Identity (SCP'd from your laptop)
├── backend/                             ← Express API server
└── frontend/                            ← Next.js UI
```

---

## 📋 All Commands

| Command | Description |
|:---|:---|
| **`npm run launch`** | **⭐ Laptop → live OpenClaw agent on VPS** |
| `npm run launch:local` | Install + run everything locally (no VPS) |
| `npm run setup` | Interactive setup wizard (config only) |
| `npm run dev` | Local dev servers (backend :4000 + frontend :3000) |
| `npm run register` | Register agent on MultiversX |
| `npm run fund` | Get devnet faucet tokens |
| `npm run balance` | Check wallet balance |
| `npm run provision -- root@IP` | Harden a VPS |
| `npm run deploy -- user@IP domain` | Deploy to VPS |

---

## 🔧 Configuration

| Variable | Default | Description |
|:---|:---|:---|
| `LLM_API_KEY` | — | Your LLM provider API key |
| `LLM_PROVIDER` | `openai` | `openai`, `anthropic`, or `google` |
| `LLM_MODEL` | `gpt-4o` | Model name |
| `PRICE_PER_QUERY` | `0.50` | Price in USDC per query |
| `AGENT_NAME` | `my-openclaw-bot` | On-chain agent name |
| `MULTIVERSX_CHAIN_ID` | `D` | `D` for devnet, `1` for mainnet |

See `.env.example` for the full list.

---

## 🔒 Security

- **Non-root Docker** containers
- **UFW firewall** (SSH + HTTP/S + Gateway)
- **Fail2Ban** brute-force protection
- **SSH key-only** auth (passwords disabled)
- **Caddy auto-SSL** (Let's Encrypt)
- **Secrets isolation** — `.env` and `wallet.pem` never committed
- **Zero-leak model** — `.env.example` (docs) → GitHub Secrets (CI) → VPS `.env` (runtime)
- **Rate limiting** + Helmet + CORS on all API endpoints

---

## 🔄 Push-to-Deploy (CI/CD)

After initial launch, every `git push` triggers:

```
Push → Lint → Test (≥80% coverage) → Deploy (frontend + backend)
```

---

## 🧪 Testing

```bash
cd backend && npm test              # 98 tests, 8 suites
cd backend && npm run lint          # 0 errors
cd backend && npm run test:coverage # 81.4% line coverage
```

---

## 📜 License

MIT — Built with ❤️ on MultiversX + OpenClaw
