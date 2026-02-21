# Card Engine Persistence: Analysis & Recommendations

Date: February 21, 2026

## Executive Summary

The mobile display sleep/wake issue represents a critical UX problem for multiplayer games. The proposed persistence architecture in `card-engine-persistence.md` and refined in `card-engine-persistence-review.md` provides a solid foundation, but requires strategic adjustments to balance performance, correctness, and implementation complexity.

**Key Recommendation:** Implement a hybrid semantic-coordinate persistence system with strict server validation, prioritizing semantic state reconstruction over raw coordinate replay. This approach delivers instant visual restoration while maintaining game state integrity.

---

## Problem Analysis

### Root Cause Assessment

The issue occurs because:

1. **Ephemeral Visual State**: Card engine state exists only in memory and Vue component refs
2. **Mount-Dependent Rendering**: Cards only appear when components mount and refs are established
3. **Network-Dependent Recovery**: Post-wake reconnection relies on server message queues and timing
4. **Race Conditions**: Component mount timing vs. WebSocket message processing creates inconsistent recovery

### Impact on User Experience

- **Multiplayer Games**: 2-5 second blank screen after device wake during active play
- **High-Stakes Moments**: Cards disappear during trick resolution or bidding
- **Competitive Disadvantage**: Players can't see their hands during critical timing
- **Trust Issues**: Users perceive the app as unreliable or buggy

### Current Mitigation Gaps

While some restore methods exist (`restoreHands`, `restoreWonTrickStacks`), they:
- Are game-specific and inconsistent
- Require manual invocation by directors
- Don't handle full board state restoration
- Lack persistence across sessions

---

## Architecture Evaluation

### Strengths of Current Plan

1. **Correct Layering**: Persistence at card-engine level is appropriate
2. **Storage Strategy**: sessionStorage isolation prevents cross-tab conflicts
3. **Save Triggers**: Hybrid visibility + debounced approach balances performance
4. **Session Scoping**: Per-game session keys prevent stale state issues

### Critical Gaps Identified

#### 1. Coordinate vs. Semantic State Tension

**Problem**: Persisting absolute x/y coordinates creates fragility:
- Layout changes break restoration
- Orientation changes invalidate positions
- Safe area adjustments cause misalignment
- Zoom/scaling differences create visual artifacts

**Solution**: Persist **semantic descriptors** (card ownership, order, visual flags) and **recompute positions** from current layout on restore.

#### 2. Insufficient Stale State Protection

**Problem**: `maxAge` alone doesn't detect meaningful state divergence:
- Server may have advanced phases during sleep
- New hands may have been dealt
- Trick resolution may have occurred

**Solution**: Implement **server fingerprint validation** using `stateSeq` + phase metadata.

#### 3. Missing Two-Stage Restore Lifecycle

**Problem**: Current plan attempts authoritative single-pass restoration, risking visual corruption if server state diverged.

**Solution**: **Stage 1** (instant local paint) + **Stage 2** (authoritative reconciliation).

---

## Recommended Architecture

### Core Principles

1. **Semantic First**: Persist what cards exist and their relationships, not where they are
2. **Validation Gate**: Never restore without server state fingerprint match
3. **Progressive Enhancement**: Fast local paint, then authoritative sync
4. **Layout Agnostic**: Recompute positions from current board geometry

### Snapshot Schema (Revised)

```typescript
interface CardEngineSnapshot {
  version: number
  savedAt: number
  gameType: string
  sessionKey: string
  
  // Server state fingerprint for validation
  fingerprint: {
    stateSeq: number
    phase: string
    roundNumber?: number
    dealer?: number
    currentPlayer?: number
    myHandCardIds: string[] // Hash of user's current hand
  }
  
  // Semantic container state
  containers: {
    deck?: ContainerSnapshot
    hands: HandSnapshot[]
    piles: PileSnapshot[]
  }
  
  // Card registry
  cards: Record<string, { suit: string; rank: string }>
}

interface ContainerSnapshot {
  id: string
  cardIds: string[] // Order matters for positioning
  faceUp: boolean
  mode?: 'fanned' | 'looseStack' // For hands
}

interface HandSnapshot extends ContainerSnapshot {
  mode: 'fanned' | 'looseStack'
  faceUp: boolean
}

interface PileSnapshot extends ContainerSnapshot {
  // Custom positions for won tricks, etc.
  customPositions?: Record<string, { x: number; y: number; rotation: number }>
}
```

### Storage & Lifecycle

**Storage**: sessionStorage with key pattern `cardEngine:${gameType}:${sessionKey}`

**Save Triggers**:
- `visibilitychange` (hidden)
- `pagehide` / `freeze` events
- Debounced after card movements (500ms)
- **Never** save mid-animation

**Restore Lifecycle**:

```typescript
// Stage 1: Instant local restoration
function restoreFromSnapshot(snapshot: CardEngineSnapshot): boolean {
  // Validate fingerprint against known server state
  if (!validateFingerprint(snapshot.fingerprint)) {
    return false // Discard stale snapshot
  }
  
  // Reconstruct containers semantically
  reconstructContainers(snapshot.containers)
  
  // Position cards using current layout
  repositionAllCards()
  
  return true
}

// Stage 2: Authoritative reconciliation (when next game_state arrives)
function reconcileWithServer(serverState: GameState) {
  // Validate fingerprint still matches
  if (!fingerprintMatches(serverState)) {
    // Discard and rebuild from server state
    clearSnapshot()
    rebuildFromServerState(serverState)
    return
  }
  
  // Fingerprint matches - keep local visuals, sync any missing logic state
  syncLogicStateOnly(serverState)
}
```

### Implementation Strategy

#### Phase 1: Core Infrastructure (useCardController)
- Add snapshot serialization/deserialization
- Implement fingerprint validation
- Add two-stage restore lifecycle
- Integrate with existing `restoreHands` patterns

#### Phase 2: Game Integration (Directors)
- Add session key generation per game
- Provide fingerprint metadata
- Enable persistence for Euchre MP first
- Clear snapshots on game end/leave

#### Phase 3: Validation & Tuning
- Test mobile sleep/wake scenarios
- Tune save debounce timing
- Add performance monitoring
- Consider localStorage fallback for iOS

---

## Risk Assessment & Mitigations

### Technical Risks

1. **Performance Overhead**
   - **Mitigation**: Debounced saves, efficient serialization, background processing

2. **Visual Glitches During Reconciliation**
   - **Mitigation**: Smooth transitions, animation coordination, staged updates

3. **Storage Quota Issues**
   - **Mitigation**: Compress snapshots, aggressive cleanup, size monitoring

### UX Risks

1. **False Positive Restorations**
   - **Mitigation**: Strict fingerprint validation, conservative matching

2. **Layout Inconsistencies**
   - **Mitigation**: Semantic positioning, layout-aware reconstruction

3. **User Confusion**
   - **Mitigation**: Clear visual feedback, consistent behavior

---

## Alternative Approaches Considered

### 1. Full Coordinate Persistence (Rejected)
- **Pros**: Pixel-perfect restoration
- **Cons**: Fragile to layout changes, complex migration, orientation issues
- **Why Rejected**: Mobile layouts are too dynamic for coordinate fidelity

### 2. Server-Side Visual State (Rejected)
- **Pros**: Authoritative, handles all edge cases
- **Cons**: Massive bandwidth increase, server complexity, latency
- **Why Rejected**: Overkill for visual-only state, poor mobile performance

### 3. Canvas-Based Rendering (Deferred)
- **Pros**: Complete visual control, efficient updates
- **Cons**: Major rewrite, animation complexity, accessibility issues
- **Why Rejected**: Too disruptive for current timeline

---

## Success Metrics

### Functional Requirements
- ✅ Cards visible < 100ms after device wake
- ✅ No visual corruption when server state matches
- ✅ Graceful degradation when server state diverged
- ✅ Works across orientation changes
- ✅ Compatible with all game types

### Performance Requirements
- ✅ Save operations < 50ms
- ✅ Restore operations < 200ms
- ✅ Memory overhead < 2MB per session
- ✅ No impact on animation performance

### Quality Requirements
- ✅ Zero data loss scenarios
- ✅ Clear error handling and recovery
- ✅ Comprehensive test coverage
- ✅ Monitoring and alerting

---

## Implementation Roadmap

### Week 1-2: Core Infrastructure
- Implement snapshot schema and serialization
- Add fingerprint validation system
- Create two-stage restore lifecycle
- Unit tests for serialization/deserialization

### Week 3-4: Euchre MP Integration
- Integrate with useEuchreDirector
- Add session key generation
- Test mobile wake scenarios
- Performance tuning

### Week 5-6: Remaining Games
- Spades MP integration
- President MP integration
- Cross-game testing
- localStorage fallback evaluation

### Week 7-8: Production Readiness
- End-to-end testing
- Error handling and monitoring
- Documentation updates
- Rollout planning

---

## Open Questions & Dependencies

1. **iOS Process Kill Handling**: Does localStorage fallback provide meaningful improvement?
2. **Animation Coordination**: How to prevent conflicts between restored positions and ongoing animations?
3. **Memory Pressure**: What's the actual storage quota impact on low-end devices?
4. **Testing Strategy**: How to reliably simulate mobile sleep/wake in automated tests?

---

## Conclusion

The persistence architecture provides a pragmatic solution to the mobile wake issue while maintaining the app's architectural integrity. By prioritizing semantic state over coordinate precision and implementing strict validation gates, we can deliver instant visual restoration without compromising game correctness.

The two-stage restore approach balances user experience (fast visuals) with system integrity (authoritative reconciliation), making this a robust foundation for reliable multiplayer gaming across all devices and conditions.</content>
<parameter name="filePath">/Users/steve/code/euchre-app/docs/designs/card-engine-persistence-analysis.md