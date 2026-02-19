# Card Sizes & Positions

Reference for unified card dimensions and positions across games (excluding Klondike).

---

## Centralized Sizing (useCardSizing.ts)

All card scales are now centralized in `composables/useCardSizing.ts`.

### CardScales (unified multipliers)
```ts
export const CardScales = {
  userHand: 1.5,        // Player's hand - largest for readability
  opponentHand: 0.65,   // Opponent hands - smaller to fit on table
  playArea: 0.85,       // Cards played to center
  deck: 0.8,            // Deal stack
  tricksWon: 0.5,       // Won trick piles - small stacks
  sweep: 0.6,           // Cards being swept off table
  mini: 0.3,            // Very small (exchange animations)
  hidden: 0.05,         // Collapsed at avatar (essentially invisible)
}
```

### Viewport-Responsive Base Size
```ts
// Base card width at different viewport breakpoints
const VIEWPORT_BREAKPOINTS = [
  { minWidth: 1920, baseWidth: 95 },   // Large desktop / TV
  { minWidth: 1440, baseWidth: 88 },   // Desktop
  { minWidth: 1024, baseWidth: 83 },   // iPad landscape / small desktop
  { minWidth: 768, baseWidth: 78 },    // iPad portrait
  { minWidth: 0, baseWidth: 70 },      // Mobile
]
```

### Per-Game Overrides
| Game | User Hand | Opponent Hand | Notes |
|------|-----------|---------------|-------|
| **Euchre** | CardScales.userHand | CardScales.opponentHand | Standard |
| **Spades** | CardScales.userHand | CardScales.opponentHand | Standard |
| **President** | CardScales.userHand | CardScales.tricksWon (0.5) | Smaller opponents (13+ cards) |

### Effective Pixel Sizes

| Scale | Width | Height | Used For |
|-------|-------|--------|----------|
| 1.6 | 133px | 186px | User hand |
| 1.0 | 83px | 116px | Base |
| 0.9 | 75px | 104px | Play area (President) |
| 0.8 | 66px | 93px | Play area (Euchre/Spades), **Deck** |
| 0.7 | 58px | 81px | Opponent hands (Euchre/Spades) |
| 0.6 | 50px | 70px | Sweep animation |
| 0.5 | 42px | 58px | President opponent hands, **Tricks won piles** |
| 0.3 | 25px | 35px | (unused currently) |
| 0.05 | 4px | 6px | Hidden (collapsed at avatar) |

---

## Deck (Deal Stack)

**Scale:** 0.8

**Position:** Offset 280px from table edge on dealer's side
```ts
// getDealerDeckPosition() in useCardController.ts
const off = 280
switch (seat.side) {
  case 'bottom': { x: centerX, y: bottom + off }
  case 'left':   { x: left - off, y: centerY }
  case 'top':    { x: centerX, y: top - off }
  case 'right':  { x: right + off, y: centerY }
}
```

---

## Tricks Won Piles

**Scale:** 0.5

**Position:** Near each player's table edge, stacked with offset
```ts
// getPlayerTrickPosition() in useCardController.ts
const inset = 20   // Distance from table edge
const gap = 12     // Horizontal gap between tricks

// Seat 0 (user/bottom): x = centerX - 60 - trickNumber * gap, y = bottom - inset
// Seat 1 (left): x = left + inset, y = centerY - 40 - trickNumber * gap
// Seat 2 (top): x = centerX + 60 + trickNumber * gap, y = top + inset
// Seat 3 (right): x = right - inset, y = centerY + 40 + trickNumber * gap

// Cards within a trick stack: y offset by -0.6px per card
```

**Rotation:** 0° for top/bottom, 90° for left/right

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
