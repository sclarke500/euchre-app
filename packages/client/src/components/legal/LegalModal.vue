<script setup lang="ts">
// Global Support/Privacy popup. Mounted once (in App.vue); shows whenever the
// useLegalModal state is set. Closing returns the user exactly where they were.
import { computed } from 'vue'
import { useLegalModal } from '@/composables/useLegalModal'
import SupportContent from './SupportContent.vue'
import PrivacyContent from './PrivacyContent.vue'

const { activePage, close } = useLegalModal()

const title = computed(() => (activePage.value === 'privacy' ? 'Privacy Policy' : 'Support'))
</script>

<template>
  <Teleport to="body">
    <Transition name="legal-fade">
      <div
        v-if="activePage"
        class="legal-overlay"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
        @click.self="close"
      >
        <div class="legal-dialog">
          <button class="legal-close" aria-label="Close" @click="close">✕</button>
          <div class="legal-scroll">
            <SupportContent v-if="activePage === 'support'" />
            <PrivacyContent v-else-if="activePage === 'privacy'" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped lang="scss">
.legal-overlay {
  position: fixed;
  inset: 0;
  z-index: 4000; // above Settings modal and chat panels
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.legal-dialog {
  position: relative;
  width: 100%;
  max-width: 640px;
  max-height: 85vh;
  max-height: 85dvh;
  background: #181820;
  color: #e8e8ec;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.5);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  // Respect notches/safe areas when near full screen
  margin: env(safe-area-inset-top) env(safe-area-inset-right)
    env(safe-area-inset-bottom) env(safe-area-inset-left);
}

.legal-close {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 1;
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.08);
  border: none;
  border-radius: 50%;
  color: rgba(255, 255, 255, 0.75);
  font-size: 15px;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.16);
    color: #fff;
  }
}

.legal-scroll {
  overflow-y: auto;
  padding: 28px 24px 24px;
}

.legal-fade-enter-active,
.legal-fade-leave-active {
  transition: opacity 0.18s ease;

  .legal-dialog {
    transition: transform 0.18s ease;
  }
}

.legal-fade-enter-from,
.legal-fade-leave-to {
  opacity: 0;

  .legal-dialog {
    transform: scale(0.97);
  }
}
</style>
