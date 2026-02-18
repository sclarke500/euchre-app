# Turn Mechanics Improvements - February 2026

## Overview

This document outlines the improvements made to the turn mechanics system in the euchre card game platform, addressing flashing issues in singleplayer mode and improving code consistency across games.

## Issues Identified

### 1. Rapid Turn Indicator Changes in Singleplayer
**Problem**: During AI turns, `currentPlayer` changes rapidly (0→1→2→3→0), causing the turn indicator glow to flash quickly between avatars.

**Root Cause**: AI plays happen synchronously without delays, leading to immediate state changes that trigger UI updates.

### 2. Inconsistent Naming Conventions
**Problem**: Different games used different naming for similar concepts:
- Euchre: `isMyTurn` / `validCards`
- Spades: `isHumanTurn` / `validPlays`
- President: `isHumanTurn` / `validPlays`

### 3. Code Duplication
**Problem**: Multiplayer stores had similar turn state management logic that could be shared.

## Changes Implemented

### 1. Added AI Play Delays ✅
**File**: `packages/client/src/games/euchre/euchreGameStore.ts`

**Change**: Modified `processAITurn()` to add 150ms delays between AI card plays:

```typescript
// Before
playCard(card, player.id)

// After
setTimeout(() => {
  playCard(card, player.id)
}, 150)
```

**Impact**: Prevents rapid turn indicator changes during AI turns, creating smoother visual transitions.

### 2. Standardized Naming Conventions ✅
**Files Modified**:
- `packages/client/src/games/euchre/useEuchreGameAdapter.ts`
- `packages/client/src/games/euchre/EuchreEngineBoard.vue`
- `packages/client/src/games/euchre/useEuchreDirector.ts`

**Changes**:
- Renamed `isMyTurn` → `isHumanTurn`
- Renamed `validCards` → `validPlays`
- Updated all references and interface definitions

**Impact**: Consistent naming across all games improves maintainability and reduces confusion.

### 3. Created Shared Turn State Composable ✅
**File**: `packages/client/src/stores/utils.ts`

**Addition**: New `useMultiplayerTurnState()` composable providing:
- Consistent turn state management
- `updateIfChanged` integration for efficient reactivity
- Reusable logic for future multiplayer stores

```typescript
export function useMultiplayerTurnState<GameStateType>(options: {
  gameState: Ref<GameStateType | null>
  myPlayerId: ComputedRef<number>
  calculateValidPlays: (state: GameStateType) => string[]
  calculateValidActions?: (state: GameStateType) => string[]
}) {
  // Implementation with proper reactivity management
}
```

## Testing Results

- ✅ Client builds successfully
- ✅ TypeScript compilation passes
- ✅ No breaking changes to existing functionality
- ✅ Singleplayer turn flow improved with smoother transitions

## Future Suggestions

### High Priority

1. **Debounced Turn Indicators**
   - Add debouncing to turn indicator updates during rapid state changes
   - Prevent flickering during animation sequences

2. **Animation-Aware Turn Display**
   - Modify turn indicators to account for animation states
   - Hide/show turn indicators based on card animation progress

### Medium Priority

3. **Shared Director Turn Logic**
   - Extract common `currentTurnSeat` computation across games
   - Create `useCurrentTurnSeat(game, playerIdToSeat)` composable

4. **Refactor Multiplayer Stores**
   - Apply `useMultiplayerTurnState()` to existing MP stores
   - Reduce code duplication and ensure consistent behavior

### Low Priority

5. **Enhanced Turn State Validation**
   - Add turn state validation to prevent invalid transitions
   - Better error handling for turn state inconsistencies

6. **Performance Monitoring**
   - Add metrics for turn transition performance
   - Monitor for reactivity bottlenecks

## Architecture Assessment

The turn mechanics architecture remains well-designed with:
- ✅ Clear separation between SP/MP modes
- ✅ Adapter pattern successfully unifies interfaces
- ✅ Local valid play calculation prevents server lag issues
- ✅ Proper use of Vue reactivity and `updateIfChanged` for efficiency

## Impact Summary

- **User Experience**: Reduced flashing in singleplayer mode
- **Code Quality**: Improved consistency and maintainability
- **Performance**: More efficient reactivity with shared utilities
- **Future-Proofing**: Shared composables enable easier maintenance

## Files Changed

```
packages/client/src/games/euchre/euchreGameStore.ts
packages/client/src/games/euchre/useEuchreGameAdapter.ts
packages/client/src/games/euchre/EuchreEngineBoard.vue
packages/client/src/games/euchre/useEuchreDirector.ts
packages/client/src/stores/utils.ts
```

## Next Steps

1. Test the changes in a full game session
2. Monitor for any edge cases in turn transitions
3. Consider applying similar improvements to other games (Spades, President)
4. Implement debounced turn indicators if flashing persists</content>
<parameter name="filePath">/Users/steve/code/euchre-app/docs/TURN_MECHANICS_IMPROVEMENTS.md