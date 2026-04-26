#!/usr/bin/env bash
# GitHub Device Flow + LabHub /api/auth/device/exchange.
#
# Usage: device-flow.sh <github_client_id> <labhub_url>
# Stdout: LabHub exchange response JSON ({token, expiresAt, member}).
# Stderr: progress messages for the user.
# Exit 0 on success; non-zero on any error.
#
# Env overrides (for testing only):
#   LABHUB_GITHUB_DEVICE_URL  default: https://github.com/login/device/code
#   LABHUB_GITHUB_TOKEN_URL   default: https://github.com/login/oauth/access_token
set -euo pipefail

CLIENT_ID="${1:?usage: device-flow.sh <client_id> <labhub_url>}"
LABHUB_URL="${2:?usage: device-flow.sh <client_id> <labhub_url>}"
GH_DEVICE_URL="${LABHUB_GITHUB_DEVICE_URL:-https://github.com/login/device/code}"
GH_TOKEN_URL="${LABHUB_GITHUB_TOKEN_URL:-https://github.com/login/oauth/access_token}"

json_field() {
  # Usage: echo '<json>' | json_field <key>
  node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const v=JSON.parse(s)['$1'];process.stdout.write(v==null?'':String(v));})"
}

# 1) Request device + user code.
RESP=$(curl -fsS -X POST "$GH_DEVICE_URL" \
  -H 'Accept: application/json' \
  -d "client_id=$CLIENT_ID&scope=read:user")

DEVICE_CODE=$(echo "$RESP" | json_field device_code)
USER_CODE=$(echo "$RESP"   | json_field user_code)
VERIFY_URL=$(echo "$RESP"  | json_field verification_uri)
INTERVAL=$(echo "$RESP"    | json_field interval)
INTERVAL="${INTERVAL:-5}"

if [ -z "$DEVICE_CODE" ]; then
  echo "ERROR: GitHub did not return a device_code: $RESP" >&2
  exit 1
fi

# 2) Show the user what to do.
echo                                                       >&2
echo "  Open: $VERIFY_URL"                                 >&2
echo "  Code: $USER_CODE"                                  >&2
echo                                                       >&2
echo "Waiting for authorization..."                        >&2

# 3) Poll for access token.
while true; do
  sleep "$INTERVAL"
  POLL=$(curl -fsS -X POST "$GH_TOKEN_URL" \
    -H 'Accept: application/json' \
    -d "client_id=$CLIENT_ID&device_code=$DEVICE_CODE&grant_type=urn:ietf:params:oauth:grant-type:device_code")

  ERR=$(echo "$POLL" | json_field error)
  case "$ERR" in
    authorization_pending) continue ;;
    slow_down)             INTERVAL=$((INTERVAL + 5)); continue ;;
    expired_token|access_denied)
                           echo "ERROR: GitHub returned $ERR" >&2; exit 1 ;;
    "")                    break ;;
    *)                     echo "ERROR: GitHub returned $ERR ($POLL)" >&2; exit 1 ;;
  esac
done

GH_TOKEN=$(echo "$POLL" | json_field access_token)
if [ -z "$GH_TOKEN" ]; then
  echo "ERROR: no access_token in poll response: $POLL" >&2
  exit 1
fi

# 4) Exchange with LabHub.
EXCHANGE=$(curl -fsS -X POST "$LABHUB_URL/api/auth/device/exchange" \
  -H 'Content-Type: application/json' \
  -d "{\"github_access_token\":\"$GH_TOKEN\"}")

# 5) Stdout = exchange response (the agent will write it to disk).
echo "$EXCHANGE"
