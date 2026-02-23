# 🚀 Deployment Guide

## The Fastest Way: One Command

```bash
npm run launch
```

This runs on your **laptop** and deploys the full OpenClaw agent to your **VPS**. You answer a few prompts (agent name, LLM key, VPS IP) and the script handles everything.

> **Local only?** Use `npm run launch:local` to install + run on your machine.

---

## How It Works: Remote-First Deployment

```
YOUR LAPTOP (launch.sh)                YOUR VPS (remote-setup.sh)
─────────────────────────              ──────────────────────────────
Step 0:  Check OpenClaw version        
Step 1:  Collect keys (LLM, name)      
Step 2:  Generate wallet + config
Step 3:  Install local deps
Step 4:  Fund wallet (devnet)
Step 5:  Register agent on-chain
Step 6:  Build manifest + mint NFT
Step 7:  Build + test locally
Step 8:  Provision VPS (SSH harden)
                                       ┌─────────────────────────────┐
Step 9:  SCP config files ──────────►  │ remote-setup.sh runs:       │
         • .env                        │  1. Install Node.js 22+     │
         • wallet.pem                  │  2. npm install -g openclaw │
         • agent.config.json           │  3. openclaw onboard        │
         • remote-setup.sh             │  4. Official skills install │
                                       │  5. Clone template + deps   │
                                       │  6. Configure + start all   │
Step 10: Verify (curl + SSH) ◄─────── └─────────────────────────────┘
```

### What gets installed on the VPS

| Component | How | Where |
|:---|:---|:---|
| **OpenClaw platform** | `npm install -g openclaw@latest` | Global |
| **OpenClaw Gateway** | `openclaw onboard --install-daemon` | `~/.openclaw/` |
| **MultiversX Skills** | Official `install.sh` (run from workspace) | `~/.openclaw/workspace/.agent/skills/multiversx/` |
| **moltbot-starter-kit** | Cloned by the skills installer | `~/.openclaw/workspace/.agent/skills/multiversx/moltbot-starter-kit/` |
| **This template** | `git clone` from GitHub | `/opt/openclaw-agent/` |
| **Config** | SCP'd from your laptop | `/opt/openclaw-agent/.env` + `wallet.pem` |

### What runs on the VPS after deployment

| Process | Port | Purpose |
|:---|:---|:---|
| OpenClaw Gateway | 18789 | AI agent runtime (channels, memory, tools) |
| Backend API | 4000 | Express server (chat, x402, sessions) |
| Caddy | 80/443 | HTTPS reverse proxy (auto-SSL) |

---

## What `launch.sh` Does Under the Hood

```
launch.sh (on your laptop)
  ├── Step 0: Version checks (OpenClaw, skills, template)
  ├── Step 1: interactive prompts → collect LLM_API_KEY, AGENT_NAME, VPS info
  ├── Step 2: scripts/generate_wallet.ts → wallet.pem
  │           writes .env + agent.config.json + moltbot .env + openclaw.json
  ├── Step 3: npm ci (backend + frontend)
  ├── Step 4: scripts/fund.ts → devnet faucet
  ├── Step 5: scripts/register.ts → on-chain identity
  ├── Step 6: scripts/build_manifest.ts → OASF manifest
  ├── Step 7: tsc + jest → build + verify
  ├── Step 8: infra/provision.sh → VPS hardening
  ├── Step 9: scp + ssh → infra/remote-setup.sh (runs on VPS)
  └── Step 10: curl + ssh → verify health
```

---

## Manual Step-by-Step

```bash
# 1. Config
npm run setup               # Interactive wizard

# 2. Fund + Register
npm run fund                # Devnet faucet
npm run register            # On-chain identity

# 3. Local dev
npm run launch:local        # Full local setup with OpenClaw
# OR
npm run dev                 # Just backend + frontend (no OpenClaw)

# 4. VPS deploy
npm run provision -- root@YOUR_VPS_IP
npm run deploy -- moltbot@YOUR_VPS_IP yourdomain.com
```

---

## Infrastructure Files

```
infra/
├── provision.sh            ← Hardens Ubuntu VPS (UFW, Fail2Ban, Docker)
├── remote-setup.sh         ← ⭐ Runs ON VPS: installs OpenClaw + skills + template
├── deploy.sh               ← Docker compose deploy
├── destroy.sh              ← Teardown
├── logs.sh                 ← Tail logs
├── docker-compose.yml      ← VPS-specific compose
└── Caddyfile               ← Auto-HTTPS reverse proxy

.github/workflows/
├── ci.yml                  ← ALWAYS: lint → test (≥80%) → audit
├── deploy-frontend.yml     ← OPTIONAL: Vercel (swappable)
└── deploy-backend.yml      ← OPTIONAL: VPS via SSH (swappable)
```

---

## Secrets: Zero-Leak Model

```
Layer 1: .env.example       ← Committed (documentation only)
Layer 2: GitHub Secrets      ← Encrypted (CI/CD injection)
Layer 3: VPS .env            ← SCP'd from laptop on deploy, never committed
```

| Secret | Where | Required? |
|:---|:---|:---|
| `LLM_API_KEY` | GitHub Secret or `.env` | Yes |
| `WALLET_PEM` | GitHub Secret or `wallet.pem` | Yes |
| `VPS_SSH_KEY` | GitHub Secret | Only for CI→VPS deploy |
| `VPS_HOST` | GitHub Secret | Only for CI→VPS deploy |
| `VERCEL_TOKEN` | GitHub Secret | Only for Vercel deploy |

---

## VPS Security (What `provision.sh` Does)

| Action | What |
|:---|:---|
| System updates | `apt-get update && upgrade` |
| Non-root user | Creates `moltbot` with sudo |
| SSH hardening | Key-only auth, root login disabled |
| Firewall | UFW: ports 22, 80, 443, 18789 |
| Brute-force | Fail2Ban active |
| Docker | Docker + Docker Compose plugin |
| Auto-updates | `unattended-upgrades` enabled |

---

## Want a Different Provider?

### Frontend Alternatives

| Platform | Deploy command |
|:---|:---|
| **Netlify** | `npx netlify-cli deploy --prod --dir=frontend/dist` |
| **Cloudflare Pages** | `npx wrangler pages deploy frontend/dist` |
| **AWS S3** | `aws s3 sync frontend/dist s3://bucket --delete` |

### Backend Alternatives

| Platform | Deploy command |
|:---|:---|
| **Google Cloud Run** | `gcloud run deploy agent --source ./backend` |
| **Fly.io** | `flyctl deploy --config backend/fly.toml` |
| **Railway** | `npx @railway/cli deploy --service backend` |

### Don't Want CI/CD?

Delete `.github/workflows/`. The template works fine without it.
