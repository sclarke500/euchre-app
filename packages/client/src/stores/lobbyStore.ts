import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  Table,
  LobbyState,
  LobbyPlayer,
  ServerMessage,
  GameType,
  TableSettings,
} from '@67cards/shared'
import { websocket } from '@/services/websocket'
import { useSettingsStore } from '@/stores/settingsStore'
import { useChatStore } from '@/stores/chatStore'

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001'

// Storage keys
const STORAGE_KEYS = {
  odusId: 'odusId',
  nickname: 'odusNickname',
  avatar: 'odusAvatar',
} as const

// Available user avatars (filename without extension)
export const USER_AVATARS = [
  'ace', 'bear', 'blaze', 'chip', 'clover', 'cookie',
  'dice', 'fox', 'ghost', 'joker', 'maple', 'maverick',
  'owl', 'panda', 'retro', 'rocket-girl', 'rocket', 'sage',
  'shade', 'shadow', 'star', 'storm', 'sunny', 'wolf',
] as const

export type UserAvatar = typeof USER_AVATARS[number]

export const useLobbyStore = defineStore('lobby', () => {
  const settingsStore = useSettingsStore()
  // State
  const isConnected = ref(false)
  const isConnecting = ref(false)
  const connectionError = ref<string | null>(null)

  const odusId = ref<string | null>(localStorage.getItem(STORAGE_KEYS.odusId))
  const nickname = ref<string>(localStorage.getItem(STORAGE_KEYS.nickname) || '')
  const avatar = ref<string | null>(localStorage.getItem(STORAGE_KEYS.avatar))

  const tables = ref<Table[]>([])
  const connectedPlayers = ref(0)

  const currentTable = ref<Table | null>(null)
  const currentSeat = ref<number | null>(null)

  const gameId = ref<string | null>(null)
  const wasHostWhenGameStarted = ref(false)
  const gameTypeWhenStarted = ref<GameType>('euchre')

  // Game type selection (for creating tables)
  const selectedGameType = ref<GameType>('euchre')
  const selectedMaxPlayers = ref<number>(4) // For President: 4-8
  const selectedSuperTwosMode = ref<boolean>(false)

  // Computed
  const isInLobby = computed(() => isConnected.value && !currentTable.value && !gameId.value)
  const isAtTable = computed(() => isConnected.value && currentTable.value !== null && !gameId.value)
  const isInGame = computed(() => gameId.value !== null)
  const isHost = computed(() => {
    // During a game, use the preserved host status
    if (gameId.value) return wasHostWhenGameStarted.value
    // At a table, check the current table's hostId
    if (!currentTable.value || !odusId.value) return false
    return currentTable.value.hostId === odusId.value
  })

  const hasNickname = computed(() => nickname.value.trim().length > 0)

  // Get game type - use preserved value during a game, otherwise from current table
  const currentGameType = computed<GameType>(() => {
    if (gameId.value) return gameTypeWhenStarted.value
    return currentTable.value?.gameType ?? 'euchre'
  })

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
        // If our current table was removed, clear it
        if (currentTable.value?.odusId === message.tableId) {
          currentTable.value = null
          currentSeat.value = null
        }
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
        // Preserve host status and game type before currentTable is cleared
        wasHostWhenGameStarted.value = currentTable.value?.hostId === odusId.value
        gameTypeWhenStarted.value = currentTable.value?.gameType ?? 'euchre'
        gameId.value = message.gameId
        break

      case 'game_restarting':
        // Game is restarting - will receive new game_started message
        break

      case 'error':
        console.error('Server error:', message.message)
        connectionError.value = message.message
        
        // If error is about table not found, clear current table state
        // so user isn't stuck at a non-existent table
        if (message.message?.toLowerCase().includes('table') && 
            message.message?.toLowerCase().includes('not found')) {
          currentTable.value = null
          currentSeat.value = null
        }
        
        setTimeout(() => {
          connectionError.value = null
        }, 5000)
        break

      case 'chat_broadcast': {
        const chatStore = useChatStore()
        chatStore.receiveMessage(message.message)
        break
      }
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
      
      // Set up reconnect handler to re-identify
      websocket.onReconnect(() => {
        console.log('Reconnected - re-identifying to server')
        if (hasNickname.value) {
          // Re-join lobby to re-establish identity
          joinLobby()
          
          // If we were in a game, request state resync
          if (gameId.value) {
            console.log('Requesting game state resync after reconnect')
            websocket.send({ type: 'request_state' })
          }
        }
      })

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

  function setAvatar(avatarName: string | null): void {
    avatar.value = avatarName
    if (avatarName) {
      localStorage.setItem(STORAGE_KEYS.avatar, avatarName)
    } else {
      localStorage.removeItem(STORAGE_KEYS.avatar)
    }
  }

  // Get full avatar URL, or null for letter initial
  const avatarUrl = computed(() => {
    if (!avatar.value) return null
    return `/avatars/users/${avatar.value}.jpg`
  })

  function joinLobby(): void {
    if (!hasNickname.value) return

    websocket.send({
      type: 'join_lobby',
      nickname: nickname.value,
      odusId: odusId.value || undefined,
    })
  }

  function createTable(tableName?: string, extraSettings?: { chatEnabled?: boolean; isPrivate?: boolean; bootInactive?: boolean }): void {
    // Build settings from shared settingsStore - include aiDifficulty for all games
    const settings: TableSettings = {
      aiDifficulty: settingsStore.aiDifficulty,
      chatEnabled: extraSettings?.chatEnabled ?? true,
      isPrivate: extraSettings?.isPrivate ?? false,
      bootInactive: extraSettings?.bootInactive ?? true,
      ...(selectedGameType.value === 'president' && { superTwosMode: settingsStore.superTwosAndJokers }),
    }

    websocket.send({
      type: 'create_table',
      tableName,
      gameType: selectedGameType.value,
      maxPlayers: selectedGameType.value === 'president' ? settingsStore.presidentPlayerCount : undefined,
      settings,
    })
  }

  function setGameType(gameType: GameType): void {
    selectedGameType.value = gameType
    // Reset to defaults when switching game type
    if (gameType === 'euchre' || gameType === 'spades') {
      selectedMaxPlayers.value = 4
      selectedSuperTwosMode.value = false
    }
  }

  function setMaxPlayers(count: number): void {
    selectedMaxPlayers.value = Math.min(Math.max(count, 4), 8)
  }

  function setSuperTwosMode(enabled: boolean): void {
    selectedSuperTwosMode.value = enabled
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
    websocket.send({
      type: 'leave_game',
    })
    gameId.value = null
    currentTable.value = null
    currentSeat.value = null
    wasHostWhenGameStarted.value = false
    gameTypeWhenStarted.value = 'euchre'
  }

  function restartGame(): void {
    websocket.send({
      type: 'restart_game',
    })
  }

  return {
    // State
    isConnected,
    isConnecting,
    connectionError,
    odusId,
    nickname,
    avatar,
    avatarUrl,
    tables,
    connectedPlayers,
    currentTable,
    currentSeat,
    gameId,
    selectedGameType,
    selectedMaxPlayers,
    selectedSuperTwosMode,

    // Computed
    isInLobby,
    isAtTable,
    isInGame,
    isHost,
    hasNickname,
    currentGameType,

    // Actions
    connect,
    disconnect,
    setNickname,
    setAvatar,
    joinLobby,
    createTable,
    joinTable,
    leaveTable,
    startGame,
    leaveGame,
    restartGame,
    setGameType,
    setMaxPlayers,
    setSuperTwosMode,
  }
})
