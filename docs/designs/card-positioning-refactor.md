# Card Positioning Refactor - Anchor-Based Layout

## Current Problem

Card container positions are calculated once in `setupHands()` as absolute pixels:
```ts
userHand.position = { x: 540, y: 620 }  // Absolute pixels, stale on resize
```

When viewport changes (resize, orientation), positions are wrong.

## Proposed Solution: Anchor-Based Positioning

Store container positions as **anchors + offsets**, not absolute pixels.

### Anchor Types

```ts
type AnchorPoint = 
  | 'table-center'      // Center of the felt
  | 'user-avatar'       // Bottom center (user's position)
  | 'seat-0' | 'seat-1' | 'seat-2' | 'seat-3'  // Player positions
```

### Container Binding

```ts
interface ContainerBinding {
  anchor: AnchorPoint
  offset: { x: number, y: number }  // Pixels from anchor (scaled by mode)
  scale: keyof typeof CardScales    // Which scale to use
}

// Example bindings
const containerBindings = {
  userHand: {
    anchor: 'user-avatar',
    offset: { x: 0, y: -40 },  // 40px above avatar
    scale: 'userHand'
  },
  deck: {
    anchor: 'table-center',
    offset: { x: 0, y: 0 },
    scale: 'deck'
  },
  playArea: {
    anchor: 'table-center', 
    offset: { x: 0, y: 0 },
    scale: 'playArea'
  },
  opponent1Hand: {
    anchor: 'seat-1',
    offset: { x: 0, y: 40 },  // Below their avatar
    scale: 'opponentHand'
  },
  // ... etc
}
```

### Anchor Resolution

```ts
function resolveAnchor(anchor: AnchorPoint, layout: TableLayoutResult): { x: number, y: number } {
  switch (anchor) {
    case 'table-center':
      return { x: layout.tableBounds.centerX, y: layout.tableBounds.centerY }
    
    case 'user-avatar':
      return { x: layout.tableBounds.centerX, y: layout.boardHeight - 50 }
    
    case 'seat-0':
    case 'seat-1':
    case 'seat-2':
    case 'seat-3':
      const seatIndex = parseInt(anchor.split('-')[1])
      const seat = layout.seats[seatIndex]
      return seat.handPosition
    
    default:
      return { x: 0, y: 0 }
  }
}
```

### Offset Scaling

Offsets are defined for "full mode" and scaled for mobile:

```ts
function scaleOffset(offset: { x: number, y: number }): { x: number, y: number } {
  if (isMobile()) {
    return { x: offset.x * 0.7, y: offset.y * 0.7 }  // Tighter on mobile
  }
  return offset
}
```

## Implementation

### 1. New: `useCardLayout.ts`

Centralizes container position calculations:

```ts
export function useCardLayout(boardRef: Ref<HTMLElement | null>) {
  const layout = ref<TableLayoutResult | null>(null)
  
  // Recalculate layout from board dimensions
  function updateLayout() {
    if (!boardRef.value) return
    const w = boardRef.value.offsetWidth
    const h = boardRef.value.offsetHeight
    layout.value = computeTableLayout(w, h, 'normal', 4)
  }
  
  // Get container position from binding
  function getContainerPosition(binding: ContainerBinding): { x: number, y: number } {
    if (!layout.value) return { x: 0, y: 0 }
    
    const anchorPos = resolveAnchor(binding.anchor, layout.value)
    const offset = scaleOffset(binding.offset)
    
    return {
      x: anchorPos.x + offset.x,
      y: anchorPos.y + offset.y
    }
  }
  
  // Reposition all containers (call on resize)
  function repositionContainers(containers: Map<string, CardContainer>, bindings: Record<string, ContainerBinding>) {
    for (const [id, container] of containers) {
      const binding = bindings[id]
      if (binding) {
        container.position = getContainerPosition(binding)
      }
    }
  }
  
  return { layout, updateLayout, getContainerPosition, repositionContainers }
}
```

### 2. Update: `useCardController.ts`

Add resize handling:

```ts
// In setupHands or equivalent:
const bindings: Record<string, ContainerBinding> = {
  userHand: { anchor: 'user-avatar', offset: { x: 0, y: -40 }, scale: 'userHand' },
  deck: { anchor: 'table-center', offset: { x: 0, y: 0 }, scale: 'deck' },
  // ... define all containers
}

// Store bindings for later
controllerState.bindings = bindings

// On resize:
function handleResize() {
  cardLayout.updateLayout()
  cardLayout.repositionContainers(containers, bindings)
  
  // Reposition cards within containers
  for (const container of containers.values()) {
    container.repositionAll(200)  // Animate over 200ms
  }
}
```

### 3. Update: `CardTable.vue`

Expose resize handler to directors:

```ts
// In ResizeObserver callback:
function computeLayout() {
  // ... existing layout code ...
  
  // Emit event for directors to handle
  emit('layout-changed', lastLayoutResult.value)
}

// Or provide via inject:
provide('onLayoutChange', (callback) => layoutChangeCallbacks.push(callback))
```

### 4. Update: Directors (Euchre, Spades, President)

Subscribe to layout changes:

```ts
// In director setup:
const cardLayout = useCardLayout(boardRef)

onMounted(() => {
  // Initial setup
  cardLayout.updateLayout()
  setupContainersFromBindings()
  
  // Handle resize
  const unsubscribe = inject('onLayoutChange')((newLayout) => {
    cardLayout.repositionContainers(containers, bindings)
    repositionAllCards()
  })
  
  onUnmounted(unsubscribe)
})
```

## Migration Path

1. **Phase 1**: Create `useCardLayout.ts` with binding types
2. **Phase 2**: Define bindings for Euchre (simplest game)
3. **Phase 3**: Wire up resize handler in Euchre director
4. **Phase 4**: Test orientation change on iPad
5. **Phase 5**: Apply to Spades and President

## Edge Cases

### Cards in Flight
If resize happens during animation:
- Option A: Let animation complete, then reposition (janky)
- Option B: Cancel animation, snap to new position (jarring)
- Option C: Retarget animation mid-flight (smooth but complex)

**Recommendation**: Option A for now, revisit if problematic.

### User Hand Arc Radius
Currently `lockedArcRadius` is cached. On resize:
- Reset the lock: `userHand.resetArcLock()`
- Let next `getCardPosition()` recalculate

### Play Area Cards
Cards in play area have individual positions (not derived from index).
- Store as offset from table-center
- On resize: recalculate from new center

## Open Questions

1. **Animate or snap on resize?**
   - Snap is simpler, animate is smoother
   - Suggest: short animation (150-200ms)

2. **Debounce resize events?**
   - Yes, 100ms debounce to avoid thrashing during drag-resize

3. **Handle mid-game resize?**
   - Should work with proper container bindings
   - Test: resize during trick animation
