#!/bin/bash
# Start local dev server accessible on LAN
# Usage: npm run dev:lan (from repo root)

set -e

# Get LAN IP (works on Mac)
get_lan_ip() {
  # Try common interfaces
  for iface in en0 en1 en2; do
    ip=$(ipconfig getifaddr $iface 2>/dev/null)
    if [ -n "$ip" ]; then
      echo "$ip"
      return
    fi
  done
  # Fallback: parse ifconfig
  ifconfig 2>/dev/null | grep "inet " | grep -v 127.0.0.1 | head -1 | awk '{print $2}'
}

LAN_IP=$(get_lan_ip)

if [ -z "$LAN_IP" ]; then
  echo "❌ Could not detect LAN IP. Check your network connection."
  exit 1
fi

echo "🌐 LAN IP detected: $LAN_IP"
echo ""
echo "📱 Access from other devices:"
echo "   http://$LAN_IP:4200"
echo ""

# Create/update .env.local for client
echo "VITE_WS_URL=ws://$LAN_IP:3001" > packages/client/.env.local
echo "✅ Created packages/client/.env.local"

# Create .env for server if missing
if [ ! -f packages/server/.env ]; then
  touch packages/server/.env
  echo "✅ Created packages/server/.env"
fi

echo ""
echo "🚀 Starting servers..."
echo "   Server: http://$LAN_IP:3001"
echo "   Client: http://$LAN_IP:4200"
echo ""
echo "Press Ctrl+C to stop both servers"
echo ""

# Start server in background
cd packages/server
npm run dev &
SERVER_PID=$!

# Give server a moment to start
sleep 2

# Start client (foreground, with --host for LAN access)
cd ../client
npm run dev -- --host

# When client exits, kill server
kill $SERVER_PID 2>/dev/null
