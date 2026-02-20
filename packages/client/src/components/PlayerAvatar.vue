<template>
  <div 
    class="player-avatar" 
    :class="[
      positionClass,
      { 
        'is-current-turn': props.isCurrentTurn,
        'is-user': props.isUser
      }
    ]"
    :style="positionStyle"
  >
    <div class="avatar-container">
      <div class="avatar-border">
        <div class="avatar-circle">{{ initial }}</div>
        <div class="name-column">
          <!-- Info tags - above name for user, top-right for opponents -->
          <div class="info-tags">
            <slot />
          </div>
          <div class="player-name">{{ props.name }}</div>
        </div>
      </div>
      
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
  status?: string
  position?: AvatarPosition
  /** Custom positioning style (for table-relative placement) */
  customStyle?: CSSProperties
}>(), {
  isCurrentTurn: false,
  isUser: false,
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
  
  // Opponents need relative on name-column for info-tags positioning
  &:not(.is-user) .name-column {
    position: relative;
  }

  .avatar-border {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0;
    position: relative; // For absolute positioning of info-tags
  }

  // User avatar: frosted glass look
  &.is-user .avatar-container {
    padding: 6px 12px 6px 6px;
    background: rgba(60, 60, 70, 0.65);
    border-radius: 30px;
    backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 
      0 4px 16px rgba(0, 0, 0, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.15);
  }

  &.is-user .avatar-border {
    flex-direction: row;
    align-items: center;
    gap: 8px;
  }

  &.is-user .name-column {
    margin-top: 0;
    margin-left: -4px;
    align-items: flex-start;
  }

  &.is-user .player-name {
    padding: 4px 14px;
    font-size: 14px;
    background: transparent; // Backdrop handles the background now
  }
  
  // For user, info-tags appear above name inside the pill
  &.is-user .info-tags {
    position: static;
    margin-bottom: 2px;
    padding-left: 14px;
  }

  &.is-user .avatar-circle {
    border-color: rgba(255, 255, 255, 0.25); // Frosted glass accent
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

  .name-column {
    display: flex;
    flex-direction: column;
    align-items: center;
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
    position: relative;
    z-index: 10;
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

  // Info tags - for user, flows above name inside pill
  .info-tags {
    display: flex;
    gap: 4px;
    z-index: 5;
    
    &:empty {
      display: none;
    }
  }
  
  // For opponents, position absolutely at top-right of avatar circle (snug like trump chip)
  &:not(.is-user) .name-column .info-tags {
    position: absolute;
    top: -45px;
    right: -14px;
  }

  .avatar-glow {
    position: absolute;
    inset: -4px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255, 215, 0, 0.3) 0%, transparent 70%);
    animation: pulse 2s ease-in-out infinite;
    pointer-events: none;
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
    bottom: 10px; // At bottom of screen, above cards
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
