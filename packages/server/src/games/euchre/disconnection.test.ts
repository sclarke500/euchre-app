import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EuchreGame } from './EuchreGame.js'

/**
 * Integration tests for EuchreGame disconnection handling
 * These will fail until the methods are implemented
 */

describe('EuchreGame Disconnection', () => {
  let game: EuchreGame
  let broadcastSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    broadcastSpy = vi.fn()
    
    game = new EuchreGame('test-game', {
      onStateChange: broadcastSpy as any,
      onBidMade: vi.fn() as any,
      onCardPlayed: vi.fn() as any,
      onTrickComplete: vi.fn() as any,
      onRoundComplete: vi.fn() as any,
      onGameOver: vi.fn() as any,
      onYourTurn: vi.fn() as any,
      onTurnReminder: vi.fn() as any,
      onPlayerTimedOut: vi.fn() as any,
      onPlayerBooted: vi.fn() as any,
      onPlayerDisconnected: vi.fn() as any,
      onPlayerReconnected: vi.fn() as any,
    })
    
    // Initialize with one human player
    game.initializePlayers([
      { odusId: 'test-123', name: 'TestPlayer', seatIndex: 0 }
    ])
    
    // Start the game
    game.start()
  })

  describe('markPlayerDisconnected', () => {
    it('exists and marks player as disconnected', () => {
      // Add a human player first
      const player = game['players'][0]!
      player.isHuman = true
      player.odusId = 'test-123'
      
      const result = game.markPlayerDisconnected(0)
      
      expect(result).toBe(true)
      expect(player.disconnected).toBe(true)
    })

    it('returns false for AI players', () => {
      // Player 1 is AI by default
      const result = game.markPlayerDisconnected(1)
      
      expect(result).toBe(false)
    })

    it('broadcasts state after marking disconnected', () => {
      const player = game['players'][0]!
      player.isHuman = true
      player.odusId = 'test-123'
      
      game.markPlayerDisconnected(0)
      
      expect(broadcastSpy).toHaveBeenCalled()
    })
  })

  describe('markPlayerReconnected', () => {
    beforeEach(() => {
      const player = game['players'][0]!
      player.isHuman = true
      player.odusId = 'test-123'
      game.markPlayerDisconnected(0)
      broadcastSpy.mockClear()
    })

    it('clears disconnected flag', () => {
      const result = game.markPlayerReconnected(0)
      
      expect(result).toBe(true)
      expect(game['players'][0]!.disconnected).toBe(false)
    })

    it('broadcasts state after reconnecting', () => {
      game.markPlayerReconnected(0)
      
      expect(broadcastSpy).toHaveBeenCalled()
    })
  })

  describe('bootDisconnectedPlayer', () => {
    beforeEach(() => {
      const player = game['players'][0]!
      player.isHuman = true
      player.odusId = 'test-123'
      game.markPlayerDisconnected(0)
      broadcastSpy.mockClear()
    })

    it('converts disconnected player to AI', () => {
      const result = game.bootDisconnectedPlayer(0)
      
      expect(result).toBe(true)
      expect(game['players'][0]!.isHuman).toBe(false)
      expect(game['players'][0]!.disconnected).toBeFalsy()
    })

    it('returns false if player is not disconnected', () => {
      game.markPlayerReconnected(0)
      const result = game.bootDisconnectedPlayer(0)
      
      expect(result).toBe(false)
    })
  })

  describe('state includes disconnected flag', () => {
    it('includes disconnected in serialized state', () => {
      const player = game['players'][0]!
      player.isHuman = true
      player.odusId = 'test-123'
      game.markPlayerDisconnected(0)
      
      const state = game.getStateForPlayer('test-123')
      
      expect(state.players[0]?.disconnected).toBe(true)
    })
  })
})
