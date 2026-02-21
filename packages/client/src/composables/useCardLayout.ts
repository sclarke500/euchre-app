/**
 * Anchor-based card layout system.
 * 
 * Containers are positioned relative to anchors (avatars, table center),
 * not absolute pixels. This allows repositioning on resize/orientation change.
 */

import { ref, type Ref } from 'vue'
import { computeTableLayout, type TableLayoutResult } from './useTableLayout'
import { isMobile, CardScales } from './useCardSizing'
import type { CardContainer, Hand, Deck, Pile } from '@/components/cardContainers'

// Anchor points that containers can bind to
export type AnchorPoint = 
  | 'table-center'      // Center of the felt
  | 'user-avatar'       // Bottom center (user's position)
  | 'seat-0' | 'seat-1' | 'seat-2' | 'seat-3'  // Player seat positions
  | 'seat-4' | 'seat-5' | 'seat-6' | 'seat-7'  // For 8-player President

// Container binding definition
export interface ContainerBinding {
  anchor: AnchorPoint
  offset: { x: number, y: number }  // Offset in "full mode" pixels
  scale?: keyof typeof CardScales   // Which scale context to use
}

// Resolve anchor point to absolute position
function resolveAnchor(
  anchor: AnchorPoint, 
  layout: TableLayoutResult,
  boardHeight: number
): { x: number, y: number } {
  const { tableBounds, seats } = layout
  
  switch (anchor) {
    case 'table-center':
      return { x: tableBounds.centerX, y: tableBounds.centerY }
    
    case 'user-avatar':
      // User avatar is at bottom center, fixed position from bottom
      return { x: tableBounds.centerX, y: boardHeight - 50 }
    
    default:
      // seat-N anchors
      if (anchor.startsWith('seat-')) {
        const parts = anchor.split('-')
        const seatIndex = parts[1] ? parseInt(parts[1]) : -1
        const seat = seats[seatIndex]
        if (seat) {
          return { ...seat.handPosition }
        }
      }
      return { x: 0, y: 0 }
  }
}

// Scale offsets for mobile (tighter spacing)
function scaleOffset(offset: { x: number, y: number }): { x: number, y: number } {
  if (isMobile()) {
    return { x: Math.round(offset.x * 0.65), y: Math.round(offset.y * 0.65) }
  }
  return offset
}

/**
 * Composable for anchor-based card layout
 */
export function useCardLayout(
  boardRef: Ref<HTMLElement | null>,
  layoutMode: 'normal' | 'wide' = 'normal',
  playerCount: number = 4
) {
  const layout = ref<TableLayoutResult | null>(null)
  const boardWidth = ref(0)
  const boardHeight = ref(0)
  
  /**
   * Recalculate layout from current board dimensions
   */
  function updateLayout(): TableLayoutResult | null {
    if (!boardRef.value) return null
    
    boardWidth.value = boardRef.value.offsetWidth
    boardHeight.value = boardRef.value.offsetHeight
    
    layout.value = computeTableLayout(
      boardWidth.value, 
      boardHeight.value, 
      layoutMode, 
      playerCount
    )
    
    return layout.value
  }
  
  /**
   * Get absolute position for a container binding
   */
  function getPosition(binding: ContainerBinding): { x: number, y: number } {
    if (!layout.value) {
      return { x: 0, y: 0 }
    }
    
    const anchorPos = resolveAnchor(binding.anchor, layout.value, boardHeight.value)
    const offset = scaleOffset(binding.offset)
    
    return {
      x: anchorPos.x + offset.x,
      y: anchorPos.y + offset.y
    }
  }
  
  /**
   * Update a container's position from its binding
   */
  function applyBinding(container: CardContainer, binding: ContainerBinding) {
    container.position = getPosition(binding)
  }
  
  /**
   * Reposition multiple containers from their bindings
   */
  function applyBindings(
    containers: Map<string, CardContainer> | Record<string, CardContainer>,
    bindings: Record<string, ContainerBinding>
  ) {
    const containerMap = containers instanceof Map 
      ? containers 
      : new Map(Object.entries(containers))
    
    for (const [id, container] of containerMap) {
      const binding = bindings[id]
      if (binding) {
        applyBinding(container, binding)
      }
    }
  }
  
  /**
   * Reposition all containers and their cards (call on resize)
   */
  async function repositionAll(
    containers: Map<string, CardContainer> | Record<string, CardContainer>,
    bindings: Record<string, ContainerBinding>,
    animationMs: number = 200
  ): Promise<void> {
    // First update layout
    updateLayout()
    
    // Apply new positions to containers
    applyBindings(containers, bindings)
    
    // Reset arc locks on hands (they need to recalculate for new size)
    const containerMap = containers instanceof Map 
      ? containers 
      : new Map(Object.entries(containers))
    
    for (const container of containerMap.values()) {
      if ('resetArcLock' in container) {
        (container as Hand).resetArcLock()
      }
    }
    
    // Animate cards to new positions
    const promises: Promise<void>[] = []
    for (const container of containerMap.values()) {
      promises.push(container.repositionAll(animationMs))
    }
    
    await Promise.all(promises)
  }
  
  /**
   * Get the current table bounds
   */
  function getTableBounds() {
    return layout.value?.tableBounds ?? null
  }
  
  /**
   * Get the current table center
   */
  function getTableCenter(): { x: number, y: number } {
    if (!layout.value) return { x: 0, y: 0 }
    return {
      x: layout.value.tableBounds.centerX,
      y: layout.value.tableBounds.centerY
    }
  }
  
  return {
    layout,
    boardWidth,
    boardHeight,
    updateLayout,
    getPosition,
    applyBinding,
    applyBindings,
    repositionAll,
    getTableBounds,
    getTableCenter,
  }
}

/**
 * Standard bindings for 4-player trick-taking games (Euchre, Spades)
 */
export function createTrickGameBindings(): Record<string, ContainerBinding> {
  return {
    deck: {
      anchor: 'table-center',
      offset: { x: 0, y: 0 },
      scale: 'deck'
    },
    userHand: {
      anchor: 'user-avatar',
      offset: { x: 0, y: -60 },  // Above user avatar
      scale: 'userHand'
    },
    opponent1: {
      anchor: 'seat-1',
      offset: { x: 0, y: 50 },   // Below left opponent avatar
      scale: 'opponentHand'
    },
    opponent2: {
      anchor: 'seat-2', 
      offset: { x: 0, y: 50 },   // Below top opponent avatar
      scale: 'opponentHand'
    },
    opponent3: {
      anchor: 'seat-3',
      offset: { x: 0, y: 50 },   // Below right opponent avatar
      scale: 'opponentHand'
    },
    playArea: {
      anchor: 'table-center',
      offset: { x: 0, y: 0 },
      scale: 'playArea'
    },
    tricksWon0: {
      anchor: 'user-avatar',
      offset: { x: 80, y: -30 },
      scale: 'tricksWon'
    },
    tricksWon1: {
      anchor: 'seat-1',
      offset: { x: 40, y: 0 },
      scale: 'tricksWon'
    },
    tricksWon2: {
      anchor: 'seat-2',
      offset: { x: 40, y: 30 },
      scale: 'tricksWon'
    },
    tricksWon3: {
      anchor: 'seat-3',
      offset: { x: -40, y: 0 },
      scale: 'tricksWon'
    },
  }
}
