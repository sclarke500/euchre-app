# Visual Inventory & Consistency Audit

Purpose: after moving the board to the **one-layer, all-pixels** model (canonical
720-tall space, single `--board-scale` transform), audit every board UI element
across Euchre / Spades / President to (a) find visual divergences, (b) list the
remaining raw-px scaling debt, and (c) identify copy-pasted markup that should
become shared components. Standalone pages (home/landing/etc.) are out of scope —
they are responsive web pages, not the board.

## Canonical token scale (reference)

All board text/box sizing should use these. They are plain canonical px and scale
with the board transform (≈0.55 on phones, ≈1.1 on tablets).

| Token | px | Role |
|---|---|---|
| `$ui-xs` | 22 | fine print, secondary chips |
| `$ui-sm` | 25 | labels, body, checkboxes |
| `$ui-md` | 29 | names, buttons, emphasis |
| `$ui-lg` | 36 | prompts, section headings |
| `$ui-xl` | 51 | score numbers, hero text |

## Cross-game element matrix

| Element | Euchre | Spades | President | Shared? | Status |
|---|---|---|---|---|---|
| **Scoreboard** | `.scoreboard` Us/Them — label `$ui-md`, value `$ui-xl`, radius 12, pad 10×16 | `.spades-scoreboard` — **now aligned** to Euchre | `.round-indicator` "Round N" — `$ui-xs`, radius 6, pad 6×12 | ❌ local per game | ⚠️ Euchre≡Spades; President is a different readout (no team score). Extract shared `<HudReadout>` shell. |
| **Action panel shell** | `.action-panel-container .frosted-panel--right` pad 30×26, radius 32, min-w 210 | n/a (uses bid wheel) | same shell as Euchre | partial | ✅ shell consistent Euchre≡President |
| **Action buttons** | `.frosted-btn` overridden → `$ui-lg`; suit `$ui-xl` | bid button `$ui-md` | **inherits frosted-btn mixin default = 14px raw** | mixin | 🔴 President play/pass buttons ~14px vs Euchre 36px — biggest visible divergence |
| **Bid/turn input** | inline in action panel | `SpadesBidWheel` (number `46px` raw) + `BlindNilPrompt` (`15px` raw) | inline in action panel | Spades-only comps | ⚠️ bid wheel + blind-nil use raw px |
| **Go Alone control** | native `<input switch>` `$ui`-sized | n/a | n/a | local | ✅ |
| **Player status callout** | `.player-status` (shared) | same | same | ✅ PlayerAvatar | ✅ consistent |
| **Trump chip (NE)** | `.avatar-chip--trump` 1.5em@`$ui-lg` | n/a | n/a | ✅ shared | ✅ |
| **Bid badge (NE)** | n/a | `.avatar-bid-badge` 1.9em@`$ui-md` | n/a | ✅ shared (PlayerAvatar) | ✅ new, consistent w/ trump anchor |
| **Dealer chip (NW)** | `.avatar-chip--dealer` 1.7em@`$ui-md` | same | same | ✅ shared | ✅ |
| **Rank badge** | n/a | n/a | `.rank-badge` `$ui-lg` emoji (slot) | local | ✅ token-based |
| **GameHUD menu** | shared, item `$ui-sm`, min-w 200 | same | same | ✅ shared | ✅ (wrap fixed by one-layer) |
| **Turn timer** | shared; reset btn `16px` raw | same | same | ✅ shared | ⚠️ reset btn raw px |
| **Rules modal** | `.modal-light .rules-content` `$ui-sm` | same | same | ✅ pattern | ✅ consistent |
| **Game-over modal** | `.game-over-*` title `$ui-md`/result `$ui-sm`/scores `$ui-xs` | identical | rank list `$ui-sm` | partial | ✅ Euchre≡Spades; President rank-based by design |
| **Leave confirm** | `.game-dialog` (rem-based) | same | same | ✅ shared `_game-dialog.scss` | ⚠️ rem-based, not canonical |
| **Round summary** | n/a | `.round-summary-*` `$ui-xs`/`$ui-md` | `.round-modal` rankings `$ui-sm` | local | ⚠️ per-game tables |

## Divergences & debt — prioritized fix list

### P1 — visible cross-game inconsistency — ✅ DONE
1. ✅ **President action buttons.** Gave President the same `.action-panel-container
   .frosted-btn { font-size: $ui-lg; padding: 16px 28px }` override Euchre has. Left the
   shared `.frosted-btn` mixin (14px) alone because teleported modal buttons also use it
   (see note under P2).
2. ✅ **Scoreboard shell.** Aligned President's `.round-indicator` to the Euchre/Spades
   scoreboard shell (radius 12, pad 10×16, `$ui-sm`, safe-area insets). Content stays
   "Round N". Full `<Scoreboard>` extraction deferred to P3 #9.

### P2 — raw-px scaling debt — ✅ DONE (board) / deferred (teleported)
3. ✅ `SpadesBidWheel.vue` `.bid-value` 46px → `$ui-xl`.
4. ✅ `BlindNilPrompt.vue` `.prompt-btn` 15px → `$ui-sm`.
5. ✅ `TurnTimer.vue` `.timer-reset-btn` 16px → `$ui-sm`.
6. ✅ `DisconnectedPlayerBanner.vue` rem fonts → `$ui-sm`/`$ui-xs` (renders inside the
   scaled board, so rem didn't scale with it).
7. ⏸️ **Deferred to P3 (modal unification):** `_frosted-glass.scss` `.frosted-btn` 14px,
   `_game-dialog.scss` rem fonts, `Modal.vue` dialog-title 1.25rem. These all live in
   **teleported modals** (`Modal.vue` → `<Teleport to="body">`), which render OUTSIDE the
   scaled board, so rem is actually correct there and canonical px would be wrong. Touching
   the mixin would also unbalance modal title-vs-button sizing. Handle as a set when the
   modal skins are consolidated.

### P3 — refactor / dedupe (the structural fix)
9. **Extract `<Scoreboard>` / `<HudReadout>`** — the Us/Them board is copy-pasted in
   Euchre & Spades and drifted (already re-synced once). One component, props for rows.
10. **Unify the modal skins.** `.dialog-panel`, `.game-dialog`, `.game-over-panel`,
    `.round-summary-panel`, `.round-modal`, `.modal-light` are several overlapping systems
    on top of the shared `Modal.vue`. Consolidate to one panel + title + actions skin.
11. **Avatar chip size mismatch (latent):** `avatarChipLayout.ts` `TRUMP_CHIP_SIZE=36`/
    `DEALER_CHIP_SIZE=40` are used for *positioning*, but the chips actually render at
    `1.5em`/`1.7em` (≈54/49px). Positioning math and render size disagree; reconcile.

## Confirmed clean / consistent (no action)
- **Token leakage: none.** Standalone pages (`views/*`, `MainMenu`, `SettingsModal`,
  `Lobby`, `CreateGameView`) use zero board tokens — boundary respected.
- Player-status callouts, trump/dealer/bid chips, GameHUD menu, rules-modal pattern,
  Euchre↔Spades game-over modal — all consistent.

## ui-size() shim debt
`ui-size()` now just returns its `$max`. ~13 call sites remain in `PlayerAvatar.vue`
(user/opponent name padding+font, avatar initial, status font+padding) and 2 in
`EuchreEngineBoard.vue` (checkbox box). Inline these to plain px, then delete the shim
from `_variables.scss`. (Re-grep `ui-size(` before deleting.)
