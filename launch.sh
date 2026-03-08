#!/bin/bash
set -euo pipefail

# ╔═══════════════════════════════════════════════════════════════════════════════╗
# ║                                                                             ║
# ║   🚀  OpenClaw — Zero to Live Agent in One Script                          ║
# ║                                                                             ║
# ║   This script takes you from a fresh repository clone to a fully            ║
# ║   running, secured, on-chain-registered AI agent.                           ║
# ║                                                                             ║
# ║   Usage:  ./launch.sh                                                      ║
# ║   Usage:  ./launch.sh --local     (skip VPS, run locally only)             ║
# ║                                                                             ║
# ║   What it does:                                                             ║
# ║   ┌─ Step 0: Pull latest OpenClaw release (always up to date)              ║
# ║   ├─ Step 1: Collect your keys (interactive prompts)                       ║
# ║   ├─ Step 2: Generate wallet + config                                      ║
# ║   ├─ Step 3: Install dependencies                                         ║
# ║   ├─ Step 4: Fund wallet (devnet only)                                     ║
# ║   ├─ Step 5: Register agent on-chain                                       ║
# ║   ├─ Step 6: Build manifest + mint OASF identity                          ║
# ║   ├─ Step 7: Build and verify (tsc + tests)                               ║
# ║   ├─ Step 8: Provision VPS (harden, Docker, firewall)                      ║
# ║   ├─ Step 9: Deploy to VPS                                                ║
# ║   └─ Step 10: Verify everything works                                     ║
# ║                                                                             ║
# ║   After this script, you only focus on YOUR agent's skills.                ║
# ║                                                                             ║
# ╚═══════════════════════════════════════════════════════════════════════════════╝

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOCAL_ONLY=false
if [ "${1:-}" = "--local" ]; then LOCAL_ONLY=true; fi

# Colors
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

step() { echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; echo -e "${BOLD}${GREEN}  ✦ Step $1${NC}: $2"; echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"; }
ok()   { echo -e "  ${GREEN}✅ $1${NC}"; }
info() { echo -e "  ${BLUE}ℹ️  $1${NC}"; }
warn() { echo -e "  ${YELLOW}⚠️  $1${NC}"; }
fail() { echo -e "  ${RED}❌ $1${NC}"; exit 1; }

# ── Official repo coordinates ───────────────────────────────────────────
OPENCLAW_SKILLS_REPO="sasurobert/multiversx-openclaw-skills"
OPENCLAW_TEMPLATE_REPO="sasurobert/mx-openclaw-template-solution"
OPENCLAW_BRANCH="master"
OPENCLAW_HOME="${HOME}/.openclaw"
OPENCLAW_WORKSPACE="${OPENCLAW_HOME}/workspace"
SKILLS_INSTALL_URL="https://raw.githubusercontent.com/${OPENCLAW_SKILLS_REPO}/refs/heads/${OPENCLAW_BRANCH}/scripts/install.sh"

# ══════════════════════════════════════════════════════════════════════════════
# STEP 0: Install OpenClaw Platform + MultiversX Agent Skills
#   → When --local: installs everything on this machine
#   → When deploying to VPS: skips local install (remote-setup.sh does it)
# ══════════════════════════════════════════════════════════════════════════════
step "0/10" "Install OpenClaw Platform + MultiversX Agent Skills"

cd "$ROOT_DIR"

# ── 0a: Install or update the official OpenClaw platform ────────────────────
echo -e "  ${BOLD}[0a] OpenClaw platform...${NC}"

if command -v openclaw &>/dev/null; then
  CURRENT_OC=$(openclaw --version 2>/dev/null || echo "unknown")
  info "OpenClaw installed: $CURRENT_OC"

  LATEST_OC=$(curl -sf "https://api.github.com/repos/openclaw/openclaw/releases/latest" 2>/dev/null \
    | grep -o '"tag_name":"[^"]*"' | cut -d'"' -f4 || echo "")
  if [ -n "$LATEST_OC" ] && [ "$LATEST_OC" != "v$CURRENT_OC" ]; then
    warn "OpenClaw update available: $CURRENT_OC → $LATEST_OC"
    read -p "  Update now? [Y/n]: " UPDATE_OC
    if [ "${UPDATE_OC:-Y}" != "n" ] && [ "${UPDATE_OC:-Y}" != "N" ]; then
      npm install -g openclaw@latest && ok "OpenClaw updated" || warn "Update failed — continuing"
    fi
  else
    ok "OpenClaw is up to date"
  fi
else
  echo -e "  Installing OpenClaw (npm install -g openclaw@latest)..."
  npm install -g openclaw@latest && ok "OpenClaw installed" || fail "Could not install OpenClaw. Requires Node ≥22."
fi

# ── 0b: Onboard OpenClaw Gateway ───────────────────────────────────────────
echo -e "  ${BOLD}[0b] OpenClaw Gateway daemon...${NC}"

if [ ! -d "$OPENCLAW_HOME" ]; then
  echo -e "  Running first-time onboarding..."
  openclaw onboard --install-daemon 2>&1 && ok "Gateway onboarded" || warn "Onboarding incomplete — run 'openclaw onboard' manually"
else
  info "OpenClaw home: $OPENCLAW_HOME"
  openclaw doctor 2>/dev/null && ok "openclaw doctor: healthy" || warn "Issues detected — run 'openclaw doctor'"
fi

mkdir -p "${OPENCLAW_WORKSPACE}/skills"
ok "Workspace: $OPENCLAW_WORKSPACE"

# ── 0c: Install MultiversX skills (official installer) ─────────────────────
#   This downloads SKILL.md + reference docs + clones moltbot-starter-kit
#   into .agent/skills/multiversx/ (relative to CWD)
#   We run it from the workspace so everything lands in the right place.
echo -e "  ${BOLD}[0c] MultiversX OpenClaw Skills + moltbot-starter-kit...${NC}"

cd "$OPENCLAW_WORKSPACE"
curl -sL "$SKILLS_INSTALL_URL" | bash \
  && ok "Skills installed → ${OPENCLAW_WORKSPACE}/.agent/skills/multiversx/" \
  || warn "Skills install failed — run manually: curl -sL $SKILLS_INSTALL_URL | bash"
cd "$ROOT_DIR"

# Convenience symlink so the project can reference the installed kit
MOLTBOT_KIT="${OPENCLAW_WORKSPACE}/.agent/skills/multiversx/moltbot-starter-kit"
if [ -d "$MOLTBOT_KIT" ] && [ ! -L "$ROOT_DIR/.moltbot" ]; then
  ln -sfn "$MOLTBOT_KIT" "$ROOT_DIR/.moltbot"
  ok "Symlink: .moltbot → moltbot-starter-kit"
fi

# ── 0d: Configure moltbot-starter-kit .env ─────────────────────────────────
#   The starter kit needs its own .env with contract addresses and wallet path.
#   We'll write this AFTER Step 1 (key collection), but prepare the path now.
echo -e "  ${BOLD}[0d] Checking moltbot-starter-kit config...${NC}"

if [ -d "$MOLTBOT_KIT" ]; then
  ok "moltbot-starter-kit found at: $MOLTBOT_KIT"
else
  warn "moltbot-starter-kit not found — some skills may not work. Install manually."
fi

# ── 0e: Check for template updates ────────────────────────────────────────
echo -e "  ${BOLD}[0e] Template version check...${NC}"

LATEST_TAG=$(curl -sf "https://api.github.com/repos/${OPENCLAW_TEMPLATE_REPO}/tags" 2>/dev/null \
  | grep -o '"name":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "")
LOCAL_VERSION=$(grep '"version"' package.json 2>/dev/null | head -1 | grep -o '"[0-9][^"]*"' | tr -d '"' || echo "1.0.0")

if [ -n "$LATEST_TAG" ] && [ "$LATEST_TAG" != "v$LOCAL_VERSION" ] && [ "$LATEST_TAG" != "$LOCAL_VERSION" ]; then
  warn "Template update: $LOCAL_VERSION → $LATEST_TAG"
  echo "     https://github.com/${OPENCLAW_TEMPLATE_REPO}/releases/tag/$LATEST_TAG"
else
  ok "Template up to date (v$LOCAL_VERSION)"
fi

echo ""
ok "OpenClaw platform + MultiversX skills ready"

# ══════════════════════════════════════════════════════════════════════════════
# STEP 1: Collect keys and configuration
# ══════════════════════════════════════════════════════════════════════════════
step "1/10" "Collect your keys (the ONLY thing you need to provide)"

echo -e "${BOLD}  Your Agent${NC}"
read -p "  📛 Agent name (e.g., crypto-researcher): " AGENT_NAME
AGENT_NAME="${AGENT_NAME:-my-openclaw-bot}"

read -p "  📝 Description: " AGENT_DESC
AGENT_DESC="${AGENT_DESC:-A MultiversX-powered AI agent}"

read -p "  💰 Price per query in USDC (e.g., 0.50): " PRICE
PRICE="${PRICE:-0.50}"

echo ""
echo -e "${BOLD}  LLM Provider${NC}"
echo "   1) OpenAI (gpt-4o)"
echo "   2) Anthropic (claude-sonnet)"
echo "   3) Google (gemini-2.5-pro)"
read -p "   Choose [1-3]: " LLM_CHOICE

case "${LLM_CHOICE:-1}" in
  1) LLM_PROVIDER="openai"; LLM_MODEL="gpt-4o" ;;
  2) LLM_PROVIDER="anthropic"; LLM_MODEL="claude-sonnet-4-20250514" ;;
  3) LLM_PROVIDER="google"; LLM_MODEL="gemini-2.5-pro" ;;
  *) LLM_PROVIDER="openai"; LLM_MODEL="gpt-4o" ;;
esac

read -sp "  🔑 $LLM_PROVIDER API Key: " LLM_API_KEY
echo ""
[ -z "$LLM_API_KEY" ] && fail "LLM API key is required"

echo ""
echo -e "${BOLD}  Network${NC}"
echo "   1) Devnet (testing — recommended for first launch)"
echo "   2) Mainnet (production — real money)"
read -p "   Choose [1-2]: " NET_CHOICE

case "${NET_CHOICE:-1}" in
  1) CHAIN_ID="D"; API_URL="https://devnet-api.multiversx.com"; EXPLORER="https://devnet-explorer.multiversx.com"; NETWORK="devnet" ;;
  2) CHAIN_ID="1"; API_URL="https://api.multiversx.com"; EXPLORER="https://explorer.multiversx.com"; NETWORK="mainnet" ;;
  *) CHAIN_ID="D"; API_URL="https://devnet-api.multiversx.com"; EXPLORER="https://devnet-explorer.multiversx.com"; NETWORK="devnet" ;;
esac

# VPS details (skip if --local)
VPS_HOST=""; VPS_USER=""; DOMAIN=""
if [ "$LOCAL_ONLY" = false ]; then
  echo ""
  echo -e "${BOLD}  VPS Deployment${NC}"
  read -p "  🖥️  VPS IP address (or press Enter to skip VPS): " VPS_HOST
  if [ -n "$VPS_HOST" ]; then
    read -p "  👤 VPS SSH user (default: root): " VPS_USER
    VPS_USER="${VPS_USER:-root}"
    read -p "  🌐 Domain name (e.g., research.mybot.com): " DOMAIN
    [ -z "$DOMAIN" ] && DOMAIN="$AGENT_NAME.example.com"
  fi
fi

ok "Keys collected — moving on"

# ══════════════════════════════════════════════════════════════════════════════
# STEP 2: Generate wallet + write .env + agent.config.json
# ══════════════════════════════════════════════════════════════════════════════
step "2/10" "Generate wallet and configuration"

cd "$ROOT_DIR"

# Generate wallet
if [ ! -f wallet.pem ]; then
  npx ts-node scripts/generate_wallet.ts
  ok "wallet.pem generated"
else
  info "wallet.pem already exists"
fi

# Extract wallet address
WALLET_ADDRESS=$(grep -oE 'erd1[a-z0-9]+' wallet.pem | head -1 || echo "erd1...")

# Write .env
cat > .env << EOF
# Generated by launch.sh — $(date)
MULTIVERSX_CHAIN_ID=$CHAIN_ID
MULTIVERSX_API_URL=$API_URL
MULTIVERSX_EXPLORER_URL=$EXPLORER
MULTIVERSX_PRIVATE_KEY=./wallet.pem

IDENTITY_REGISTRY_ADDRESS=erd1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq6gq4hu
VALIDATION_REGISTRY_ADDRESS=erd1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq6gq4hu
REPUTATION_REGISTRY_ADDRESS=erd1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq6gq4hu
ESCROW_CONTRACT_ADDRESS=erd1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq6gq4hu

X402_FACILITATOR_URL=http://localhost:4000
MULTIVERSX_RELAYER_URL=http://localhost:3001
MULTIVERSX_MCP_URL=http://localhost:3000

AGENT_NAME=$AGENT_NAME
AGENT_WALLET_ADDRESS=$WALLET_ADDRESS
AGENT_URI=https://${DOMAIN:-$AGENT_NAME.example.com}

LLM_PROVIDER=$LLM_PROVIDER
LLM_API_KEY=$LLM_API_KEY
LLM_MODEL=$LLM_MODEL

PRICE_PER_QUERY=$PRICE
PRICE_TOKEN=USDC-350c4e

BACKEND_PORT=4000
FRONTEND_PORT=3000
NODE_ENV=production
CORS_ORIGIN=https://${DOMAIN:-localhost:3000}
EOF
ok ".env written"

# Write agent.config.json
cat > agent.config.json << EOF
{
  "agentName": "$AGENT_NAME",
  "description": "$AGENT_DESC",
  "version": "1.0.0",
  "nonce": 0,
  "network": "$NETWORK",
  "pricing": { "perQuery": "$PRICE", "token": "USDC-350c4e" },
  "llm": { "provider": "$LLM_PROVIDER", "model": "$LLM_MODEL" },
  "services": [
    {
      "id": "default",
      "name": "General Query",
      "description": "Process a text query and return a structured response",
      "pricePerCall": "$PRICE",
      "token": "USDC-350c4e"
    }
  ]
}
EOF
ok "agent.config.json written"

# Configure moltbot-starter-kit in the OpenClaw workspace
MOLTBOT_KIT="${OPENCLAW_WORKSPACE}/.agent/skills/multiversx/moltbot-starter-kit"
if [ -d "$MOLTBOT_KIT" ]; then
  cat > "$MOLTBOT_KIT/.env" << MOLTEOF
# Generated by launch.sh — $(date)
# Moltbot Starter Kit config (inside OpenClaw workspace)
MULTIVERSX_CHAIN_ID=$CHAIN_ID
MULTIVERSX_API_URL=$API_URL
MULTIVERSX_EXPLORER_URL=$EXPLORER
MULTIVERSX_PRIVATE_KEY=$ROOT_DIR/wallet.pem

IDENTITY_REGISTRY_ADDRESS=erd1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq6gq4hu
VALIDATION_REGISTRY_ADDRESS=erd1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq6gq4hu
REPUTATION_REGISTRY_ADDRESS=erd1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq6gq4hu
ESCROW_CONTRACT_ADDRESS=erd1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq6gq4hu

X402_FACILITATOR_URL=http://localhost:4000
MULTIVERSX_RELAYER_URL=http://localhost:3001
MOLTEOF
  ok "moltbot-starter-kit .env configured"
fi

# Generate OpenClaw workspace config (~/.openclaw/openclaw.json)
# Maps the user's LLM choice to the OpenClaw agent model config
case "$LLM_PROVIDER" in
  openai)    OC_MODEL="openai/$LLM_MODEL" ;;
  anthropic) OC_MODEL="anthropic/$LLM_MODEL" ;;
  google)    OC_MODEL="google/$LLM_MODEL" ;;
  *)         OC_MODEL="openai/gpt-4o" ;;
esac

OPENCLAW_CONFIG="${OPENCLAW_HOME}/openclaw.json"
if [ ! -f "$OPENCLAW_CONFIG" ]; then
  cat > "$OPENCLAW_CONFIG" << OCEOF
{
  "agent": {
    "model": "$OC_MODEL"
  },
  "gateway": {
    "auth": {
      "mode": "token"
    }
  }
}
OCEOF
  ok "openclaw.json created with model: $OC_MODEL (auth.mode: token)"
else
  info "openclaw.json already exists — not overwriting"
  # Warn if gateway.auth.mode is missing (required since v2026.3.7)
  if ! grep -q '"mode"' "$OPENCLAW_CONFIG" 2>/dev/null; then
    warn "openclaw.json may need gateway.auth.mode — required since OpenClaw v2026.3.7"
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
# STEP 3: Install dependencies
# ══════════════════════════════════════════════════════════════════════════════
step "3/10" "Install dependencies"

# Install root-level dependencies (required for scripts/*.ts)
cd "$ROOT_DIR" && npm ci --silent 2>/dev/null || npm install --silent
ok "Root dependencies installed (scripts)"

cd "$ROOT_DIR/backend" && npm ci --silent
ok "Backend dependencies installed"

if [ -f "$ROOT_DIR/frontend/package.json" ]; then
  cd "$ROOT_DIR/frontend" && npm ci --silent 2>/dev/null || npm install --silent
  ok "Frontend dependencies installed"
fi

# ══════════════════════════════════════════════════════════════════════════════
# STEP 4: Fund wallet (devnet only)
# ══════════════════════════════════════════════════════════════════════════════
step "4/10" "Fund wallet"

cd "$ROOT_DIR"
if [ "$CHAIN_ID" = "D" ]; then
  npx ts-node scripts/fund.ts 2>/dev/null && ok "Wallet funded from devnet faucet" || warn "Faucet unavailable — fund manually"
else
  info "Mainnet selected — fund your wallet manually: $WALLET_ADDRESS"
  echo "   Send at least 0.05 EGLD for gas + your USDC for escrow"
  read -p "   Press Enter when funded..." _
fi

# ══════════════════════════════════════════════════════════════════════════════
# STEP 5: Register agent on-chain
# ══════════════════════════════════════════════════════════════════════════════
step "5/10" "Register agent on MultiversX"

cd "$ROOT_DIR"
npx ts-node scripts/register.ts 2>&1 && ok "Agent registered on-chain" || warn "Registration may require funded contracts — continuing"

# ══════════════════════════════════════════════════════════════════════════════
# STEP 6: Build manifest + mint identity NFT
# ══════════════════════════════════════════════════════════════════════════════
step "6/10" "Build manifest"

cd "$ROOT_DIR"
npx ts-node scripts/build_manifest.ts 2>&1 && ok "Manifest built" || warn "Manifest build skipped — run manually: npm run build-manifest"

# ══════════════════════════════════════════════════════════════════════════════
# STEP 7: Build and test locally
# ══════════════════════════════════════════════════════════════════════════════
step "7/10" "Build and verify"

cd "$ROOT_DIR/backend"
npx tsc --outDir dist && ok "TypeScript build: OK" || fail "TypeScript build failed"
NODE_ENV=test npx jest --forceExit --detectOpenHandles --silent && ok "Tests: ALL PASSING" || warn "Some tests failed — review output"

# ══════════════════════════════════════════════════════════════════════════════
# STEP 8: Provision VPS
# ══════════════════════════════════════════════════════════════════════════════
step "8/10" "Provision VPS"

if [ -z "$VPS_HOST" ] || [ "$LOCAL_ONLY" = true ]; then
  info "No VPS — running locally only"
  info "Start locally: cd backend && npm run dev"
else
  echo -e "  ${BOLD}About to harden your VPS:${NC}"
  echo "   • System updates + Node.js 22+"
  echo "   • Non-root user 'moltbot'"
  echo "   • SSH hardening (key-only, no root login)"
  echo "   • UFW firewall (ports 22, 80, 443, 18789)"
  echo "   • Fail2Ban + Docker + Docker Compose"
  echo ""
  read -p "  Proceed? [Y/n]: " PROVISION_CONFIRM
  if [ "${PROVISION_CONFIRM:-Y}" != "n" ] && [ "${PROVISION_CONFIRM:-Y}" != "N" ]; then
    cd "$ROOT_DIR"
    bash infra/provision.sh "$VPS_USER@$VPS_HOST" && ok "VPS provisioned" || fail "VPS provisioning failed"
  else
    info "VPS provisioning skipped"
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
# STEP 9: Deploy to VPS (remote-first: OpenClaw + skills + agent all on VPS)
# ══════════════════════════════════════════════════════════════════════════════
step "9/10" "Deploy full OpenClaw agent to VPS"

if [ -n "$VPS_HOST" ] && [ "$LOCAL_ONLY" = false ]; then
  DEPLOY_USER="moltbot"
  [ "$VPS_USER" != "root" ] && DEPLOY_USER="$VPS_USER"
  DEPLOY_TARGET="$DEPLOY_USER@$VPS_HOST"
  AGENT_HOME="/opt/openclaw-agent"

  echo -e "  ${BOLD}Uploading agent config to VPS...${NC}"

  # Create the agent home on the VPS
  ssh "$DEPLOY_TARGET" "sudo mkdir -p $AGENT_HOME && sudo chown $DEPLOY_USER:$DEPLOY_USER $AGENT_HOME"
  ok "Agent home created: $AGENT_HOME"

  # Upload everything the VPS needs
  scp -q .env "$DEPLOY_TARGET:$AGENT_HOME/.env" && ok "Uploaded: .env"
  scp -q wallet.pem "$DEPLOY_TARGET:$AGENT_HOME/wallet.pem" && ok "Uploaded: wallet.pem"
  scp -q agent.config.json "$DEPLOY_TARGET:$AGENT_HOME/agent.config.json" && ok "Uploaded: agent.config.json"
  scp -q infra/remote-setup.sh "$DEPLOY_TARGET:$AGENT_HOME/remote-setup.sh" && ok "Uploaded: remote-setup.sh"

  echo ""
  echo -e "  ${BOLD}Running full OpenClaw setup on VPS (this takes 2-5 min)...${NC}"
  echo -e "  ${BLUE}  ↳ Installing Node.js 22+, OpenClaw, MultiversX Skills, template...${NC}"
  echo ""

  # Execute the remote setup script via SSH
  ssh -t "$DEPLOY_TARGET" "chmod +x $AGENT_HOME/remote-setup.sh && sudo bash $AGENT_HOME/remote-setup.sh"

  ok "Full OpenClaw agent deployed to VPS"
else
  info "No VPS — skipping remote deployment"
fi

# ══════════════════════════════════════════════════════════════════════════════
# STEP 10: Final verification
# ══════════════════════════════════════════════════════════════════════════════
step "10/10" "Verify everything"

echo ""
if [ -n "$VPS_HOST" ] && [ "$LOCAL_ONLY" = false ]; then
  # Remote health check
  echo -e "  Waiting for services to start..."
  sleep 5

  echo -e "  Checking API health..."
  if curl -sf "https://$DOMAIN/api/health" > /dev/null 2>&1; then
    ok "HTTPS health check: PASSED"
  elif curl -sf "http://$VPS_HOST:4000/api/health" > /dev/null 2>&1; then
    ok "HTTP health check: PASSED — HTTPS will activate via Caddy"
  else
    warn "Health check: agent may still be starting"
  fi

  echo -e "  Checking OpenClaw Gateway..."
  if ssh "$DEPLOY_USER@$VPS_HOST" "pgrep -f 'openclaw gateway'" &>/dev/null; then
    ok "OpenClaw Gateway: RUNNING"
  else
    warn "OpenClaw Gateway may need manual start: openclaw gateway --port 18789"
  fi
fi

echo ""
echo -e "${CYAN}╔═══════════════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║${NC}                                                                             ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}  ${BOLD}${GREEN}🎉  YOUR OPENCLAW AGENT IS LIVE!${NC}                                          ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}                                                                             ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}  Agent:       $AGENT_NAME"
echo -e "${CYAN}║${NC}  Wallet:      $WALLET_ADDRESS"
echo -e "${CYAN}║${NC}  Network:     $NETWORK"
echo -e "${CYAN}║${NC}  LLM:         $LLM_PROVIDER / $LLM_MODEL"
echo -e "${CYAN}║${NC}  Price:       $PRICE USDC per query"

if [ -n "$VPS_HOST" ] && [ "$LOCAL_ONLY" = false ]; then
echo -e "${CYAN}║${NC}"
echo -e "${CYAN}║${NC}  ${BOLD}Running on VPS:${NC}"
echo -e "${CYAN}║${NC}    🖥️  Server:      $VPS_HOST"
echo -e "${CYAN}║${NC}    🌐 Frontend:    https://$DOMAIN"
echo -e "${CYAN}║${NC}    🔌 API:         https://$DOMAIN/api/health"
echo -e "${CYAN}║${NC}    🦞 OpenClaw:    ws://$VPS_HOST:18789"
echo -e "${CYAN}║${NC}    🔍 Explorer:    $EXPLORER/accounts/$WALLET_ADDRESS"
echo -e "${CYAN}║${NC}"
echo -e "${CYAN}║${NC}  ${BOLD}Architecture (on VPS):${NC}"
echo -e "${CYAN}║${NC}    OpenClaw Gateway → ws://127.0.0.1:18789"
echo -e "${CYAN}║${NC}    MultiversX Skills → ~/.openclaw/workspace/.agent/skills/multiversx/"
echo -e "${CYAN}║${NC}    moltbot-starter-kit → (listen → act → prove loop)"
echo -e "${CYAN}║${NC}    Backend API → http://0.0.0.0:4000"
fi

echo -e "${CYAN}║${NC}"
echo -e "${CYAN}║${NC}  ${BOLD}What to do next:${NC}"
echo -e "${CYAN}║${NC}    1. Customize your agent:  backend/src/agent/base-agent.ts"
echo -e "${CYAN}║${NC}    2. Add your own tools:     override getTools() and getSystemPrompt()"
echo -e "${CYAN}║${NC}    3. Push to update:         git push → auto-deploys via CI/CD"
echo -e "${CYAN}║${NC}"
echo -e "${CYAN}║${NC}  ${BOLD}Commands:${NC}"
echo -e "${CYAN}║${NC}    npm run dev        # Local development"

if [ -n "$VPS_HOST" ] && [ "$LOCAL_ONLY" = false ]; then
echo -e "${CYAN}║${NC}    ssh $DEPLOY_USER@$VPS_HOST   # Connect to your VPS"
echo -e "${CYAN}║${NC}    npm run deploy     # Redeploy to VPS"
fi

echo -e "${CYAN}║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════════════════════════════════╝${NC}"
echo ""
