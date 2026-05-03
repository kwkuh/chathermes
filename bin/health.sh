#!/usr/bin/env bash
# bin/health.sh — verify a running ChatHermes install.
# Checks: ports listening, endpoints responding, DB tables present, cron alive.
set -e
cd "$(dirname "$0")/.."

GREEN='\033[0;32m'; YELLOW='\033[0;33m'; RED='\033[0;31m'; DIM='\033[2m'; BOLD='\033[1m'; NC='\033[0m'

WEB_PORT="${PORT:-7000}"
ORCH_PORT="${ORCH_PORT:-7010}"
HERMES_PROXY_PORT="${HERMES_PROXY_PORT:-19002}"

echo ""
echo -e "${BOLD}=== ChatHermes health ===${NC}"
echo ""
echo -e "${DIM}ports: web=${WEB_PORT} orch=${ORCH_PORT} proxy=${HERMES_PROXY_PORT}${NC}"
echo ""

# ─── 1. ports listening ───
echo -e "${BOLD}[1] ports${NC}"
fail=0
for p in "$WEB_PORT" "$ORCH_PORT" "$HERMES_PROXY_PORT"; do
  if ss -tln 2>/dev/null | grep -qE ":${p}\\b" || \
     lsof -iTCP:"$p" -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "  ${GREEN}+${NC} :${p} listening"
  else
    echo -e "  ${RED}X${NC} :${p} NOT listening"
    fail=1
  fi
done

if [ "$fail" -eq 1 ]; then
  echo ""
  echo -e "${RED}some services down.${NC} Run ./bin/start.sh"
  exit 1
fi

# ─── 2. endpoint matrix ───
echo ""
echo -e "${BOLD}[2] endpoints${NC}"

check_endpoint() {
  local label="$1" url="$2" expect="$3"
  local code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$url" 2>/dev/null || echo "000")
  if [ "$code" = "$expect" ]; then
    echo -e "  ${GREEN}+${NC} ${code}  ${label}"
  else
    echo -e "  ${YELLOW}!${NC} ${code}  ${label} ${DIM}(expected ${expect})${NC}"
    fail=1
  fi
}

check_endpoint "web /"             "http://127.0.0.1:${WEB_PORT}/"               "200"
check_endpoint "web /auth/login"   "http://127.0.0.1:${WEB_PORT}/auth/login"     "200"
check_endpoint "web /docs"         "http://127.0.0.1:${WEB_PORT}/docs"           "200"
check_endpoint "orch /api/status"  "http://127.0.0.1:${ORCH_PORT}/api/status"    "200"
check_endpoint "orch /api/openapi" "http://127.0.0.1:${ORCH_PORT}/api/openapi.json" "200"
check_endpoint "orch /api/me/profile (auth-gated)" "http://127.0.0.1:${ORCH_PORT}/api/me/profile" "401"
check_endpoint "proxy /health"     "http://127.0.0.1:${HERMES_PROXY_PORT}/health" "200"

# ─── 3. status snapshot ───
echo ""
echo -e "${BOLD}[3] orchestrator status${NC}"
STATUS=$(curl -s --max-time 3 "http://127.0.0.1:${ORCH_PORT}/api/status" 2>/dev/null)
if [ -n "$STATUS" ]; then
  if command -v jq >/dev/null 2>&1; then
    echo "$STATUS" | jq -C . 2>/dev/null | head -20
  else
    echo "  $STATUS"
  fi
else
  echo -e "  ${RED}X${NC} no response"
  fail=1
fi

# ─── 4. DB tables ───
echo ""
echo -e "${BOLD}[4] database tables${NC}"
DATA_ROOT=$(grep -E "^DATA_ROOT=" orchestrator/.env 2>/dev/null | head -1 | cut -d'=' -f2)
DATA_ROOT="${DATA_ROOT:-./data}"
DB_PATH="orchestrator/${DATA_ROOT#./}/orchestrator.db"

if [ -f "$DB_PATH" ] && command -v sqlite3 >/dev/null 2>&1; then
  table_count=$(sqlite3 "$DB_PATH" ".tables" 2>/dev/null | tr -s ' \n' '\n' | grep -v '^$' | wc -l)
  echo -e "  ${GREEN}+${NC} $DB_PATH has ${table_count} tables"
  REQUIRED=(users sessions chat_sessions messages cron_jobs notifications credit_balances credit_transactions email_log outbound_webhooks rate_limit_buckets login_attempts)
  missing=0
  for t in "${REQUIRED[@]}"; do
    if ! sqlite3 "$DB_PATH" ".tables" 2>/dev/null | grep -qw "$t"; then
      echo -e "  ${RED}X${NC} missing table: $t"
      ((missing++))
      fail=1
    fi
  done
  if [ "$missing" -eq 0 ]; then
    echo -e "  ${GREEN}+${NC} all required tables present"
  fi
elif [ ! -f "$DB_PATH" ]; then
  echo -e "  ${YELLOW}!${NC} $DB_PATH not found (orchestrator hasn't created DB yet?)"
else
  echo -e "  ${DIM}skipped (sqlite3 cli not installed)${NC}"
fi

# ─── 5. cron alive ───
if [ -f "$DB_PATH" ] && command -v sqlite3 >/dev/null 2>&1; then
  echo ""
  echo -e "${BOLD}[5] cron jobs${NC}"
  rows=$(sqlite3 "$DB_PATH" "SELECT name, last_status FROM cron_jobs;" 2>/dev/null)
  if [ -n "$rows" ]; then
    echo "$rows" | while IFS='|' read -r name status; do
      if [ "$status" = "ok" ] || [ -z "$status" ]; then
        echo -e "  ${GREEN}+${NC} ${name} ${DIM}(${status:-pending})${NC}"
      else
        echo -e "  ${YELLOW}!${NC} ${name} ${DIM}(${status})${NC}"
      fi
    done
  else
    echo -e "  ${DIM}cron loop hasn't recorded any runs yet (give it 30s)${NC}"
  fi
fi

# ─── verdict ───
echo ""
if [ "$fail" -eq 0 ]; then
  echo -e "${BOLD}${GREEN}=== HEALTHY ===${NC}"
  echo ""
else
  echo -e "${BOLD}${RED}=== UNHEALTHY ===${NC}"
  echo ""
  echo "Logs to inspect:"
  echo "  tail -f .logs/{orch,proxy,web}.log"
  echo ""
  exit 1
fi
