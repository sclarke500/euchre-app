<template>
  <div 
    class="player-avatar" 
    :class="[
      positionClass,
      { 
        'is-current-turn': props.isCurrentTurn,
        'is-user': props.isUser,
        'is-dealer': props.isDealer
      }
    ]"
    :style="positionStyle"
  >
    <div class="avatar-container">
      <div class="avatar-border">
        <div class="avatar-circle">{{ initial }}</div>
        <div class="name-row">
          <div class="player-name">{{ props.name }}</div>
        </div>
      </div>
      
      <!-- Info tags - top right of avatar circle -->
      <div class="info-tags">
        <slot />
      </div>
      
      <!-- Dealer chip - bottom right (or bottom left for rail-right position) -->
      <div v-if="props.isDealer" class="dealer-chip" :class="{ 'chip-left': props.position === 'rail-right' }">D</div>
      
      <!-- Turn indicator glow -->
      <div v-if="props.isCurrentTurn" class="avatar-glow"></div>
    </div>
    
    <!-- Status text (e.g., "Passed", "Thinking...") -->
    <div class="player-status" :class="{ visible: !!props.status }">{{ props.status }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from 'vue'

export type AvatarPosition = 'bottom' | 'left' | 'right' | 'top' | 'rail-left' | 'rail-right' | 'rail-top'

const props = withDefaults(defineProps<{
  name: string
  isCurrentTurn?: boolean
  isUser?: boolean
  isDealer?: boolean
  status?: string
  position?: AvatarPosition
  /** Custom positioning style (for table-relative placement) */
  customStyle?: CSSProperties
}>(), {
  isCurrentTurn: false,
  isUser: false,
  isDealer: false,
  status: '',
  position: 'bottom',
})

const initial = computed(() => props.name?.[0]?.toUpperCase() ?? '?')

const positionClass = computed(() => `position-${props.position}`)

const positionStyle = computed(() => props.customStyle ?? {})
</script>

<style scoped lang="scss">
.player-avatar {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  z-index: 350; // Above table cards (~100-250), below user hand (~1000+)

  .avatar-container {
    position: relative;
  }

  .avatar-border {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0;
  }

  .avatar-circle {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: linear-gradient(145deg, #4a4a5c, #3a3a4c);
    border: 2px solid #5a5a70;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    font-weight: bold;
    color: #ddd;
    box-shadow: 
      0 4px 12px rgba(0, 0, 0, 0.5),
      0 2px 4px rgba(0, 0, 0, 0.3);
    transition: border-color var(--anim-slow, 0.3s) ease, box-shadow var(--anim-slow, 0.3s) ease;
  }

  .name-row {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: -8px;
  }

  .player-name {
    padding: 2px 12px;
    font-size: 13px;
    font-weight: 600;
    color: #ccc;
    white-space: nowrap;
    background: #1a1a24;
    border-radius: 10px;
  }

  .player-status {
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    margin-top: 4px;
    font-size: 11px;
    color: #ffd700;
    background: rgba(0, 0, 0, 0.85);
    padding: 3px 8px;
    border-radius: 4px;
    font-weight: 600;
    white-space: nowrap;
    opacity: 0;
    transition: opacity var(--anim-slow, 0.3s) ease;
    pointer-events: none;

    &.visible {
      opacity: 1;
    }
  }

  // Info tags - positioned at top-right of avatar circle
  .info-tags {
    position: absolute;
    top: -4px;
    right: -4px;
    display: flex;
    gap: 4px;
    z-index: 5;
  }

  .avatar-glow {
    position: absolute;
    inset: -4px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255, 215, 0, 0.3) 0%, transparent 70%);
    animation: pulse 2s ease-in-out infinite;
    pointer-events: none;
  }

  // Dealer chip - absolutely positioned at bottom-right of avatar
  .dealer-chip {
    position: absolute;
    bottom: 12px;
    right: -4px;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: linear-gradient(135deg, #fff 0%, #e0e0e0 100%);
    color: #2c3e50;
    font-size: 13px;
    font-weight: bold;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
    z-index: 5;
    
    // Bottom-left for rail-right position
    &.chip-left {
      right: auto;
      left: -4px;
    }
  }

  // Turn indicator - golden glow on circle
  &.is-current-turn .avatar-circle {
    border-color: rgba(255, 215, 0, 0.7);
    box-shadow:
      0 0 12px rgba(255, 215, 0, 0.3),
      0 0 30px rgba(255, 215, 0, 0.15),
      0 0 50px rgba(255, 215, 0, 0.08);
  }

  // Position variants
  &.position-bottom {
    position: fixed;
    // Position so avatar sits just above user's cards
    bottom: calc(20% - 10px);
    left: 50%;
    transform: translateX(-50%);
    z-index: 500; // Above table cards, below user hand (~1000+)
  }

  &.position-rail-left {
    position: absolute;
    transform: translate(-50%, -50%);
  }

  &.position-rail-right {
    position: absolute;
    transform: translate(-50%, -50%);
  }

  &.position-rail-top {
    position: absolute;
    transform: translate(-50%, -50%);
  }
}

@keyframes pulse {
  0%, 100% { opacity: 0.6; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.05); }
}
</style>
