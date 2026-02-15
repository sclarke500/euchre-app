<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useLobbyStore } from '@/stores/lobbyStore'
import { getPlatformInfo } from '@/utils/platform'
import SettingsModal from './SettingsModal.vue'

export type GameType = 'euchre' | 'president' | 'klondike' | 'spades'

const showSettings = ref(false)

// Platform detection
const showIOSInstallHint = ref(false)
const showIOSSafariWarning = ref(false)
const showAndroidInstall = ref(false)
let deferredPrompt: BeforeInstallPromptEvent | null = null

// Type for the install prompt event
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function handleBeforeInstallPrompt(e: Event) {
  // Prevent the mini-infobar from appearing on mobile
  e.preventDefault()
  // Save the event so it can be triggered later
  deferredPrompt = e as BeforeInstallPromptEvent
  showAndroidInstall.value = true
}

async function installPWA() {
  if (!deferredPrompt) return

  // Show the install prompt
  deferredPrompt.prompt()

  // Wait for the user to respond
  await deferredPrompt.userChoice

  // Clear the deferred prompt
  deferredPrompt = null
  showAndroidInstall.value = false
}

// 67 wobble animation on load
const isWobbling = ref(true)

onMounted(() => {
  // Stop wobble after animation completes
  setTimeout(() => {
    isWobbling.value = false
  }, 2000) // 4 cycles × 0.5s = 2s

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
  } else {
    // Android/Desktop - listen for install prompt
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
  }
})

onUnmounted(() => {
  window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
})

function dismissInstallHint() {
  showIOSInstallHint.value = false
  showIOSSafariWarning.value = false
  showAndroidInstall.value = false
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

const nicknameInput = ref(lobbyStore.nickname)
const isEditingNickname = ref(!lobbyStore.hasNickname)
const nicknameInputRef = ref<HTMLInputElement | null>(null)
const highlightNickname = ref(false)

const canEnterMultiplayer = computed(() => {
  return nicknameInput.value.trim().length >= 2
})

function saveNickname() {
  if (canEnterMultiplayer.value) {
    lobbyStore.setNickname(nicknameInput.value)
    isEditingNickname.value = false
  }
}

function editNickname() {
  isEditingNickname.value = true
}

function handleMultiplayer() {
  if (!canEnterMultiplayer.value) {
    isEditingNickname.value = true
    highlightNickname.value = true
    nextTick(() => {
      nicknameInputRef.value?.focus()
    })
    setTimeout(() => {
      highlightNickname.value = false
    }, 600)
    return
  }
  saveNickname()
  emit('enterMultiplayer', selectedGame.value)
}

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

    <div class="logo-section">
      <img src="@/assets/AppLogo.png" alt="Euchre Logo" class="logo" />
      <span class="stamp-text">67CardGames.com</span>
    </div>

    <div class="content-section">
      <h1>{{ gameTitle }}</h1>

      <div class="game-carousel">
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

      <div class="menu-options">
        <button class="menu-btn single-player" @click="handleSinglePlayer">
          Single Player
          <span v-if="selectedGame === 'klondike'" class="btn-subtitle">Classic solitaire</span>
          <span v-else class="btn-subtitle">Play against 3 <span class="clanker">clankers</span></span>
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

      <div :class="['nickname-section', { highlight: highlightNickname }]">
        <template v-if="isEditingNickname">
          <label for="nickname">Your Nickname</label>
          <div class="nickname-input-row">
            <input
              id="nickname"
              ref="nicknameInputRef"
              v-model="nicknameInput"
              type="text"
              placeholder="Enter nickname..."
              maxlength="20"
              @keyup.enter="saveNickname"
            />
            <button
              class="save-btn"
              :disabled="!canEnterMultiplayer"
              @click="saveNickname"
            >
              Save
            </button>
          </div>
          <p class="nickname-hint">Required for multiplayer (min 2 characters)</p>
        </template>
        <template v-else>
          <div class="nickname-display">
            <span class="nickname-label">Playing as:</span>
            <span class="nickname-value">{{ lobbyStore.nickname }}</span>
            <button class="edit-btn" @click="editNickname">Edit</button>
          </div>
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
      <div v-if="showAndroidInstall" class="install-hint">
        <span>Install app for fullscreen</span>
        <button class="install-btn" @click="installPWA">Install</button>
        <button class="dismiss-btn" @click="dismissInstallHint">×</button>
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

.main-menu {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: row;
  background: linear-gradient(135deg, #1e4d2b 0%, #0d2818 100%);
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
  background: rgba(0, 0, 0, 0.1);
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
    margin-bottom: $spacing-xl * 2;
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);

    @media (max-height: 500px) {
      font-size: 2rem;
      margin-bottom: $spacing-md;
    }

    // Portrait mode - smaller title
    @media (orientation: portrait) {
      font-size: 2.5rem;
      margin-bottom: $spacing-lg;
    }
  }
}

.game-carousel {
  display: flex;
  gap: $spacing-md;
  margin-bottom: $spacing-xl;
  padding: $spacing-sm 0;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  
  &::-webkit-scrollbar {
    display: none;
  }

  @media (max-height: 500px) {
    margin-bottom: $spacing-md;
    gap: $spacing-sm;
  }

  @media (orientation: portrait) {
    margin-bottom: $spacing-lg;
    // Allow full-width scrolling on mobile
    width: calc(100% + #{$spacing-md} * 2);
    margin-left: -$spacing-md;
    padding-left: $spacing-md;
    padding-right: $spacing-md;
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
  cursor: pointer;
  scroll-snap-align: center;
  transition: all 0.2s ease;
  flex-shrink: 0;

  &:hover {
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.3);
  }

  &.active {
    background: white;
    border-color: white;
    color: #1e4d2b;
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
  margin-bottom: $spacing-xl * 2;

  @media (max-height: 500px) {
    flex-direction: row;
    margin-bottom: $spacing-lg;
  }

  @media (orientation: portrait) {
    gap: $spacing-md;
    margin-bottom: $spacing-lg;
    width: 100%;
    max-width: 320px;
  }
}

.menu-btn {
  padding: $spacing-lg $spacing-xl * 2;
  font-size: 1.5rem;
  font-weight: bold;
  background: white;
  color: #1e4d2b;
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

    .clanker {
      font-family: 'Audiowide', cursive;
      font-weight: 400;
      letter-spacing: 0.05em;
    }
  }
}

.nickname-section {
  background: rgba(0, 0, 0, 0.2);
  padding: $spacing-lg;
  border-radius: 12px;
  min-width: 320px;
  border: 2px solid transparent;
  transition: border-color var(--anim-fast) ease, box-shadow var(--anim-fast) ease;

  @media (max-height: 500px) {
    padding: $spacing-md;
    min-width: 280px;
  }

  @media (orientation: portrait) {
    min-width: unset;
    width: 100%;
    max-width: 320px;
  }

  &.highlight {
    border-color: #f4d03f;
    box-shadow: 0 0 12px rgba(244, 208, 63, 0.6);
    animation: pulse-highlight var(--anim-medium) ease-in-out 2;
  }

  label {
    display: block;
    font-size: 0.875rem;
    margin-bottom: $spacing-sm;
    opacity: 0.9;
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

.nickname-input-row {
  display: flex;
  gap: $spacing-sm;

  input {
    flex: 1;
    padding: $spacing-sm $spacing-md;
    font-size: 1rem;
    border: 2px solid transparent;
    border-radius: 8px;
    background: white;
    color: #333;

    &:focus {
      outline: none;
      border-color: $secondary-color;
    }
  }

  .save-btn {
    padding: $spacing-sm $spacing-md;
    background: $secondary-color;
    color: white;
    font-weight: bold;
    border-radius: 8px;

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }
}

.nickname-hint {
  font-size: 0.75rem;
  opacity: 0.7;
  margin-top: $spacing-sm;
}

.nickname-display {
  display: flex;
  align-items: center;
  gap: $spacing-sm;

  .nickname-label {
    font-size: 0.875rem;
    opacity: 0.8;
  }

  .nickname-value {
    font-weight: bold;
    font-size: 1.125rem;
  }

  .edit-btn {
    margin-left: auto;
    padding: $spacing-xs $spacing-sm;
    font-size: 0.75rem;
    background: rgba(255, 255, 255, 0.25);
    color: white;
    border-radius: 4px;
  }
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
