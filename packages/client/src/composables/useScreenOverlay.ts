/**
 * Screen-fixed overlay positioning for components teleported to <body>.
 *
 * Uses --screen-safe-* (viewport px, set by ScaledContainer or applySafeAreaCSSVars)
 * so chat panels, modals, and back buttons respect notches outside the scaled canvas.
 *
 * See docs/PLATFORM_CONTRACT.md.
 */
import { computed, type CSSProperties } from 'vue'

export type ScreenEdge = 'top' | 'right' | 'bottom' | 'left'

/** CSS value for one safe-area inset edge in viewport pixels. */
export function screenInsetCss(edge: ScreenEdge): string {
  return `var(--screen-safe-${edge}, var(--device-safe-${edge}, env(safe-area-inset-${edge}, 0px)))`
}

/** Padding style object clearing all edges past device safe areas. */
export function screenSafePadding(extra = 0): CSSProperties {
  const pad = extra > 0 ? `${extra}px` : '0px'
  return {
    paddingTop: extra > 0 ? `calc(${screenInsetCss('top')} + ${pad})` : screenInsetCss('top'),
    paddingRight: extra > 0 ? `calc(${screenInsetCss('right')} + ${pad})` : screenInsetCss('right'),
    paddingBottom: extra > 0 ? `calc(${screenInsetCss('bottom')} + ${pad})` : screenInsetCss('bottom'),
    paddingLeft: extra > 0 ? `calc(${screenInsetCss('left')} + ${pad})` : screenInsetCss('left'),
  }
}

/** Fixed corner offset past safe area (for buttons, panels anchored to an edge). */
export function screenFixedOffset(
  edge: { top?: number; right?: number; bottom?: number; left?: number }
): CSSProperties {
  const style: CSSProperties = {}
  if (edge.top !== undefined) {
    style.top = `calc(${screenInsetCss('top')} + ${edge.top}px)`
  }
  if (edge.right !== undefined) {
    style.right = `calc(${screenInsetCss('right')} + ${edge.right}px)`
  }
  if (edge.bottom !== undefined) {
    style.bottom = `calc(${screenInsetCss('bottom')} + ${edge.bottom}px)`
  }
  if (edge.left !== undefined) {
    style.left = `calc(${screenInsetCss('left')} + ${edge.left}px)`
  }
  return style
}

export function useScreenOverlay() {
  const overlayPadding = computed(() => screenSafePadding(16))
  const modalPadding = computed(() => screenSafePadding(16))
  const backButtonPosition = computed(() => screenFixedOffset({ top: 16, left: 16 }))
  const chatPanelInset = computed(() => ({
    paddingLeft: screenInsetCss('left'),
  }))

  return {
    overlayPadding,
    modalPadding,
    backButtonPosition,
    chatPanelInset,
    screenInsetCss,
    screenSafePadding,
    screenFixedOffset,
  }
}