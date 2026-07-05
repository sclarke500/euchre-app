<template>
  <div 
    class="player-avatar"
    :data-seat-index="seatIndex"
    :class="[
      positionClass,
      statusClass,
      { 
        'is-current-turn': props.isCurrentTurn,
        'is-user': props.isUser
      }
    ]"
    :style="positionStyle"
  >
    <div class="avatar-container">
      <div class="avatar-border">
        <div class="avatar-circle-frame" :class="{ 'is-user-frame': props.isUser }">
          <div class="avatar-circle" :class="{ 'has-image': hasAvatar }">
            <img v-if="hasAvatar" :src="resolvedAvatarUrl" :alt="name" class="avatar-image" />
            <span v-else class="avatar-initial">{{ initial }}</span>
          </div>
          <div
            v-if="props.trumpSuit"
            class="avatar-chip avatar-chip--trump"
            :style="trumpChipStyle"
            aria-label="Trump suit"
          ><SuitGlyph :suit="props.trumpSuit" class="trump-chip-glyph" /></div>
          <div
            v-if="hasBidBadge"
            class="avatar-bid-badge"
            :style="bidBadgeStyle"
            aria-label="Bid"
          >{{ props.bidBadge }}</div>
        </div>
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
import SuitGlyph from './SuitGlyph.vue'
import { useLobbyStore } from '@/stores/lobbyStore'
import { chipQuadrantStyle, chipQuadrantCenterStyle, CHIP_QUADRANTS, TRUMP_CHIP_SIZE } from '@/utils/avatarChipLayout'

export type AvatarPosition = 'bottom' | 'left' | 'right' | 'top' | 'rail-left' | 'rail-right' | 'rail-top'

const props = withDefaults(defineProps<{
  name: string
  isCurrentTurn?: boolean
  isUser?: boolean
  status?: string
  position?: AvatarPosition
  /** Seat index for DOM queries (dealer chip animation, debug) */
  seatIndex?: number
  /** Custom positioning style (for table-relative placement) */
  customStyle?: CSSProperties
  /** Trump suit name to show (e.g., "spades", "hearts") */
  trumpSuit?: string
  /** Trump suit color (e.g., #e74c3c for red, #2c3e50 for black) */
  trumpColor?: string
  /** Optional avatar image URL (overrides auto-detection) */
  avatarUrl?: string
  /** Chat message to display as speech bubble */
  chatMessage?: ChatMessage | null
  /** Keep bubble visible (for testing/positioning) */
  chatPersistent?: boolean
  /** Corner badge at NE (e.g. Spades bid) — same anchor as the trump chip */
  bidBadge?: string | number | null
  /** Optional background color for the bid badge */
  bidBadgeColor?: string
}>(), {
  isCurrentTurn: false,
  isUser: false,
  status: '',
  position: 'bottom',
  seatIndex: undefined,
  trumpSuit: '',
  trumpColor: '#2c3e50',
  avatarUrl: '',
  chatMessage: null,
  chatPersistent: false,
  bidBadge: null,
  bidBadgeColor: '',
})

const emit = defineEmits<{
  'chat-dismiss': []
}>()

const lobbyStore = useLobbyStore()

const initial = computed(() => props.name?.[0]?.toUpperCase() ?? '?')

// Auto-detect avatar:
// 1. If avatarUrl prop provided, use it
// 2. If isUser, check lobbyStore for user's selected avatar
// 3. Otherwise check if it's an AI name
const resolvedAvatarUrl = computed(() => {
  if (props.avatarUrl) return props.avatarUrl
  
  // User's own avatar from profile
  if (props.isUser && lobbyStore.avatarUrl) {
    return lobbyStore.avatarUrl
  }
  
  // AI avatar by name
  const aiAvatar = getAIAvatar(props.name)
  if (aiAvatar) {
    return `/avatars/ai/${aiAvatar}`
  }
  
  return ''
})

const hasAvatar = computed(() => !!resolvedAvatarUrl.value)

const positionClass = computed(() => `position-${props.position}`)

const positionStyle = computed(() => props.customStyle ?? {})

const trumpChipStyle = computed(() => ({
  ...chipQuadrantStyle(CHIP_QUADRANTS.trump, TRUMP_CHIP_SIZE),
  color: props.trumpColor,
}))

const hasBidBadge = computed(
  () => props.bidBadge !== null && props.bidBadge !== undefined && props.bidBadge !== ''
)

// Bid badge sits at the same NE inset as the trump chip, but centers on the
// anchor so variable-width text ("Nil"/"Blind Nil") grows around the corner.
const bidBadgeStyle = computed(() => ({
  ...chipQuadrantCenterStyle(CHIP_QUADRANTS.trump),
  ...(props.bidBadgeColor ? { background: props.bidBadgeColor } : {}),
}))

// Status type for color coding: 'pass' = neutral, 'action' = green (order up, pick it up, etc.)
const statusClass = computed(() => {
  if (!props.status) return ''
  const lower = props.status.toLowerCase()
  if (lower.includes('pass')) return 'status-pass'
  if (lower.includes('order') || lower.includes('pick') || lower.includes('call') || lower.includes('alone')) {
    return 'status-action'
  }
  return ''
})

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
@use '@/assets/styles/avatar-chips' as *;

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

  // User avatar: frosted glass look with unified glow
  &.is-user .avatar-container {
    padding: 2px 14px 2px 4px;
    background: var(--panel-bg);
    border-radius: 30px;
    backdrop-filter: blur(16px);
    border: 1px solid var(--panel-border);
    box-shadow: 
      0 4px 16px rgba(0, 0, 0, 0.3),
      0 0 var(--panel-glow-size) var(--panel-glow-color),
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
    position: relative; // For absolute positioned badges (President rank)
  }

  &.is-user .player-name {
    padding: ui-size(4px, 0.9vh, 8px) ui-size(14px, 2.8vh, 26px);
    font-size: ui-size(16px, 3vh, 26px);
    background: transparent; // Backdrop handles the background now
  }
  
  // For user, info-tags appear above name inside the pill
  &.is-user .info-tags {
    position: static;
    margin-bottom: 2px;
    padding-left: 14px;
  }

  &.is-user .avatar-circle-frame.is-user-frame {
    // Break the circle out of the pill (left half sits outside the plaque).
    margin-top: -26px;
    margin-bottom: -26px;
    margin-left: -62px;
  }

  &.is-user .avatar-circle {
    border-color: rgba(255, 255, 255, 0.25); // Frosted glass accent
  }

  .avatar-circle {
    width: 112px;
    height: 112px;
    border-radius: 50%;
    background: linear-gradient(145deg, #4a4a5c, #3a3a4c);
    border: 2px solid #5a5a70;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: $ui-md;
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
    font-size: ui-size(24px, 4.6vh, 40px);
    font-weight: 700;
    color: #e8e8f0;
  }

  // Corner bid badge (Spades) — NE anchor, same as trump chip, centered on the
  // anchor so numbers read as a circle and longer text grows around it.
  .avatar-bid-badge {
    position: absolute;
    transform: translate(-50%, -50%);
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 1.9em;
    height: 1.9em;
    padding: 0 0.5em;
    border-radius: 999px;
    background: #2f6fb0;
    color: #fff;
    font-size: $ui-md;
    font-weight: 700;
    line-height: 1;
    white-space: nowrap;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.45);
    border: 2px solid rgba(255, 255, 255, 0.85);
    z-index: 12;
    pointer-events: none;
  }

  .name-column {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-top: -8px;
  }

  .player-name {
    padding: ui-size(4px, 0.9vh, 8px) ui-size(14px, 2.8vh, 26px);
    font-size: ui-size(15px, 3vh, 25px);
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

  // Status callout — same speech-bubble look as chat comments, just bigger, so
  // bidding feedback ("Pass" / "Order Up") reads consistently with player chat.
  .player-status {
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%) scale(0.85);
    margin-top: 12px;
    font-size: ui-size(14px, 2.6vh, 22px);
    line-height: 1.2;
    color: #1a1a1a;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 248, 248, 0.98) 100%);
    padding: ui-size(5px, 1vh, 9px) ui-size(12px, 2.4vh, 20px);
    border-radius: 12px;
    font-weight: 700;
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25), 0 1px 3px rgba(0, 0, 0, 0.15);
    transition: opacity 0.2s ease, transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);

    // Tail pointing UP toward the avatar (callout style, like chat bubbles)
    &::after {
      content: '';
      position: absolute;
      top: -7px;
      left: 50%;
      transform: translateX(-50%);
      width: 0;
      height: 0;
      border: 7px solid transparent;
      border-bottom-color: rgba(255, 255, 255, 0.98);
      border-top: none;
    }

    &.visible {
      opacity: 1;
      transform: translateX(-50%) scale(1);
    }
  }

  // Color-coded text — bubble stays white like chat callouts, meaning carried by color
  &.status-pass .player-status {
    color: #444b57;
  }

  &.status-action .player-status {
    color: #1c7a4a;
  }

  // Info tags - for user, flows above name inside pill
  .info-tags {
    display: flex;
    gap: 4px;
    z-index: 20; // Above the name plaque (10) so bid/tricks chips aren't hidden

    &:empty {
      display: none;
    }
  }
  
  // Opponent info tags (bid/tricks) — near SE, below trump
  &:not(.is-user) .name-column .info-tags {
    position: absolute;
    top: -8px;
    right: -18px;
  }

  .avatar-glow {
    position: absolute;
    inset: -4px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255, 215, 0, 0.3) 0%, transparent 70%);
    animation: pulse 2s ease-in-out infinite;
    pointer-events: none;
  }
  
  // Turn indicator - bright animated glow on circle
  &.is-current-turn .avatar-circle {
    border-color: #ffd700;
    border-width: 3px;
    box-shadow:
      0 0 5px 1px rgba(255, 215, 0, 0.35),
      0 0 12px 2px rgba(255, 215, 0, 0.25),
      0 0 24px 5px rgba(255, 215, 0, 0.12);
    animation: turn-pulse 1.5s ease-in-out infinite;
  }
  
  @keyframes turn-pulse {
    0%, 100% {
      box-shadow:
        0 0 5px 1px rgba(255, 215, 0, 0.35),
        0 0 12px 2px rgba(255, 215, 0, 0.25),
        0 0 24px 5px rgba(255, 215, 0, 0.12);
    }
    50% {
      box-shadow:
        0 0 7px 2px rgba(255, 215, 0, 0.5),
        0 0 17px 5px rgba(255, 215, 0, 0.3),
        0 0 30px 7px rgba(255, 215, 0, 0.18);
    }
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
    // Gentle raise off the bottom — enough to ease the safe-area (gesture nav)
    // cutoff without sitting so high it blocks the hand. Quarter-strength of the
    // earlier (too-drastic) lift. This scoped rule (with its [data-v] attr) must
    // hold the value — a non-scoped rule loses on specificity.
    bottom: calc(18px + (var(--safe-bottom, 0px) * 0.25));
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

<!-- Avatar/chip/label sizing — universal now (the canonical is uniformly large,
     so there is no separate "mobile" tier). PlayerAvatar is only used on the
     game board, so these global selectors are safe. -->
<style lang="scss">
@use '@/assets/styles/avatar-chips' as *;

.player-avatar {
  // Avatar circle (kept in sync with the scoped default above)
  .avatar-circle {
    width: 112px;
    height: 112px;
  }

  // Name labels — readable-floored so they never get tiny on phones
  .player-name {
    padding: ui-size(4px, 0.9vh, 8px) ui-size(14px, 2.8vh, 26px);
    font-size: ui-size(15px, 3vh, 25px);
    border-radius: 14px;
  }

  // Info tags (bid/tricks chips)
  .info-tags {
    gap: 6px;

    .info-chip {
      font-size: $ui-xs;
      padding: 3px 10px;
    }
  }
}

</style>
