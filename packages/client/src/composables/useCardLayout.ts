/**
 * Anchor-based card layout system.
 *
 * Containers are positioned relative to anchors (table center, seats, user hand),
 * not absolute pixels. Bindings are in canonical units; Model B scale handles devices.
 *
 * See docs/PLATFORM_CONTRACT.md.
 */

import { ref, type Ref } from 'vue'
import { computeTableLayout, type TableLayoutResult } from './useTableLayout'
import { CardScales } from './useCardSizing'
import { PLATFORM_CONSTANTS } from './useBoardViewport'
import type { CardContainer, Hand } from '@/components/cardContainers'

export type AnchorPoint =
  | 'table-center'
  | 'user-hand'
  | 'user-avatar'
  | 'seat-0' | 'seat-1' | 'seat-2' | 'seat-3'
  | 'seat-4' | 'seat-5' | 'seat-6' | 'seat-7'

export interface ContainerBinding {
  anchor: AnchorPoint
  /** Offset in canonical units from the resolved anchor. */
  offset: { x: number; y: number }
  scale?: keyof typeof CardScales
}

function seatAnchor(seatIndex: number): AnchorPoint {
  return `seat-${seatIndex}` as AnchorPoint
}

/** Resolve an anchor to an absolute position in canonical board units. */
export function resolveAnchor(
  anchor: AnchorPoint,
  layout: TableLayoutResult,
  boardHeight: number
): { x: number; y: number } {
  const { tableBounds, seats } = layout

  switch (anchor) {
    case 'table-center':
      return { x: tableBounds.centerX, y: tableBounds.centerY }

    case 'user-hand':
      return {
        x: tableBounds.centerX,
        y: boardHeight * PLATFORM_CONSTANTS.USER_HAND_Y_FRACTION,
      }

    case 'user-avatar':
      return {
        x: tableBounds.centerX,
        y: boardHeight - PLATFORM_CONSTANTS.USER_AVATAR_BOTTOM_OFFSET,
      }

    default:
      if (anchor.startsWith('seat-')) {
        const seatIndex = parseInt(anchor.split('-')[1] ?? '-1', 10)
        const seat = seats[seatIndex]
        if (seat) return { ...seat.handPosition }
      }
      return { x: 0, y: 0 }
  }
}

/** Resolve a binding to an absolute canonical position. */
export function resolveBindingPosition(
  binding: ContainerBinding,
  layout: TableLayoutResult,
  boardHeight: number
): { x: number; y: number } {
  const anchorPos = resolveAnchor(binding.anchor, layout, boardHeight)
  return {
    x: anchorPos.x + binding.offset.x,
    y: anchorPos.y + binding.offset.y,
  }
}

const TRICKS_WON_OFFSETS: Record<number, { x: number; y: number }> = {
  0: { x: 58, y: -30 },
  1: { x: 36, y: -22 },
  2: { x: 62, y: 28 },
  3: { x: -36, y: 22 },
}

/**
 * Standard container bindings keyed by engine container IDs
 * (`hand-0`, `center`, `tricks-won-player-0`, etc.).
 */
export function buildContainerBindings(
  playerCount: number,
  userSeatIndex: number = 0
): Record<string, ContainerBinding> {
  const bindings: Record<string, ContainerBinding> = {
    center: {
      anchor: 'table-center',
      offset: { x: 0, y: 0 },
      scale: 'playArea',
    },
    deck: {
      anchor: 'table-center',
      offset: { x: 0, y: 0 },
      scale: 'deck',
    },
  }

  for (let i = 0; i < playerCount; i++) {
    const isUser = i === userSeatIndex
    bindings[`hand-${i}`] = isUser
      ? { anchor: 'user-hand', offset: { x: 0, y: 0 }, scale: 'userHand' }
      : { anchor: seatAnchor(i), offset: { x: 0, y: 0 }, scale: 'opponentHand' }

    const tricksOffset = TRICKS_WON_OFFSETS[i] ?? { x: 40, y: 0 }
    bindings[`tricks-won-player-${i}`] = {
      anchor: isUser ? 'user-avatar' : seatAnchor(i),
      offset: tricksOffset,
      scale: 'tricksWon',
    }
  }

  return bindings
}

/** Deal-time hand position (before user hand fans down to user-hand anchor). */
export function buildDealHandBindings(
  playerCount: number,
  _userSeatIndex: number = 0
): Record<string, ContainerBinding> {
  const bindings: Record<string, ContainerBinding> = {}
  for (let i = 0; i < playerCount; i++) {
    bindings[`hand-${i}`] = {
      anchor: seatAnchor(i),
      offset: { x: 0, y: 0 },
      scale: i === _userSeatIndex ? 'userHand' : 'opponentHand',
    }
  }
  return bindings
}

/**
 * @deprecated Use buildContainerBindings() — returns engine-keyed bindings.
 */
export function createTrickGameBindings(): Record<string, ContainerBinding> {
  return buildContainerBindings(4, 0)
}

export function applyBindingToContainer(
  container: CardContainer,
  binding: ContainerBinding,
  layout: TableLayoutResult,
  boardHeight: number
): void {
  container.position = resolveBindingPosition(binding, layout, boardHeight)
}

export function applyBindingsToContainers(
  containers: Iterable<[string, CardContainer]>,
  bindings: Record<string, ContainerBinding>,
  layout: TableLayoutResult,
  boardHeight: number,
  options?: {
    /** Container IDs to skip (e.g. deck at dealer position mid-game). */
    skip?: Set<string>
    /** Per-container binding overrides for this apply pass. */
    overrides?: Record<string, ContainerBinding>
  }
): void {
  const skip = options?.skip
  const overrides = options?.overrides

  for (const [id, container] of containers) {
    if (skip?.has(id)) continue
    const binding = overrides?.[id] ?? bindings[id]
    if (binding) {
      applyBindingToContainer(container, binding, layout, boardHeight)
    }
  }
}

/**
 * Composable for anchor-based card layout (resize/orientation flows).
 */
export function useCardLayout(
  boardRef: Ref<HTMLElement | null>,
  layoutMode: 'normal' | 'wide' = 'normal',
  playerCount: number = 4
) {
  const layout = ref<TableLayoutResult | null>(null)
  const boardWidth = ref(0)
  const boardHeight = ref(0)

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

  function getPosition(binding: ContainerBinding): { x: number; y: number } {
    if (!layout.value) return { x: 0, y: 0 }
    return resolveBindingPosition(binding, layout.value, boardHeight.value)
  }

  function applyBinding(container: CardContainer, binding: ContainerBinding) {
    if (!layout.value) return
    applyBindingToContainer(container, binding, layout.value, boardHeight.value)
  }

  function applyBindings(
    containers: Map<string, CardContainer> | Record<string, CardContainer>,
    bindings: Record<string, ContainerBinding>
  ) {
    if (!layout.value) return
    const entries = containers instanceof Map
      ? containers.entries()
      : Object.entries(containers)
    applyBindingsToContainers(entries, bindings, layout.value, boardHeight.value)
  }

  async function repositionAll(
    containers: Map<string, CardContainer> | Record<string, CardContainer>,
    bindings: Record<string, ContainerBinding>,
    animationMs: number = 200
  ): Promise<void> {
    updateLayout()
    applyBindings(containers, bindings)

    const containerMap = containers instanceof Map
      ? containers
      : new Map(Object.entries(containers))

    for (const container of containerMap.values()) {
      if ('resetArcLock' in container) {
        (container as Hand).resetArcLock()
      }
    }

    const promises: Promise<void>[] = []
    for (const container of containerMap.values()) {
      promises.push(container.repositionAll(animationMs))
    }

    await Promise.all(promises)
  }

  function getTableBounds() {
    return layout.value?.tableBounds ?? null
  }

  function getTableCenter(): { x: number; y: number } {
    if (!layout.value) return { x: 0, y: 0 }
    return {
      x: layout.value.tableBounds.centerX,
      y: layout.value.tableBounds.centerY,
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