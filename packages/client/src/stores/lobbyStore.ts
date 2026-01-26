import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  Table,
  LobbyState,
  LobbyPlayer,
  ServerMessage,
} from '@euchre/shared'
import { websocket } from '@/services/websocket'

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001'

// Storage keys
const STORAGE_KEYS = {
  odusId: 'odusId',
  nickname: 'odusNickname',
} as const

export const useLobbyStore = defineStore('lobby', () => {
  // State
  const isConnected = ref(false)
  const isConnecting = ref(false)
  const connectionError = ref<string | null>(null)

  const odusId = ref<string | null>(localStorage.getItem(STORAGE_KEYS.odusId))
  const nickname = ref<string>(localStorage.getItem(STORAGE_KEYS.nickname) || '')

  const tables = ref<Table[]>([])
  const connectedPlayers = ref(0)

  const currentTable = ref<Table | null>(null)
  const currentSeat = ref<number | null>(null)

  const gameId = ref<string | null>(null)

  // Computed
  const isInLobby = computed(() => isConnected.value && !currentTable.value && !gameId.value)
  const isAtTable = computed(() => isConnected.value && currentTable.value !== null && !gameId.value)
  const isInGame = computed(() => gameId.value !== null)
  const isHost = computed(() => {
    if (!currentTable.value || !odusId.value) return false
    return currentTable.value.hostId === odusId.value
  })

  const hasNickname = computed(() => nickname.value.trim().length > 0)

  // Message handler
  function handleMessage(message: ServerMessage): void {
    switch (message.type) {
      case 'welcome':
        odusId.value = message.odusId
        localStorage.setItem(STORAGE_KEYS.odusId, message.odusId)
        break

      case 'lobby_state':
        tables.value = message.state.tables
        connectedPlayers.value = message.state.connectedPlayers
        break

      case 'table_updated':
        updateTable(message.table)
        break

      case 'table_removed':
        removeTable(message.tableId)
        break

      case 'joined_table':
        currentTable.value = message.table
        currentSeat.value = message.seatIndex
        break

      case 'left_table':
        currentTable.value = null
        currentSeat.value = null
        break

      case 'player_joined':
        if (currentTable.value) {
          const seat = currentTable.value.seats[message.seatIndex]
          if (seat) {
            seat.player = message.player
          }
        }
        break

      case 'player_left':
        if (currentTable.value) {
          const seat = currentTable.value.seats[message.seatIndex]
          if (seat) {
            seat.player = null
          }
        }
        break

      case 'game_started':
        gameId.value = message.gameId
        break

      case 'error':
        console.error('Server error:', message.message)
        connectionError.value = message.message
        setTimeout(() => {
          connectionError.value = null
        }, 5000)
        break
    }
  }

  function updateTable(table: Table): void {
    const index = tables.value.findIndex((t) => t.odusId === table.odusId)
    if (index !== -1) {
      tables.value[index] = table
    } else {
      tables.value.push(table)
    }

    // Update current table if it's the one we're at
    if (currentTable.value?.odusId === table.odusId) {
      currentTable.value = table
    }
  }

  function removeTable(tableId: string): void {
    tables.value = tables.value.filter((t) => t.odusId !== tableId)
  }

  // Actions
  async function connect(): Promise<void> {
    if (isConnected.value || isConnecting.value) return

    isConnecting.value = true
    connectionError.value = null

    try {
      await websocket.connect(WS_URL)
      isConnected.value = true

      // Set up message handler
      websocket.onMessage(handleMessage)

      // Join lobby with nickname
      if (hasNickname.value) {
        joinLobby()
      }
    } catch (error) {
      connectionError.value = 'Failed to connect to server'
      console.error('Connection error:', error)
    } finally {
      isConnecting.value = false
    }
  }

  function disconnect(): void {
    websocket.disconnect()
    isConnected.value = false
    currentTable.value = null
    currentSeat.value = null
    gameId.value = null
    tables.value = []
  }

  function setNickname(name: string): void {
    nickname.value = name.trim()
    localStorage.setItem(STORAGE_KEYS.nickname, nickname.value)
  }

  function joinLobby(): void {
    if (!hasNickname.value) return

    websocket.send({
      type: 'join_lobby',
      nickname: nickname.value,
      odusId: odusId.value || undefined,
    })
  }

  function createTable(tableName?: string): void {
    websocket.send({
      type: 'create_table',
      tableName,
    })
  }

  function joinTable(tableId: string, seatIndex: number): void {
    websocket.send({
      type: 'join_table',
      tableId,
      seatIndex,
    })
  }

  function leaveTable(): void {
    websocket.send({
      type: 'leave_table',
    })
  }

  function startGame(): void {
    websocket.send({
      type: 'start_game',
    })
  }

  function leaveGame(): void {
    gameId.value = null
    currentTable.value = null
    currentSeat.value = null
  }

  return {
    // State
    isConnected,
    isConnecting,
    connectionError,
    odusId,
    nickname,
    tables,
    connectedPlayers,
    currentTable,
    currentSeat,
    gameId,

    // Computed
    isInLobby,
    isAtTable,
    isInGame,
    isHost,
    hasNickname,

    // Actions
    connect,
    disconnect,
    setNickname,
    joinLobby,
    createTable,
    joinTable,
    leaveTable,
    startGame,
    leaveGame,
  }
})
