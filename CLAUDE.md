# CLAUDE.md

This file provides context for Claude Code when working on this project.

**Important**: Keep this file updated! When you make significant changes to the project (new patterns, conventions, architecture decisions, or gotchas), update the relevant sections here so future sessions have accurate context.

## Project Overview

A card game platform featuring Euchre, President, Spades, and Klondike. Built as a monorepo with a Vue 3 frontend and Node.js WebSocket server.

Canonical status/planning docs:
- `docs/DOCUMENTATION_INDEX.md`
- `docs/ROADMAP.md`
- `docs/GAME_ARCHITECTURE.md` — **pure game / thin host contract** (read before adding games)
- `docs/designs/pure-game-architecture-plan.md` — migration plan

## Project Structure

```
packages/
├── client/     # Vue 3 + Vite frontend (@euchre/client)
├── server/     # WebSocket game server (@euchre/server)
└── shared/     # Shared types and game logic (@euchre/shared)
```

## Tech Stack

- **Frontend**: Vue 3, TypeScript, Pinia (state management), SCSS, Vite
- **Backend**: Node.js, WebSocket (ws library)
- **Shared**: TypeScript types and game logic

## Common Commands

```bash
# Development
npm run dev                              # Start client dev server
npm run start:server                     # Start WebSocket server

# Building (order matters - shared must build first)
npm run build:shared                     # Build shared package
npm run build:client                     # Build client
npm run build:server                     # Build server
npm run build                            # Build shared + client

# Or use workspace flags
npm run build --workspace=@euchre/shared
npm run build --workspace=@euchre/server
```

## Architecture Patterns

### Pure game state machines
Game rules live in `packages/shared` as pure transitions. **Do not** reimplement bid/play/score phase graphs in the client store or server `*Game` class.

- Shared: `create*Game` / `deal*` / `process*` / `apply*` → new state (illegal = same reference)
- SP store / server: `toPureState → pureFn → applyPureState` + animation/WS/AI schedule only
- Reference games: Spades (template), Euchre (`euchre/game.ts`), President (play/pass/exchange)
- Golden replays: `packages/shared/src/testing/golden.ts` (`runGoldenReplay`)
- Details: `docs/GAME_ARCHITECTURE.md`

### Game Adapters
The client uses a `useGameAdapter` composable that abstracts game state access. Components inject the adapter and use it uniformly for both singleplayer and multiplayer modes.

```typescript
const game = inject<GameAdapter>('game')!
const isMyTurn = computed(() => game.isMyTurn.value)
```

### Stores
- `gameStore.ts` - Singleplayer Euchre game state
- `multiplayerGameStore.ts` - Multiplayer Euchre via WebSocket
- `lobbyStore.ts` - Multiplayer lobby/table management
- `klondikeStore.ts` - Klondike solitaire
- `presidentGameStore.ts` - President card game
- `presidentMultiplayerStore.ts` - Multiplayer President via WebSocket
- `spadesStore.ts` - Singleplayer Spades game state
- `spadesMultiplayerStore.ts` - Multiplayer Spades via WebSocket

### WebSocket Messages
Message types defined in `packages/shared/src/multiplayer.ts`:
- `ClientMessage` - Messages from client to server
- `ServerMessage` - Messages from server to client

## Animation Conventions

### Card Play Animation (Euchre)
When a card is played from the player's hand:
1. Card disappears instantly (replaced with invisible placeholder)
2. Gap in hand remains for 400ms
3. Then remaining cards slide together to close gap
4. Play area shows card appearing with its own animation

### Key Animation Classes
- `.dealing` - Cards sliding up from bottom on deal
- `.discarding` - Card flying away animation (dealer discard)
- `.sliding-away` - Hand sliding down (partner going alone)

## Game-Specific Notes

### Euchre
- 4 players, 2 teams (players 0,2 vs 1,3)
- Seat indices 0-3, human player always sees themselves at bottom
- Trump calling has two rounds of bidding
- "Going alone" - partner sits out

### Singleplayer Start Behavior
- Singleplayer games (Euchre, Spades, President) always start fresh when opened.
- "Resume old game" localStorage restore flows have been removed from board/store/director layers.

### Player Timeout System
- Turn reminders sent every 15 seconds
- After 4 reminders (60 seconds), player marked as timed out
- Any player can boot a timed-out player (not just host)
- Booted player replaced with AI

### Game Settings
Settings stored in `settingsStore.ts` with localStorage persistence:

**General:**
- AI Difficulty (Easy/Hard) - affects all games with AI

**Euchre:**
- Dealer Pass Rule: "Dealer Can Pass" (hand redealt) or "Stick the Dealer" (must call)

**President:**
- Super 2s & Jokers: Standard rules have 2s as highest (2 twos beat 2 aces). When enabled, adds Jokers (beat everything) and 2s need one less card (2 twos beat 3 aces)

### Bot Remarks System
Bots comment on game events (chat bubbles). Three layers, all in `packages/shared/src`:

1. **Detection** (per game): `euchre/remarks.ts`, `spades/remarks.ts`, `president/remarks.ts` diff old/new state snapshots (Spades also uses explicit `SpadesRemarkFlags` set by the game at trick/round completion). Each detected event carries a `type` (e.g. `alone_march`), a **category**, a sentiment, and a probability.
2. **Engine** (`ai/remarkEngine.ts`): `createGameRemarkEngine(detectEvents)` — holds the previous snapshot + a **per-instance** 3s cooldown (was module-global; don't regress this, it silenced other server tables). Games expose `createXRemarkEngine()` factories; callers (3 server game classes + 3 singleplayer stores) hold one instance each and call `.process(newState, players, mode)` / `.capture(state)`.
3. **Bot voices** (`ai/bots/*.ts`): text resolution chain in `getRemarkForEvent`: `bot.events[eventType]` (per-event override) → `bot.categories[category]` (brag_big / brag / gloat / wince_big / wince / ominous) → `bot.remarks[sentiment]` (legacy fallback, also serves celebrate/concede for game end).

Notable events: Euchre `alone_march`, `euchred_loner`/`got_euchred_alone`, `march`, `game_point`; Spades `nil_broken`/`broke_nil` (fires **live** when a nil bidder takes their first trick — round-end scoring only flags made nils now), `blind_nil_*`, `bag_penalty` (detected via bags shrinking, since bags are stored `% 10`); President `rank_jump` (Scum→President), `rank_fall`, `repeat_president`. Gloat events fire even when the victim is the human (an AI opponent speaks).

To add a new remarkable situation: add detection in the game's `detectEvents` (or a flag if it's mid-trick), map it to a category, optionally give bots per-event override lines.

### AI Difficulty Levels
Two AI implementations in `packages/shared/src/`:

**Easy AI** (`ai.ts`):
- Stateless - makes locally optimal decisions each turn
- Leads highest non-trump or draws trump with 3+ trump
- Plays lowest winning card, or lowest card if can't win
- Lets partner win without interference

**Hard AI** (`ai-hard.ts`):
- Uses `GameTracker` class to track game state across tricks
- Tracks: cards played, player voids, bowers played, trump remaining
- Smarter lead selection based on remaining trump count
- Knows when off-suit aces are safe (both bowers gone)
- Considers opponent voids when deciding to protect partner's win
- Tracker must be reset each round and updated after each trick

## Card Engine v2

The app uses a shared container-based card animation engine for Euchre, President, and Spades.

**Platform layout contract:** `docs/PLATFORM_CONTRACT.md` — canonical coordinate space (Model B), frozen constants in `useBoardViewport.PLATFORM_CONSTANTS`, container positions via anchor bindings in `useCardLayout.buildContainerBindings()`. Games must not set absolute pixel positions in directors.

### Key Files
- `CardTable.vue` - Shared table surface and avatar/chip rendering
- `BoardCard.vue` - Single card component with position/animation methods
- `cardContainers.ts` - Container classes that own and position cards
- `useCardTable.ts` - Engine API for decks/hands/piles + card moves
- `useBoardViewport.ts` - Single source of truth for canonical scale + safe rect
- `useCardLayout.ts` - Anchor-based container bindings (resize-safe)
- `useCardController.ts` - Shared deal/play/resize animations (uses bindings)
- `useAppRenderMode.ts` - Route → render path (canonical / responsive / scrollable / solitaire)
- `useScreenOverlay.ts` - Safe-area positioning for teleported overlays

### Architecture Concepts

**Container-based ownership**: Cards belong to exactly one container at a time (Deck, Hand, PlayArea). Containers manage card positions based on their mode.

**Single render layer**: All cards render in one flat layer on the board, absolutely positioned. No swapping between render systems.

**ManagedCard**: Wrapper that tracks a card + its face-up state + ref to the DOM component:
```typescript
interface ManagedCard {
  card: EngineCard
  faceUp: boolean
  ref: BoardCardRef | null
}
```

**BoardCardRef methods**:
- `setPosition(pos)` - Instant position (no animation)
- `moveTo(pos, duration)` - Animated transition
- `getPosition()` - Current position
- `setArcFan(enabled)` - Toggle transform-origin for arc-style fanning

### Container Types

**Deck**: Stacked cards at a position (kitty). Has `dealTo(hand)` method.

**Hand**: Player's cards. Two modes:
- `looseStack` - Random-ish pile (face down, waiting)
- `fanned` - Spread out for viewing

Hand options: `rotation`, `scale`, `fanSpacing`, `fanCurve` (arc effect for user's hand)

**PlayArea**: Center area for played cards (not yet fully implemented).

### User-Hand Fan Spacing (read before touching hand spread!)

`Hand.getCardPosition()` in `cardContainers.ts` has **two spacing paths**:
- **Flat branch** (opponents / no curve): gap = `fanSpacing × hand.scale`
- **Arc branch** (user hand, `fanCurve > 0`): gap comes from the locked arc radius = `max(curve formula, fanSpacing × hand.scale)`. Historically the arc **ignored** `fanSpacing` entirely — every spacing knob was a silent no-op for the user's hand until this `max()` was added. If spacing changes seem to do nothing, you're probably in the arc branch.

Key facts:
- `fanSpacing` is **pre-scale**; the rendered gap is `fanSpacing × scale` (user hand scale = 1.5).
- The table-based calc in `useCardController` (focus block) works in *visual canonical px*, then divides the scale back out when storing. Big hands (≥10 cards, Spades/President) target `tableWidth + ¼ card overhang per side` — wider collided with the bid wheel pinned to the right screen edge.
- `config.userFanSpacing` in a director **bypasses the table calc entirely** (Euchre uses 30; Spades' override was deliberately removed — don't re-add it).
- Arc radius **locks on first fan** (`lockedArcRadius`) so spacing stays constant as cards are played; call `resetArcLock()` before re-fanning with new spacing (the focus block does this).

### Suit Glyphs
All suit symbols render via `SuitGlyph.vue` (inline SVG, `fill: currentColor`). **Never** use Unicode ♥♦♣♠ text — platform symbol-font fallbacks size them wildly differently (this was the Android oversized-pips bug).

**Restore helper**: `useCardController` includes `restoreWonTrickStacks(tricks)` for rebuilding decorative won-trick piles from persisted completed tricks. This is reusable across trick-taking games (e.g., Euchre/Spades).

### Table Layout
- `.table-surface` with CSS for felt texture and wood border
- Supports `normal` (4 players) and `wide` (5+ players) layouts
- Player avatars positioned outside table edges
- User always at bottom (seat-0), hidden avatar

## Modal & Dialog Scaling

Modals (`Modal.vue`) teleport to `<body>`, so they **escape the board's transform scale**. On canonical (game) routes:
- Dialogs authored in canonical px opt in via the `scale-with-board` prop → shrunk by `--modal-scale: clamp(0.8, var(--board-scale), 1)`. The **0.8 floor** exists because rem-authored dialogs (President) became unreadable at raw board scale (~0.56 on phones).
- Dialog **buttons** (`.dialog-btn`, `.game-dialog__btn`) are counter-scaled inside `Modal.vue` by dividing by `--modal-scale`, so they render at a constant on-screen size (~15px) on every device. If buttons look too small/large in a scaled dialog, fix it there — **not** by resizing `frosted-btn` or `_game-dialog.scss` (that would leak to unscaled contexts).

## Safe Areas & Orientation (native)

- `--screen-safe-*` vars are set on `:root` by `applySafeAreaCSSVars()`. On **Android** they are live CSS expressions `max(env(...), var(--android-safe-*))` — never numeric snapshots, because the WebView's `env()` omits system bars and MainActivity's injected values can arrive late / change on rotation (ScaledContainer deliberately skips overwriting them on Android). On iOS/web they're numeric (guess-table-floored) and re-applied on resize (main.ts). Details: `docs/SAFE_AREAS.md`.
- MainActivity re-injects `--android-safe-*` on **every page load** (`WebViewListener.onPageLoaded`) — page navigations (initial load, Capgo OTA bundle swaps) replace `documentElement` and wipe injected vars. Don't remove that listener; the insets-changed listener alone only fires again on rotation.
- Fixed/absolute overlays living outside `ScaledContainer` must add `--screen-safe-*` offsets themselves (e.g. MainMenu's settings gear, TurnTimer, bid wheels). Symptom of forgetting: element collides with the status-bar clock/battery or camera cutout in exactly one landscape rotation.
- **Full-bleed pattern**: paint the background (felt/wood) on the outermost full-screen element and apply safe-area padding on that same element so only *content* is inset — otherwise the padding shows black letterbox strips. Klondike's felt lives on `.klondike-layout` (not `.klondike-board`) for this reason.
- Klondike `calculateCardSize()` measures `.klondike-board` itself, which already excludes the menu bar — do **not** subtract a toolbar height (double-count previously shrank cards ~20%).
- `@capacitor/screen-orientation` has **no "either landscape" mask** — `'landscape'` maps to one fixed direction on both platforms. `lockLandscape()` (`utils/orientation.ts`) therefore reads the current orientation and locks to the matching landscape. Never lock a hardcoded direction: it 180°-flips users holding the device the other way.

## App Updates & OTA Releases

Unified update system in `useAppUpdates.ts` (state machine: idle → checking → up-to-date | downloading → ready). Settings → "Check for Updates" drives it on all platforms.

- **Web/PWA**: service worker in `prompt` mode (vite-plugin-pwa). SW is registered manually in `useAppUpdates` — **never inside the native shells** (on Android the SW would fight the OTA bundle swapper).
- **Native (iOS/Android)**: Capgo `@capgo/capacitor-updater` (pinned version) in manual mode. Checks static `https://67cardgames.com/ota/latest.json`, compares against baked-in `__APP_VERSION__`, plugin handles download/atomic swap/rollback. `notifyAppReady()` is called every launch in `initAppUpdates()` — removing it makes Capgo roll back the bundle.

**OTA release flow** (web-layer changes only): `npm run release` — one command. Auto-bumps the patch version (a hand-bumped `packages/client/package.json` version is respected instead), builds, zips dist, publishes (GitHub Release via `gh` CLI, or `public/ota/` fallback), writes `public/ota/latest.json`, then commits **all working-tree changes** and pushes. For the manual/partial flow use `npm run release:ota` (no bump, no push).

**Never OTA-ship** a bundle requiring native code not in the store binary (new Capacitor plugins, MainActivity/iOS shell changes, etc.) — those need a real App Store/Play release. CORS for `/ota/*` is set in `public/_headers`.

**Native version sync**: `scripts/sync-native-version.mjs` (runs automatically in the `cap:*` scripts) keeps Android `versionName`/`versionCode` and iOS `MARKETING_VERSION`/`CURRENT_PROJECT_VERSION` in lockstep with the client package version (build number = `major*1000000 + minor*1000 + patch`). This matters because Capgo's `resetWhenUpdate` only discards a stored OTA bundle when the *native* version changes — with a static versionName, new store binaries stay masked by old OTA bundles.

**Dev gotcha — OTA bundle masks local builds**: once a device has applied an OTA update, Capgo serves that stored bundle instead of the APK's baked-in assets, so `cap:android`/`cap:ios` changes won't appear. Uninstall the app (or clear its storage) first, or use live reload (`npx cap run android -l --external`) for UI iteration.

## Code Style

- Vue components use `<script setup lang="ts">`
- SCSS with variables defined in client's vite config
- Prefer `computed()` over watchers when possible
- Use `ref()` for local component state

## Things to Remember

- Always rebuild shared package after changing types: `npm run build:shared`
- Card sizes use CSS custom properties: `--card-width`, `--card-height`
- Player IDs are seat indices (0-3), not unique IDs
- `odusId` is the unique player identifier for WebSocket connections
