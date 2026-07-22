#!/bin/bash
set -e
cd "$(dirname "$0")"
PORT="${PORT:-4173}"
IP="$(ipconfig getifaddr en0 2>/dev/null || true)"
if [ -z "$IP" ]; then IP="$(ipconfig getifaddr en1 2>/dev/null || true)"; fi
if [ -z "$IP" ]; then IP="$(python3 - <<'PY'
import socket
s=socket.socket(socket.AF_INET,socket.SOCK_DGRAM)
try:
 s.connect(('8.8.8.8',80)); print(s.getsockname()[0])
except Exception: print('localhost')
finally: s.close()
PY
)"; fi

echo ""
echo "HUM Roofing Intelligence Round 2"
echo "Mac preview:   http://localhost:$PORT"
echo "Phone preview: http://$IP:$PORT"
echo "Keep this window open. Your phone and Mac must be on the same Wi-Fi."
echo ""
(open "http://localhost:$PORT" >/dev/null 2>&1 &) || true

if command -v node >/dev/null 2>&1; then
  echo "Using Node server. Live AI is enabled when OPENAI_API_KEY is set in this Terminal session."
  PORT="$PORT" node server.mjs
else
  echo "Node was not found. Using Python static server; offline AI intake remains available."
  python3 -m http.server "$PORT" --bind 0.0.0.0
fi
