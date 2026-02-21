import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Tests for player disconnection handling
 * 
 * New behavior:
 * - WebSocket close = mark player as disconnected (don't replace with AI)
 * - Game pauses for disconnected player's turn
 * - Other players can boot disconnected player (then AI takes over)
 * - If disconnected player reconnects, they resume (no AI replacement happened)
 * - Intentional leave (leave_game message) still immediately replaces with AI
 */

// Mock player for testing
interface TestPlayer {
  name: string
  isHuman: boolean
  odusId: string | null
  disconnected?: boolean
}

// Simulated game state for testing
class MockGameRuntime {
  players: TestPlayer[] = []
  currentPlayer: number = 0
  turnTimerPaused: boolean = false
  events: { onPlayerDisconnected?: (idx: number) => void; onPlayerReconnected?: (idx: number) => void } = {}

  constructor(playerCount: number = 4) {
    for (let i = 0; i < playerCount; i++) {
      this.players.push({
        name: i === 0 ? 'Human' : `Bot${i}`,
        isHuman: i === 0,
        odusId: i === 0 ? 'human-123' : null,
        disconnected: false,
      })
    }
  }

  markPlayerDisconnected(playerIndex: number): boolean {
    const player = this.players[playerIndex]
    if (!player || !player.isHuman || player.disconnected) {
      return false
    }
    
    player.disconnected = true
    
    // Pause turn timer if it's their turn
    if (this.currentPlayer === playerIndex) {
      this.turnTimerPaused = true
    }
    
    this.events.onPlayerDisconnected?.(playerIndex)
    return true
  }

  markPlayerReconnected(playerIndex: number): boolean {
    const player = this.players[playerIndex]
    if (!player || !player.disconnected) {
      return false
    }
    
    player.disconnected = false
    
    // Resume turn timer if it's their turn
    if (this.currentPlayer === playerIndex) {
      this.turnTimerPaused = false
    }
    
    this.events.onPlayerReconnected?.(playerIndex)
    return true
  }

  bootDisconnectedPlayer(playerIndex: number): boolean {
    const player = this.players[playerIndex]
    if (!player || !player.disconnected) {
      return false
    }
    
    // Convert to AI
    player.isHuman = false
    player.disconnected = false
    player.odusId = null
    player.name = `Bot${playerIndex}`
    
    // Resume game if it was paused for this player
    if (this.turnTimerPaused && this.currentPlayer === playerIndex) {
      this.turnTimerPaused = false
    }
    
    return true
  }

  getState() {
    return {
      players: this.players.map(p => ({
        name: p.name,
        isHuman: p.isHuman,
        disconnected: p.disconnected,
      })),
      currentPlayer: this.currentPlayer,
    }
  }
}

describe('Player Disconnection', () => {
  let game: MockGameRuntime

  beforeEach(() => {
    game = new MockGameRuntime(4)
    // Set up human player at seat 0
    game.players[0] = {
      name: 'Steve',
      isHuman: true,
      odusId: 'steve-123',
      disconnected: false,
    }
  })

  describe('markPlayerDisconnected', () => {
    it('marks human player as disconnected', () => {
      const result = game.markPlayerDisconnected(0)
      
      expect(result).toBe(true)
      expect(game.players[0]?.disconnected).toBe(true)
      expect(game.players[0]?.isHuman).toBe(true) // Still human, not replaced
    })

    it('does not affect AI players', () => {
      const result = game.markPlayerDisconnected(1) // Bot
      
      expect(result).toBe(false)
      expect(game.players[1]?.disconnected).toBeFalsy()
    })

    it('does not mark already disconnected player', () => {
      game.markPlayerDisconnected(0)
      const result = game.markPlayerDisconnected(0)
      
      expect(result).toBe(false)
    })

    it('pauses turn timer if disconnected player is current player', () => {
      game.currentPlayer = 0
      game.markPlayerDisconnected(0)
      
      expect(game.turnTimerPaused).toBe(true)
    })

    it('does not pause timer if different player is current', () => {
      game.currentPlayer = 1
      game.markPlayerDisconnected(0)
      
      expect(game.turnTimerPaused).toBe(false)
    })

    it('fires onPlayerDisconnected event', () => {
      const callback = vi.fn()
      game.events.onPlayerDisconnected = callback
      
      game.markPlayerDisconnected(0)
      
      expect(callback).toHaveBeenCalledWith(0)
    })
  })

  describe('markPlayerReconnected', () => {
    beforeEach(() => {
      game.markPlayerDisconnected(0)
    })

    it('clears disconnected flag', () => {
      const result = game.markPlayerReconnected(0)
      
      expect(result).toBe(true)
      expect(game.players[0]?.disconnected).toBe(false)
      expect(game.players[0]?.isHuman).toBe(true)
    })

    it('does not affect non-disconnected player', () => {
      game.markPlayerReconnected(0) // First reconnect
      const result = game.markPlayerReconnected(0) // Second attempt
      
      expect(result).toBe(false)
    })

    it('resumes turn timer if reconnected player is current', () => {
      game.currentPlayer = 0
      game.turnTimerPaused = true
      
      game.markPlayerReconnected(0)
      
      expect(game.turnTimerPaused).toBe(false)
    })

    it('fires onPlayerReconnected event', () => {
      const callback = vi.fn()
      game.events.onPlayerReconnected = callback
      
      game.markPlayerReconnected(0)
      
      expect(callback).toHaveBeenCalledWith(0)
    })
  })

  describe('bootDisconnectedPlayer', () => {
    beforeEach(() => {
      game.markPlayerDisconnected(0)
    })

    it('converts disconnected player to AI', () => {
      const result = game.bootDisconnectedPlayer(0)
      
      expect(result).toBe(true)
      expect(game.players[0]?.isHuman).toBe(false)
      expect(game.players[0]?.disconnected).toBe(false)
      expect(game.players[0]?.odusId).toBeNull()
    })

    it('does not boot non-disconnected player', () => {
      game.markPlayerReconnected(0)
      const result = game.bootDisconnectedPlayer(0)
      
      expect(result).toBe(false)
      expect(game.players[0]?.isHuman).toBe(true) // Still human
    })

    it('resumes game if booted player was current and paused', () => {
      game.currentPlayer = 0
      game.turnTimerPaused = true
      
      game.bootDisconnectedPlayer(0)
      
      expect(game.turnTimerPaused).toBe(false)
    })
  })

  describe('state broadcast includes disconnected flag', () => {
    it('includes disconnected status in player state', () => {
      game.markPlayerDisconnected(0)
      
      const state = game.getState()
      
      expect(state.players[0]?.disconnected).toBe(true)
      expect(state.players[1]?.disconnected).toBeFalsy()
    })
  })
})

describe('Disconnection vs Intentional Leave', () => {
  let game: MockGameRuntime

  beforeEach(() => {
    game = new MockGameRuntime(4)
    game.players[0] = {
      name: 'Steve',
      isHuman: true,
      odusId: 'steve-123',
      disconnected: false,
    }
  })

  it('disconnection keeps player human with disconnected flag', () => {
    // Simulate WebSocket close (unintentional)
    game.markPlayerDisconnected(0)
    
    expect(game.players[0]?.isHuman).toBe(true)
    expect(game.players[0]?.disconnected).toBe(true)
  })

  it('player can reconnect after disconnection', () => {
    game.markPlayerDisconnected(0)
    game.markPlayerReconnected(0)
    
    expect(game.players[0]?.isHuman).toBe(true)
    expect(game.players[0]?.disconnected).toBe(false)
    expect(game.players[0]?.name).toBe('Steve') // Name preserved
  })

  it('booting converts to AI permanently', () => {
    game.markPlayerDisconnected(0)
    game.bootDisconnectedPlayer(0)
    
    // Now even if they "reconnect", they're already AI
    const result = game.markPlayerReconnected(0)
    
    expect(result).toBe(false) // Can't reconnect to AI slot
    expect(game.players[0]?.isHuman).toBe(false)
  })
})

describe('Multiple Players Disconnected', () => {
  let game: MockGameRuntime

  beforeEach(() => {
    game = new MockGameRuntime(4)
    // Make all players human for this test
    game.players.forEach((p, i) => {
      p.isHuman = true
      p.odusId = `player-${i}`
      p.name = `Player${i}`
    })
  })

  it('can track multiple disconnected players', () => {
    game.markPlayerDisconnected(0)
    game.markPlayerDisconnected(2)
    
    expect(game.players[0]?.disconnected).toBe(true)
    expect(game.players[1]?.disconnected).toBeFalsy()
    expect(game.players[2]?.disconnected).toBe(true)
    expect(game.players[3]?.disconnected).toBeFalsy()
  })

  it('can boot one disconnected player while another stays disconnected', () => {
    game.markPlayerDisconnected(0)
    game.markPlayerDisconnected(2)
    
    game.bootDisconnectedPlayer(0)
    
    expect(game.players[0]?.isHuman).toBe(false) // Booted → AI
    expect(game.players[2]?.disconnected).toBe(true) // Still disconnected
    expect(game.players[2]?.isHuman).toBe(true) // Still human
  })

  it('each player can reconnect independently', () => {
    game.markPlayerDisconnected(0)
    game.markPlayerDisconnected(2)
    
    game.markPlayerReconnected(2)
    
    expect(game.players[0]?.disconnected).toBe(true) // Still disconnected
    expect(game.players[2]?.disconnected).toBe(false) // Reconnected
  })
})
