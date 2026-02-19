import type {
  PresidentPile,
  PlayerRank,
  PlayType,
  StandardCard,
} from '@67cards/shared'
import {
  PresidentPhase,
  createPresidentGame,
  dealPresidentCards,
  processPlay,
  processPass,
  assignRanks,
  getNextActivePlayer,
  createEmptyPile,
  isValidPlay,
  getRankDisplayName,
  getRandomAINames,
} from '@67cards/shared'
import type { PresidentClientGameState, PresidentClientPlayer } from '@67cards/shared'
import type { PresidentGameEvents, PresidentGamePlayer } from './types.js'
import {
  applyPresidentGameState,
  buildPresidentClientState,
  buildPresidentGameState,
} from './state.js'
import { buildPresidentTurnOptions } from './turns.js'
import { computePresidentAIPlay } from './ai.js'
import { createPresidentCardExchangeController } from './cardExchange.js'
import { advanceReminderTick } from '../shared/reminders.js'

export class PresidentGame {
  public readonly id: string
  private players: PresidentGamePlayer[] = []
  private phase: PresidentPhase = PresidentPhase.Setup
  private currentPile: PresidentPile = createEmptyPile()
  private currentPlayer = 0
  private consecutivePasses = 0
  private finishedPlayers: number[] = []
  private roundNumber = 1
  private gameOver = false
  private lastPlayerId: number | null = null
  private superTwosMode = false
  private maxPlayers: number
  private events: PresidentGameEvents
  private stateSeq = 0
  private turnReminderTimeout: ReturnType<typeof setTimeout> | null = null
  private readonly TURN_REMINDER_DELAY = 15000 // 15 seconds
  private turnReminderCount = 0
  private readonly TIMEOUT_AFTER_REMINDERS = 4 // Mark as timed out after 4 reminders (60 seconds)
  private timedOutPlayer: number | null = null
  
  // AI difficulty
  private readonly aiDifficulty: 'easy' | 'hard'
  private readonly cardExchange: ReturnType<typeof createPresidentCardExchangeController>

  constructor(id: string, events: PresidentGameEvents, maxPlayers: number = 4, superTwosMode: boolean = false, aiDifficulty: 'easy' | 'hard' = 'easy') {
    this.id = id
    this.events = events
    this.maxPlayers = maxPlayers
    this.superTwosMode = superTwosMode
    this.aiDifficulty = aiDifficulty
    this.cardExchange = createPresidentCardExchangeController({
      players: this.players,
      getPhase: () => this.phase,
      setPhase: (phase) => {
        this.phase = phase
      },
      setCurrentPlayer: (seatIndex) => {
        this.currentPlayer = seatIndex
      },
      broadcastState: () => {
        this.broadcastState()
      },
      processCurrentTurn: () => {
        this.processCurrentTurn()
      },
      events: {
        onExchangePrompt: this.events.onExchangePrompt,
        onExchangeComplete: this.events.onExchangeComplete,
      },
    })
  }

  getStateSeq(): number {
    return this.stateSeq
  }

  /**
   * Initialize the game with players
   */
  initializePlayers(humanPlayers: Array<{ odusId: string; name: string; seatIndex: number }>): void {
    // Count how many AI players we need
    const aiCount = this.maxPlayers - humanPlayers.length
    const aiNames = getRandomAINames(aiCount)
    let aiNameIndex = 0

    // Create all players (fill empty seats with AI)
    for (let i = 0; i < this.maxPlayers; i++) {
      const humanPlayer = humanPlayers.find((p) => p.seatIndex === i)

      if (humanPlayer) {
        this.players.push({
          odusId: humanPlayer.odusId,
          seatIndex: i,
          name: humanPlayer.name,
          isHuman: true,
          hand: [],
          rank: null,
          finishOrder: null,
          cardsToGive: 0,
          cardsToReceive: 0,
        })
      } else {
        this.players.push({
          odusId: null,
          seatIndex: i,
          name: aiNames[aiNameIndex++] ?? 'Bot',
          isHuman: false,
          hand: [],
          rank: null,
          finishOrder: null,
          cardsToGive: 0,
          cardsToReceive: 0,
        })
      }
    }
  }

  /**
   * Start the game
   */
  start(): void {
    this.startNewRound()
  }

  /**
   * Get player info by odusId
   */
  getPlayerInfo(odusId: string): { seatIndex: number; name: string } | null {
    const player = this.players.find((p) => p.odusId === odusId)
    if (!player) return null
    return { seatIndex: player.seatIndex, name: player.name }
  }

  /**
   * Get the current game state filtered for a specific player
   */
  getStateForPlayer(odusId: string | null): PresidentClientGameState {
    return buildPresidentClientState({
      odusId,
      players: this.players,
      phase: this.phase,
      currentPile: this.currentPile,
      currentPlayer: this.currentPlayer,
      consecutivePasses: this.consecutivePasses,
      finishedPlayers: this.finishedPlayers,
      roundNumber: this.roundNumber,
      gameOver: this.gameOver,
      lastPlayerId: this.lastPlayerId,
      superTwosMode: this.superTwosMode,
      stateSeq: this.stateSeq,
      timedOutPlayer: this.timedOutPlayer,
    })
  }

  /**
   * Force resend state to a specific player (for resync requests)
   */
  resendStateToPlayer(odusId: string): void {
    const state = this.getStateForPlayer(odusId)
    this.events.onStateChange(odusId, state)

    const playerIndex = this.players.findIndex((p) => p.odusId === odusId)
    if (playerIndex === -1) return

    const player = this.players[playerIndex]!

    // Resend exchange prompt if player is participating and hasn't confirmed yet
    if (this.phase === PresidentPhase.CardExchange) {
      const exchangeInfo = this.cardExchange.getExchangeInfo(playerIndex)
      if (exchangeInfo && !exchangeInfo.confirmed) {
        const recipient = this.players[exchangeInfo.recipientSeat]
        
        console.log('Resending exchange_prompt to player', playerIndex, player.name)
        this.events.onExchangePrompt(odusId, {
          canSelect: exchangeInfo.canSelect,
          cardsNeeded: exchangeInfo.cardsNeeded,
          preSelectedCardIds: exchangeInfo.preSelectedCards.map(c => c.id),
          recipientName: recipient?.name ?? 'opponent',
        })
        return
      }
    }

    // Resend your_turn if it's this player's turn during Playing phase
    if (this.phase === PresidentPhase.Playing && this.currentPlayer === playerIndex) {
      if (player.isHuman && player.finishOrder === null) {
        this.notifyPlayerTurn(odusId)
      }
    }
  }

  /**
   * Handle playing cards from a player
   */
  handlePlayCards(odusId: string, cardIds: string[]): boolean {
    const playerIndex = this.players.findIndex((p) => p.odusId === odusId)
    if (playerIndex === -1) return false

    if (this.currentPlayer !== playerIndex) {
      return false
    }

    if (this.phase !== PresidentPhase.Playing) {
      return false
    }

    const player = this.players[playerIndex]!

    // Find the cards in hand
    const cards: StandardCard[] = []
    for (const cardId of cardIds) {
      const card = player.hand.find((c) => c.id === cardId)
      if (!card) return false
      cards.push(card)
    }

    // Validate the play - check if it's a valid play against the current pile
    // This allows any cards of the same rank, not just the specific card IDs
    // returned by findValidPlays (which only returns the first N cards of each rank)
    if (!isValidPlay(cards, this.currentPile, this.superTwosMode)) {
      return false
    }

    // Clear turn reminder and timeout status since player acted
    this.clearTurnReminderTimeout()
    if (this.timedOutPlayer === playerIndex) {
      this.timedOutPlayer = null
    }

    this.playCardsInternal(playerIndex, cards)
    return true
  }

  /**
   * Handle a pass from a player
   */
  handlePass(odusId: string): boolean {
    const playerIndex = this.players.findIndex((p) => p.odusId === odusId)
    if (playerIndex === -1) return false

    if (this.currentPlayer !== playerIndex) {
      return false
    }

    if (this.phase !== PresidentPhase.Playing) {
      return false
    }

    // Can't pass if pile is empty (you must play)
    if (this.currentPile.currentRank === null) {
      return false
    }

    // Clear turn reminder and timeout status since player acted
    this.clearTurnReminderTimeout()
    if (this.timedOutPlayer === playerIndex) {
      this.timedOutPlayer = null
    }

    this.passInternal(playerIndex)
    return true
  }

  /**
   * Handle a player confirming their exchange (clicking Exchange button).
   * For President/VP: cardIds are the cards they selected to give.
   * For Scum/ViceScum: cardIds can be empty (their cards are pre-selected).
   */
  handleConfirmExchange(odusId: string, cardIds: string[]): boolean {
    console.log('handleConfirmExchange called:', { odusId, cardIds })
    
    const playerIndex = this.players.findIndex((p) => p.odusId === odusId)
    if (playerIndex === -1) {
      console.log('handleConfirmExchange: player not found')
      return false
    }

    if (this.phase !== PresidentPhase.CardExchange) {
      console.log('handleConfirmExchange: wrong phase', this.phase)
      return false
    }

    if (!this.cardExchange.isParticipating(playerIndex)) {
      console.log('handleConfirmExchange: player not participating in exchange')
      return false
    }

    if (this.cardExchange.hasConfirmed(playerIndex)) {
      console.log('handleConfirmExchange: player already confirmed')
      return false
    }

    console.log('handleConfirmExchange: confirming exchange')
    return this.cardExchange.confirmExchange(playerIndex, cardIds)
  }

  // ---- Internal methods ----

  private startNewRound(): void {
    try {
      console.log('startNewRound called, roundNumber:', this.roundNumber)
      this.phase = PresidentPhase.Dealing

      // Build game state for shared functions
      const gameState = buildPresidentGameState({
        players: this.players,
        phase: this.phase,
        currentPile: this.currentPile,
        currentPlayer: this.currentPlayer,
        consecutivePasses: this.consecutivePasses,
        finishedPlayers: this.finishedPlayers,
        roundNumber: this.roundNumber,
        gameOver: this.gameOver,
        lastPlayerId: this.lastPlayerId,
        superTwosMode: this.superTwosMode,
        awaitingGiveCards: null,
      })

      // Deal cards using shared function
      const dealtState = dealPresidentCards(gameState)
      console.log('Cards dealt, players hand sizes:', dealtState.players.map(p => p.hand.length))

      // Update local state from dealt state
      for (let i = 0; i < this.players.length; i++) {
        const statePlayer = dealtState.players[i]
        if (statePlayer) {
          this.players[i]!.hand = statePlayer.hand
        }
      }

      this.currentPile = createEmptyPile()
      this.consecutivePasses = 0
      this.finishedPlayers = []
      this.lastPlayerId = null

      // Reset each player's finishOrder for the new round (ranks are kept)
      for (const player of this.players) {
        player.finishOrder = null
      }

      // Broadcast state to all players
      this.broadcastState()

      // Check for card exchange (after first round)
      const hasRanks = this.players.some(p => p.rank !== null)
      console.log('hasRanks:', hasRanks, 'player ranks:', this.players.map(p => p.rank))

      if (hasRanks) {
        // Start card exchange - all players confirm simultaneously
        setTimeout(() => {
          try {
            this.cardExchange.startExchange()
          } catch (error) {
            console.error('Error in setTimeout -> startExchange:', error)
          }
        }, 1200)
      } else {
        // First round - find starting player (has 3 of clubs)
        setTimeout(() => {
          this.currentPlayer = this.findStartingPlayer()
          this.phase = PresidentPhase.Playing
          this.broadcastState()
          this.processCurrentTurn()
        }, 1200)
      }
    } catch (error) {
      console.error('Error in startNewRound:', error)
      throw error
    }
  }

  private findStartingPlayer(): number {
    for (const player of this.players) {
      const has3Clubs = player.hand.some(
        card => card.rank === '3' && card.suit === 'clubs'
      )
      if (has3Clubs) {
        return player.seatIndex
      }
    }
    return 0
  }

  private playCardsInternal(playerIndex: number, cards: StandardCard[]): void {
    const player = this.players[playerIndex]!

    // Use shared processPlay function
    const gameState = buildPresidentGameState({
      players: this.players,
      phase: this.phase,
      currentPile: this.currentPile,
      currentPlayer: this.currentPlayer,
      consecutivePasses: this.consecutivePasses,
      finishedPlayers: this.finishedPlayers,
      roundNumber: this.roundNumber,
      gameOver: this.gameOver,
      lastPlayerId: this.lastPlayerId,
      superTwosMode: this.superTwosMode,
      awaitingGiveCards: null,
    })
    const newState = processPlay(gameState, playerIndex, cards)

    const nextState = applyPresidentGameState(this.players, newState)
    this.phase = nextState.phase
    this.currentPile = nextState.currentPile
    this.currentPlayer = nextState.currentPlayer
    this.consecutivePasses = nextState.consecutivePasses
    this.finishedPlayers = nextState.finishedPlayers
    this.gameOver = nextState.gameOver
    this.lastPlayerId = nextState.lastPlayerId

    // Get play type for the broadcast
    const playType = cards.length === 1 ? 'single' :
                     cards.length === 2 ? 'pair' :
                     cards.length === 3 ? 'triple' : 'quad'

    // Broadcast the play
    this.events.onPlayMade(playerIndex, cards, playType as PlayType, player.name)

    // Check if player just finished
    const newPlayer = this.players[playerIndex]!
    if (newPlayer.finishOrder !== null && player.finishOrder === null) {
      // Just finished - will get rank assigned at round end
      this.events.onPlayerFinished(
        playerIndex,
        player.name,
        newPlayer.finishOrder,
        newPlayer.rank ?? (1 as PlayerRank) // Default to President if rank not yet assigned
      )
    }

    // Check for round complete
    if (this.phase === PresidentPhase.RoundComplete) {
      this.handleRoundComplete()
      return
    }

    // Check if joker was played - auto-clear pile since nothing can beat it
    const playedJoker = cards.some(c => c.rank === 'Joker')
    if (playedJoker && this.superTwosMode) {
      this.broadcastState()
      // Brief pause to show the joker, then auto-clear
      setTimeout(() => {
        this.currentPile = createEmptyPile()
        this.currentPlayer = playerIndex // Joker player leads again
        this.consecutivePasses = 0
        this.events.onPileCleared(playerIndex)
        this.broadcastState()
        setTimeout(() => {
          this.processCurrentTurn()
        }, 300)
      }, 800)
      return
    }

    this.broadcastState()
    this.processCurrentTurn()
  }

  private passInternal(playerIndex: number): void {
    const player = this.players[playerIndex]!

    // Use shared processPass function
    const gameState = buildPresidentGameState({
      players: this.players,
      phase: this.phase,
      currentPile: this.currentPile,
      currentPlayer: this.currentPlayer,
      consecutivePasses: this.consecutivePasses,
      finishedPlayers: this.finishedPlayers,
      roundNumber: this.roundNumber,
      gameOver: this.gameOver,
      lastPlayerId: this.lastPlayerId,
      superTwosMode: this.superTwosMode,
      awaitingGiveCards: null,
    })
    const newState = processPass(gameState, playerIndex)

    // Check if pile was cleared
    const pileCleared = newState.currentPile.currentRank === null &&
                        this.currentPile.currentRank !== null

    const nextState = applyPresidentGameState(this.players, newState)
    this.phase = nextState.phase
    this.currentPile = nextState.currentPile
    this.currentPlayer = nextState.currentPlayer
    this.consecutivePasses = nextState.consecutivePasses
    this.finishedPlayers = nextState.finishedPlayers
    this.gameOver = nextState.gameOver
    this.lastPlayerId = nextState.lastPlayerId

    // Broadcast the pass
    this.events.onPassed(playerIndex, player.name)

    if (pileCleared) {
      this.events.onPileCleared(this.currentPlayer)
      // Brief pause when pile clears
      this.broadcastState()
      setTimeout(() => {
        this.processCurrentTurn()
      }, 500)
    } else {
      this.broadcastState()
      this.processCurrentTurn()
    }
  }

  private handleRoundComplete(): void {
    try {
      console.log('handleRoundComplete called, roundNumber:', this.roundNumber)

      // Assign ranks based on finish order
      const gameState = buildPresidentGameState({
        players: this.players,
        phase: this.phase,
        currentPile: this.currentPile,
        currentPlayer: this.currentPlayer,
        consecutivePasses: this.consecutivePasses,
        finishedPlayers: this.finishedPlayers,
        roundNumber: this.roundNumber,
        gameOver: this.gameOver,
        lastPlayerId: this.lastPlayerId,
        superTwosMode: this.superTwosMode,
        awaitingGiveCards: null,
      })
      console.log('Game state built, players finishOrders:', gameState.players.map(p => p.finishOrder))
      const rankedState = assignRanks(gameState)
      console.log('Ranks assigned:', rankedState.players.map(p => ({ id: p.id, rank: p.rank, cardsToGive: p.cardsToGive })))
      const nextState = applyPresidentGameState(this.players, rankedState)
      this.phase = nextState.phase
      this.currentPile = nextState.currentPile
      this.currentPlayer = nextState.currentPlayer
      this.consecutivePasses = nextState.consecutivePasses
      this.finishedPlayers = nextState.finishedPlayers
      this.gameOver = nextState.gameOver
      this.lastPlayerId = nextState.lastPlayerId

    // Build rankings for broadcast
    const rankings = this.players
      .filter(p => p.rank !== null)
      .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
      .map(p => ({
        playerId: p.seatIndex,
        rank: p.rank!,
        name: p.name,
      }))

    this.events.onRoundComplete(rankings, this.roundNumber)
    this.broadcastState()

    // Check if game should end (e.g., after 5 rounds)
    if (this.roundNumber >= 5) {
      this.gameOver = true
      this.phase = PresidentPhase.GameOver

      const finalRankings = rankings.map(r => ({
        playerId: r.playerId,
        name: r.name,
        rank: r.rank,
      }))
      this.events.onGameOver(finalRankings)
      this.broadcastState()
    } else {
      // Start next round after delay
      setTimeout(() => {
        try {
          this.roundNumber++
          this.startNewRound()
        } catch (error) {
          console.error('Error in setTimeout -> startNewRound:', error)
        }
      }, 3000)
    }
    } catch (error) {
      console.error('Error in handleRoundComplete:', error)
      throw error
    }
  }

  private processCurrentTurn(): void {
    const player = this.players[this.currentPlayer]
    if (!player) return

    // Skip if player is finished
    if (player.finishOrder !== null) {
      const gameState = buildPresidentGameState({
        players: this.players,
        phase: this.phase,
        currentPile: this.currentPile,
        currentPlayer: this.currentPlayer,
        consecutivePasses: this.consecutivePasses,
        finishedPlayers: this.finishedPlayers,
        roundNumber: this.roundNumber,
        gameOver: this.gameOver,
        lastPlayerId: this.lastPlayerId,
        superTwosMode: this.superTwosMode,
        awaitingGiveCards: null,
      })
      this.currentPlayer = getNextActivePlayer(gameState, this.currentPlayer)
      this.processCurrentTurn()
      return
    }

    // Human player - notify their turn
    if (player.isHuman && player.odusId) {
      this.notifyPlayerTurn(player.odusId)
      return
    }

    // AI turn - add delay
    setTimeout(() => {
      if (this.phase !== PresidentPhase.Playing) return

      const gameState = buildPresidentGameState({
        players: this.players,
        phase: this.phase,
        currentPile: this.currentPile,
        currentPlayer: this.currentPlayer,
        consecutivePasses: this.consecutivePasses,
        finishedPlayers: this.finishedPlayers,
        roundNumber: this.roundNumber,
        gameOver: this.gameOver,
        lastPlayerId: this.lastPlayerId,
        superTwosMode: this.superTwosMode,
        awaitingGiveCards: null,
      })
      const play = computePresidentAIPlay({
        player,
        currentPile: this.currentPile,
        gameState,
        aiDifficulty: this.aiDifficulty,
      })

      if (play === null) {
        this.passInternal(player.seatIndex)
      } else {
        this.playCardsInternal(player.seatIndex, play)
      }
    }, 800)
  }

  private broadcastState(): void {
    // Increment state sequence number
    this.stateSeq++

    // Send filtered state to each human player
    for (const player of this.players) {
      if (player.isHuman && player.odusId) {
        const state = this.getStateForPlayer(player.odusId)
        this.events.onStateChange(player.odusId, state)
      }
    }
  }

  private notifyPlayerTurn(odusId: string): void {
    const playerIndex = this.players.findIndex((p) => p.odusId === odusId)
    if (playerIndex === -1) return

    const player = this.players[playerIndex]!
    const { validActions, validPlayIds } = buildPresidentTurnOptions({
      hand: player.hand,
      currentPile: this.currentPile,
      superTwosMode: this.superTwosMode,
    })

    // Clear any existing reminder timeout
    this.clearTurnReminderTimeout()

    // Reset timeout tracking for new turn
    this.turnReminderCount = 0
    this.timedOutPlayer = null

    this.events.onYourTurn(odusId, validActions, validPlayIds)

    // Set up a reminder if they don't act
    this.turnReminderTimeout = setTimeout(() => {
      this.sendTurnReminder(odusId, playerIndex)
    }, this.TURN_REMINDER_DELAY)
  }

  private sendTurnReminder(odusId: string, playerIndex: number): void {
    // Verify it's still this player's turn
    if (this.currentPlayer !== playerIndex) {
      return
    }

    const player = this.players[playerIndex]!
    const reminderTick = advanceReminderTick({
      reminderCount: this.turnReminderCount,
      timeoutAfterReminders: this.TIMEOUT_AFTER_REMINDERS,
      timedOutPlayer: this.timedOutPlayer,
      playerIndex,
    })

    this.turnReminderCount = reminderTick.nextReminderCount

    // Check if player has timed out (exceeded reminder limit)
    if (reminderTick.didTimeOut) {
      console.log(`Player ${playerIndex} (${player.name}) has timed out`)
      this.timedOutPlayer = reminderTick.nextTimedOutPlayer
      this.events.onPlayerTimedOut(playerIndex, player.name)
    }

    const { validActions, validPlayIds } = buildPresidentTurnOptions({
      hand: player.hand,
      currentPile: this.currentPile,
      superTwosMode: this.superTwosMode,
    })

    console.log(`Sending turn reminder ${this.turnReminderCount} to player ${playerIndex}`)
    this.events.onTurnReminder(odusId, validActions, validPlayIds)

    // Set up another reminder
    this.turnReminderTimeout = setTimeout(() => {
      this.sendTurnReminder(odusId, playerIndex)
    }, this.TURN_REMINDER_DELAY)
  }

  private clearTurnReminderTimeout(): void {
    if (this.turnReminderTimeout) {
      clearTimeout(this.turnReminderTimeout)
      this.turnReminderTimeout = null
    }
  }

  /**
   * Replace a human player with AI. Used for both voluntary leaves and boots.
   */
  replaceWithAI(playerIndex: number): boolean {
    const player = this.players[playerIndex]
    if (!player || !player.isHuman) {
      return false
    }

    console.log(`Replacing player ${playerIndex} (${player.name}) with AI`)

    // Clear any pending turn timeout
    this.clearTurnReminderTimeout()
    this.turnReminderCount = 0
    if (this.timedOutPlayer === playerIndex) {
      this.timedOutPlayer = null
    }

    // Convert player to AI
    const aiNames = getRandomAINames(1)
    player.isHuman = false
    player.name = aiNames[0] ?? 'Bot'
    player.odusId = null

    // Notify about the replacement
    this.events.onPlayerBooted(playerIndex, player.name)

    // Broadcast updated state
    this.broadcastState()

    // If it was this player's turn, have the AI take over
    if (this.currentPlayer === playerIndex) {
      this.processCurrentTurn()
    }

    return true
  }

  /**
   * Boot a timed-out player and replace with AI
   */
  bootPlayer(playerIndex: number): boolean {
    if (this.timedOutPlayer !== playerIndex) {
      return false
    }
    this.timedOutPlayer = null
    return this.replaceWithAI(playerIndex)
  }

  /**
   * Restore a disconnected player to their seat, replacing the AI that took over.
   */
  restoreHumanPlayer(seatIndex: number, odusId: string, nickname: string): boolean {
    const player = this.players[seatIndex]
    if (!player) {
      console.log(`restoreHumanPlayer: seat ${seatIndex} not found`)
      return false
    }

    // Only restore if the seat is currently AI-controlled
    if (player.isHuman) {
      console.log(`restoreHumanPlayer: seat ${seatIndex} is already human`)
      return false
    }

    console.log(`Restoring player ${nickname} to seat ${seatIndex} (was ${player.name})`)

    // Convert AI back to human
    player.isHuman = true
    player.name = nickname
    player.odusId = odusId

    // Notify about the restoration
    this.events.onPlayerBooted(seatIndex, nickname) // Reuse this event to notify of player change

    // Broadcast updated state
    this.broadcastState()

    return true
  }

  /**
   * Find a player's seat index by their odusId. Returns -1 if not found.
   */
  findPlayerIndexByOdusId(odusId: string): number {
    return this.players.findIndex(p => p.odusId === odusId)
  }

  /**
   * Check if a player is timed out (for external queries)
   */
  isPlayerTimedOut(playerIndex: number): boolean {
    return this.timedOutPlayer === playerIndex
  }

}
