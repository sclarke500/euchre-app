<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useLobbyStore } from '@/stores/lobbyStore'
import TableCard from '@/components/TableCard.vue'
import type { GameType } from '@euchre/shared'

const emit = defineEmits<{
  back: []
  gameStarted: []
}>()

const lobbyStore = useLobbyStore()
const showCreateOptions = ref(false)

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
  if (lobbyStore.isAtTable) {
    lobbyStore.leaveTable()
  }
})

function handleCreateTable() {
  lobbyStore.createTable()
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
    <div v-if="showCreateOptions && !lobbyStore.isAtTable" class="create-options">
      <div class="create-options-content">
        <h3>Create Table</h3>

        <div class="game-type-selector">
          <button
            :class="['game-type-btn', { active: lobbyStore.selectedGameType === 'euchre' }]"
            @click="selectGameType('euchre')"
          >
            Euchre
          </button>
          <button
            :class="['game-type-btn', { active: lobbyStore.selectedGameType === 'president' }]"
            @click="selectGameType('president')"
          >
            President
          </button>
        </div>

        <div v-if="lobbyStore.selectedGameType === 'president'" class="president-options">
          <div class="option-row">
            <label>Players:</label>
            <div class="player-count-selector">
              <button
                v-for="n in [4, 5, 6, 7, 8]"
                :key="n"
                :class="['count-btn', { active: lobbyStore.selectedMaxPlayers === n }]"
                @click="lobbyStore.setMaxPlayers(n)"
              >
                {{ n }}
              </button>
            </div>
          </div>
          <div class="option-row">
            <label>
              <input
                type="checkbox"
                :checked="lobbyStore.selectedSuperTwosMode"
                @change="lobbyStore.setSuperTwosMode(($event.target as HTMLInputElement).checked)"
              >
              Super 2s & Jokers
            </label>
          </div>
        </div>

        <div class="create-actions">
          <button class="cancel-btn" @click="showCreateOptions = false">Cancel</button>
          <button class="confirm-create-btn" @click="handleCreateTable">Create</button>
        </div>
      </div>
    </div>

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
        <span v-if="lobbyStore.isHost">Press "Start Game" when ready. Empty seats will be filled with <span class="clanker">clankers</span>.</span>
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
  background: linear-gradient(135deg, #1e4d2b 0%, #0d2818 100%);
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
  color: #1e4d2b;
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
    background: rgba(255, 193, 7, 0.2);
    color: #ffc107;
  }

  &.error {
    background: rgba(244, 67, 54, 0.2);
    color: #f44336;
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

.create-options {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
}

.create-options-content {
  background: #1e4d2b;
  border-radius: 12px;
  padding: $spacing-lg;
  min-width: 320px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);

  h3 {
    margin: 0 0 $spacing-md 0;
    text-align: center;
    font-size: 1.25rem;
  }
}

.game-type-selector {
  display: flex;
  gap: $spacing-sm;
  margin-bottom: $spacing-md;
}

.game-type-btn {
  flex: 1;
  padding: $spacing-sm $spacing-md;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  font-weight: 500;
  transition: all 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  &.active {
    background: white;
    color: #1e4d2b;
  }
}

.president-options {
  margin-bottom: $spacing-md;
  padding: $spacing-md;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
}

.option-row {
  display: flex;
  align-items: center;
  gap: $spacing-md;
  margin-bottom: $spacing-sm;

  &:last-child {
    margin-bottom: 0;
  }

  label {
    font-size: 0.875rem;
    display: flex;
    align-items: center;
    gap: $spacing-xs;

    input[type="checkbox"] {
      width: 18px;
      height: 18px;
    }
  }
}

.player-count-selector {
  display: flex;
  gap: $spacing-xs;
}

.count-btn {
  width: 36px;
  height: 36px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  font-weight: 500;

  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  &.active {
    background: white;
    color: #1e4d2b;
  }
}

.create-actions {
  display: flex;
  gap: $spacing-sm;
  margin-top: $spacing-md;
}

.cancel-btn {
  flex: 1;
  padding: $spacing-sm $spacing-md;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.1);
  color: white;

  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }
}

.confirm-create-btn {
  flex: 1;
  padding: $spacing-sm $spacing-md;
  border-radius: 8px;
  background: $secondary-color;
  color: white;
  font-weight: bold;
}
</style>
