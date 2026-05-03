#!/usr/bin/env bash
# bin/start.sh — boot all 3 ChatHermes services in background.
# Uses nohup + .pid files. No PM2 / systemd dependency.
# For production, see deploy/systemd/ instead.
set -e
cd "$(dirname "$0")/.."

GREEN='\033[0;32m'; YELLOW='\033[0;33m'; RED='\033[0;31m'; DIM='\033[2m'; BOLD='\033[1m'; NC='\033[0m'

# Default ports (override via env)
WEB_PORT="${PORT:-7000}"
ORCH_PORT="${ORCH_PORT:-7010}"
HERMES_PROXY_PORT="${HERMES_PROXY_PORT:-19002}"

PID_DIR="${PID_DIR:-./.pids}"
LOG_DIR="${LOG_DIR:-./.logs}"
mkdir -p "$PID_DIR" "$LOG_DIR"

# ─── pre-flight ───
echo ""
echo -e "${BOLD}${GREEN}=== ChatHermes start ===${NC}"
echo ""

if [ ! -f "orchestrator/.env" ]; then
  echo -e "${RED}error:${NC} orchestrator/.env missing. Run ./bin/setup.sh first."
  exit 1
fi

if [ ! -d "orchestrator/node_modules" ] || [ ! -d "web/node_modules" ]; then
  echo -e "${RED}error:${NC} dependencies not installed. Run ./bin/install.sh first."
  exit 1
fi

if [ ! -d "web/.next" ]; then
  echo -e "${YELLOW}warn:${NC} web/.next not built. Building now..."
  (cd web && bun run build > /dev/null 2>&1)
fi

# ─── port check ───
check_port() {
  local port=$1 name=$2
  if ss -tln 2>/dev/null | grep -qE ":${port}\\b" || \
     lsof -iTCP:"$port" -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${RED}error:${NC} port $port ($name) already in use."
    echo "  Run ./bin/stop.sh first, or set a different port:"
    echo "    PORT=8000 ORCH_PORT=8010 HERMES_PROXY_PORT=19102 ./bin/start.sh"
    exit 1
  fi
}

check_port "$WEB_PORT" "web"
check_port "$ORCH_PORT" "orchestrator"
check_port "$HERMES_PROXY_PORT" "hermes-proxy"

# ─── start orchestrator ───
echo -e "  ${DIM}starting${NC} orchestrator on :${ORCH_PORT}..."
cd orchestrator
PORT="$ORCH_PORT" nohup bun run src/index.ts > "../$LOG_DIR/orch.log" 2>&1 &
echo $! > "../$PID_DIR/orch.pid"
cd ..

# ─── start hermes-proxy ───
echo -e "  ${DIM}starting${NC} hermes-proxy on :${HERMES_PROXY_PORT}..."
cd orchestrator
HERMES_PROXY_PORT="$HERMES_PROXY_PORT" nohup bun run src/_hermes_proxy.ts > "../$LOG_DIR/proxy.log" 2>&1 &
echo $! > "../$PID_DIR/proxy.pid"
cd ..

# ─── start web ───
echo -e "  ${DIM}starting${NC} web on :${WEB_PORT}..."
cd web
PORT="$WEB_PORT" ORCH_URL="http://127.0.0.1:${ORCH_PORT}" nohup bun run start > "../$LOG_DIR/web.log" 2>&1 &
echo $! > "../$PID_DIR/web.pid"
cd ..

# ─── verify boot ───
echo ""
echo -e "  ${DIM}waiting 6s for services to settle...${NC}"
sleep 6

ORCH_PID=$(cat "$PID_DIR/orch.pid")
PROXY_PID=$(cat "$PID_DIR/proxy.pid")
WEB_PID=$(cat "$PID_DIR/web.pid")

ALIVE=0
kill -0 "$ORCH_PID" 2>/dev/null && ALIVE=$((ALIVE + 1)) || true
kill -0 "$PROXY_PID" 2>/dev/null && ALIVE=$((ALIVE + 1)) || true
kill -0 "$WEB_PID" 2>/dev/null && ALIVE=$((ALIVE + 1)) || true

echo ""
if [ "$ALIVE" -eq 3 ]; then
  echo -e "  ${GREEN}+${NC} orchestrator   pid $ORCH_PID  http://127.0.0.1:${ORCH_PORT}"
  echo -e "  ${GREEN}+${NC} hermes-proxy   pid $PROXY_PID  http://127.0.0.1:${HERMES_PROXY_PORT}"
  echo -e "  ${GREEN}+${NC} web            pid $WEB_PID  http://127.0.0.1:${WEB_PORT}"
  echo ""
  echo -e "${BOLD}${GREEN}=== all 3 services running ===${NC}"
  echo ""
  echo "Open:    http://localhost:${WEB_PORT}"
  echo "Health:  ./bin/health.sh"
  echo "Logs:    tail -f $LOG_DIR/{orch,proxy,web}.log"
  echo "Stop:    ./bin/stop.sh"
  echo ""
else
  echo -e "${RED}=== only ${ALIVE}/3 services started ===${NC}"
  echo ""
  echo "Logs to inspect:"
  for s in orch proxy web; do
    echo "  $LOG_DIR/${s}.log"
  done
  echo ""
  echo "Last orchestrator errors:"
  grep -iE "error|fail|cannot" "$LOG_DIR/orch.log" 2>/dev/null | tail -5 || echo "  (none in log)"
  exit 1
fi
