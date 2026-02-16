# euchre-app

Monorepo card game platform featuring Euchre, President, Spades, and Klondike with a Vue client and Node WebSocket server.

## Documentation

Start here for current documentation map and statuses:

- `docs/DOCUMENTATION_INDEX.md`

Canonical multiplayer planning/execution docs:

- `docs/ROADMAP.md`

## Monorepo Structure

```
packages/
├── client/   # Vue 3 + Vite frontend (@euchre/client)
├── server/   # WebSocket game server (@euchre/server)
└── shared/   # Shared rules/types/utilities (@euchre/shared)
e2e/          # Playwright end-to-end tests
docs/         # Planning, architecture, and research docs
```

Client structure (domain-first):

- `packages/client/src/games/<game>/` for game-local boards, adapters, directors, and stores.
- `packages/client/src/components/`, `packages/client/src/composables/`, and `packages/client/src/stores/` for shared UI/engine/utilities.

## Prerequisites

- Node.js `^20.19.0 || >=22.12.0`
- npm

## Setup

```sh
npm install
```

## Common Commands

```sh
# Client dev server (http://localhost:4200)
npm run dev

# Server (http://localhost:3001)
npm run start:server

# Build in dependency order
npm run build:shared
npm run build:server
npm run build:client
```

## E2E Quickstart

```sh
# Terminal 1
npm run start:server

# Terminal 2
npm run dev

# Terminal 3
cd e2e && npm run test:phase0
```

`test:phase0` includes preflight checks for client/server availability to fail fast when local services are not running.
