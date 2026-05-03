#!/usr/bin/env bash
# bin/stop.sh — stop all 3 ChatHermes services started by ./bin/start.sh.
set -e
cd "$(dirname "$0")/.."

GREEN='\033[0;32m'; YELLOW='\033[0;33m'; DIM='\033[2m'; NC='\033[0m'

PID_DIR="${PID_DIR:-./.pids}"

echo ""
echo -e "${GREEN}=== ChatHermes stop ===${NC}"
echo ""

if [ ! -d "$PID_DIR" ]; then
  echo -e "${YELLOW}!${NC} no $PID_DIR directory. Were services started via ./bin/start.sh?"
  echo "  If services were started by other means, kill manually:"
  echo "    pkill -f 'bun.*src/index.ts'"
  echo "    pkill -f 'bun.*_hermes_proxy'"
  echo "    pkill -f 'bun.*next'"
  exit 0
fi

stopped=0
for svc in orch proxy web; do
  PID_FILE="$PID_DIR/${svc}.pid"
  if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if kill -0 "$PID" 2>/dev/null; then
      kill "$PID" 2>/dev/null && echo -e "  ${GREEN}+${NC} stopped ${svc} (pid $PID)" && ((stopped++))
      sleep 0.3
      # Force-kill if still alive
      if kill -0 "$PID" 2>/dev/null; then
        kill -9 "$PID" 2>/dev/null && echo -e "  ${DIM}  force-killed ${svc}${NC}"
      fi
    else
      echo -e "  ${DIM}- ${svc} (pid $PID) already dead${NC}"
    fi
    rm -f "$PID_FILE"
  fi
done

echo ""
if [ "$stopped" -gt 0 ]; then
  echo -e "${GREEN}=== ${stopped} service(s) stopped ===${NC}"
else
  echo -e "${DIM}=== nothing was running ===${NC}"
fi
echo ""
