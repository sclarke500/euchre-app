# Multiplayer Requirements

## Overview

Add multiplayer support to the Euchre app, allowing players to join public games with other human players. The existing single-player mode (1 human + 3 AIs) remains available.

## Game Modes

### Single Player (existing)
- User plays with 3 AI opponents
- No server connection required
- Accessed from main menu

### Multiplayer
- Users join public "tables" (game rooms)
- 1-4 human players per table
- Empty seats filled with AI when game starts
- Real-time gameplay via WebSocket connection

## Matchmaking

### Public Tables
- Lobby shows only tables waiting for players (in-progress games not shown)
- Each table displays:
  - Table name/ID
  - 4 seat slots showing either:
    - Player nickname (if occupied)
    - Empty/clickable (if available)
- Players join by clicking an empty seat slot
- Seat selection determines partnerships (players across from each other are teammates)
- Players can create a new table via "Create Table" button

### Creating a Table
- Player clicks "Create Table" button
- New table appears in lobby list
- Creator automatically seated in first slot (seat 0)
- Creator has "Start Game" button (visible only to them)

### Starting a Game
- Only table creator can start the game
- Can start with any number of human players (1-4)
- Vacant seats automatically filled with AI players
- When started:
  - All players at table leave lobby and enter game view
  - Table removed from lobby list (no longer visible to others)

## User Identity

### Anonymous Players
- No login/registration required
- Players choose a nickname on first visit
- Nickname stored in localStorage (persists across sessions)
- Nickname editable from settings/lobby

### Session Management
- Session state stored in sessionStorage:
  - `odusNickname`: Player's display name
  - `ouserId`: Unique identifier (UUID, generated on first visit)
  - `odusGameId`: Current game ID (if in a game)
- Survives page refresh and temporary disconnects
- Cleared when browser tab closes

### Reconnection
- If player refreshes or briefly disconnects:
  - Server holds their seat for ~30 seconds
  - Player auto-rejoins if same userId connects
  - Game state restored from server
- If timeout expires:
  - Seat converted to AI player
  - Game continues for remaining players

## Technical Architecture

### Project Structure (Monorepo)
```
euchre-app/
├── packages/
│   ├── client/          # Vue.js frontend (current src/ moved here)
│   ├── server/          # Node.js WebSocket server
│   └── shared/          # Shared types and game logic
├── package.json         # Workspace root
└── docs/
```

### Server Stack
- **Runtime**: Node.js
- **WebSocket**: ws or Socket.io
- **Hosting**: Render.com (Web Service)
- **State**: In-memory (no database for v1)

### Client Changes
- New lobby/matchmaking UI
- WebSocket service for server communication
- Game store updates to handle server-authoritative state
- Reconnection logic

## Message Protocol

### Client → Server

| Message | Payload | Description |
|---------|---------|-------------|
| `join_lobby` | `{ nickname }` | Enter lobby, get table list |
| `create_table` | `{ tableName? }` | Create new table |
| `join_table` | `{ tableId, seatIndex }` | Join specific seat at table |
| `leave_table` | `{}` | Leave current table |
| `start_game` | `{}` | Start game (creator only) |
| `make_bid` | `{ action, suit?, goingAlone? }` | Submit bid |
| `play_card` | `{ cardId }` | Play a card |
| `discard_card` | `{ cardId }` | Dealer discard |

### Server → Client

| Message | Payload | Description |
|---------|---------|-------------|
| `lobby_state` | `{ tables: Table[] }` | Full lobby state |
| `table_updated` | `{ table: Table }` | Table state changed |
| `table_removed` | `{ tableId }` | Table no longer exists |
| `game_state` | `{ gameState: GameState }` | Full game state (filtered per player) |
| `player_joined` | `{ playerId, nickname }` | Player joined table |
| `player_left` | `{ playerId }` | Player left/disconnected |
| `your_turn` | `{ validActions }` | Prompt for player action |
| `error` | `{ message }` | Error message |

### Server → All (Broadcast)

| Message | Payload | Description |
|---------|---------|-------------|
| `bid_made` | `{ playerId, action, suit? }` | Bid announcement |
| `card_played` | `{ playerId, card }` | Card played |
| `trick_complete` | `{ winnerId, cards }` | Trick finished |
| `round_complete` | `{ scores, winner }` | Round finished |
| `game_over` | `{ winningTeam, finalScores }` | Game ended |

## UI Flow

### Main Menu
```
┌─────────────────────────┐
│     EUCHRE             │
│                         │
│   [ Single Player ]     │
│   [ Multiplayer   ]     │
│                         │
│   Nickname: ________    │
└─────────────────────────┘
```

### Multiplayer Lobby
```
┌───────────────────────────────────────────────────────────┐
│  LOBBY                                    [Create Table]  │
├───────────────────────────────────────────────────────────┤
│                                                           │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  Table #1                                           │  │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐ │  │
│  │  │  Steve  │  │ [empty] │  │  Mike   │  │ [empty] │ │  │
│  │  │ (host)  │  │  click  │  │         │  │  click  │ │  │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘ │  │
│  │      0            1            2            3       │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  Table #2                                           │  │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐ │  │
│  │  │  Alice  │  │ [empty] │  │ [empty] │  │ [empty] │ │  │
│  │  │ (host)  │  │  click  │  │  click  │  │  click  │ │  │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘ │  │
│  │      0            1            2            3       │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                           │
└───────────────────────────────────────────────────────────┘

Seats 0 & 2 are Team 1 (partners)
Seats 1 & 3 are Team 2 (partners)
```

### After Joining a Table (creator view)
```
┌───────────────────────────────────────────────────────────┐
│  TABLE #1                                                 │
├───────────────────────────────────────────────────────────┤
│                                                           │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐       │
│  │  You    │  │  Mike   │  │ [empty] │  │ [empty] │       │
│  │ (host)  │  │         │  │  (AI)   │  │  (AI)   │       │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘       │
│      0            1            2            3             │
│                                                           │
│  [ Leave Table ]                      [ Start Game ]      │
│                                                           │
└───────────────────────────────────────────────────────────┘

Note: Empty seats show "(AI)" preview - will be filled with AI when game starts
```

## State Management

### Server is Authoritative
- Server manages all game logic
- Client sends actions, receives state updates
- Prevents cheating (can't see other players' cards)
- Client game store becomes "view" of server state

### Filtered Game State
- Server sends each player only what they should see:
  - Their own hand (full card details)
  - Other players' hand sizes (not card values)
  - Current trick (all played cards visible)
  - Scores, trump, current player, phase

## Open Questions

1. **Table expiration**: How long do empty tables persist? (Suggest: 5 minutes)
2. **Max tables**: Limit concurrent tables? (Suggest: 50 for free tier)
3. **Chat**: Add simple text chat in v1? (Suggest: No, keep simple)
4. **Player kick**: Can creator kick players? (Suggest: No for v1)
5. ~~**Team selection**: Can players choose teams?~~ **Resolved**: Players choose seat when joining, which determines their team (seats 0&2 vs 1&3)

## Implementation Phases

### Phase 1: Project Setup
- Convert to monorepo structure
- Extract shared types to shared package
- Set up basic server with WebSocket

### Phase 2: Lobby System
- Implement lobby UI on client
- Server table management (create/join/leave)
- Real-time table list updates

### Phase 3: Multiplayer Game
- Move game logic to server
- Client receives and displays server state
- Handle all player actions via WebSocket

### Phase 4: Polish
- Reconnection handling
- Error states and edge cases
- Deploy to Render.com

---

## Questions for Review

1. Does the message protocol cover all game actions?
2. Is the reconnection timeout (30s) reasonable?
3. Any concerns about the monorepo structure?
4. Should we add anything else for v1?
