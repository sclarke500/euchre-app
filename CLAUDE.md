# CLAUDE.md

This file provides context for Claude Code when working on this project.

**Important**: Keep this file updated! When you make significant changes to the project (new patterns, conventions, architecture decisions, or gotchas), update the relevant sections here so future sessions have accurate context.

## Project Overview

A card game platform featuring Euchre, President, Spades, and Klondike. Built as a monorepo with a Vue 3 frontend and Node.js WebSocket server.

Canonical status/planning docs:
- `docs/DOCUMENTATION_INDEX.md`
- `docs/ROADMAP.md`

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

### Key Files
- `CardTable.vue` - Shared table surface and avatar/chip rendering
- `BoardCard.vue` - Single card component with position/animation methods
- `cardContainers.ts` - Container classes that own and position cards
- `useCardTable.ts` - Engine API for decks/hands/piles + card moves

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

### Table Layout
- `.table-surface` with CSS for felt texture and wood border
- Supports `normal` (4 players) and `wide` (5+ players) layouts
- Player avatars positioned outside table edges
- User always at bottom (seat-0), hidden avatar

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
