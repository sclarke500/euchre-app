#!/bin/bash
# Ensure dev server is running for local network testing
# Port 4200 is configured in vite.config.ts

cd "$(dirname "$0")/.."

PORT=4200

# Check if already running
if lsof -i :$PORT -sTCP:LISTEN >/dev/null 2>&1; then
  echo "✅ Dev server already running on port $PORT"
  IP=$(ipconfig getifaddr en0 2>/dev/null || echo "localhost")
  echo "   Access at: http://$IP:$PORT"
  exit 0
fi

echo "🚀 Starting dev server on port $PORT..."
npm run dev -- --host

# Note: This runs in foreground. For background, use:
# nohup npm run dev -- --host > /tmp/euchre-dev.log 2>&1 &
