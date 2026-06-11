# Capacitor Native App Setup (iOS + Android)

The web app (`@67cards/client`) ships to the Apple App Store and Google Play via
[Capacitor](https://capacitorjs.com), which wraps the existing Vite build in a native
shell. No rewrite — the same Vue codebase loads inside a native WebView from bundled
assets.

- **App name**: 67 Card Games
- **Bundle / App ID**: `com.sixsevencardgames.app` (reverse-DNS; no segment may start
  with a digit, so not `com.67cards.app`)
- **Web assets**: `packages/client/dist` (Vite build output → `webDir` in `capacitor.config.ts`)

This repo already contains the committable scaffold (`capacitor.config.ts`, deps in
`packages/client/package.json`, npm scripts, `.gitignore` entries). The steps below
generate the native projects and must be run **on a Mac with the native toolchains** —
they can't run in CI/sandbox.

---

## Prerequisites

| Target | Needs |
|---|---|
| Build tooling | Node 20+ (already required by this repo) |
| iOS | macOS, **Xcode**, **CocoaPods** (`sudo gem install cocoapods` or `brew install cocoapods`) |
| Android | **Android Studio** + Android SDK (set `ANDROID_HOME`) |
| Publishing — iOS | Apple Developer Program — **$99/year** |
| Publishing — Android | Google Play Console — **$25 one-time** |

---

## One-time setup

From the repo root:

```bash
# 1. Install dependencies (adds the @capacitor/* packages already listed in package.json)
npm install

# 2. Generate the native projects (run from the client package)
cd packages/client
npm run build              # produce dist/ so cap has web assets to copy
npx cap add ios
npx cap add android
```

This creates `packages/client/ios/` and `packages/client/android/`. **Commit those
folders** — they hold native config/signing setup. Their build artifacts and the synced
web bundle are already gitignored.

---

## Dev loop

After any web change, rebuild + sync, then open the native IDE:

```bash
# from packages/client
npm run cap:ios       # build + cap sync ios + open Xcode
npm run cap:android   # build + cap sync android + open Android Studio
npm run cap:sync      # build + cap sync (both platforms, no IDE open)
```

In Xcode/Android Studio: pick a simulator/device and Run. To ship: Xcode → Product →
Archive → distribute to App Store Connect; Android Studio → Build → Generate Signed
Bundle.

---

## ⚠️ Critical: WebSocket URL for native builds

Multiplayer connects via `VITE_WS_URL`, falling back to `ws://${window.location.host}`
([lobbyStore.ts](../packages/client/src/stores/lobbyStore.ts)). **That fallback does not
work in the native app** — the WebView's host is `localhost`, not your server. And
`ws://` (plaintext) is blocked by iOS App Transport Security.

**The server is already hosted with TLS.** It runs as a separate Render web service at
`euchre-app.onrender.com` (Express HTTP + WebSocketServer on the same port), and Render
provisions TLS on `*.onrender.com` — so `wss://euchre-app.onrender.com` works today. The
hosted PWA at `67cardgames.com` already uses it via a `VITE_WS_URL` build env var set in
the static-site host's dashboard (not committed). No new server hosting is required.

For the native build, create `packages/client/.env.production` (gitignored):

```
VITE_WS_URL=wss://euchre-app.onrender.com
```

Vite loads `.env.production` for `npm run build` and it overrides `.env.local`, so the
native bundle uses the production server. **Confirm this matches the `VITE_WS_URL` the
hosted PWA is built with** (check the static site's env vars in the host dashboard) — a
wrong value means multiplayer silently fails to connect in the app.

**Cold-start caveat:** if the Render service is on the free tier it spins down after
~15 min idle and cold-starts take ~30–60s. The client has a 10s connection timeout, so
the first connect after idle may fail and then retry (the reconnect logic added in
[MULTIPLAYER_RECONNECT_HARDENING.md](MULTIPLAYER_RECONNECT_HARDENING.md) keeps retrying).
A paid Render instance avoids the spin-down.

---

## Roadmap

- **Phase 1 — Runnable shell (this scaffold).** `npm install` + `cap add` → app runs in
  simulator loading bundled `dist/`. ✅ scaffold committed; run the commands above.
- **Phase 2 — Make it real.**
  - Set `VITE_WS_URL=wss://euchre-app.onrender.com` in `.env.production` (the server
    is already hosted on Render with TLS — no new hosting needed).
  - App Store polish (guideline 4.2): splash screen, app icon, status-bar/safe-area
    handling (safe areas already done), optional haptics on card plays.
  - Push notifications (APNs/FCM) for "it's your turn" while backgrounded — hooks into
    the existing server-side turn-timer reminders.
- **Phase 3 — Submit.** Apple Developer account, screenshots, privacy labels (trivial
  while there's no ads/tracking), archive → store.

Monetization (ads via AdMob, or IAP) is additive and can be added later — see notes in
chat history. Ads take no Apple cut; IAP is the 15–30% path and only needed if selling
digital goods.

## Notes

- All `@capacitor/*` packages must share the same major version (currently `7.x`).
- Keep the native app version in sync with `packages/client/package.json` / store
  metadata when releasing.
