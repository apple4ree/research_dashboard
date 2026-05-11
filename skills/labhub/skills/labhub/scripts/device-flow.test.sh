#!/usr/bin/env bash
# Smoke test for device-flow.sh.
# Spins up a Python HTTP server that mimics GitHub + LabHub, runs the
# script, and asserts it walks through authorization_pending → success.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PORT=$((40000 + RANDOM % 20000))
WORKDIR=$(mktemp -d)
trap 'kill $SERVER_PID 2>/dev/null; rm -rf "$WORKDIR"' EXIT

# Fake server: serves canned responses based on path + a counter.
cat > "$WORKDIR/server.py" <<'PY'
import http.server, json, sys
poll_count = 0

class H(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        global poll_count
        length = int(self.headers.get('content-length', 0))
        body = self.rfile.read(length).decode()
        path = self.path
        resp = None
        if path.endswith('/login/device/code'):
            resp = {'device_code': 'd1', 'user_code': 'ABCD-EFGH',
                    'verification_uri': 'https://github.com/login/device',
                    'interval': 1}
        elif path.endswith('/login/oauth/access_token'):
            poll_count += 1
            if poll_count < 2:
                resp = {'error': 'authorization_pending'}
            else:
                resp = {'access_token': 'gho_test'}
        elif path.endswith('/api/auth/device/exchange'):
            resp = {'token': 'eyJtest', 'expiresAt': '2099-01-01T00:00:00.000Z',
                    'member': {'login': 'testbot', 'displayName': 'Test'}}
        if resp is None:
            self.send_response(404); self.end_headers(); return
        body_bytes = json.dumps(resp, separators=(',', ':')).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body_bytes)))
        self.end_headers()
        self.wfile.write(body_bytes)
    def log_message(self, *a): pass

http.server.HTTPServer(('127.0.0.1', int(sys.argv[1])), H).serve_forever()
PY

python3 "$WORKDIR/server.py" "$PORT" &
SERVER_PID=$!

# Wait for server to be up.
for _ in $(seq 1 30); do
  curl -fsS -o /dev/null -X POST "http://127.0.0.1:$PORT/login/device/code" -d 'x=1' && break
  sleep 0.1
done

# Run the script with the fake server's URL substituted in.
# device-flow.sh hits api.github.com hardcoded — for the test we override
# via env vars LABHUB_GITHUB_DEVICE_URL and LABHUB_GITHUB_TOKEN_URL.
export LABHUB_GITHUB_DEVICE_URL="http://127.0.0.1:$PORT/login/device/code"
export LABHUB_GITHUB_TOKEN_URL="http://127.0.0.1:$PORT/login/oauth/access_token"

OUTPUT=$(bash "$SCRIPT_DIR/device-flow.sh" "test-client-id" "http://127.0.0.1:$PORT")

# Assert: stdout contains the expected token field.
if ! grep -q '"token":"eyJtest"' <<< "$OUTPUT"; then
  echo "FAIL: expected token in stdout, got: $OUTPUT" >&2
  exit 1
fi
echo "PASS"
