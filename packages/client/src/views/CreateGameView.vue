<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useLobbyStore } from '@/stores/lobbyStore'
import { useSettingsStore } from '@/stores/settingsStore'
import EuchreOptions from '@/games/euchre/EuchreOptions.vue'
import PresidentOptions from '@/games/president/PresidentOptions.vue'
import SpadesOptions from '@/games/spades/SpadesOptions.vue'
import type { GameType } from '@67cards/shared'

const router = useRouter()
const lobbyStore = useLobbyStore()
const settings = useSettingsStore()

// Storage keys
const STORAGE_KEYS = {
  lastGameType: 'createTable.lastGameType',
  chatEnabled: 'createTable.chatEnabled',
  isPrivate: 'createTable.isPrivate',
  bootInactive: 'createTable.bootInactive',
}

// Load saved preferences
const selectedGame = ref<GameType>(
  (localStorage.getItem(STORAGE_KEYS.lastGameType) as GameType) || 'euchre'
)
const chatEnabled = ref(localStorage.getItem(STORAGE_KEYS.chatEnabled) !== 'false')
const isPrivate = ref(localStorage.getItem(STORAGE_KEYS.isPrivate) === 'true')
const bootInactive = ref(localStorage.getItem(STORAGE_KEYS.bootInactive) !== 'false')

// Bot remarks: off / mild / spicy
type BotRemarksLevel = 'off' | 'mild' | 'spicy'
const botRemarks = computed<BotRemarksLevel>({
  get: () => {
    if (!settings.botChatEnabled) return 'off'
    return settings.aiChatMode === 'unhinged' ? 'spicy' : 'mild'
  },
  set: (val) => {
    if (val === 'off') {
      settings.setBotChatEnabled(false)
    } else {
      settings.setBotChatEnabled(true)
      settings.setAIChatMode(val === 'spicy' ? 'unhinged' : 'clean')
    }
  }
})

// Sync selected game to lobby store
onMounted(async () => {
  lobbyStore.setGameType(selectedGame.value)
  
  // Ensure connected
  if (!lobbyStore.isConnected) {
    await lobbyStore.connect()
    if (lobbyStore.hasNickname) {
      lobbyStore.joinLobby()
    }
  }
})

function selectGameType(game: GameType) {
  selectedGame.value = game
  lobbyStore.setGameType(game)
  localStorage.setItem(STORAGE_KEYS.lastGameType, game)
}

function handleCreate() {
  // Save preferences
  localStorage.setItem(STORAGE_KEYS.lastGameType, selectedGame.value)
  localStorage.setItem(STORAGE_KEYS.chatEnabled, String(chatEnabled.value))
  localStorage.setItem(STORAGE_KEYS.isPrivate, String(isPrivate.value))
  localStorage.setItem(STORAGE_KEYS.bootInactive, String(bootInactive.value))
  
  lobbyStore.createTable(undefined, {
    chatEnabled: chatEnabled.value,
    isPrivate: isPrivate.value,
    bootInactive: bootInactive.value,
  })
  
  // Navigate back to lobby (table view will show)
  router.push('/lobby')
}

function handleBack() {
  router.push('/lobby')
}
</script>

<template>
  <div class="create-game-view">
    <div class="create-game-content">
      <header class="header">
        <button class="back-btn" @click="handleBack">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Cancel
        </button>
        <h1>New Game</h1>
        <button class="create-btn" @click="handleCreate">Create Table</button>
      </header>

      <div class="two-column">
        <!-- Left Column: Game Selection & Options -->
        <div class="column">
          <div class="section-card">
            <h2>Game</h2>
            <div class="game-tabs">
              <button
                v-for="game in (['euchre', 'president', 'spades'] as const)"
                :key="game"
                :class="['game-tab', { active: selectedGame === game }]"
                @click="selectGameType(game)"
              >
                {{ game.charAt(0).toUpperCase() + game.slice(1) }}
              </button>
            </div>
          </div>

          <div class="section-card">
            <h2>Game Rules</h2>
            <div class="game-options-panel">
              <EuchreOptions v-if="selectedGame === 'euchre'" />
              <PresidentOptions v-else-if="selectedGame === 'president'" />
              <SpadesOptions v-else-if="selectedGame === 'spades'" />
            </div>
          </div>
        </div>

        <!-- Right Column: Table Options -->
        <div class="column">
          <div class="section-card">
            <h2>Table Options</h2>
            
            <div class="option-row">
              <span class="option-label">Private Game</span>
              <div class="option-pills">
                <button
                  :class="['pill', { active: !isPrivate }]"
                  @click="isPrivate = false"
                >
                  Off
                </button>
                <button
                  :class="['pill', { active: isPrivate }]"
                  @click="isPrivate = true"
                >
                  On
                </button>
              </div>
            </div>
            
            <div class="option-row">
              <span class="option-label">Boot Inactive</span>
              <div class="option-pills">
                <button
                  :class="['pill', { active: !bootInactive }]"
                  @click="bootInactive = false"
                >
                  Off
                </button>
                <button
                  :class="['pill', { active: bootInactive }]"
                  @click="bootInactive = true"
                >
                  On
                </button>
              </div>
            </div>
            
            <div class="option-row">
              <span class="option-label">Chat</span>
              <div class="option-pills">
                <button
                  :class="['pill', { active: !chatEnabled }]"
                  @click="chatEnabled = false"
                >
                  Off
                </button>
                <button
                  :class="['pill', { active: chatEnabled }]"
                  @click="chatEnabled = true"
                >
                  On
                </button>
              </div>
            </div>
            
            <div class="option-row">
              <span class="option-label">Bot Remarks</span>
              <div class="option-pills">
                <button
                  :class="['pill', { active: botRemarks === 'off' }]"
                  @click="botRemarks = 'off'"
                >
                  Off
                </button>
                <button
                  :class="['pill', { active: botRemarks === 'mild' }]"
                  @click="botRemarks = 'mild'"
                >
                  Mild
                </button>
                <button
                  :class="['pill', { active: botRemarks === 'spicy' }]"
                  @click="botRemarks = 'spicy'"
                >
                  Spicy
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.create-game-view {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, $home-gradient-top 0%, $home-gradient-bottom 100%);
  color: white;
  overflow-y: auto;
}

.create-game-content {
  width: 100%;
  height: 100%;
  padding: $spacing-xl;
  display: flex;
  flex-direction: column;
}

.two-column {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: $spacing-xl 48px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  
  @media (max-width: 600px) {
    grid-template-columns: 1fr;
  }
}

.column {
  display: flex;
  flex-direction: column;
  gap: $spacing-xl;
}

.section-card {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: $spacing-md;
  border: 1px solid rgba(255, 255, 255, 0.08);
  
  h2 {
    font-size: 0.9rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #e8dcc8; // Soft warm cream
    margin-bottom: $spacing-md;
  }
}

.game-tabs {
  display: flex;
  gap: 2px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 2px;
}

.game-tab {
  flex: 1;
  padding: $spacing-sm $spacing-md;
  background: transparent;
  border-radius: 10px;
  color: rgba(255, 255, 255, 0.7);
  font-weight: 500;
  transition: all 0.15s ease;

  &:hover {
    color: white;
  }

  &.active {
    background: $brand-green;
    color: white;
  }
}

.game-options-panel {
  flex: 1;
  background: transparent;
  padding: $spacing-sm 0;
  overflow-y: auto;
  
  // Override compact-options styles for dark theme
  :deep(.compact-options) {
    gap: $spacing-md;
  }
  
  :deep(.option-row) {
    padding: $spacing-xs 0;
  }
  
  :deep(.option-label) {
    font-size: 0.9rem;
    color: rgba(255, 255, 255, 0.9);
  }
  
  :deep(.toggle-group),
  :deep(.count-group) {
    display: flex;
    gap: 4px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 2px;
  }
  
  :deep(.toggle-btn),
  :deep(.count-pill) {
    padding: $spacing-xs $spacing-sm;
    background: transparent;
    border-radius: 6px;
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.85rem;
    font-weight: 500;
    width: auto;
    height: auto;
    
    &:hover {
      color: white;
    }
    
    &.active {
      background: $brand-green;
      color: white;
      box-shadow: none;
    }
  }
}

.option-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $spacing-md;
  padding: $spacing-sm 0;
}

.option-label {
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
}

.option-pills {
  display: flex;
  gap: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 2px;
}

.pill {
  padding: $spacing-xs $spacing-sm;
  background: transparent;
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.85rem;
  font-weight: 500;
  transition: all 0.15s ease;

  &:hover {
    color: white;
  }

  &.active {
    background: $brand-green;
    color: white;
  }
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: $spacing-xl;

  h1 {
    font-size: 1.25rem;
    font-weight: 600;
  }
}

.back-btn {
  display: flex;
  align-items: center;
  gap: $spacing-xs;
  padding: $spacing-sm $spacing-md;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: white;
  font-weight: 500;

  svg {
    width: 20px;
    height: 20px;
  }

  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }
}

.create-btn {
  padding: $spacing-sm $spacing-lg;
  background: $brand-green;
  border-radius: 8px;
  color: white;
  font-weight: 600;

  &:hover {
    background: $brand-green-light;
  }
}

</style>
