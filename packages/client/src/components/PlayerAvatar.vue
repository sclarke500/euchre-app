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
      <!-- Dealer chip attached to avatar -->
      <div v-if="props.isDealer" class="dealer-chip">D</div>
      
      <div class="avatar-border">
        <div class="avatar-circle">{{ initial }}</div>
        <div class="player-name">{{ props.name }}</div>
      </div>
      
      <!-- Turn indicator glow -->
      <div v-if="props.isCurrentTurn" class="avatar-glow"></div>
    </div>
    
    <!-- Status text (e.g., "Passed", "Thinking...") -->
    <div class="player-status" :class="{ visible: !!props.status }">{{ props.status }}</div>
    
    <!-- Info tags slot (bid chips, tricks, etc.) -->
    <div class="info-tags">
      <slot />
    </div>
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
  z-index: 300;

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
    background: #333344;
    border: 2px solid #4a4a60;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    font-weight: bold;
    color: #ccc;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
    transition: border-color var(--anim-slow, 0.3s) ease, box-shadow var(--anim-slow, 0.3s) ease;
  }

  .player-name {
    margin-top: -8px;
    padding: 2px 10px;
    font-size: 13px;
    font-weight: 600;
    color: #ccc;
    white-space: nowrap;
    background: #1a1a24;
    border-radius: 4px;
  }

  .player-status {
    font-size: 10px;
    color: #ffd700;
    background: rgba(0, 0, 0, 0.8);
    padding: 2px 6px;
    border-radius: 3px;
    font-weight: 600;
    opacity: 0;
    transition: opacity var(--anim-slow, 0.3s) ease;
    pointer-events: none;

    &.visible {
      opacity: 1;
    }
  }

  .info-tags {
    display: flex;
    gap: 4px;
    justify-content: center;
  }

  .avatar-glow {
    position: absolute;
    inset: -4px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255, 215, 0, 0.3) 0%, transparent 70%);
    animation: pulse 2s ease-in-out infinite;
    pointer-events: none;
  }

  .dealer-chip {
    position: absolute;
    top: -6px;
    right: -6px;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: linear-gradient(135deg, #fff 0%, #e0e0e0 100%);
    color: #2c3e50;
    font-size: 11px;
    font-weight: bold;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
    z-index: 10;
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
    bottom: 12px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 400;
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
