# Card Sizes & Positions

Reference for unifying card dimensions and positions across games (excluding Klondike).

---

## Current State

### Base Card Size (CSS Variables)
```scss
// packages/client/src/assets/styles/_variables.scss
$card-width: 83px;
$card-height: 116px;
// Aspect ratio: 1.4 (standard playing card)
```

### Scale by Context

| Game | User Hand | Opponent Hand | Play Area | Notes |
|------|-----------|---------------|-----------|-------|
| **Euchre** | 1.6 | 0.7 | 0.8 | Standard trick-taking |
| **Spades** | 1.6 | 0.7 | 0.8 | Same as Euchre |
| **President** | 1.6 | 0.5 | 0.9 | Smaller opponents (more cards), larger play area |

### Effective Pixel Sizes

| Scale | Width | Height |
|-------|-------|--------|
| 1.6 | 133px | 186px | User hand |
| 1.0 | 83px | 116px | Base |
| 0.9 | 75px | 104px | Play area (President) |
| 0.8 | 66px | 93px | Play area (Euchre/Spades) |
| 0.7 | 58px | 81px | Opponent hands |
| 0.5 | 42px | 58px | President opponent hands |
| 0.3 | 25px | 35px | Tricks won pile |
| 0.05 | 4px | 6px | Hidden (collapsed at avatar) |

---

## Position Sources

### useTableLayout.ts
Computes seat positions based on board dimensions:
- `tableBounds`: { left, right, top, bottom, centerX, centerY }
- `seats[i].handPosition`: { x, y } for each player
- User always at seat 0 (bottom center)

### useCardController.ts
Default config per game type:
```ts
const GAME_DEFAULTS = {
  euchre: {
    playAreaMode: 'trick',    // Cards at cardinal positions
    userHandScale: 1.6,
    opponentHandScale: 0.7,
  },
  spades: {
    playAreaMode: 'trick',
    userHandScale: 1.6,
    opponentHandScale: 0.7,
  },
  president: {
    playAreaMode: 'overlay',  // Cards stacked in center
    userHandScale: 1.6,
    opponentHandScale: 0.5,
  },
}
```

### Play Area Modes

**trick** (Euchre, Spades):
- Cards positioned at 4 spots around center
- Each player's card at their "side" of the center
- Offsets: ~50px from center based on seat position

**overlay** (President):
- Cards stacked directly on center
- Small random offset for visual variety
- New cards on top of pile

---

## Hand Positioning

### User Hand (Bottom)
- Y: Near bottom of board
- Arc-fanned layout with curved positions
- Cards overlap based on hand size
- Larger scale (1.6) for readability

### Opponent Hands
- Collapsed at avatar position (scale 0.05 = invisible)
- When revealed: fanned from avatar position
- Smaller scale (0.5-0.7) for table feel

---

## Recommendations for Unification

### Option A: Standardize All Games
```ts
const UNIFIED_SCALES = {
  userHand: 1.5,        // Slightly smaller than current
  opponentHand: 0.6,    // Middle ground
  playArea: 0.85,       // Consistent for all games
  tricksWon: 0.3,       // Small stacked piles
}
```

### Option B: Keep Variations, Document Why
- Euchre/Spades: 5-13 cards, need moderate opponent size
- President: Up to 13+ cards, need smaller opponents
- Keep per-game overrides but establish base defaults

### Positions to Standardize
1. **User hand Y offset** from bottom
2. **Play area center** relative to table bounds
3. **Opponent card reveal** position/fan spread
4. **Tricks won pile** offset from player

---

## Files to Modify for Unification

1. `composables/useCardController.ts` - GAME_DEFAULTS
2. `games/*/use*Director.ts` - Override configs
3. `assets/styles/_variables.scss` - Base dimensions

---

## For 3D Perspective (Future)

When adding `rotateX` to table:
- Cards on table need matching transform
- OR transform entire `.board` container
- Cards in user hand probably stay flat (closer to viewer)
- Need to test click/tap hit areas after transform

---

*Last updated: 2026-02-19*
