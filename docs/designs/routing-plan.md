# Routing Plan

## Current State
- No Vue Router - uses `currentView` ref in App.vue
- Navigation by changing ref value: `currentView = 'lobby'`
- Lobby code stored in lobbyStore, not URL
- Game ID stored in lobbyStore, not URL
- Back/forward buttons don't work
- Can't share links to lobby or game
- Refresh loses all state

## Proposed Routes

```
/                           → Main Menu
/play/:game                 → Single Player (euchre|president|spades|klondike)
/lobby                      → Multiplayer Lobby (create/join tables)
/lobby/:code                → Direct join to table by code
/game/:gameType/:gameId     → Active multiplayer game
```

### Route Examples
- `67cardgames.com/` → Main menu
- `67cardgames.com/play/euchre` → Euchre single player
- `67cardgames.com/lobby` → Multiplayer lobby
- `67cardgames.com/lobby/ABC123` → Join table ABC123
- `67cardgames.com/game/euchre/xyz789` → Reconnect to game xyz789

## Benefits
1. **Back/forward work** - natural browser navigation
2. **Shareable URLs** - send lobby codes as links
3. **Refresh reconnects** - game ID in URL survives refresh
4. **Deep linking** - bookmark a game type
5. **Better analytics** - page views by route

## Route Behaviors

### `/` (Main Menu)
- Show game selection
- No guards needed

### `/play/:game`
- Validate game param (euchre|president|spades|klondike)
- Invalid → redirect to `/`
- Start single player mode

### `/lobby`
- Connect to WebSocket
- Show create/join UI
- If `:code` param, auto-join that table

### `/lobby/:code`
- Connect to WebSocket
- Auto-join table with code
- Invalid code → show error, stay on `/lobby`

### `/game/:gameType/:gameId`
- Validate game exists on server
- If valid: reconnect and render game board
- If invalid: redirect to `/lobby` with "game ended" message
- Leave confirmation when navigating away during active game

## Navigation Guards

### `beforeEach` (global)
- Track previous route for "back to X" logic

### `/game/*` guard
- Check if game exists
- Trigger reconnect flow
- Redirect if game doesn't exist

### Leave game confirmation
- If navigating away from `/game/*` with active game
- Show "Leave game?" modal
- Prevent navigation or confirm

## Implementation Steps

### Phase 1: Setup (non-breaking)
1. `npm install vue-router`
2. Create `src/router/index.ts` with route config
3. Create route components (thin wrappers initially)

### Phase 2: Migration
4. Update `main.ts` to use router
5. Replace App.vue view switching with `<router-view>`
6. Update lobbyStore to read/sync with route params
7. Replace all `currentView = 'x'` with `router.push('/x')`

### Phase 3: Features
8. Add navigation guards
9. Add leave confirmation modal
10. Add reconnect logic for `/game/:id`
11. Update lobby to use URL codes

## File Structure

```
src/
  router/
    index.ts          # Route definitions
    guards.ts         # Navigation guards
  views/
    HomeView.vue      # Main menu (wraps MainMenu.vue)
    PlayView.vue      # Single player (wraps game boards)
    LobbyView.vue     # Lobby (wraps Lobby.vue)
    GameView.vue      # Multiplayer game (wraps game boards)
```

## State Management Changes

### lobbyStore additions
- `syncWithRoute(route)` - called on route enter
- `currentTableCode` - derived from route param
- `currentGameId` - derived from route param

### URL → State flow
```
User visits /lobby/ABC123
  → router calls lobbyStore.syncWithRoute()
  → lobbyStore reads code from route
  → lobbyStore.joinTable('ABC123')
  → table joined, UI updates
```

### State → URL flow
```
User creates table, gets code XYZ
  → lobbyStore.currentTableCode = 'XYZ'
  → watcher pushes router.replace('/lobby/XYZ')
  → URL updates without navigation
```

## Open Questions

1. **Query params vs path segments?**
   - `/lobby?code=ABC` vs `/lobby/ABC`
   - Path segments feel cleaner, going with that

2. **Game ID format?**
   - Current: short random string like `q4tke3l`
   - Works fine for URLs

3. **Handle stale game URLs?**
   - Bookmark `/game/euchre/old123`, game ended
   - Option A: Redirect to `/lobby` with message
   - Option B: Show "game ended" page with button to lobby
   - Going with A (simpler)

4. **Single player routes needed?**
   - Could just be `/play/euchre` without state in URL
   - No need to persist single player state in URL
   - Refresh restarts game (acceptable)
