/**
 * Uniform chip placement around the player avatar circle.
 *
 * Draw a square tightly bounding the circle; chips sit in NW/NE/SE/SW corners
 * with their center inset from each corner toward the circle center.
 */

export const AVATAR_CIRCLE_SIZE = 125

/** Chip center distance from the bounding-square corner (canonical px). */
export const AVATAR_CHIP_CORNER_INSET = 18

export type ChipQuadrant = 'nw' | 'ne' | 'se' | 'sw'

/** Dealer and trump badges — keep in sync across games. */
export const CHIP_QUADRANTS = {
  dealer: 'nw' as ChipQuadrant,
  trump: 'ne' as ChipQuadrant,
} as const

/** Canonical chip diameters (px) — paired with em sizes in _avatar-chips.scss. */
export const TRUMP_CHIP_SIZE = 36
export const DEALER_CHIP_SIZE = 40

/**
 * Top-left position for a chip inside `.avatar-circle-frame`
 * (origin = top-left of the circle's bounding square).
 */
export function getChipOffsetInFrame(
  quadrant: ChipQuadrant,
  chipSize: number,
  circleSize = AVATAR_CIRCLE_SIZE,
  inset = AVATAR_CHIP_CORNER_INSET
): { left: number; top: number } {
  const half = chipSize / 2
  let cx: number
  let cy: number

  switch (quadrant) {
    case 'nw':
      cx = inset
      cy = inset
      break
    case 'ne':
      cx = circleSize - inset
      cy = inset
      break
    case 'sw':
      cx = inset
      cy = circleSize - inset
      break
    case 'se':
      cx = circleSize - inset
      cy = circleSize - inset
      break
  }

  return { left: cx - half, top: cy - half }
}

/** CSS custom properties for frame-based chip layout. */
export function chipQuadrantStyle(
  quadrant: ChipQuadrant,
  chipSizePx: number
): Record<string, string> {
  const { left, top } = getChipOffsetInFrame(quadrant, chipSizePx)
  return {
    left: `${left}px`,
    top: `${top}px`,
  }
}

/**
 * Center point of a quadrant's inset anchor (for a variable-width badge that
 * centers on the corner via transform: translate(-50%, -50%), rather than a
 * fixed-size chip). chipSize 0 → getChipOffsetInFrame returns the center.
 */
export function chipQuadrantCenterStyle(
  quadrant: ChipQuadrant
): Record<string, string> {
  const { left, top } = getChipOffsetInFrame(quadrant, 0)
  return {
    left: `${left}px`,
    top: `${top}px`,
  }
}

/**
 * Measure a chip's board-local top-left by reading the live avatar frame DOM.
 * Works for fixed (user) and absolute (opponent) avatars after scale transforms.
 */
export function measureChipBoardPosition(
  boardEl: HTMLElement | null,
  seatIndex: number,
  quadrant: ChipQuadrant,
  chipSize: number
): { left: number; top: number } | null {
  if (!boardEl) return null

  const frame = boardEl.querySelector(
    `[data-seat-index="${seatIndex}"] .avatar-circle-frame`
  )
  if (!frame) return null

  const boardRect = boardEl.getBoundingClientRect()
  const frameRect = frame.getBoundingClientRect()
  // Frame not laid out yet (e.g. mid round-transition) — bail so the caller can
  // retry instead of placing the chip at a garbage (top-left) position.
  if (frameRect.width === 0 || frameRect.height === 0) return null
  const scale = boardEl.offsetWidth > 0 ? boardRect.width / boardEl.offsetWidth : 1

  const chipOffset = getChipOffsetInFrame(quadrant, chipSize)
  const frameLeft = (frameRect.left - boardRect.left) / scale
  const frameTop = (frameRect.top - boardRect.top) / scale

  return {
    left: frameLeft + chipOffset.left,
    top: frameTop + chipOffset.top,
  }
}

/** NW dealer chip position in board coordinates for a seat. */
export function measureDealerChipBoardPosition(
  boardEl: HTMLElement | null,
  seatIndex: number
): { left: number; top: number } | null {
  return measureChipBoardPosition(
    boardEl,
    seatIndex,
    CHIP_QUADRANTS.dealer,
    DEALER_CHIP_SIZE
  )
}