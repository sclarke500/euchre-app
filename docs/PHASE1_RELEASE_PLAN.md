# Phase 1 Release Plan

**Goal:** Clean, usable UX with graceful error handling for soft launch.

**Date:** 2026-02-15

---

## UX Improvements

### 1. Main Menu Redesign (Game-First Flow)

**Current problem:** Selecting a game then "Multiplayer" is confusing — game selection is ignored.

**New flow:**
```
Homepage: Game grid
    ↓ tap game
Game Screen: [Play Solo] [Play Online] + Settings
    ↓ Play Solo
Start single-player with saved settings
    ↓ Play Online  
Lobby filtered to that game, settings pre-fill new table modal
```

**Files:** `MainMenu.vue`, new `GameLandingPage.vue` or inline

### 2. Per-Game Settings System

**Settings per game (localStorage):**
- Euchre: AI difficulty, stick-the-dealer
- President: Player count (4-6)
- Spades: Win score (300/500)
- Klondike: Draw count (1/3)

**Storage:** `localStorage` keys like `settings_euchre`, `settings_spades`

**Files:** `stores/settingsStore.ts`, new `GameSettings.vue` component

### 3. Multiplayer Modal Cleanup

- Pre-fill from per-game settings
- Allow editing before table creation
- Consistent styling across games

**Files:** Lobby components, `NewGameModal.vue` or similar

### 4. Fix Avatar Layout

**Problems:**
- Top avatar clips off screen
- Inconsistent sizing

**Fix:** Proper spacing/padding, test on mobile viewport

**Files:** `CardTable.vue`, game board components

### 5. Standardize User Action Panel (Player Bar)

**New design:**
```
┌──────────────────────────────────────────┐
│ [Avatar] Player Name        [Actions]    │
│              Your Hand                   │
└──────────────────────────────────────────┘
```

- User gets dedicated bottom bar
- Avatar + name on left
- Action buttons (Pass, Bid, etc.) on right
- Hand below or integrated

**Files:** New `PlayerBar.vue`, update all game boards

### 6. Toast System for Errors

- Transient errors: "Connection lost, reconnecting..."
- Non-blocking, auto-dismiss
- Use existing `useToast.ts` or enhance

**Files:** `useToast.ts`, `ToastContainer.vue`

### 7. End-to-End Testing

- All single-player games start and complete
- All multiplayer games: create → join → play → end
- Disconnect/reconnect flows
- Error scenarios

---

## Implementation Order

| Step | Task | Status |
|------|------|--------|
| 1 | Main menu redesign (game-first) | 🔄 In Progress |
| 2 | Per-game settings system | ⬜ |
| 3 | Multiplayer modal cleanup | ⬜ |
| 4 | Fix avatar layout | ⬜ |
| 5 | Player bar component | ⬜ |
| 6 | Toast error system | ⬜ |
| 7 | E2E testing | ⬜ |

---

## Design Decisions

- **Option A chosen:** Game-first flow (tap game → see options → play)
- **Player bar:** User gets dedicated bottom bar with avatar + actions
- **Settings persist:** localStorage per game, used as defaults everywhere
