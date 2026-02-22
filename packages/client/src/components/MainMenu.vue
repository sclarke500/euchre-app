<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useLobbyStore } from '@/stores/lobbyStore'
import { getPlatformInfo } from '@/utils/platform'
import SettingsModal from './SettingsModal.vue'
import ProfileModal from './ProfileModal.vue'

const route = useRoute()
const router = useRouter()

export type GameType = 'euchre' | 'president' | 'klondike' | 'spades'

const showSettings = ref(false)
const showProfile = ref(false)

// Carousel scroll state
const carouselRef = ref<HTMLElement | null>(null)
const canScrollLeft = ref(false)
const canScrollRight = ref(false)

function updateScrollState() {
  const el = carouselRef.value
  if (!el) return
  canScrollLeft.value = el.scrollLeft > 5
  canScrollRight.value = el.scrollLeft < el.scrollWidth - el.clientWidth - 5
}

function scrollCarousel(direction: 'left' | 'right') {
  const el = carouselRef.value
  if (!el) return
  const scrollAmount = 120
  el.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' })
}

function scrollToSelectedGame() {
  const el = carouselRef.value
  if (!el) return
  const activeCard = el.querySelector('.game-card.active') as HTMLElement
  if (activeCard) {
    activeCard.scrollIntoView({ behavior: 'instant', inline: 'center', block: 'nearest' })
  }
}

// Platform detection
const showIOSInstallHint = ref(false)
const showIOSSafariWarning = ref(false)
// Note: Android/Desktop install prompt is handled by App.vue

// 67 wobble animation on load
const isWobbling = ref(true)

// Pending redirect after nickname is set
const pendingRedirect = ref<string | null>(null)

onMounted(() => {
  // Stop wobble after animation completes
  setTimeout(() => {
    isWobbling.value = false
  }, 2000) // 4 cycles × 0.5s = 2s

  // Set up carousel scroll tracking
  nextTick(() => {
    scrollToSelectedGame()
    updateScrollState()
    carouselRef.value?.addEventListener('scroll', updateScrollState)
  })

  // Check if redirected here because nickname was needed
  if (route.query.needsNickname === 'true') {
    pendingRedirect.value = route.query.redirect as string || null
    showProfile.value = true
    highlightNickname.value = true
    setTimeout(() => {
      highlightNickname.value = false
    }, 600)
    // Clean up URL
    router.replace({ path: '/', query: {} })
  }

  const platform = getPlatformInfo()

  if (platform.isStandalone) {
    // Already running as PWA, no hints needed
    return
  }

  if (platform.isIOS) {
    if (platform.isSafari) {
      showIOSInstallHint.value = true
    } else {
      showIOSSafariWarning.value = true
    }
  }
  // Note: Android/Desktop install prompt is handled by App.vue (fires before mount)
})

onUnmounted(() => {
  carouselRef.value?.removeEventListener('scroll', updateScrollState)
})

function dismissInstallHint() {
  showIOSInstallHint.value = false
  showIOSSafariWarning.value = false
}

const emit = defineEmits<{
  startSinglePlayer: [game: GameType]
  enterMultiplayer: [game: GameType]
}>()

// Load saved game selection from localStorage, default to 'euchre'
const savedGame = localStorage.getItem('selectedGame') as GameType | null
const selectedGame = ref<GameType>(
  savedGame === 'president' ? 'president' :
  savedGame === 'klondike' ? 'klondike' :
  savedGame === 'spades' ? 'spades' : 'euchre'
)

// Save game selection when it changes
watch(selectedGame, (newGame) => {
  localStorage.setItem('selectedGame', newGame)
})

const lobbyStore = useLobbyStore()

const highlightNickname = ref(false)

const canEnterMultiplayer = computed(() => {
  return lobbyStore.nickname.trim().length >= 2
})

// Handle redirect after profile modal closes (if user came from lobby without nickname)
watch(showProfile, (isOpen) => {
  if (!isOpen && pendingRedirect.value && canEnterMultiplayer.value) {
    const redirect = pendingRedirect.value
    pendingRedirect.value = null
    router.push(redirect)
  }
})

function handleMultiplayer() {
  if (!canEnterMultiplayer.value) {
    showProfile.value = true
    highlightNickname.value = true
    setTimeout(() => {
      highlightNickname.value = false
    }, 600)
    return
  }
  emit('enterMultiplayer', selectedGame.value)
}

// Get user's initial for avatar fallback
const userInitial = computed(() => {
  return lobbyStore.nickname?.[0]?.toUpperCase() || '?'
})

function handleSinglePlayer() {
  emit('startSinglePlayer', selectedGame.value)
}

const gameTitle = computed(() => {
  switch (selectedGame.value) {
    case 'euchre': return 'Euchre'
    case 'president': return 'President'
    case 'klondike': return 'Klondike'
    case 'spades': return 'Spades'
    default: return 'Euchre'
  }
})
</script>

<template>
  <div class="main-menu" :class="{ 'wobble-67': isWobbling }">
    <button class="settings-btn" @click="showSettings = true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    </button>

    <SettingsModal :show="showSettings" @close="showSettings = false" />
    <ProfileModal :show="showProfile" @close="showProfile = false" />

    <div class="logo-section">
      <img src="@/assets/AppLogo.png" alt="Euchre Logo" class="logo" />
      <span class="stamp-text">67CardGames.com</span>
    </div>

    <div class="content-section">
      <h1>{{ gameTitle }}</h1>

      <div class="game-carousel-wrapper">
        <div v-if="canScrollLeft" class="carousel-fade left"></div>
        <button v-if="canScrollLeft" class="carousel-arrow left" @click="scrollCarousel('left')">
          ‹
        </button>
        
        <div ref="carouselRef" class="game-carousel">
          <button
            :class="['game-card', { active: selectedGame === 'euchre' }]"
            @click="selectedGame = 'euchre'"
          >
            <span class="game-name">Euchre</span>
            <span class="game-desc">Trick-taking</span>
          </button>
          <button
            :class="['game-card', { active: selectedGame === 'spades' }]"
            @click="selectedGame = 'spades'"
          >
            <span class="game-name">Spades</span>
            <span class="game-desc">Bid & tricks</span>
          </button>
          <button
            :class="['game-card', { active: selectedGame === 'president' }]"
            @click="selectedGame = 'president'"
          >
            <span class="game-name">President</span>
            <span class="game-desc">Shedding</span>
          </button>
          <button
            :class="['game-card', { active: selectedGame === 'klondike' }]"
            @click="selectedGame = 'klondike'"
          >
            <span class="game-name">Klondike</span>
            <span class="game-desc">Solitaire</span>
          </button>
        </div>
        
        <div v-if="canScrollRight" class="carousel-fade right"></div>
        <button v-if="canScrollRight" class="carousel-arrow right" @click="scrollCarousel('right')">
          ›
        </button>
      </div>

      <div class="menu-options">
        <button class="menu-btn single-player" @click="handleSinglePlayer">
          Single Player
          <span v-if="selectedGame === 'klondike'" class="btn-subtitle">Classic solitaire</span>
          <span v-else class="btn-subtitle">Play against AI</span>
        </button>

        <button
          class="menu-btn multiplayer"
          :disabled="selectedGame === 'klondike'"
          @click="handleMultiplayer"
        >
          Multiplayer
          <span v-if="selectedGame === 'klondike'" class="btn-subtitle">Solitaire is solo!</span>
          <span v-else class="btn-subtitle">Play with friends online</span>
        </button>
      </div>

      <div :class="['profile-section', { highlight: highlightNickname }]">
        <template v-if="!lobbyStore.hasNickname">
          <button class="profile-btn setup" @click="showProfile = true">
            <div class="profile-avatar no-avatar">
              <span>?</span>
            </div>
            <span class="profile-text">Set up your profile</span>
          </button>
        </template>
        <template v-else>
          <button class="profile-btn" @click="showProfile = true">
            <div class="profile-avatar" :class="{ 'no-avatar': !lobbyStore.avatarUrl }">
              <img v-if="lobbyStore.avatarUrl" :src="lobbyStore.avatarUrl" :alt="lobbyStore.nickname" />
              <span v-else>{{ userInitial }}</span>
            </div>
            <div class="profile-info">
              <span class="profile-name">{{ lobbyStore.nickname }}</span>
              <span class="profile-hint">Tap to edit</span>
            </div>
          </button>
        </template>
      </div>

      <!-- Install hints -->
      <div v-if="showIOSInstallHint" class="install-hint">
        <span>For fullscreen: tap <strong>Share</strong> → <strong>Add to Home Screen</strong></span>
        <button class="dismiss-btn" @click="dismissInstallHint">×</button>
      </div>
      <div v-if="showIOSSafariWarning" class="install-hint warning">
        <span>Open in <strong>Safari</strong> to install as an app</span>
        <button class="dismiss-btn" @click="dismissInstallHint">×</button>
      </div>
      <!-- Android/Desktop install prompt handled by App.vue -->
    </div>
  </div>
</template>

<style scoped lang="scss">
// 67 wobble Easter egg - seesaw effect like weighing options
@keyframes wobble-67 {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-1.5deg); }
  75% { transform: rotate(1.5deg); }
}

.wobble-67 {
  animation: wobble-67 0.5s ease-in-out 2;
  transform-origin: center center;
}

.settings-btn {
  position: absolute;
  top: $spacing-md;
  right: $spacing-md;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 50%;
  color: white;
  z-index: 10;

  svg {
    width: 24px;
    height: 24px;
  }

  &:hover {
    background: rgba(255, 255, 255, 0.25);
  }

  &:active {
    transform: scale(0.95);
  }
}

.main-menu {
  width: 100%;
  height: 100%;
  max-width: 900px;
  margin: 0 auto;
  display: flex;
  flex-direction: row;
  // Background handled by #app for full-screen coverage
  color: white;

  // Portrait mode - stack vertically
  @media (orientation: portrait) {
    flex-direction: column;
    overflow-y: auto;
  }
}

.logo-section {
  flex: 0 0 40%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: $spacing-xl;
  background: 
    // Subtle warm glow top-left
    radial-gradient(circle at 20% 20%, rgba(255, 220, 150, 0.08) 0%, transparent 40%),
    // Cool accent bottom-right
    radial-gradient(circle at 80% 90%, rgba(100, 180, 255, 0.06) 0%, transparent 35%),
    // Green gradient base
    linear-gradient(160deg, rgba($brand-green, 0.5) 0%, rgba($brand-green-dark, 0.3) 100%);
  gap: $spacing-lg;

  @media (max-height: 500px) {
    padding: $spacing-md;
    gap: $spacing-sm;
  }

  // Portrait mode - smaller logo section at top
  @media (orientation: portrait) {
    flex: 0 0 auto;
    padding: $spacing-lg $spacing-md;
    gap: $spacing-sm;
  }

  .logo {
    width: 80%;
    max-height: 70%;
    object-fit: contain;
    object-position: center;
    filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.3));

    // Portrait mode - limit logo size
    @media (orientation: portrait) {
      width: 50%;
      max-width: 200px;
      max-height: 150px;
    }
  }

  .stamp-text {
    font-family: 'Courier Prime', monospace;
    font-size: 1.1rem;
    font-weight: bold;
    color: rgba(255, 255, 255, 0.9);
    letter-spacing: 1px;
    padding: $spacing-xs $spacing-sm;
    border: 2px solid rgba(255, 255, 255, 0.8);
    border-radius: 3px;
    transform: rotate(-3deg);
    text-shadow: 1px 1px 0 rgba(0, 0, 0, 0.3);
    box-shadow:
      inset 0 0 0 1px rgba(255, 255, 255, 0.3),
      2px 2px 4px rgba(0, 0, 0, 0.2);
    margin-top: calc(-#{$spacing-xl} - 15px);

    @media (max-height: 500px) {
      font-size: 0.85rem;
      padding: 2px $spacing-xs;
      margin-top: calc(-#{$spacing-md} - 10px);
    }

    // Portrait mode - smaller stamp
    @media (orientation: portrait) {
      font-size: 0.9rem;
      margin-top: calc(-#{$spacing-md} - 8px);
    }
  }
}

.content-section {
  flex: 0 0 60%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: $spacing-lg;
  background:
    // Soft spotlight on content area
    radial-gradient(ellipse 80% 60% at 50% 30%, rgba(255, 255, 255, 0.03) 0%, transparent 60%),
    // Subtle bokeh accent top-right
    radial-gradient(circle at 85% 10%, rgba(150, 200, 255, 0.07) 0%, transparent 20%),
    // Warm accent bottom
    radial-gradient(circle at 30% 95%, rgba(255, 180, 100, 0.05) 0%, transparent 25%);

  @media (max-height: 500px) {
    padding: $spacing-sm;
  }

  // Portrait mode - flex grow to fill remaining space
  @media (orientation: portrait) {
    flex: 1;
    justify-content: flex-start;
    padding: $spacing-md;
    padding-bottom: $spacing-xl;
  }

  h1 {
    font-family: 'Rock Salt', cursive;
    font-size: 4rem;
    font-weight: 400;
    margin-bottom: $spacing-lg;
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);

    @media (max-height: 500px) {
      font-size: 2rem;
      margin-bottom: $spacing-sm;
    }

    // Portrait mode - smaller title
    @media (orientation: portrait) {
      font-size: 2.5rem;
      margin-bottom: $spacing-md;
    }
  }
}

.game-carousel-wrapper {
  position: relative;
  margin-bottom: $spacing-lg;
  max-width: 100%;
  overflow: visible; // Allow cards to be fully visible

  @media (max-height: 500px) {
    margin-bottom: $spacing-sm;
  }

  @media (orientation: portrait) {
    margin-bottom: $spacing-md;
    // Extend to edges for full-width scroll
    width: calc(100% + #{$spacing-md} * 2);
    margin-left: -$spacing-md;
  }
}

.carousel-fade {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 40px;
  pointer-events: none;
  z-index: 2;

  &.left {
    left: 0;
    background: linear-gradient(to right, rgba($surface-900, 0.95), transparent);
  }

  &.right {
    right: 0;
    background: linear-gradient(to left, rgba($surface-900, 0.95), transparent);
  }
}

.carousel-arrow {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 32px;
  height: 32px;
  background: rgba(255, 255, 255, 0.2);
  border: none;
  border-radius: 50%;
  color: white;
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.35);
  }

  &.left {
    left: 4px;
  }

  &.right {
    right: 4px;
  }
}

.game-carousel {
  display: flex;
  gap: $spacing-md;
  padding: $spacing-sm $spacing-md;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  
  &::-webkit-scrollbar {
    display: none;
  }

  @media (max-height: 500px) {
    gap: $spacing-sm;
  }
}

.game-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: $spacing-md $spacing-lg;
  min-width: 100px;
  background: rgba(255, 255, 255, 0.1);
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  color: white;
  cursor: pointer;
  scroll-snap-align: center;
  transition: all 0.2s ease;
  flex-shrink: 0;

  &:hover {
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.3);
  }

  &.active {
    background: $text-primary;
    border-color: $text-primary;
    color: $brand-green;
    transform: scale(1.05);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  }

  .game-name {
    font-size: 1rem;
    font-weight: bold;
    white-space: nowrap;
  }

  .game-desc {
    font-size: 0.7rem;
    opacity: 0.7;
    white-space: nowrap;
  }

  @media (max-height: 500px) {
    padding: $spacing-sm $spacing-md;
    min-width: 80px;

    .game-name {
      font-size: 0.85rem;
    }
  }
}

.menu-options {
  display: flex;
  flex-direction: column;
  gap: $spacing-lg;
  margin-bottom: $spacing-lg;

  @media (max-height: 500px) {
    flex-direction: row;
    margin-bottom: $spacing-md;
  }

  @media (orientation: portrait) {
    gap: $spacing-md;
    margin-bottom: $spacing-md;
    width: 100%;
    max-width: 320px;
  }
}

.menu-btn {
  padding: $spacing-lg $spacing-xl * 2;
  font-size: 1.5rem;
  font-weight: bold;
  background: $text-primary;
  color: $brand-green;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 280px;

  @media (max-height: 500px) {
    padding: $spacing-md $spacing-xl;
    font-size: 1.25rem;
    min-width: 200px;
  }

  @media (orientation: portrait) {
    padding: $spacing-md $spacing-lg;
    font-size: 1.25rem;
    min-width: unset;
    width: 100%;
  }

  &:active:not(:disabled) {
    transform: scale(0.95);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-subtitle {
    font-size: 0.875rem;
    font-weight: normal;
    opacity: 0.7;
    margin-top: $spacing-xs;
  }
}

.profile-section {
  border: 2px solid transparent;
  border-radius: 16px;
  transition: border-color var(--anim-fast) ease, box-shadow var(--anim-fast) ease;

  &.highlight {
    border-color: #f4d03f;
    box-shadow: 0 0 12px rgba(244, 208, 63, 0.6);
    animation: pulse-highlight var(--anim-medium) ease-in-out 2;
  }
}

@keyframes pulse-highlight {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.02);
  }
}

.profile-btn {
  display: flex;
  align-items: center;
  gap: $spacing-md;
  padding: $spacing-md $spacing-lg;
  background: rgba(0, 0, 0, 0.25);
  border-radius: 16px;
  cursor: pointer;
  transition: background 0.15s ease;
  min-width: 200px;
  
  &:hover {
    background: rgba(0, 0, 0, 0.35);
  }
  
  &.setup {
    .profile-text {
      font-size: 0.9rem;
      color: rgba(255, 255, 255, 0.9);
    }
  }
}

.profile-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  border: 2px solid rgba(255, 255, 255, 0.3);
  
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  
  &.no-avatar {
    background: linear-gradient(145deg, #4a4a5c, #3a3a4c);
    display: flex;
    align-items: center;
    justify-content: center;
    
    span {
      font-size: 1.25rem;
      font-weight: bold;
      color: #ddd;
    }
  }
}

.profile-info {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
}

.profile-name {
  font-weight: bold;
  font-size: 1.1rem;
  color: white;
}

.profile-hint {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.6);
}

.install-hint {
  margin-top: $spacing-xl;
  padding: $spacing-md $spacing-lg;
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 12px;
  font-size: 1rem;
  display: flex;
  align-items: center;
  gap: $spacing-md;
  max-width: 400px;

  @media (max-height: 500px) {
    margin-top: $spacing-md;
    padding: $spacing-sm $spacing-md;
    font-size: 0.875rem;
  }

  @media (orientation: portrait) {
    max-width: 320px;
  }

  &.warning {
    background: rgba(231, 76, 60, 0.25);
    border-color: rgba(231, 76, 60, 0.4);
  }

  strong {
    font-weight: bold;
  }

  .install-btn {
    flex-shrink: 0;
    margin-left: auto;
    padding: $spacing-sm $spacing-md;
    font-size: 1rem;
    font-weight: bold;
    background: $secondary-color;
    color: white;
    border-radius: 8px;
  }

  .dismiss-btn {
    flex-shrink: 0;
    padding: $spacing-xs $spacing-sm;
    font-size: 1.25rem;
    line-height: 1;
    background: rgba(255, 255, 255, 0.2);
    color: white;
    border-radius: 6px;
  }
}
</style>
