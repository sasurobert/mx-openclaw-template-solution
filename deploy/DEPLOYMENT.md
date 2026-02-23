# 🚀 Deployment Guide

This template includes **optional, configurable CI/CD** that works out of the box — or can be easily swapped for any platform.

## Architecture

```
.github/workflows/
├── ci.yml                  ← ALWAYS runs: lint, test, audit
├── deploy-frontend.yml     ← OPTIONAL: Vercel (swap for Netlify, Cloudflare, etc.)
└── deploy-backend.yml      ← OPTIONAL: VPS via SSH (swap for Cloud Run, Fly.io, etc.)

deploy/
└── Caddyfile               ← OPTIONAL: auto-HTTPS reverse proxy (swap for nginx, traefik)

backend/
├── Dockerfile              ← Multi-stage build, works anywhere Docker runs
└── eslint.config.js        ← ESLint flat config (v9+)

docker-compose.yml          ← OPTIONAL: full-stack local/VPS orchestration
.env.example                ← Documentation of all config variables
```

## Quick Start (4 commands to deploy)

```bash
# 1. Fork the template
gh repo fork multiversx/mx-openclaw-template-solution

# 2. Set secrets (only the ones you need for YOUR deployment)
gh secret set LLM_API_KEY --body "sk-..."
gh secret set WALLET_PEM < wallet.pem

# For VPS deploy (optional):
gh secret set VPS_SSH_KEY < ~/.ssh/id_ed25519
gh secret set VPS_HOST --body "203.0.113.42"

# For Vercel deploy (optional):
gh secret set VERCEL_TOKEN --body "vercel_xxxx"
gh secret set VERCEL_ORG_ID --body "team_xxxx"
gh secret set VERCEL_PROJECT_ID --body "prj_xxxx"

# 3. Push → everything deploys automatically
git push origin main
```

## Want to Deploy Somewhere Else?

### Frontend Alternatives

Edit `.github/workflows/deploy-frontend.yml` — replace the Deploy step:

| Platform | Replace with |
|:---|:---|
| **Netlify** | `npx netlify-cli deploy --prod --dir=frontend/dist` |
| **Cloudflare Pages** | `npx wrangler pages deploy frontend/dist` |
| **AWS S3 + CloudFront** | `aws s3 sync frontend/dist s3://bucket --delete` |
| **Firebase Hosting** | `npx firebase-tools deploy --only hosting` |
| **GitHub Pages** | Use `peaceiris/actions-gh-pages@v3` action |

### Backend Alternatives

Edit `.github/workflows/deploy-backend.yml` — replace the SSH deploy steps:

| Platform | Replace with |
|:---|:---|
| **Google Cloud Run** | `gcloud run deploy agent --source ./backend --region us-central1` |
| **Fly.io** | `flyctl deploy --config backend/fly.toml` |
| **Railway** | `npx @railway/cli deploy --service backend` |
| **Render** | `curl -X POST $RENDER_DEPLOY_HOOK_URL` |
| **AWS ECS** | `aws ecs update-service --cluster $CLUSTER --service $SVC` |
| **DigitalOcean App Platform** | `doctl apps create-deployment $APP_ID` |

### Don't Want CI/CD at All?

Just delete the `.github/workflows/` directory. The template works perfectly for local development without any CI/CD.

## Secrets Model (Zero Leakage)

```
Layer 1: .env.example      ← Committed to Git, documentation only
Layer 2: GitHub Secrets     ← Encrypted, injected at deploy time
Layer 3: VPS .env           ← Generated on first deploy, never leaves the server
```

**Critical rule:** `.env`, `wallet.pem`, and `*.db` are in `.gitignore`. They can never be committed.

### Environment Variables

| Variable | Where to set | Required? |
|:---|:---|:---|
| `AGENT_NAME` | `.env` | Yes |
| `AGENT_WALLET_ADDRESS` | `.env` | Yes |
| `MULTIVERSX_API_URL` | `.env` | Yes |
| `LLM_API_KEY` | GitHub Secret | Yes (for LLM features) |
| `WALLET_PEM` | GitHub Secret | Yes (for signing) |
| `VPS_SSH_KEY` | GitHub Secret | Only if VPS deploy |
| `VPS_HOST` | GitHub Secret | Only if VPS deploy |
| `VERCEL_TOKEN` | GitHub Secret | Only if Vercel deploy |

## Local Development

```bash
cd backend
cp ../.env.example ../.env  # Fill in your values
npm install
npm run dev                 # Starts on port 4000
```

## Docker (Local or VPS)

```bash
cp .env.example .env        # Fill in your values
docker compose up -d        # Starts backend + frontend + Caddy
docker compose ps           # Verify all services healthy
docker compose logs -f      # Tail logs
```

## What Happens on `git push`

| Step | Workflow | Time |
|:---|:---|:---|
| 1. Lint + Type Check | `ci.yml` | ~10s |
| 2. Test (≥80% coverage) | `ci.yml` | ~15s |
| 3. Security Audit | `ci.yml` | ~5s |
| 4. Deploy Frontend | `deploy-frontend.yml` | ~40s |
| 5. Deploy Backend | `deploy-backend.yml` | ~50s |
| 6. Health Check | `deploy-backend.yml` | ~5s |

**Total: ~2 minutes from push to live.** Deploy is blocked if tests fail.
