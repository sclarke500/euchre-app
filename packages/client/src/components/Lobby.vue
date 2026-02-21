<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useLobbyStore } from '@/stores/lobbyStore'
import { useSettingsStore } from '@/stores/settingsStore'
import TableCard from '@/components/TableCard.vue'
import Modal from '@/components/Modal.vue'
import EuchreOptions from '@/games/euchre/EuchreOptions.vue'
import PresidentOptions from '@/games/president/PresidentOptions.vue'
import SpadesOptions from '@/games/spades/SpadesOptions.vue'
import type { GameType } from '@67cards/shared'

const props = defineProps<{
  initialTableCode?: string
}>()

const settings = useSettingsStore()

const emit = defineEmits<{
  back: []
  gameStarted: []
}>()

const lobbyStore = useLobbyStore()
const showCreateOptions = ref(false)

// Create table options - load from localStorage with defaults
const STORAGE_KEYS = {
  chatEnabled: 'createTable.chatEnabled',
  isPrivate: 'createTable.isPrivate',
  bootInactive: 'createTable.bootInactive',
}

const chatEnabled = ref(localStorage.getItem(STORAGE_KEYS.chatEnabled) !== 'false')
const isPrivate = ref(localStorage.getItem(STORAGE_KEYS.isPrivate) === 'true')
const bootInactive = ref(localStorage.getItem(STORAGE_KEYS.bootInactive) !== 'false')

const sortedTables = computed(() => {
  return [...lobbyStore.tables].sort((a, b) => b.createdAt - a.createdAt)
})

onMounted(async () => {
  await lobbyStore.connect()
  if (lobbyStore.isConnected && lobbyStore.hasNickname) {
    lobbyStore.joinLobby()
  }
})

onUnmounted(() => {
  // Only leave table if not transitioning to a game
  // (gameId being set means we're starting a game, not leaving)
  if (lobbyStore.isAtTable && !lobbyStore.gameId) {
    lobbyStore.leaveTable()
  }
})

function handleCreateTable() {
  // Save preferences to localStorage
  localStorage.setItem(STORAGE_KEYS.chatEnabled, String(chatEnabled.value))
  localStorage.setItem(STORAGE_KEYS.isPrivate, String(isPrivate.value))
  localStorage.setItem(STORAGE_KEYS.bootInactive, String(bootInactive.value))
  
  lobbyStore.createTable(undefined, {
    chatEnabled: chatEnabled.value,
    isPrivate: isPrivate.value,
    bootInactive: bootInactive.value,
  })
  showCreateOptions.value = false
}

function handleBack() {
  if (lobbyStore.isAtTable) {
    lobbyStore.leaveTable()
  } else {
    lobbyStore.disconnect()
    emit('back')
  }
}

function handleStartGame() {
  lobbyStore.startGame()
}

function toggleCreateOptions() {
  showCreateOptions.value = !showCreateOptions.value
}

function selectGameType(gameType: GameType) {
  lobbyStore.setGameType(gameType)
}

// Watch for game start
const checkGameStart = computed(() => lobbyStore.gameId)
</script>

<template>
  <div class="lobby">
    <header class="lobby-header">
      <button class="back-btn" @click="handleBack">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        {{ lobbyStore.isAtTable ? 'Leave Table' : 'Back' }}
      </button>

      <h1>{{ lobbyStore.isAtTable ? lobbyStore.currentTable?.name : 'Lobby' }}</h1>

      <div class="header-right">
        <span class="player-count">{{ lobbyStore.connectedPlayers }} online</span>
        <button
          v-if="!lobbyStore.isAtTable"
          class="create-btn"
          @click="toggleCreateOptions"
        >
          Create Table
        </button>
        <button
          v-if="lobbyStore.isAtTable && lobbyStore.isHost"
          class="start-btn"
          @click="handleStartGame"
        >
          Start Game
        </button>
      </div>
    </header>

    <!-- Create Table Options -->
    <Modal
      :show="showCreateOptions && !lobbyStore.isAtTable"
      aria-label="Create table"
      @close="showCreateOptions = false"
    >
      <div class="modal-light">
        <div class="modal-header">
          <h3>Create Table</h3>
        </div>
        <div class="modal-body">
          <div class="game-selector">
            <button
              v-for="game in ['euchre', 'president', 'spades'] as const"
              :key="game"
              :class="['game-pill', { active: lobbyStore.selectedGameType === game }]"
              @click="selectGameType(game)"
            >
              {{ game.charAt(0).toUpperCase() + game.slice(1) }}
            </button>
          </div>

          <div class="bot-difficulty-row">
            <span class="difficulty-label">Bot Difficulty</span>
            <div class="difficulty-selector">
              <button
                :class="['difficulty-pill', { active: settings.aiDifficulty === 'easy' }]"
                @click="settings.setAIDifficulty('easy')"
              >
                Easy
              </button>
              <button
                :class="['difficulty-pill', { active: settings.aiDifficulty === 'hard' }]"
                @click="settings.setAIDifficulty('hard')"
              >
                Hard
              </button>
            </div>
          </div>

          <div class="game-options-section">
            <EuchreOptions v-if="lobbyStore.selectedGameType === 'euchre'" />
            <PresidentOptions v-else-if="lobbyStore.selectedGameType === 'president'" />
            <SpadesOptions v-else-if="lobbyStore.selectedGameType === 'spades'" />
          </div>

          <div class="table-options-section">
            <label class="toggle-option">
              <input v-model="chatEnabled" type="checkbox" />
              <span class="toggle-label">Chat enabled</span>
            </label>
            
            <label class="toggle-option">
              <input v-model="isPrivate" type="checkbox" />
              <span class="toggle-label">Private game</span>
              <span class="toggle-hint">Shows 🔒 in lobby - for playing with friends</span>
            </label>
            
            <label class="toggle-option">
              <input v-model="bootInactive" type="checkbox" />
              <span class="toggle-label">Boot inactive players</span>
              <span class="toggle-hint">Show turn timer and allow kicking AFK players</span>
            </label>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" @click="showCreateOptions = false">Cancel</button>
          <button class="btn-primary" @click="handleCreateTable">Create</button>
        </div>
      </div>
    </Modal>

    <!-- Connection status -->
    <div v-if="lobbyStore.isConnecting" class="status-banner connecting">
      Connecting to server...
    </div>
    <div v-else-if="lobbyStore.connectionError" class="status-banner error">
      {{ lobbyStore.connectionError }}
    </div>

    <!-- At Table View -->
    <div v-if="lobbyStore.isAtTable && lobbyStore.currentTable" class="table-view">
      <TableCard
        :table="lobbyStore.currentTable"
        :is-current="true"
        :current-user-id="lobbyStore.odusId || ''"
        @join-seat="() => {}"
      />
      <p class="waiting-message">
        Waiting for players...
        <span v-if="lobbyStore.isHost">Press "Start Game" when ready. Empty seats will be filled with AI.</span>
      </p>
    </div>

    <!-- Lobby Table List -->
    <div v-else-if="lobbyStore.isInLobby" class="table-list">
      <template v-if="sortedTables.length > 0">
        <TableCard
          v-for="table in sortedTables"
          :key="table.odusId"
          :table="table"
          :is-current="false"
          :current-user-id="lobbyStore.odusId || ''"
          @join-seat="(seatIndex) => lobbyStore.joinTable(table.odusId, seatIndex)"
        />
      </template>
      <div v-else class="empty-lobby">
        <p>No tables available</p>
        <p class="empty-hint">Create a table to start playing!</p>
      </div>
    </div>

    <!-- Game redirect notice -->
    <div v-if="checkGameStart" class="game-starting">
      <p>Game starting...</p>
    </div>
  </div>
</template>

<style scoped lang="scss">
.lobby {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, $home-gradient-top 0%, $home-gradient-bottom 100%);
  color: white;
}

.lobby-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $spacing-md $spacing-lg;
  background: rgba(0, 0, 0, 0.2);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);

  h1 {
    font-size: 1.5rem;
    margin: 0;
  }
}

.back-btn {
  display: flex;
  align-items: center;
  gap: $spacing-xs;
  padding: $spacing-sm $spacing-md;
  background: rgba(255, 255, 255, 0.15);
  color: white;
  border-radius: 8px;

  svg {
    width: 20px;
    height: 20px;
  }
}

.header-right {
  display: flex;
  align-items: center;
  gap: $spacing-md;
}

.player-count {
  font-size: 0.875rem;
  opacity: 0.8;
}

.create-btn,
.start-btn {
  padding: $spacing-sm $spacing-lg;
  font-weight: bold;
  border-radius: 8px;
}

.create-btn {
  background: white;
  color: $brand-green;
}

.start-btn {
  background: $secondary-color;
  color: white;
}

.status-banner {
  padding: $spacing-sm $spacing-lg;
  text-align: center;
  font-size: 0.875rem;

  &.connecting {
    background: rgba(217, 119, 6, 0.15);
    color: var(--color-warning);
  }

  &.error {
    background: rgba(220, 38, 38, 0.15);
    color: var(--color-danger);
  }
}

.table-list {
  flex: 1;
  overflow-y: auto;
  padding: $spacing-lg;
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
}

.table-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: $spacing-lg;
  gap: $spacing-lg;
}

.waiting-message {
  text-align: center;
  font-size: 1rem;
  opacity: 0.9;

  span {
    display: block;
    font-size: 0.875rem;
    opacity: 0.7;
    margin-top: $spacing-xs;
  }
}

.empty-lobby {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  opacity: 0.7;

  p {
    font-size: 1.25rem;
  }

  .empty-hint {
    font-size: 0.875rem;
    margin-top: $spacing-sm;
  }
}

.game-starting {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  z-index: 100;
}

// --- Create Table Modal Inner Styles ---
// (modal wrapper is .modal-light from _modal-light.scss)

.game-selector {
  display: flex;
  background: var(--color-surface-muted);
  border-radius: var(--radius-md);
  padding: 3px;
  margin-bottom: $spacing-md;
}

.game-pill {
  flex: 1;
  padding: $spacing-xs $spacing-sm;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 0.85rem;
  font-weight: 500;
  transition: all 0.15s ease;

  &:hover:not(.active) {
    color: var(--color-text);
    background: rgba(0, 0, 0, 0.05);
  }

  &.active {
    background: var(--color-surface);
    color: var(--color-primary);
    box-shadow: var(--shadow-sm);
  }
}

.bot-difficulty-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: $spacing-md;
  padding: $spacing-sm 0;
}

.difficulty-label {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--color-text-secondary);
}

.difficulty-selector {
  display: flex;
  background: var(--color-surface-muted);
  border-radius: var(--radius-sm);
  padding: 2px;
}

.difficulty-pill {
  padding: 6px 14px;
  border-radius: 5px;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 0.8rem;
  font-weight: 500;
  transition: all 0.15s ease;

  &:hover:not(.active) {
    color: var(--color-text);
    background: rgba(0, 0, 0, 0.05);
  }

  &.active {
    background: var(--color-surface);
    color: var(--color-primary);
    box-shadow: var(--shadow-sm);
  }
}

.game-options-section {
  padding: $spacing-sm;
  background: var(--color-surface-subtle);
  border-radius: var(--radius-md);
  min-height: 50px;
}

.table-options-section {
  margin-top: $spacing-md;
  padding-top: $spacing-md;
  border-top: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
}

.toggle-option {
  display: flex;
  align-items: flex-start;
  gap: $spacing-sm;
  cursor: pointer;
  
  input[type="checkbox"] {
    width: 18px;
    height: 18px;
    margin-top: 2px;
    accent-color: var(--color-primary);
    cursor: pointer;
  }
  
  .toggle-label {
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--color-text);
  }
  
  .toggle-hint {
    display: block;
    font-size: 0.75rem;
    color: var(--color-text-secondary);
    margin-top: 2px;
  }
}

.player-count-selector {
  display: flex;
  gap: $spacing-xs;
}

.count-btn {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-sm);
  background: var(--color-surface-muted);
  color: var(--color-text-secondary);
  font-weight: 500;

  &:hover {
    background: var(--color-border);
  }

  &.active {
    background: var(--color-primary);
    color: var(--color-text-on-primary);
  }
}
</style>
