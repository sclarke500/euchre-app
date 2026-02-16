import { ref, computed, type Ref } from 'vue'
import { Hand } from '@/components/cardContainers'

export interface SeatLayout {
  side: 'bottom' | 'left' | 'top' | 'right'
  handPosition: { x: number; y: number }
  rotation: number
  angleToCenter: number
  isUser: boolean
}

export interface TableBounds {
  left: number
  top: number
  right: number
  bottom: number
  width: number
  height: number
  centerX: number
  centerY: number
}

export interface TableLayoutResult {
  seats: SeatLayout[]
  tableBounds: TableBounds
  tableCenter: { x: number; y: number }
}

export interface SeatDefinition {
  side: 'bottom' | 'left' | 'top' | 'right'
  pos: number     // 0-1 position along that side
  rotation: number
}

/** Standard seat layouts for common player counts */
const SEAT_PRESETS: Record<number, SeatDefinition[]> = {
  4: [
    { side: 'bottom', pos: 0.5, rotation: 0 },
    { side: 'left', pos: 0.5, rotation: 90 },
    { side: 'top', pos: 0.5, rotation: 180 },
    { side: 'right', pos: 0.5, rotation: -90 },
  ],
  5: [
    { side: 'bottom', pos: 0.5, rotation: 0 },
    { side: 'left', pos: 0.5, rotation: 90 },
    { side: 'top', pos: 0.25, rotation: 180 },
    { side: 'top', pos: 0.75, rotation: 180 },
    { side: 'right', pos: 0.5, rotation: -90 },
  ],
  6: [
    { side: 'bottom', pos: 0.5, rotation: 0 },
    { side: 'left', pos: 0.5, rotation: 90 },
    { side: 'top', pos: 0.2, rotation: 180 },
    { side: 'top', pos: 0.5, rotation: 180 },
    { side: 'top', pos: 0.8, rotation: 180 },
    { side: 'right', pos: 0.5, rotation: -90 },
  ],
  7: [
    { side: 'bottom', pos: 0.5, rotation: 0 },
    { side: 'left', pos: 0.5, rotation: 90 },
    { side: 'top', pos: 0.15, rotation: 180 },
    { side: 'top', pos: 0.38, rotation: 180 },
    { side: 'top', pos: 0.62, rotation: 180 },
    { side: 'top', pos: 0.85, rotation: 180 },
    { side: 'right', pos: 0.5, rotation: -90 },
  ],
  8: [
    { side: 'bottom', pos: 0.5, rotation: 0 },
    { side: 'left', pos: 0.33, rotation: 90 },
    { side: 'left', pos: 0.67, rotation: 90 },
    { side: 'top', pos: 0.2, rotation: 180 },
    { side: 'top', pos: 0.5, rotation: 180 },
    { side: 'top', pos: 0.8, rotation: 180 },
    { side: 'right', pos: 0.67, rotation: -90 },
    { side: 'right', pos: 0.33, rotation: -90 },
  ],
}

export function computeTableLayout(
  boardWidth: number,
  boardHeight: number,
  layout: 'normal' | 'wide',
  playerCount: number,
  seatOverrides?: SeatDefinition[]
): TableLayoutResult {
  const isWide = layout === 'wide'
  // Symmetric margins - table is centered
  const marginH = isWide ? 0.10 : 0.20
  const marginLeft = marginH
  const marginRight = marginH
  const tableMarginTop = 0.15
  const userAreaPct = 0.20

  const tableW = boardWidth * (1 - marginLeft - marginRight)
  const tableH = boardHeight * (1 - tableMarginTop - userAreaPct)
  const tableX = boardWidth * marginLeft + tableW / 2
  const tableY = boardHeight * tableMarginTop + tableH / 2

  const tableLeft = boardWidth * marginLeft
  const tableTop = boardHeight * tableMarginTop
  const tableRight = tableLeft + tableW
  const tableBottom = tableTop + tableH

  const tableBounds: TableBounds = {
    left: tableLeft,
    top: tableTop,
    right: tableRight,
    bottom: tableBottom,
    width: tableW,
    height: tableH,
    centerX: tableX,
    centerY: tableY,
  }

  const tableCenter = { x: tableX, y: tableY }
  const handInset = Math.min(tableW, tableH) * 0.06 + 25

  const seatDefs = seatOverrides ?? SEAT_PRESETS[playerCount] ?? SEAT_PRESETS[4]!

  const seats: SeatLayout[] = seatDefs.map((seat, i) => {
    let handX: number
    let handY: number

    // Position opponent hands at the table edge (under avatar center)
    // Avatar is positioned at the edge, so hand should be too
    switch (seat.side) {
      case 'left':
        handX = tableLeft
        handY = tableTop + seat.pos * tableH
        break
      case 'right':
        handX = tableRight
        handY = tableTop + seat.pos * tableH
        break
      case 'top':
        handX = tableLeft + seat.pos * tableW
        handY = tableTop
        break
      default: // bottom (user) - position below table so cards overlap the bottom edge
        handX = tableX
        handY = tableBottom + 20 // Cards overlap table bottom
    }

    const handPos = { x: handX, y: handY }
    const angleToCenter = Hand.calcAngleToCenter(handPos, tableCenter)

    return {
      side: seat.side,
      handPosition: handPos,
      rotation: seat.rotation,
      angleToCenter,
      isUser: i === 0,
    }
  })

  return { seats, tableBounds, tableCenter }
}

/**
 * Reactive composable wrapper around computeTableLayout.
 * Recomputes when boardRef dimensions change (call recompute() after resize).
 */
export function useTableLayout(
  boardRef: Ref<HTMLElement | null>,
  layout: Ref<'normal' | 'wide'>,
  playerCount: Ref<number>
) {
  const layoutResult = ref<TableLayoutResult | null>(null)

  function recompute() {
    if (!boardRef.value) return
    layoutResult.value = computeTableLayout(
      boardRef.value.offsetWidth,
      boardRef.value.offsetHeight,
      layout.value,
      playerCount.value
    )
  }

  const seats = computed(() => layoutResult.value?.seats ?? [])
  const tableCenter = computed(() => layoutResult.value?.tableCenter ?? { x: 0, y: 0 })
  const tableBounds = computed(() => layoutResult.value?.tableBounds ?? null)

  return {
    seats,
    tableCenter,
    tableBounds,
    recompute,
  }
}
