#!/usr/bin/env bash
# bin/setup.sh — interactive .env wizard for ChatHermes orchestrator.
# Idempotent: safe to re-run. Won't clobber an existing .env (asks first).
set -e
cd "$(dirname "$0")/.."

GREEN='\033[0;32m'; YELLOW='\033[0;33m'; RED='\033[0;31m'; DIM='\033[2m'; NC='\033[0m'

ENV_FILE="orchestrator/.env"
ENV_EXAMPLE="orchestrator/.env.example"

echo ""
echo -e "${GREEN}=== ChatHermes setup wizard ===${NC}"
echo ""

if [ ! -f "$ENV_EXAMPLE" ]; then
  echo -e "${RED}error:${NC} $ENV_EXAMPLE not found. Are you in the repo root?"
  exit 1
fi

if [ -f "$ENV_FILE" ]; then
  echo -e "${YELLOW}warn:${NC} $ENV_FILE already exists."
  read -r -p "Overwrite? [y/N] " ans
  if [ "$ans" != "y" ] && [ "$ans" != "Y" ]; then
    echo "Keeping existing .env. Edit manually or delete it then re-run."
    exit 0
  fi
  cp "$ENV_FILE" "$ENV_FILE.bak.$(date +%s)"
  echo -e "  ${DIM}backup:${NC} $ENV_FILE.bak.$(date +%s)"
fi

# Detect openssl for SESSION_SECRET generation
if ! command -v openssl >/dev/null 2>&1; then
  echo -e "${RED}error:${NC} openssl not found. Install it first (apt install openssl / brew install openssl)."
  exit 1
fi

SESSION_SECRET=$(openssl rand -hex 32)
echo -e "${GREEN}+${NC} generated SESSION_SECRET (64 hex chars)"

# Defaults
PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-http://localhost:7000}"
NODE_ENV="${NODE_ENV:-development}"
DATA_ROOT="${DATA_ROOT:-./data}"

# Prompt: PUBLIC_BASE_URL
echo ""
read -r -p "Public base URL [default: http://localhost:7000]: " input
PUBLIC_BASE_URL="${input:-http://localhost:7000}"

# Prompt: ADMIN_EMAILS
echo ""
echo -e "${DIM}Admin emails get auto-promoted to admin role on first signup.${NC}"
read -r -p "Admin email(s), comma-separated [skip with Enter]: " ADMIN_EMAILS

# Prompt: at least one LLM key
echo ""
echo -e "${DIM}You need at least ONE LLM provider key. Skip any you don't have (press Enter).${NC}"
echo -e "${DIM}You can add more later by editing $ENV_FILE.${NC}"
echo ""
read -r -p "  NOUS_API_KEY (Nous Research, hermes-4-405b): " NOUS_API_KEY
read -r -p "  KIMI_API_KEY (Moonshot, kimi-k2-thinking):  " KIMI_API_KEY
read -r -p "  ANTHROPIC_API_KEY (Claude):                 " ANTHROPIC_API_KEY
read -r -p "  OPENAI_API_KEY (GPT-5):                     " OPENAI_API_KEY
read -r -p "  GEMINI_API_KEY (Google):                    " GEMINI_API_KEY

if [ -z "$NOUS_API_KEY" ] && [ -z "$KIMI_API_KEY" ] && [ -z "$ANTHROPIC_API_KEY" ] && [ -z "$OPENAI_API_KEY" ] && [ -z "$GEMINI_API_KEY" ]; then
  echo ""
  echo -e "${YELLOW}warn:${NC} no LLM keys provided. Chat will fail until you edit $ENV_FILE."
fi

# Build .env from example, substituting our values
cp "$ENV_EXAMPLE" "$ENV_FILE"

# Helper: replace KEY=anything with KEY=value
set_env_var() {
  local key="$1" val="$2"
  # Escape & in replacement
  val="${val//&/\\&}"
  if grep -qE "^${key}=" "$ENV_FILE"; then
    # Use | as delimiter since values may contain /
    sed -i.tmp "s|^${key}=.*|${key}=${val}|" "$ENV_FILE" && rm -f "$ENV_FILE.tmp"
  else
    echo "${key}=${val}" >> "$ENV_FILE"
  fi
}

set_env_var "PUBLIC_BASE_URL" "$PUBLIC_BASE_URL"
set_env_var "NODE_ENV" "$NODE_ENV"
set_env_var "SESSION_SECRET" "$SESSION_SECRET"
set_env_var "DATA_ROOT" "$DATA_ROOT"
[ -n "$ADMIN_EMAILS" ] && set_env_var "ADMIN_EMAILS" "$ADMIN_EMAILS"
[ -n "$NOUS_API_KEY" ] && set_env_var "NOUS_API_KEY" "$NOUS_API_KEY"
[ -n "$KIMI_API_KEY" ] && set_env_var "KIMI_API_KEY" "$KIMI_API_KEY"
[ -n "$ANTHROPIC_API_KEY" ] && set_env_var "ANTHROPIC_API_KEY" "$ANTHROPIC_API_KEY"
[ -n "$OPENAI_API_KEY" ] && set_env_var "OPENAI_API_KEY" "$OPENAI_API_KEY"
[ -n "$GEMINI_API_KEY" ] && set_env_var "GEMINI_API_KEY" "$GEMINI_API_KEY"

# Create data dir (orchestrator code also auto-creates this, but doing it here gives fast feedback if perms wrong)
mkdir -p "orchestrator/${DATA_ROOT#./}"

echo ""
echo -e "${GREEN}=== setup complete ===${NC}"
echo ""
echo "  $ENV_FILE written"
echo "  data dir:    orchestrator/${DATA_ROOT#./}/"
echo ""
echo "Next steps:"
echo -e "  ${DIM}# install deps + smoke test${NC}"
echo "  ./bin/install.sh"
echo ""
echo -e "  ${DIM}# OR start everything now (assumes deps already installed):${NC}"
echo "  ./bin/start.sh"
echo ""
