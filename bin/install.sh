#!/usr/bin/env bash
# bin/install.sh — one-shot fresh install for ChatHermes.
# Idempotent: safe to re-run. Each step skips if already done.
set -e
cd "$(dirname "$0")/.."

GREEN='\033[0;32m'; YELLOW='\033[0;33m'; RED='\033[0;31m'; DIM='\033[2m'; BOLD='\033[1m'; NC='\033[0m'

echo ""
echo -e "${BOLD}${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${GREEN}║${NC}  ${BOLD}ChatHermes${NC} — fresh install           ${BOLD}${GREEN}║${NC}"
echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""

# ─── 1/6 Pre-flight: Bun + Node ───
echo -e "${BOLD}[1/6]${NC} pre-flight"

if ! command -v bun >/dev/null 2>&1; then
  echo -e "  ${RED}error:${NC} bun not found."
  echo "  Install: curl -fsSL https://bun.sh/install | bash"
  exit 1
fi
BUN_VERSION=$(bun --version)
echo -e "  ${GREEN}+${NC} bun ${BUN_VERSION}"

if ! command -v node >/dev/null 2>&1; then
  echo -e "  ${YELLOW}warn:${NC} node not found. Next.js prefers Node 22+ for build."
  echo "  Bun's Node compat works for runtime but build may complain."
else
  NODE_VERSION=$(node --version)
  echo -e "  ${GREEN}+${NC} node ${NODE_VERSION}"
fi

# ─── 2/6 .env ───
echo ""
echo -e "${BOLD}[2/6]${NC} environment"

if [ ! -f "orchestrator/.env" ]; then
  echo -e "  ${YELLOW}!${NC} orchestrator/.env not found, running setup wizard..."
  echo ""
  ./bin/setup.sh
  echo ""
else
  echo -e "  ${GREEN}+${NC} orchestrator/.env exists"
  # Validate critical keys present
  for key in SESSION_SECRET PUBLIC_BASE_URL; do
    if ! grep -qE "^${key}=" orchestrator/.env; then
      echo -e "  ${RED}error:${NC} $key missing from orchestrator/.env"
      echo "  Run ./bin/setup.sh to regenerate."
      exit 1
    fi
  done
fi

# Source env to get DATA_ROOT
DATA_ROOT=$(grep -E "^DATA_ROOT=" orchestrator/.env | head -1 | cut -d'=' -f2)
DATA_ROOT="${DATA_ROOT:-./data}"
mkdir -p "orchestrator/${DATA_ROOT#./}"
echo -e "  ${GREEN}+${NC} data dir: orchestrator/${DATA_ROOT#./}/"

# ─── 3/6 Verify bundle integrity ───
echo ""
echo -e "${BOLD}[3/6]${NC} bundle verification"
if [ -x "bin/verify-bundle.sh" ]; then
  if ./bin/verify-bundle.sh > /tmp/chathermes-verify.log 2>&1; then
    echo -e "  ${GREEN}+${NC} attribution layer + credentials sanitized"
  else
    echo -e "  ${RED}error:${NC} verify-bundle failed:"
    tail -20 /tmp/chathermes-verify.log
    exit 1
  fi
else
  echo -e "  ${YELLOW}warn:${NC} bin/verify-bundle.sh missing or not executable, skipping."
fi

# ─── 4/6 Orchestrator deps ───
echo ""
echo -e "${BOLD}[4/6]${NC} orchestrator dependencies"
cd orchestrator
if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
  echo -e "  ${DIM}running:${NC} bun install"
  bun install --silent 2>&1 | tail -5
  echo -e "  ${GREEN}+${NC} installed"
else
  echo -e "  ${GREEN}+${NC} node_modules already present"
fi
cd ..

# ─── 5/6 Web deps + build ───
echo ""
echo -e "${BOLD}[5/6]${NC} web dependencies + build"
cd web
if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
  echo -e "  ${DIM}running:${NC} bun install"
  bun install --silent 2>&1 | tail -5
fi

if [ ! -d ".next" ]; then
  echo -e "  ${DIM}running:${NC} bun run build (this takes 30-60s)"
  bun run build 2>&1 | tail -3
  echo -e "  ${GREEN}+${NC} Next.js production build ready"
else
  echo -e "  ${GREEN}+${NC} .next/ already built (delete to rebuild)"
fi
cd ..

# ─── 6/6 Smoke test ───
echo ""
echo -e "${BOLD}[6/6]${NC} smoke test (boot orch for 8s, hit /api/status, kill)"

ORCH_PORT="${ORCH_PORT:-7010}"
cd orchestrator
PORT="$ORCH_PORT" nohup bun run src/index.ts > /tmp/chathermes-smoke.log 2>&1 &
SMOKE_PID=$!
cd ..

# Wait for boot
sleep 6

if curl -fsS --max-time 3 "http://127.0.0.1:${ORCH_PORT}/api/status" > /tmp/chathermes-smoke-status.json 2>/dev/null; then
  if grep -q "operational" /tmp/chathermes-smoke-status.json; then
    echo -e "  ${GREEN}+${NC} orchestrator boots clean, /api/status returns operational"
  else
    echo -e "  ${YELLOW}!${NC} orchestrator booted but /api/status reported degraded:"
    cat /tmp/chathermes-smoke-status.json
  fi
else
  echo -e "  ${RED}error:${NC} orchestrator did not respond on :${ORCH_PORT}"
  echo "  Last 20 lines of log:"
  tail -20 /tmp/chathermes-smoke.log
  kill "$SMOKE_PID" 2>/dev/null || true
  exit 1
fi

kill "$SMOKE_PID" 2>/dev/null || true
sleep 1

# ─── done ───
echo ""
echo -e "${BOLD}${GREEN}═══ install complete ═══${NC}"
echo ""
echo "Start everything:"
echo -e "  ${BOLD}./bin/start.sh${NC}"
echo ""
echo "Then check health:"
echo -e "  ${BOLD}./bin/health.sh${NC}"
echo ""
echo "Open: http://localhost:7000"
echo ""
echo -e "${DIM}If you skipped LLM keys during setup, edit orchestrator/.env and restart.${NC}"
echo ""
