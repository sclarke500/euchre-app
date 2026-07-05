<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="show"
        ref="overlayRef"
        class="modal-overlay"
        :class="{ 'non-blocking': nonBlocking, 'modal-canonical': scaleWithBoard && isCanonical }"
        :style="{ zIndex: 10000 + priority, ...modalPadding }"
        @click.self="handleBackdropClick"
      >
        <div
          ref="dialogRef"
          class="modal-content"
          :class="contentClass"
          role="dialog"
          :aria-modal="nonBlocking ? 'false' : 'true'"
          :aria-label="ariaLabel"
          :aria-labelledby="ariaLabelledby"
          :aria-describedby="ariaDescribedby"
          tabindex="-1"
          @keydown="handleKeydown"
        >
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { nextTick, onUnmounted, ref, watch } from 'vue'
import { useScreenOverlay } from '@/composables/useScreenOverlay'
import { useAppRenderMode } from '@/composables/useAppRenderMode'

const { modalPadding } = useScreenOverlay()
// On canonical (game) routes the board is transform-scaled, but modals teleport
// to <body> and escape that scale. Dialogs authored in canonical px ($ui-*,
// game-dialog/dialog-panel) render ~2x too large on phones unscaled — those
// opt in via scaleWithBoard to shrink by the board scale (never enlarged past
// 1). rem-authored modals (rules, modal-light) stay unscaled.
const { isCanonical } = useAppRenderMode()

const props = withDefaults(defineProps<{
  show: boolean
  nonBlocking?: boolean
  priority?: number
  dismissOnBackdrop?: boolean
  dismissOnEsc?: boolean
  lockScroll?: boolean
  /** Shrink the dialog by --board-scale on canonical routes (for dialogs authored in canonical px) */
  scaleWithBoard?: boolean
  ariaLabel?: string
  ariaLabelledby?: string
  ariaDescribedby?: string
  contentClass?: string | string[] | Record<string, boolean>
}>(), {
  nonBlocking: false,
  priority: 0,
  dismissOnBackdrop: true,
  dismissOnEsc: true,
  lockScroll: true,
  scaleWithBoard: false,
  ariaLabel: undefined,
  ariaLabelledby: undefined,
  ariaDescribedby: undefined,
  contentClass: undefined,
})

const emit = defineEmits<{
  close: []
}>()

const overlayRef = ref<HTMLDivElement | null>(null)
const dialogRef = ref<HTMLDivElement | null>(null)
const previousBodyOverflow = ref<string | null>(null)
const previouslyFocusedElement = ref<HTMLElement | null>(null)

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function getFocusableElements() {
  if (!dialogRef.value) return []
  return Array.from(dialogRef.value.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    .filter((el) => !el.hasAttribute('disabled') && !el.getAttribute('aria-hidden'))
}

function focusDialog() {
  const focusable = getFocusableElements()
  const firstFocusable = focusable[0]
  if (firstFocusable) {
    firstFocusable.focus()
  } else {
    dialogRef.value?.focus()
  }
}

function handleBackdropClick() {
  if (!props.dismissOnBackdrop || props.nonBlocking) return
  emit('close')
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && props.dismissOnEsc) {
    event.preventDefault()
    emit('close')
    return
  }

  if (event.key !== 'Tab') return

  const focusable = getFocusableElements()
  if (focusable.length === 0) {
    event.preventDefault()
    dialogRef.value?.focus()
    return
  }

  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (!first || !last) {
    event.preventDefault()
    dialogRef.value?.focus()
    return
  }
  const active = document.activeElement as HTMLElement | null

  if (event.shiftKey && active === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && active === last) {
    event.preventDefault()
    first.focus()
  }
}

function applyScrollLock() {
  if (!props.lockScroll || props.nonBlocking) return
  if (previousBodyOverflow.value === null) {
    previousBodyOverflow.value = document.body.style.overflow
  }
  document.body.style.overflow = 'hidden'
}

function releaseScrollLock() {
  if (previousBodyOverflow.value !== null) {
    document.body.style.overflow = previousBodyOverflow.value
    previousBodyOverflow.value = null
  }
}

watch(
  () => props.show,
  async (isOpen) => {
    if (isOpen) {
      previouslyFocusedElement.value = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
      applyScrollLock()
      await nextTick()
      // Reset scroll position of modal content and any scrollable children
      if (dialogRef.value) {
        dialogRef.value.scrollTop = 0
        dialogRef.value.querySelectorAll<HTMLElement>('.modal-body, .dialog-text, .rules-content')
          .forEach(el => el.scrollTop = 0)
      }
      focusDialog()
      return
    }

    releaseScrollLock()
    previouslyFocusedElement.value?.focus()
    previouslyFocusedElement.value = null
  },
  { immediate: true },
)

onUnmounted(() => {
  releaseScrollLock()
})
</script>

<style scoped lang="scss">
@use '@/assets/styles/frosted-glass' as *;

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  // z-index set via inline style based on priority prop
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  // padding set via modalPadding (safe-area aware)

  &.non-blocking {
    pointer-events: none;
    background-color: transparent;
    backdrop-filter: none;

    .modal-content {
      pointer-events: auto;
    }
  }
}

.modal-content {
  // Board-scale factor for canonical routes (1 elsewhere). Layout constraints
  // divide by it so the dialog lays out in canonical space, then the transform
  // shrinks it to viewport size — same proportions as the scaled board behind it.
  --modal-scale: 1;
  background: transparent;
  border-radius: 12px;
  transform: scale(var(--modal-scale));
  max-width: calc(min(92vw, 560px) / var(--modal-scale));
  max-height: calc((100dvh - #{$spacing-xl}) / var(--modal-scale));
  overflow: auto;
}

.modal-canonical .modal-content {
  --modal-scale: min(1, var(--board-scale, 1));
}

:deep(.dialog-panel) {
  @include frosted-panel;
  padding: $spacing-lg;
  border-radius: 16px;
  text-align: center;
  color: $text-primary;
}

:deep(.dialog-title) {
  margin-bottom: $spacing-sm;
  font-weight: 700;
  font-size: 1.25rem;
  color: $text-primary;
}

:deep(.dialog-text) {
  margin-bottom: $spacing-md;
  color: $text-secondary;
  line-height: 1.5;
}

:deep(.dialog-actions) {
  display: flex;
  justify-content: center;
  gap: $spacing-sm;
  flex-wrap: wrap;
}

:deep(.dialog-btn) {
  @include frosted-btn;
}

:deep(.dialog-btn--primary) {
  background: linear-gradient(
    180deg,
    rgba(40, 115, 80, 0.95) 0%,
    rgba(28, 85, 58, 0.98) 100%
  );
  border-color: rgba(70, 160, 110, 0.25);
  color: #fff;
  
  &:hover {
    background: linear-gradient(
      180deg,
      rgba(48, 130, 90, 0.95) 0%,
      rgba(35, 100, 68, 0.98) 100%
    );
  }
}

:deep(.dialog-btn--muted) {
  background: linear-gradient(
    180deg,
    rgba(55, 58, 68, 0.95) 0%,
    rgba(35, 38, 48, 0.98) 100%
  );
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: $text-secondary;
  
  &:hover {
    background: linear-gradient(
      180deg,
      rgba(65, 68, 78, 0.95) 0%,
      rgba(45, 48, 58, 0.98) 100%
    );
    color: $text-primary;
  }
}

// Transition styles
.modal-enter-active {
  transition: opacity var(--anim-medium) ease-out;

  .modal-content {
    transition: transform var(--anim-medium) cubic-bezier(0.34, 1.56, 0.64, 1), opacity var(--anim-medium) ease-out;
  }
}

.modal-leave-active {
  transition: opacity var(--anim-fast) ease-in;

  .modal-content {
    transition: transform var(--anim-fast) ease-in, opacity var(--anim-fast) ease-in;
  }
}

.modal-enter-from {
  opacity: 0;

  .modal-content {
    opacity: 0;
    transform: scale(calc(var(--modal-scale) * 0.75)) translateY(15px);
  }
}

.modal-leave-to {
  opacity: 0;

  .modal-content {
    opacity: 0;
    transform: scale(calc(var(--modal-scale) * 0.8)) translateY(-10px);
  }
}
</style>
