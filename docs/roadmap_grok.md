# Multiplayer Flow Alignment Roadmap (Grok)

**Date:** 2026-02-15  
**Scope:** Euchre, President, Spades multiplayer lifecycle alignment across client + server

## Executive Summary

After reviewing the repository, game implementations, and the existing roadmap_codex.md analysis, I concur with the core assessment: the codebase has strong multiplayer foundations but suffers from architectural divergence that increases maintenance burden and bug risk. The cleanest path forward is incremental convergence to a unified multiplayer contract, prioritizing server-side abstraction and client-side parity.

## Key Findings from Code Review

### Server-Side Analysis
- **Game Classes**: `Game.ts`, `PresidentGame.ts`, `SpadesGame.ts` share similar structure but duplicate multiplayer logic (disconnect handling, AI replacement, state broadcasting).
- **Registry**: `sessions/registry.ts` maintains separate maps for each game type instead of a unified runtime registry.
- **Handlers**: `sessions/handlers.ts` has game-type branching in action routing.
- **Index.ts**: Contains per-game disconnect/reconnect logic.

### Client-Side Analysis
- **Stores**: All three games have multiplayer stores with similar patterns (queue buffering, state sequence tracking, sync handling), but implementation details vary.
- **Adapters**: Present for Euchre (`useGameAdapter.ts`) and President (`usePresidentGameAdapter.ts`), missing for Spades.
- **Directors**: Present for Euchre (`useEuchreDirector.ts`) and President (`usePresidentDirector.ts`), missing for Spades.
- **Boards**: All have game board components, but Spades handles animation/orchestration directly in the board instead of using a director.

### Shared Code Opportunities
- **Multiplayer Types**: Well-structured in `shared/src/multiplayer.ts` with good separation of concerns.
- **Core Logic**: Game rules are properly isolated in shared packages.
- **WebSocket Transport**: Consistent across games.

## Enhanced Gap Analysis

Building on roadmap_codex.md, here are additional insights:

| Area | Current State | Risk Level | Priority |
|---|---|---|---|
| Server runtime abstraction | Duplicated methods across game classes | High | P0 |
| Client store standardization | Similar but inconsistent patterns | Medium | P1 |
| Message protocol unification | Game-specific message types | Low | P2 |
| Error handling consistency | Varies by game implementation | Medium | P1 |
| Test coverage for multiplayer flows | Limited E2E tests | High | P0 |

## Recommended Implementation Plan

### Phase 0: Foundation & Diagnostics (1-2 days)
**Goals**: Stabilize current implementation, add observability.

- Add structured logging for multiplayer events (message types, sequences, queue states).
- Implement shared debug utilities for all multiplayer stores.
- Add runtime assertions for queue drain and state consistency.
- Expand E2E test coverage for critical paths.

**Success Criteria**: Consistent diagnostics across all games, reliable repro steps for issues.

### Phase 1: Server Runtime Unification (3-4 days)
**Goals**: Abstract game runtime differences behind a common interface.

Create `GameRuntime` interface in shared package:
```typescript
interface GameRuntime {
  initializePlayers(players: HumanPlayer[]): void
  start(): void
  resendStateToPlayer(odusId: string): void
  findPlayerIndexByOdusId(odusId: string): number | null
  replaceWithAI(playerIndex: number): boolean
  restoreHumanPlayer(seatIndex: number, odusId: string, name: string): boolean
  bootPlayer(playerIndex: number): boolean
  getPlayerInfo(odusId: string): PlayerInfo | null
  getStateSeq(): number
  dispatch(action: GameAction, odusId: string): boolean
}
```

- Wrap existing game classes with runtime adapters.
- Implement unified registry: `Map<gameId, { type: GameType, runtime: GameRuntime, hostId: string, settings: GameSettings }>`
- Refactor `handlers.ts` and `index.ts` to use runtime interface.

**Success Criteria**: All game creation, restart, and disconnect flows use single orchestration path.

### Phase 2: Spades Client Parity (2-3 days)
**Goals**: Bring Spades to same architectural level as Euchre/President.

- Create `useSpadesGameAdapter.ts` following established pattern.
- Create `useSpadesDirector.ts` for animation orchestration.
- Refactor `SpadesGameBoard.vue` to focus on rendering, delegate orchestration to director.
- Add `TurnTimer` component integration.
- Add timeout UI affordances.

**Success Criteria**: Spades multiplayer follows `store → adapter → director → board` pattern.

### Phase 3: Client Store Harmonization (2-3 days)
**Goals**: Extract common multiplayer store logic.

Create shared multiplayer store utilities:
- Queue management helpers
- State sequence tracking
- Sync/resync logic
- Turn state management
- Message application patterns

Refactor all three stores to use shared utilities while preserving game-specific message handling.

**Success Criteria**: 70%+ code sharing in store implementations, consistent behavior across games.

### Phase 4: Protocol Consolidation (Optional, 3-5 days)
**Goals**: Reduce message type proliferation.

Options:
- **Conservative**: Keep existing message names, standardize internal handling.
- **Progressive**: Unify to generic envelope with game-type discrimination.

Recommend starting with conservative approach, evaluating progressive unification after 3 months of stable operation.

**Success Criteria**: Simplified message routing, reduced client-side branching.

## Code Sharing Opportunities

### Server-Side
- Extract common multiplayer lifecycle methods into base `MultiplayerGame` class.
- Shared timeout/boot logic.
- Unified state broadcasting with game-specific state builders.

### Client-Side
- Generic multiplayer store base class with game-specific extensions.
- Shared animation timing utilities.
- Common UI components (TurnTimer, timeout indicators).

### Testing
- Shared E2E test helpers for multiplayer flows.
- Parameterized tests across game types.

## Risk Mitigation

### Incremental Approach
- Each phase delivers immediate value and can be rolled back independently.
- Maintain backward compatibility throughout.
- Extensive testing of multiplayer reconnection flows.

### Monitoring & Observability
- Add multiplayer health metrics.
- Implement client-side error boundaries for multiplayer failures.
- Create dashboard for tracking multiplayer session success rates.

## Success Metrics

- **Reliability**: 95%+ successful multiplayer game completions.
- **Maintainability**: New multiplayer features require <50% duplicate code.
- **Developer Experience**: Onboarding new games to multiplayer takes <1 week.
- **User Experience**: Consistent behavior across all three games.

## Alternative Considerations

### Monolithic Game Engine
Instead of per-game classes, consider a single configurable game engine. However, this would require significant refactoring and risk introducing regressions in established games.

### Protocol-First Approach
Start with message protocol unification before runtime abstraction. This could provide cleaner separation but delays immediate reliability gains.

## Conclusion

The roadmap_codex.md provides an excellent foundation. My recommendations emphasize:
1. Prioritizing server-side unification for maximum reliability impact.
2. Maintaining the incremental, low-risk approach.
3. Adding concrete code sharing opportunities.
4. Including monitoring and testing as first-class concerns.

This plan should deliver a robust, maintainable multiplayer foundation while preserving the existing user experience.