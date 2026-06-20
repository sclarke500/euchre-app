# Platform Layout Contract

**Status:** Authoritative (2026-06-14)  
**Scope:** Trick-taking games (Euchre, Spades, President) and future games using `useCardController`.

If this doc conflicts with older layout docs (`CARD_SIZES_POSITIONS.md` breakpoint tables, `SAFE_AREAS.md` board-shrinking diagram), **this doc wins**.

---

## Coordinate Space (Model B)

| Constant | Value | Location |
|----------|-------|----------|
| Canonical height | `720` | `useBoardViewport.CANONICAL_HEIGHT` |
| Base card width | `116` | `useBoardViewport.BASE_CARD_WIDTH` |
| Card aspect ratio | `1.4` | `useBoardViewport.CARD_ASPECT_RATIO` |
| Scale | `viewportHeight / 720` | `useBoardViewport.scale` |

- Canonical **width** follows viewport aspect ratio (`720 × aspect`).
- All game positions, offsets, and card sizes are expressed in **canonical units**.
- There are **no device tiers** — one scale handles every device.
- The felt is **full-bleed** (extends under notches). Safe areas apply to interactive HUD only.

Import frozen constants:

```ts
import { PLATFORM_CONSTANTS } from '@/composables/useBoardViewport'
```

---

## Container Positioning (Anchor Bindings)

Card containers (hands, piles, deck) are positioned via **anchor + offset** bindings, not absolute pixels in game code.

```ts
import { buildContainerBindings, type ContainerBinding } from '@/composables/useCardLayout'

const bindings = buildContainerBindings(4, userSeatIndex)
```

| Anchor | Resolves to |
|--------|-------------|
| `table-center` | Center of the felt |
| `user-hand` | Bottom player fanned hand (`boardHeight × 0.84`) |
| `user-avatar` | Bottom center avatar (`boardHeight - 50`) |
| `seat-N` | Seat N hand position from `computeTableLayout` |

Games may pass `containerBindings` overrides to `useCardController` for game-specific deltas. Do not set `hand.position` in directors.

---

## Card Context Scales

Single multiplier set in `useCardSizing.CardScales` — applied in canonical space for all devices:

| Key | Multiplier | Used for |
|-----|------------|----------|
| `userHand` | 1.5 | Player's hand |
| `opponentHand` | 0.65 | Opponent hands |
| `playArea` | 0.8 | Center trick pile |
| `deck` | 0.8 | Deal stack |
| `tricksWon` | 0.5 | Won-trick piles |

---

## Render Paths

| Path | Routes | Layout system |
|------|--------|---------------|
| **Canonical** | Euchre, Spades, President | `ScaledContainer` → `useBoardViewport` |
| **Responsive shell** | Main menu, lobby | Full-viewport CSS |
| **Scrollable docs** | Landing, privacy, support | Normal web flow |
| **Solitaire engine** | Klondike | `useKlondikeLayout` (separate, do not leak) |

---

## HUD / Safe Areas

| Var | Units | Set by | Used by |
|-----|-------|--------|---------|
| `--safe-*` | Canonical | `ScaledContainer` | HUD inside `CardTable` (`calc(Npx + var(--safe-top))`) |
| `--board-scale` | Ratio | `ScaledContainer` | `ui-size()` SCSS helper |
| `--screen-safe-*` | Viewport px | `ScaledContainer` + `applySafeAreaCSSVars` | Teleported overlays via `useScreenOverlay` |

**Inside the scaled canvas:** use `--safe-*` (canonical).  
**Teleported to `<body>`:** use `useScreenOverlay()` → `--screen-safe-*`.

## Render Modes (`useAppRenderMode`)

| Mode | Routes | Container |
|------|--------|-----------|
| `canonical` | `/play/euchre`, `/lobby`, `/game/*`, `/dev/layout` | `ScaledContainer` |
| `responsive-shell` | `/play` (main menu) | None |
| `scrollable` | `/`, `/privacy`, `/support` | None |
| `solitaire` | `/play/klondike` | None (Klondike engine) |

---

## Deprecated Patterns

Do **not** add new code using:

- Viewport breakpoint tables for card base width
- `isMobile()` affecting card sizes or layout offsets
- Absolute pixel positions in game directors
- Per-game resize listeners (use `CardTable` `@layout-changed` → `cardController.handleLayoutChange`)

---

## New Trick-Taking Game Checklist

1. `useCardController(engine, boardRef, { ...presets, containerBindings?: overrides })`
2. Director calls `setupTable()` / `handleLayoutChange()` — no layout math
3. Board wires `@layout-changed` to `director.handleLayoutChange()`
4. Override bindings only for game-specific container positions