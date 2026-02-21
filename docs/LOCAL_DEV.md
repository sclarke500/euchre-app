# Local Development Setup

Run the game locally for LAN multiplayer (e.g., plane trips, no internet).

## Quick Start

```bash
# From repo root
npm run dev:lan
```

This will:
1. Auto-detect your LAN IP
2. Configure WebSocket URL
3. Start both server (port 3001) and client (port 4200)
4. Display URL for other devices to connect

## Manual Setup

If the script doesn't work, you can run each piece manually:

### 1. Find your LAN IP

**Mac:**
```bash
ipconfig getifaddr en0
```

**Windows:**
```bash
ipconfig | findstr IPv4
```

**Linux:**
```bash
hostname -I | awk '{print $1}'
```

### 2. Configure the client

Create `packages/client/.env.local`:
```
VITE_WS_URL=ws://YOUR_IP:3001
```

### 3. Start the server

```bash
cd packages/server
touch .env  # Create if missing
npm run dev
```

### 4. Start the client (LAN accessible)

```bash
cd packages/client
npm run dev -- --host
```

## Connecting Devices

1. Make sure all devices are on the same WiFi network
2. On phones/tablets/other laptops, open browser and go to:
   ```
   http://YOUR_IP:4200
   ```
3. Each device needs a unique nickname to join the same game

## Plane Trip Setup (Offline)

For playing without internet:

1. **Before the flight:**
   - Run `npm install` on your laptop (needs internet)
   - Make sure both `packages/server/dist/` and `packages/client/dist/` exist (run `npm run build` if not)

2. **On the plane:**
   - Connect devices via phone hotspot OR laptop's internet sharing
   - Run `npm run dev:lan`
   - Share the IP with other players

3. **Laptop as hotspot (Mac):**
   - System Settings → General → Sharing → Internet Sharing
   - Share from: WiFi, To: iPhone USB (or create WiFi network)
   - Devices connect to your laptop's shared network

## Troubleshooting

**"Cannot connect to WebSocket"**
- Check that server is running (`localhost:3001`)
- Verify `.env.local` has correct IP
- Firewall may be blocking ports 3001/4200

**"Other devices can't see the game"**
- All devices must be on same network
- Try `--host 0.0.0.0` explicitly: `npm run dev -- --host 0.0.0.0`
- Check firewall settings

**Server crashes on start**
- Create empty `packages/server/.env` file if missing
- Run `npm run build:server` first
