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
        <div class="avatar-circle" :class="{ 'has-image': hasAvatar }">
          <img v-if="hasAvatar" :src="resolvedAvatarUrl" :alt="name" class="avatar-image" />
          <span v-else class="avatar-initial">{{ initial }}</span>
        </div>
        <div class="name-column">
          <!-- Info tags - above name for user, top-right for opponents -->
          <div class="info-tags">
            <slot />
          </div>
          <div class="player-name">{{ props.name }}</div>
        </div>
      </div>
      
      <!-- Trump indicator chip - top-right of avatar circle -->
      <div v-if="props.trumpSymbol" class="trump-chip" :style="{ color: props.trumpColor }">{{ props.trumpSymbol }}</div>
      
      <!-- Turn indicator glow -->
      <div v-if="props.isCurrentTurn" class="avatar-glow"></div>
      
      <!-- Chat bubble - positioned relative to avatar -->
      <ChatBubble
        v-if="chatMessage"
        :message="chatMessage"
        :position="bubblePosition"
        :persistent="chatPersistent"
        class="avatar-chat-bubble"
        @dismiss="emit('chat-dismiss')"
      />
    </div>
    
    <!-- Status text (e.g., "Passed", "Thinking...") -->
    <div class="player-status" :class="{ visible: !!props.status }">{{ props.status }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from 'vue'
import { getAIAvatar, type ChatMessage } from '@67cards/shared'
import ChatBubble from './chat/ChatBubble.vue'

export type AvatarPosition = 'bottom' | 'left' | 'right' | 'top' | 'rail-left' | 'rail-right' | 'rail-top'

const props = withDefaults(defineProps<{
  name: string
  isCurrentTurn?: boolean
  isUser?: boolean
  status?: string
  position?: AvatarPosition
  /** Custom positioning style (for table-relative placement) */
  customStyle?: CSSProperties
  /** Trump suit symbol to show (e.g., ♠ ♥ ♦ ♣) */
  trumpSymbol?: string
  /** Trump suit color (e.g., #e74c3c for red, #2c3e50 for black) */
  trumpColor?: string
  /** Optional avatar image URL (overrides auto-detection) */
  avatarUrl?: string
  /** Chat message to display as speech bubble */
  chatMessage?: ChatMessage | null
  /** Keep bubble visible (for testing/positioning) */
  chatPersistent?: boolean
}>(), {
  isCurrentTurn: false,
  isUser: false,
  status: '',
  position: 'bottom',
  trumpSymbol: '',
  trumpColor: '#2c3e50',
  avatarUrl: '',
  chatMessage: null,
  chatPersistent: false,
})

const emit = defineEmits<{
  'chat-dismiss': []
}>()

const initial = computed(() => props.name?.[0]?.toUpperCase() ?? '?')

// Auto-detect AI avatar by name if no avatarUrl provided
const resolvedAvatarUrl = computed(() => {
  if (props.avatarUrl) return props.avatarUrl
  const aiAvatar = getAIAvatar(props.name)
  if (aiAvatar) {
    // AI avatars are in /assets/avatars/ai/
    return `/avatars/ai/${aiAvatar}`
  }
  return ''
})

const hasAvatar = computed(() => !!resolvedAvatarUrl.value)

const positionClass = computed(() => `position-${props.position}`)

const positionStyle = computed(() => props.customStyle ?? {})

// Map avatar position to bubble tail direction
// Side players: bubble above (out of table area)
// Top player: bubble to the right (out of table area)
// User (bottom): bubble above
const bubblePosition = computed(() => {
  switch (props.position) {
    case 'rail-top':
    case 'top':
      return 'left' // Bubble to RIGHT of avatar, tail points left toward avatar
    case 'rail-left':
    case 'left':
    case 'rail-right':
    case 'right':
      return 'bottom' // Bubble ABOVE avatar, tail points down toward avatar
    case 'bottom':
    default:
      return 'bottom' // Bubble above avatar, tail points down
  }
})
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
    overflow: hidden;
    
    &.has-image {
      background: none;
      padding: 0;
    }
  }
  
  .avatar-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 50%;
  }
  
  .avatar-initial {
    // Keep existing initial styling
  }

  .name-column {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-top: -8px;
  }

  .player-name {
    padding: 3px 14px;
    font-size: 13px;
    font-weight: 600;
    color: #e8e8f0;
    white-space: nowrap;
    background: linear-gradient(180deg, 
      rgba(70, 70, 90, 0.95) 0%, 
      rgba(40, 40, 55, 0.98) 50%,
      rgba(25, 25, 35, 0.98) 100%
    );
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 12px;
    position: relative;
    z-index: 10;
    box-shadow: 
      0 3px 10px rgba(0, 0, 0, 0.5),
      0 1px 3px rgba(0, 0, 0, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.2),
      inset 0 -1px 0 rgba(0, 0, 0, 0.3);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  }

  .player-status {
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    margin-top: 4px;
    font-size: 11px;
    color: var(--color-warning);
    background: var(--color-dark-surface);
    padding: 3px 8px;
    border-radius: var(--radius-sm);
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
  
  // Trump indicator chip - positioned at top-right of avatar circle
  .trump-chip {
    position: absolute;
    top: -4px;
    right: -4px;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: linear-gradient(135deg, #f8f8f8 0%, #e8e8e8 100%);
    border: 2px solid #ddd;
    font-size: 14px;
    font-weight: bold;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 
      0 2px 6px rgba(0, 0, 0, 0.4),
      inset 0 1px 2px rgba(255, 255, 255, 0.8),
      inset 0 -1px 2px rgba(0, 0, 0, 0.15);
    z-index: 10;
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

  // Chat bubble positioning (relative to avatar-container)
  // Keep bubbles OUT of the table/card play area
  .avatar-chat-bubble {
    position: absolute;
    z-index: 450;
  }
  
  // User (bottom) - bubble ABOVE, tail points down
  &.position-bottom .avatar-chat-bubble {
    bottom: calc(100% + 10px);
    left: 50%;
    transform: translateX(-50%);
  }
  
  // Top opponent - bubble to the RIGHT, tail points left, raised to avoid scoreboard
  &.position-rail-top .avatar-chat-bubble,
  &.position-top .avatar-chat-bubble {
    left: calc(100% + 8px);
    top: 35%;
    transform: translateY(-50%);
  }
  
  // Left opponent - bubble ABOVE, tail points down
  &.position-rail-left .avatar-chat-bubble,
  &.position-left .avatar-chat-bubble {
    bottom: calc(100% + 10px);
    left: 50%;
    transform: translateX(-50%);
  }
  
  // Right opponent - bubble ABOVE, tail points down
  &.position-rail-right .avatar-chat-bubble,
  &.position-right .avatar-chat-bubble {
    bottom: calc(100% + 10px);
    left: 50%;
    transform: translateX(-50%);
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
