<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useLobbyStore } from '@/stores/lobbyStore'
import { getPlatformInfo } from '@/utils/platform'
import SettingsModal from './SettingsModal.vue'

export type GameType = 'euchre' | 'president' | 'klondike' | 'spades'

const emit = defineEmits<{
  startSinglePlayer: [game: GameType]
  enterMultiplayer: [game: GameType]
}>()

// View state: null = game grid, GameType = game detail
const selectedGame = ref<GameType | null>(null)

const showSettings = ref(false)

// Platform detection for PWA install hints
const showIOSInstallHint = ref(false)
const showIOSSafariWarning = ref(false)
const showAndroidInstall = ref(false)
let deferredPrompt: BeforeInstallPromptEvent | null = null

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function handleBeforeInstallPrompt(e: Event) {
  e.preventDefault()
  deferredPrompt = e as BeforeInstallPromptEvent
  showAndroidInstall.value = true
}

async function installPWA() {
  if (!deferredPrompt) return
  deferredPrompt.prompt()
  await deferredPrompt.userChoice
  deferredPrompt = null
  showAndroidInstall.value = false
}

// Wobble animation on load
const isWobbling = ref(true)

onMounted(() => {
  setTimeout(() => {
    isWobbling.value = false
  }, 2000)

  const platform = getPlatformInfo()
  if (platform.isStandalone) return

  if (platform.isIOS) {
    if (platform.isSafari) {
      showIOSInstallHint.value = true
    } else {
      showIOSSafariWarning.value = true
    }
  } else {
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

// Lobby store for nickname
const lobbyStore = useLobbyStore()

// Game metadata
const games = [
  { 
    id: 'euchre' as GameType, 
    name: 'Euchre', 
    description: 'Classic trick-taking',
    players: '4 players',
    hasMultiplayer: true,
    icon: '🃏'
  },
  { 
    id: 'spades' as GameType, 
    name: 'Spades', 
    description: 'Bid and take tricks',
    players: '4 players',
    hasMultiplayer: true,
    icon: '♠️'
  },
  { 
    id: 'president' as GameType, 
    name: 'President', 
    description: 'Shed your cards first',
    players: '4-6 players',
    hasMultiplayer: true,
    icon: '👑'
  },
  { 
    id: 'klondike' as GameType, 
    name: 'Klondike', 
    description: 'Classic solitaire',
    players: 'Solo',
    hasMultiplayer: false,
    icon: '🎴'
  },
]

const currentGame = computed(() => games.find(g => g.id === selectedGame.value))

function selectGame(game: GameType) {
  selectedGame.value = game
}

function goBack() {
  selectedGame.value = null
}

function handleSinglePlayer() {
  if (!selectedGame.value) return
  emit('startSinglePlayer', selectedGame.value)
}

function handleMultiplayer() {
  if (!selectedGame.value || !currentGame.value?.hasMultiplayer) return
  
  // Check nickname
  if (!lobbyStore.hasNickname || lobbyStore.nickname.trim().length < 2) {
    // Show nickname prompt
    showNicknamePrompt.value = true
    return
  }
  
  emit('enterMultiplayer', selectedGame.value)
}

// Nickname prompt
const showNicknamePrompt = ref(false)
const nicknameInput = ref(lobbyStore.nickname)

function saveNicknameAndPlay() {
  if (nicknameInput.value.trim().length < 2) return
  lobbyStore.setNickname(nicknameInput.value)
  showNicknamePrompt.value = false
  emit('enterMultiplayer', selectedGame.value!)
}

function cancelNicknamePrompt() {
  showNicknamePrompt.value = false
}
</script>

<template>
  <div class="main-menu" :class="{ 'wobble-67': isWobbling }">
    <!-- Settings button -->
    <button class="settings-btn" @click="showSettings = true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    </button>

    <SettingsModal :show="showSettings" @close="showSettings = false" />

    <!-- Game Grid View -->
    <template v-if="!selectedGame">
      <div class="home-view">
        <div class="logo-section">
          <img src="@/assets/AppLogo.png" alt="67 Card Games" class="logo" />
          <span class="stamp-text">67CardGames.com</span>
        </div>

        <div class="games-grid">
          <button
            v-for="game in games"
            :key="game.id"
            class="game-card"
            @click="selectGame(game.id)"
          >
            <span class="game-icon">{{ game.icon }}</span>
            <span class="game-name">{{ game.name }}</span>
            <span class="game-desc">{{ game.description }}</span>
            <span class="game-players">{{ game.players }}</span>
          </button>
        </div>

        <!-- Install hints -->
        <div v-if="showIOSInstallHint" class="install-hint">
          <span>Tap <strong>Share</strong> → <strong>Add to Home Screen</strong></span>
          <button class="dismiss-btn" @click="dismissInstallHint">×</button>
        </div>
        <div v-if="showIOSSafariWarning" class="install-hint warning">
          <span>Open in <strong>Safari</strong> to install</span>
          <button class="dismiss-btn" @click="dismissInstallHint">×</button>
        </div>
        <div v-if="showAndroidInstall" class="install-hint">
          <span>Install for fullscreen</span>
          <button class="install-btn" @click="installPWA">Install</button>
          <button class="dismiss-btn" @click="dismissInstallHint">×</button>
        </div>
      </div>
    </template>

    <!-- Game Detail View -->
    <template v-else>
      <div class="game-view">
        <button class="back-btn" @click="goBack">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        <div class="game-header">
          <span class="game-icon-large">{{ currentGame?.icon }}</span>
          <h1>{{ currentGame?.name }}</h1>
          <p class="game-subtitle">{{ currentGame?.description }}</p>
        </div>

        <div class="play-options">
          <button class="play-btn solo" @click="handleSinglePlayer">
            <span class="btn-icon">🎮</span>
            <span class="btn-text">
              <strong>Play Solo</strong>
              <span v-if="currentGame?.id === 'klondike'">Classic solitaire</span>
              <span v-else>vs AI opponents</span>
            </span>
          </button>

          <button 
            class="play-btn online" 
            :disabled="!currentGame?.hasMultiplayer"
            @click="handleMultiplayer"
          >
            <span class="btn-icon">🌐</span>
            <span class="btn-text">
              <strong>Play Online</strong>
              <span v-if="!currentGame?.hasMultiplayer">Not available</span>
              <span v-else>With friends</span>
            </span>
          </button>
        </div>

        <!-- Nickname display -->
        <div v-if="currentGame?.hasMultiplayer && lobbyStore.hasNickname" class="nickname-badge">
          Playing as: <strong>{{ lobbyStore.nickname }}</strong>
        </div>
      </div>
    </template>

    <!-- Nickname Prompt Modal -->
    <Teleport to="body">
      <div v-if="showNicknamePrompt" class="modal-overlay" @click.self="cancelNicknamePrompt">
        <div class="nickname-modal">
          <h2>Enter Your Nickname</h2>
          <p>Required for multiplayer games</p>
          <input
            v-model="nicknameInput"
            type="text"
            placeholder="Your nickname..."
            maxlength="20"
            @keyup.enter="saveNicknameAndPlay"
          />
          <div class="modal-actions">
            <button class="cancel-btn" @click="cancelNicknamePrompt">Cancel</button>
            <button 
              class="confirm-btn" 
              :disabled="nicknameInput.trim().length < 2"
              @click="saveNicknameAndPlay"
            >
              Play Online
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped lang="scss">
@keyframes wobble-67 {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-1.5deg); }
  75% { transform: rotate(1.5deg); }
}

.wobble-67 {
  animation: wobble-67 0.5s ease-in-out 2;
  transform-origin: center center;
}

.main-menu {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #1e4d2b 0%, #0d2818 100%);
  color: white;
  overflow-y: auto;
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
}

// ==================
// Home View (Game Grid)
// ==================

.home-view {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: $spacing-xl;
  padding-top: $spacing-xl * 2;
  gap: $spacing-xl;

  @media (orientation: portrait) {
    padding: $spacing-lg;
    padding-top: $spacing-xl;
  }
}

.logo-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $spacing-md;

  .logo {
    width: 120px;
    height: auto;
    filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.3));

    @media (orientation: portrait) {
      width: 100px;
    }
  }

  .stamp-text {
    font-family: 'Courier Prime', monospace;
    font-size: 1rem;
    font-weight: bold;
    color: rgba(255, 255, 255, 0.9);
    letter-spacing: 1px;
    padding: $spacing-xs $spacing-sm;
    border: 2px solid rgba(255, 255, 255, 0.8);
    border-radius: 3px;
    transform: rotate(-3deg);
    text-shadow: 1px 1px 0 rgba(0, 0, 0, 0.3);
  }
}

.games-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: $spacing-lg;
  max-width: 500px;
  width: 100%;

  @media (max-width: 400px) {
    gap: $spacing-md;
  }
}

.game-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: $spacing-lg;
  background: rgba(255, 255, 255, 0.1);
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.4);
    transform: translateY(-2px);
  }

  &:active {
    transform: scale(0.98);
  }

  .game-icon {
    font-size: 2.5rem;
    margin-bottom: $spacing-sm;
  }

  .game-name {
    font-size: 1.25rem;
    font-weight: bold;
    margin-bottom: $spacing-xs;
  }

  .game-desc {
    font-size: 0.8rem;
    opacity: 0.7;
    text-align: center;
  }

  .game-players {
    font-size: 0.75rem;
    opacity: 0.5;
    margin-top: $spacing-xs;
  }
}

// ==================
// Game Detail View
// ==================

.game-view {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: $spacing-xl;
  padding-top: $spacing-xl * 2;
  gap: $spacing-xl;

  @media (orientation: portrait) {
    padding: $spacing-lg;
    padding-top: $spacing-xl;
  }
}

.back-btn {
  position: absolute;
  top: $spacing-md;
  left: $spacing-md;
  display: flex;
  align-items: center;
  gap: $spacing-xs;
  padding: $spacing-sm $spacing-md;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  color: white;
  font-size: 0.9rem;

  svg {
    width: 18px;
    height: 18px;
  }

  &:hover {
    background: rgba(255, 255, 255, 0.25);
  }
}

.game-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;

  .game-icon-large {
    font-size: 4rem;
    margin-bottom: $spacing-md;
  }

  h1 {
    font-family: 'Rock Salt', cursive;
    font-size: 2.5rem;
    font-weight: 400;
    margin-bottom: $spacing-sm;
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);

    @media (orientation: portrait) {
      font-size: 2rem;
    }
  }

  .game-subtitle {
    font-size: 1.1rem;
    opacity: 0.8;
  }
}

.play-options {
  display: flex;
  flex-direction: column;
  gap: $spacing-lg;
  width: 100%;
  max-width: 320px;
}

.play-btn {
  display: flex;
  align-items: center;
  gap: $spacing-md;
  padding: $spacing-lg;
  background: white;
  color: #1e4d2b;
  border-radius: 12px;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
  }

  &:active:not(:disabled) {
    transform: scale(0.98);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-icon {
    font-size: 2rem;
  }

  .btn-text {
    display: flex;
    flex-direction: column;
    align-items: flex-start;

    strong {
      font-size: 1.25rem;
    }

    span {
      font-size: 0.85rem;
      opacity: 0.7;
    }
  }
}

.nickname-badge {
  margin-top: $spacing-md;
  padding: $spacing-sm $spacing-md;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  font-size: 0.9rem;

  strong {
    color: #f4d03f;
  }
}

// ==================
// Install Hints
// ==================

.install-hint {
  padding: $spacing-md $spacing-lg;
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  gap: $spacing-md;

  &.warning {
    background: rgba(231, 76, 60, 0.2);
    border-color: rgba(231, 76, 60, 0.3);
  }

  .install-btn {
    padding: $spacing-sm $spacing-md;
    background: $secondary-color;
    color: white;
    font-weight: bold;
    border-radius: 8px;
  }

  .dismiss-btn {
    padding: $spacing-xs $spacing-sm;
    background: rgba(255, 255, 255, 0.2);
    color: white;
    border-radius: 6px;
    font-size: 1.25rem;
    line-height: 1;
  }
}

// ==================
// Nickname Modal
// ==================

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.nickname-modal {
  background: white;
  color: #333;
  padding: $spacing-xl;
  border-radius: 16px;
  max-width: 320px;
  width: 90%;
  text-align: center;

  h2 {
    font-size: 1.25rem;
    margin-bottom: $spacing-xs;
  }

  p {
    font-size: 0.9rem;
    opacity: 0.7;
    margin-bottom: $spacing-lg;
  }

  input {
    width: 100%;
    padding: $spacing-md;
    font-size: 1rem;
    border: 2px solid #ddd;
    border-radius: 8px;
    margin-bottom: $spacing-lg;

    &:focus {
      outline: none;
      border-color: #1e4d2b;
    }
  }

  .modal-actions {
    display: flex;
    gap: $spacing-md;

    button {
      flex: 1;
      padding: $spacing-md;
      font-size: 1rem;
      font-weight: bold;
      border-radius: 8px;
    }

    .cancel-btn {
      background: #eee;
      color: #666;
    }

    .confirm-btn {
      background: #1e4d2b;
      color: white;

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }
  }
}
</style>
