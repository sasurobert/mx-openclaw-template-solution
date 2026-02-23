#!/bin/bash
set -euo pipefail

# ╔═══════════════════════════════════════════════════════════════════════════════╗
# ║  OpenClaw Remote Setup — Runs ON THE VPS (not the developer's laptop)       ║
# ║                                                                             ║
# ║  This script is SCP'd to the VPS by launch.sh and executed via SSH.         ║
# ║  It installs the full OpenClaw agent stack:                                 ║
# ║    1. Node.js 22+                                                           ║
# ║    2. OpenClaw platform (npm install -g openclaw@latest)                    ║
# ║    3. MultiversX OpenClaw Skills + moltbot-starter-kit                      ║
# ║    4. Clone the template repo + install deps                                ║
# ║    5. Register agent on-chain                                               ║
# ║    6. Start everything (OpenClaw Gateway + backend + frontend)              ║
# ║                                                                             ║
# ║  Environment variables are passed via the .env file that launch.sh SCPs.    ║
# ╚═══════════════════════════════════════════════════════════════════════════════╝

# Colors
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
step() { echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; echo -e "${BOLD}${GREEN}  ✦ $1${NC}: $2"; echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"; }
ok()   { echo -e "  ${GREEN}✅ $1${NC}"; }
info() { echo -e "  ${BLUE}ℹ️  $1${NC}"; }
warn() { echo -e "  ${YELLOW}⚠️  $1${NC}"; }
fail() { echo -e "  ${RED}❌ $1${NC}"; exit 1; }

# ── Source the .env that launch.sh uploaded ──────────────────────────────────
AGENT_HOME="/opt/openclaw-agent"
source "${AGENT_HOME}/.env" 2>/dev/null || true

TEMPLATE_REPO="${TEMPLATE_REPO:-sasurobert/mx-openclaw-template-solution}"
SKILLS_REPO="sasurobert/multiversx-openclaw-skills"
SKILLS_INSTALL_URL="https://raw.githubusercontent.com/${SKILLS_REPO}/refs/heads/master/scripts/install.sh"

# ══════════════════════════════════════════════════════════════════════════════
step "1/6" "Install Node.js 22+"
# ══════════════════════════════════════════════════════════════════════════════

if command -v node &>/dev/null; then
  NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
  if [ "$NODE_VER" -ge 22 ] 2>/dev/null; then
    ok "Node.js $(node -v) already installed"
  else
    warn "Node.js $(node -v) is too old — upgrading to v22"
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - 2>/dev/null
    apt-get install -y -qq nodejs
    ok "Node.js $(node -v) installed"
  fi
else
  echo -e "  Installing Node.js 22..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - 2>/dev/null
  apt-get install -y -qq nodejs
  ok "Node.js $(node -v) installed"
fi

# Ensure npm is available
npm --version &>/dev/null || fail "npm not found after Node.js install"
ok "npm $(npm -v)"

# ══════════════════════════════════════════════════════════════════════════════
step "2/6" "Install OpenClaw Platform"
# ══════════════════════════════════════════════════════════════════════════════

if command -v openclaw &>/dev/null; then
  ok "OpenClaw already installed: $(openclaw --version 2>/dev/null || echo 'unknown')"
else
  npm install -g openclaw@latest && ok "OpenClaw installed" || fail "Could not install OpenClaw"
fi

# Onboard (creates ~/.openclaw, installs Gateway daemon)
OPENCLAW_HOME="${HOME}/.openclaw"
if [ ! -d "$OPENCLAW_HOME" ]; then
  openclaw onboard --install-daemon 2>&1 && ok "Gateway onboarded" || warn "Onboarding may need manual steps"
else
  ok "OpenClaw home exists: $OPENCLAW_HOME"
fi

OPENCLAW_WORKSPACE="${OPENCLAW_HOME}/workspace"
mkdir -p "${OPENCLAW_WORKSPACE}/skills"

# ══════════════════════════════════════════════════════════════════════════════
step "3/6" "Install MultiversX Agent Skills + moltbot-starter-kit"
# ══════════════════════════════════════════════════════════════════════════════

# Run the official installer FROM the workspace directory
# This puts everything at ~/.openclaw/workspace/.agent/skills/multiversx/
cd "$OPENCLAW_WORKSPACE"
curl -sL "$SKILLS_INSTALL_URL" | bash \
  && ok "Skills installed → ${OPENCLAW_WORKSPACE}/.agent/skills/multiversx/" \
  || warn "Skills install had issues — check output above"

# Configure moltbot-starter-kit .env
MOLTBOT_KIT="${OPENCLAW_WORKSPACE}/.agent/skills/multiversx/moltbot-starter-kit"
if [ -d "$MOLTBOT_KIT" ]; then
  cp "${AGENT_HOME}/.env" "${MOLTBOT_KIT}/.env"
  ok "moltbot-starter-kit configured from agent .env"
fi

# ══════════════════════════════════════════════════════════════════════════════
step "4/6" "Clone template + install dependencies"
# ══════════════════════════════════════════════════════════════════════════════

cd "$AGENT_HOME"

# Clone template if not already present
if [ ! -d "backend" ]; then
  # Clone into a temp dir, then move contents
  TMPDIR=$(mktemp -d)
  git clone --depth 1 "https://github.com/${TEMPLATE_REPO}.git" "$TMPDIR" 2>/dev/null
  cp -rn "$TMPDIR"/* "$AGENT_HOME"/ 2>/dev/null || true
  cp -rn "$TMPDIR"/.[!.]* "$AGENT_HOME"/ 2>/dev/null || true
  rm -rf "$TMPDIR"
  ok "Template cloned"
else
  ok "Template already present"
fi

# Install backend dependencies
cd "$AGENT_HOME/backend" && npm ci --silent 2>/dev/null || npm install --silent
ok "Backend dependencies installed"

# Install frontend dependencies
if [ -f "$AGENT_HOME/frontend/package.json" ]; then
  cd "$AGENT_HOME/frontend" && npm ci --silent 2>/dev/null || npm install --silent
  ok "Frontend dependencies installed"
fi

# Symlink moltbot-starter-kit for convenience
if [ -d "$MOLTBOT_KIT" ] && [ ! -L "$AGENT_HOME/.moltbot" ]; then
  ln -sfn "$MOLTBOT_KIT" "$AGENT_HOME/.moltbot"
  ok "Symlink: .moltbot → moltbot-starter-kit"
fi

# ══════════════════════════════════════════════════════════════════════════════
step "5/6" "Configure OpenClaw workspace + register agent"
# ══════════════════════════════════════════════════════════════════════════════

cd "$AGENT_HOME"

# Generate OpenClaw config if not present
OPENCLAW_CONFIG="${OPENCLAW_HOME}/openclaw.json"
if [ ! -f "$OPENCLAW_CONFIG" ]; then
  # Map LLM provider to OpenClaw model format
  LLM_PROVIDER="${LLM_PROVIDER:-openai}"
  LLM_MODEL="${LLM_MODEL:-gpt-4o}"
  case "$LLM_PROVIDER" in
    openai)    OC_MODEL="openai/$LLM_MODEL" ;;
    anthropic) OC_MODEL="anthropic/$LLM_MODEL" ;;
    google)    OC_MODEL="google/$LLM_MODEL" ;;
    *)         OC_MODEL="openai/gpt-4o" ;;
  esac

  cat > "$OPENCLAW_CONFIG" << OCEOF
{
  "agent": {
    "model": "$OC_MODEL"
  }
}
OCEOF
  ok "openclaw.json created: $OC_MODEL"
fi

# Build TypeScript
cd "$AGENT_HOME/backend"
npx tsc --outDir dist 2>/dev/null && ok "TypeScript build: OK" || warn "TypeScript build had warnings"

# Register agent on-chain (if scripts exist)
cd "$AGENT_HOME"
if [ -f "scripts/register.ts" ]; then
  npx ts-node scripts/register.ts 2>&1 && ok "Agent registered on-chain" || warn "Registration skipped — may need funded contracts"
fi

# ══════════════════════════════════════════════════════════════════════════════
step "6/6" "Start everything"
# ══════════════════════════════════════════════════════════════════════════════

cd "$AGENT_HOME"

# Start OpenClaw Gateway (if not already running)
if ! pgrep -f "openclaw gateway" &>/dev/null; then
  nohup openclaw gateway --port 18789 > /var/log/openclaw-gateway.log 2>&1 &
  sleep 2
  ok "OpenClaw Gateway started (port 18789)"
else
  ok "OpenClaw Gateway already running"
fi

# If Docker is available, use docker-compose for backend + frontend
if command -v docker &>/dev/null && [ -f "docker-compose.yml" ]; then
  docker compose up -d --build 2>&1 && ok "Backend + Frontend started (Docker)" || warn "Docker compose failed"
else
  # Start backend directly with PM2 or nohup
  if command -v pm2 &>/dev/null; then
    pm2 start backend/dist/server.js --name openclaw-backend 2>/dev/null && ok "Backend started (PM2)"
  else
    nohup node backend/dist/server.js > /var/log/openclaw-backend.log 2>&1 &
    ok "Backend started (nohup)"
  fi
fi

echo ""
echo -e "${CYAN}╔════════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║${NC}  ${BOLD}${GREEN}🎉  OpenClaw Agent is LIVE on this server!${NC}"
echo -e "${CYAN}║${NC}"
echo -e "${CYAN}║${NC}  OpenClaw Gateway:   ws://127.0.0.1:18789"
echo -e "${CYAN}║${NC}  Backend API:        http://0.0.0.0:4000"
echo -e "${CYAN}║${NC}  Agent Home:         $AGENT_HOME"
echo -e "${CYAN}║${NC}  OpenClaw Workspace: $OPENCLAW_WORKSPACE"
echo -e "${CYAN}║${NC}  Skills:             ${OPENCLAW_WORKSPACE}/.agent/skills/multiversx/"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════════════════╝${NC}"
echo ""
