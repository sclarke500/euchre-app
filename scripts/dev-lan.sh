#!/bin/bash
# Start local dev server accessible on LAN via Caddy
# Usage: npm run dev:lan (from repo root)

set -e

cd "$(dirname "$0")/.."

# Get LAN IP (works on Mac)
get_lan_ip() {
  for iface in en0 en1 en2; do
    ip=$(ipconfig getifaddr $iface 2>/dev/null)
    if [ -n "$ip" ]; then
      echo "$ip"
      return
    fi
  done
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
echo "   http://$LAN_IP:8080"
echo ""

# Kill any existing processes on our ports
echo "🧹 Cleaning up old processes..."
pkill -f "@67cards/server" 2>/dev/null || true
pkill -f "tsx.*index.ts" 2>/dev/null || true
pkill -f "caddy run" 2>/dev/null || true
sleep 1

# Build client first
echo "📦 Building client..."
npm run build -w @67cards/client

# Clean up old env files that might interfere
rm -f packages/client/.env.local

echo ""
echo "🚀 Starting servers..."
echo "   Caddy (proxy):  http://$LAN_IP:8080"
echo "   Backend:        localhost:3001 (internal)"
echo ""
echo "Press Ctrl+C to stop all servers"
echo ""

# Start backend in background
npm run dev -w @67cards/server &
SERVER_PID=$!

# Give server a moment to start
sleep 2

# Start Caddy (foreground)
caddy run --config Caddyfile

# When Caddy exits, kill backend
kill $SERVER_PID 2>/dev/null
