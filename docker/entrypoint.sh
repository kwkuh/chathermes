#!/bin/sh
# Boots the three ChatHermes processes in one container and ties their
# lifetimes together: if any one dies, the container exits so the platform's
# restart policy takes over. A half-running container that still answers the
# healthcheck is worse than one that restarts.
set -eu

: "${PORT:=7010}"
: "${WEB_PORT:=7000}"
: "${DATA_ROOT:=/data}"
: "${ORCH_URL:=http://127.0.0.1:${PORT}}"
export PORT WEB_PORT DATA_ROOT ORCH_URL

mkdir -p "$DATA_ROOT"

if [ -z "${SESSION_SECRET:-}" ]; then
  echo "FATAL: SESSION_SECRET is not set. Generate one with: openssl rand -hex 32" >&2
  exit 1
fi

pids=""
cleanup() {
  # shellcheck disable=SC2086
  [ -n "$pids" ] && kill $pids 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "→ orchestrator on :${PORT}"
bun /app/orchestrator/src/index.ts &
orch_pid=$!
pids="$orch_pid"

echo "→ shared Hermes agent proxy on :19002"
bun /app/orchestrator/src/_hermes_proxy.ts &
proxy_pid=$!
pids="$pids $proxy_pid"

# The web server proxies to the orchestrator, so give it a moment to bind
# rather than letting the first requests fail.
i=0
while [ "$i" -lt 30 ]; do
  if wget -qO- "http://127.0.0.1:${PORT}/api/system/banner" >/dev/null 2>&1; then break; fi
  i=$((i + 1))
  sleep 1
done

echo "→ web on :${WEB_PORT}"
cd /app/web && bun run start -p "${WEB_PORT}" -H 0.0.0.0 &
web_pid=$!
pids="$pids $web_pid"

# Exit as soon as any child exits, carrying its status out to the platform.
wait -n "$orch_pid" "$proxy_pid" "$web_pid" 2>/dev/null || wait "$orch_pid" || true
status=$?
echo "a ChatHermes process exited (status ${status}) — stopping container" >&2
exit "$status"
