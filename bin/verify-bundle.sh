#!/usr/bin/env bash
# Verify bundle integrity: no leaked credentials, attribution intact.
set -e
cd "$(dirname "$0")/.."

echo "== verify-bundle =="

echo "-- attribution layer --"
test -f orchestrator/src/_attribution.ts && echo "  + _attribution.ts present" || { echo "  X MISSING"; exit 1; }
grep -q "attributionPresent" orchestrator/src/_attribution.ts && echo "  + runtime guard present" || { echo "  X tampered"; exit 1; }

echo "-- credential scan (strict, real-key shape) --"
# Real keys have specific char-count signatures. These patterns ONLY match real secrets,
# not docs referencing "sk_live_..." or "hcloud_..." placeholders.
PATTERNS=(
  "sk_live_[A-Za-z0-9]{20,}"
  "rk_live_[A-Za-z0-9]{20,}"
  "whsec_[A-Za-z0-9]{30,}"
  "re_[A-Za-z0-9]{20,}_[A-Za-z0-9]{20,}"
  "hcloud_[A-Za-z0-9]{50,}"
  "AIza[A-Za-z0-9_-]{35,}"
  "sk-ant-[A-Za-z0-9_-]{50,}"
  "sk-proj-[A-Za-z0-9_-]{50,}"
)
total_hits=0
for p in "${PATTERNS[@]}"; do
  HITS=$(grep -rE "$p" --include="*.ts" --include="*.tsx" --include="*.json" --include="*.md" --include="*.example" --include="*.yml" . 2>/dev/null | grep -v "verify-bundle.sh" | wc -l)
  if [ "$HITS" -gt 0 ]; then
    echo "  X $HITS hits for: $p"
    grep -rE "$p" --include="*.ts" --include="*.tsx" --include="*.json" --include="*.md" --include="*.example" --include="*.yml" . 2>/dev/null | grep -v "verify-bundle.sh" | head -3
    total_hits=$((total_hits + HITS))
  fi
done
if [ "$total_hits" -eq 0 ]; then
  echo "  + zero real credentials matched"
else
  echo "  ABORT: $total_hits credential leaks found"
  exit 1
fi

echo "-- email/PII scan --"
EMAILS=(soeharyo@gmail kuhlaksana@gmail metafoxe@gmail aicoidcompany@gmail)
for e in "${EMAILS[@]}"; do
  HITS=$(grep -rE "$e" --include="*.ts" --include="*.tsx" --include="*.json" --include="*.md" . 2>/dev/null | wc -l)
  if [ "$HITS" -gt 0 ]; then echo "  X $HITS hits for: $e"; exit 1; fi
done
echo "  + no team emails leaked"

echo "-- IP scan --"
IPS=(168\.119\.119\. 5\.78\.141\.)
for i in "${IPS[@]}"; do
  HITS=$(grep -rE "$i" --include="*.ts" --include="*.tsx" --include="*.json" --include="*.md" . 2>/dev/null | wc -l)
  if [ "$HITS" -gt 0 ]; then echo "  X $HITS hits for: $i"; exit 1; fi
done
echo "  + no production IPs leaked"

echo "-- env hygiene --"
test ! -f orchestrator/.env && echo "  + no real .env shipped" || { echo "  X .env should not be in repo"; exit 1; }
test -f orchestrator/.env.example && echo "  + .env.example present" || { echo "  X .env.example MISSING"; exit 1; }
test ! -f data/orchestrator.db && echo "  + no production database shipped" || { echo "  X database should not be in repo"; exit 1; }

echo
echo "  ALL CHECKS PASSED"
