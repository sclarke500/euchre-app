<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useLobbyStore } from '@/stores/lobbyStore'
import { getPlatformInfo } from '@/utils/platform'
import SettingsModal from './SettingsModal.vue'
import ProfileModal from './ProfileModal.vue'
import AppLogo from './AppLogo.vue'

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

function playGame(game: GameType) {
  emit('startSinglePlayer', game)
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
  <div class="menu-wrapper">
    <div class="main-menu">
      <button class="settings-btn" @click="showSettings = true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    </button>

    <SettingsModal :show="showSettings" @close="showSettings = false" />
    <ProfileModal :show="showProfile" @close="showProfile = false" />

    <div class="logo-section">
      <AppLogo size="md" />
      
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
    </div>

    <div class="content-section">
      <h2 class="section-title">Pick a Game</h2>

      <div class="game-grid">
        <button class="game-card" @click="playGame('euchre')">
          <span class="game-name">Euchre</span>
          <span class="game-desc">Classic Midwest trick-taking</span>
        </button>
        <button class="game-card" @click="playGame('spades')">
          <span class="game-name">Spades</span>
          <span class="game-desc">Bid your tricks wisely</span>
        </button>
        <button class="game-card" @click="playGame('president')">
          <span class="game-name">President</span>
          <span class="game-desc">Race to shed your cards</span>
        </button>
        <button class="game-card" @click="playGame('klondike')">
          <span class="game-name">Klondike</span>
          <span class="game-desc">Classic solitaire</span>
        </button>
      </div>

      <button class="multiplayer-btn" @click="handleMultiplayer">
        <span class="mp-icon">👥</span>
        <span class="mp-text">Play with Friends</span>
      </button>

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

// Full-viewport wrapper with background
.menu-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative; // For settings overlay positioning
  
  // Background: image on left portion, fading to dark
  background: 
    // Dark overlay on left for logo readability
    linear-gradient(to right,
      rgba(0, 0, 0, 0.4) 0%,
      rgba(0, 0, 0, 0.3) 20%,
      transparent 40%
    ),
    // Gradient fade to dark
    linear-gradient(to right, 
      transparent 25%,
      rgba(20, 25, 35, 0.4) 35%,
      rgba(20, 25, 35, 0.75) 42%,
      rgba(20, 25, 35, 1) 50%
    ),
    // Robot image - covers left portion, fills height
    url('@/assets/menu-background.jpg');
  background-size: cover, cover, auto 100%;
  background-position: center, center, left center;
  background-repeat: no-repeat;
  background-color: rgb(20, 25, 35);

  // Portrait mode (phones only) - stacked layout
  @media (orientation: portrait) and (max-width: 600px) {
    align-items: flex-start;
    background: 
      linear-gradient(to bottom, 
        transparent 20%,
        rgba(20, 25, 35, 0.8) 35%,
        rgba(20, 25, 35, 1) 45%
      ),
      url('@/assets/menu-background.jpg');
    background-size: 100% 100%, 100% 40%;
    background-position: center, center top;
    background-repeat: no-repeat;
  }
}

.main-menu {
  width: 100%;
  height: 100%;
  max-width: 900px;
  display: flex;
  flex-direction: row;
  color: white;

  // Portrait mode (phones only) - stacked layout
  @media (orientation: portrait) and (max-width: 600px) {
    flex-direction: column;
    overflow-y: auto;
  }
}

.logo-section {
  flex: 0 0 40%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  padding: $spacing-xl;
  padding-left: $spacing-xl * 1.5;
  // Transparent - let main-menu background show through
  gap: $spacing-lg;

  // Push profile to bottom
  .profile-section {
    margin-top: auto;
    margin-bottom: $spacing-lg;
    align-self: flex-start;
  }

  @media (max-height: 500px) {
    padding: $spacing-md;
    padding-left: $spacing-lg;
    gap: $spacing-sm;
    
    .profile-section {
      margin-bottom: $spacing-sm;
    }
  }

  // Portrait mode (phones only) - logo top-left, profile centered at bottom
  @media (orientation: portrait) and (max-width: 600px) {
    flex: 0 0 auto;
    flex-direction: column;
    align-items: flex-start;
    justify-content: flex-start;
    padding: $spacing-md;
    padding-bottom: $spacing-lg;
    gap: $spacing-md;
    min-height: 220px;
    
    // Mid-size logo in portrait
    :deep(.app-logo) {
      .logo-img {
        width: 130px;
      }
      .logo-url {
        font-size: 0.8rem;
        letter-spacing: 1px;
        margin-top: -5px;
      }
    }
    
    .profile-section {
      margin-top: auto;
      margin-bottom: 0;
      align-self: center;
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

  // Portrait mode (phones only) - flex grow to fill remaining space
  @media (orientation: portrait) and (max-width: 600px) {
    flex: 1;
    justify-content: flex-start;
    padding: $spacing-md;
    padding-bottom: $spacing-xl;
  }

  .section-title {
    font-family: 'Rock Salt', cursive;
    font-size: 1.5rem;
    font-weight: 400;
    margin-bottom: $spacing-lg;
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
    opacity: 0.9;

    @media (max-height: 500px) {
      font-size: 1.1rem;
      margin-bottom: $spacing-sm;
    }

    @media (orientation: portrait) and (max-width: 600px) {
      font-size: 1.25rem;
      margin-bottom: $spacing-md;
    }
  }
}

.game-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: $spacing-md;
  margin-bottom: $spacing-xl;
  width: 100%;
  max-width: 400px;

  @media (max-height: 500px) {
    gap: $spacing-sm;
    margin-bottom: $spacing-md;
    max-width: 350px;
  }

  @media (orientation: portrait) and (max-width: 600px) {
    max-width: 320px;
  }
}

.game-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: $spacing-lg $spacing-md;
  background: rgba(255, 255, 255, 0.1);
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 16px;
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.2);
    border-color: rgba(255, 255, 255, 0.4);
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
  }

  &:active {
    transform: scale(0.98);
  }

  .game-name {
    font-size: 1.2rem;
    font-weight: bold;
    margin-bottom: 4px;
  }

  .game-desc {
    font-size: 0.75rem;
    opacity: 0.7;
    text-align: center;
  }

  @media (max-height: 500px) {
    padding: $spacing-md $spacing-sm;

    .game-name {
      font-size: 0.85rem;
    }
  }
}

.multiplayer-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: $spacing-md;
  padding: $spacing-md $spacing-xl;
  background: transparent;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 30px;
  color: white;
  font-size: 1.1rem;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.5);
    box-shadow: 0 0 20px rgba(212, 175, 55, 0.3);
  }

  &:active {
    transform: scale(0.98);
  }

  .mp-icon {
    font-size: 1.3rem;
  }

  .mp-text {
    font-weight: 500;
  }

  @media (max-height: 500px) {
    padding: $spacing-sm $spacing-lg;
    font-size: 1rem;
  }

  @media (orientation: portrait) and (max-width: 600px) {
    padding: $spacing-sm $spacing-lg;
    font-size: 1rem;
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
  padding: 8px 16px 8px 8px;
  background: var(--panel-bg);
  backdrop-filter: blur(16px);
  border: 1px solid var(--panel-border);
  border-radius: 30px;
  cursor: pointer;
  transition: background 0.15s ease, box-shadow 0.15s ease;
  box-shadow: 
    0 4px 16px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.15);
  
  &:hover {
    background: rgba(255, 255, 255, 0.18);
    box-shadow: 
      0 4px 20px rgba(0, 0, 0, 0.4),
      0 0 12px rgba(212, 175, 55, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
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

  @media (orientation: portrait) and (max-width: 600px) {
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
