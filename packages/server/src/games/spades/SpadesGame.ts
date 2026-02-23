import type {
  SpadesTrick,
  SpadesBid,
  SpadesTeamScore,
} from '@67cards/shared'
import {
  SpadesPhase,
  Spades,
  getRandomAINames,
  GameTimings,
} from '@67cards/shared'
import type { SpadesClientGameState } from '@67cards/shared'
import type { SpadesGameEvents, SpadesGamePlayer } from './types.js'
import {
  buildSpadesClientState,
  buildSpadesGameState,
} from './state.js'
import { buildSpadesTurnOptions } from './turns.js'
import { computeSpadesAIBid, computeSpadesAIPlay } from './ai.js'
import { advanceReminderTick } from '../shared/reminders.js'

export class SpadesGame {
  public readonly id: string
  private players: SpadesGamePlayer[] = []
  private phase: SpadesPhase = SpadesPhase.Setup
  private currentTrick: SpadesTrick = Spades.createSpadesTrick()
  private completedTricks: SpadesTrick[] = []
  private currentPlayer = 0
  private dealer = 0
  private scores: SpadesTeamScore[] = [
    { teamId: 0, score: 0, bags: 0 },
    { teamId: 1, score: 0, bags: 0 },
  ]
  private roundNumber = 1
  private gameOver = false
  private winner: number | null = null
  private spadesBroken = false
  private bidsComplete = false
  private winScore = 500
  private loseScore = -200
  private events: SpadesGameEvents
  private stateSeq = 0
  private turnReminderTimeout: ReturnType<typeof setTimeout> | null = null
  private readonly TURN_REMINDER_DELAY = 15000
  private turnReminderCount = 0
  private readonly TIMEOUT_AFTER_REMINDERS = 4
  private timedOutPlayer: number | null = null

  constructor(id: string, events: SpadesGameEvents) {
    this.id = id
    this.events = events
  }

  getStateSeq(): number {
    return this.stateSeq
  }

  initializePlayers(humanPlayers: Array<{ odusId: string; name: string; avatar?: string; seatIndex: number }>): void {
    const aiCount = 4 - humanPlayers.length
    const aiNames = getRandomAINames(aiCount)
    let aiNameIndex = 0

    for (let i = 0; i < 4; i++) {
      const humanPlayer = humanPlayers.find((p) => p.seatIndex === i)

      if (humanPlayer) {
        this.players.push({
          odusId: humanPlayer.odusId,
          seatIndex: i,
          name: humanPlayer.name,
          avatar: humanPlayer.avatar,
          isHuman: true,
          hand: [],
          teamId: i % 2,
          bid: null,
          tricksWon: 0,
        })
      } else {
        this.players.push({
          odusId: null,
          seatIndex: i,
          name: aiNames[aiNameIndex++] ?? 'Bot',
          isHuman: false,
          hand: [],
          teamId: i % 2,
          bid: null,
          tricksWon: 0,
        })
      }
    }
  }

  start(): void {
    this.dealer = Math.floor(Math.random() * 4)
    this.startNewRound()
  }

  getPlayerInfo(odusId: string): { seatIndex: number; name: string } | null {
    const player = this.players.find((p) => p.odusId === odusId)
    if (!player) return null
    return { seatIndex: player.seatIndex, name: player.name }
  }

  resendStateToPlayer(odusId: string): void {
    const player = this.players.find(p => p.odusId === odusId)
    if (!player) return

    const state = buildSpadesClientState({
      forPlayerId: odusId,
      players: this.players,
      phase: this.phase,
      currentTrick: this.currentTrick,
      completedTricks: this.completedTricks,
      currentPlayer: this.currentPlayer,
      dealer: this.dealer,
      scores: this.scores,
      roundNumber: this.roundNumber,
      gameOver: this.gameOver,
      winner: this.winner,
      spadesBroken: this.spadesBroken,
      bidsComplete: this.bidsComplete,
      winScore: this.winScore,
      loseScore: this.loseScore,
      stateSeq: this.stateSeq,
      timedOutPlayer: this.timedOutPlayer,
    })
    this.events.onStateChange(odusId, state)

    if (player.seatIndex === this.currentPlayer && !this.gameOver) {
      const actions = buildSpadesTurnOptions({
        phase: this.phase,
        hand: player.hand,
        currentTrick: this.currentTrick,
        spadesBroken: this.spadesBroken,
      })
      this.events.onYourTurn(odusId, actions.actions, actions.cards)
    }
  }

  handleBid(odusId: string, bid: SpadesBid): boolean {
    if (this.phase !== SpadesPhase.Bidding) return false
    const playerIndex = this.players.findIndex((p) => p.odusId === odusId)
    this.clearTurnTimer()
    if (playerIndex !== -1 && this.timedOutPlayer === playerIndex) {
      this.timedOutPlayer = null
    }
    return this.makeBid(odusId, bid)
  }

  handlePlayCard(odusId: string, cardId: string): boolean {
    if (this.phase !== SpadesPhase.Playing) return false
    const playerIndex = this.players.findIndex((p) => p.odusId === odusId)
    this.clearTurnTimer()
    if (playerIndex !== -1 && this.timedOutPlayer === playerIndex) {
      this.timedOutPlayer = null
    }
    return this.playCard(odusId, cardId)
  }

  replaceWithAI(playerIndex: number): boolean {
    const player = this.players[playerIndex]
    if (!player || !player.isHuman) return false

    this.clearTurnTimer()
    this.turnReminderCount = 0
    if (this.timedOutPlayer === playerIndex) {
      this.timedOutPlayer = null
    }

    const aiNames = getRandomAINames(1)
    player.isHuman = false
    player.name = aiNames[0] ?? 'Bot'
    player.odusId = null
    player.avatar = undefined  // Clear avatar for AI players

    this.events.onPlayerBooted(playerIndex, player.name)
    this.broadcastState()

    if (this.currentPlayer === playerIndex && !this.gameOver) {
      this.scheduleAITurn()
    }

    return true
  }

  bootPlayer(playerIndex: number): boolean {
    if (this.timedOutPlayer !== playerIndex) {
      return false
    }
    this.timedOutPlayer = null
    return this.replaceWithAI(playerIndex)
  }

  /**
   * Mark a human player as disconnected (connection lost).
   */
  markPlayerDisconnected(playerIndex: number): boolean {
    const player = this.players[playerIndex]
    if (!player || !player.isHuman || player.disconnected) return false

    console.log(`Player ${player.name} (seat ${playerIndex}) disconnected`)
    player.disconnected = true

    if (this.currentPlayer === playerIndex) {
      this.clearTurnTimer()
    }

    this.events.onPlayerDisconnected?.(playerIndex, player.name)
    this.broadcastState()
    return true
  }

  /**
   * Mark a disconnected player as reconnected.
   */
  markPlayerReconnected(playerIndex: number): boolean {
    const player = this.players[playerIndex]
    if (!player || !player.disconnected) return false

    console.log(`Player ${player.name} (seat ${playerIndex}) reconnected`)
    player.disconnected = false

    this.events.onPlayerReconnected?.(playerIndex, player.name)
    this.broadcastState()
    return true
  }

  /**
   * Boot a disconnected player (convert to AI).
   */
  bootDisconnectedPlayer(playerIndex: number): boolean {
    const player = this.players[playerIndex]
    if (!player || !player.disconnected) return false

    console.log(`Booting disconnected player ${player.name} (seat ${playerIndex})`)
    player.disconnected = false
    return this.replaceWithAI(playerIndex)
  }

  restoreHumanPlayer(seatIndex: number, odusId: string, nickname: string): boolean {
    const player = this.players[seatIndex]
    if (!player) return false
    if (player.isHuman) return false

    player.isHuman = true
    player.name = nickname
    player.odusId = odusId

    this.events.onPlayerBooted(seatIndex, nickname)
    this.broadcastState()
    return true
  }

  findPlayerIndexByOdusId(odusId: string): number {
    return this.players.findIndex(p => p.odusId === odusId)
  }

  private startNewRound(): void {
    // Deal cards
    const gameState = Spades.createSpadesGame(
      this.players.map(p => p.name),
      0,
      this.winScore,
      this.loseScore
    )
    const dealtState = Spades.dealSpadesCards({
      ...gameState,
      dealer: this.dealer,
      scores: this.scores,
      roundNumber: this.roundNumber,
    })

    // Update player hands
    for (let i = 0; i < 4; i++) {
      this.players[i]!.hand = dealtState.players[i]?.hand ?? []
      this.players[i]!.bid = null
      this.players[i]!.tricksWon = 0
    }

    this.phase = SpadesPhase.Dealing
    this.currentTrick = Spades.createSpadesTrick()
    this.completedTricks = []
    this.currentPlayer = (this.dealer + 1) % 4
    this.spadesBroken = false
    this.bidsComplete = false

    this.broadcastState()

    // Start bidding after deal animation
    setTimeout(() => {
      this.phase = SpadesPhase.Bidding
      this.broadcastState()
      this.scheduleAITurn()
    }, GameTimings.roundPauseMs)
  }

  makeBid(odusId: string, bid: SpadesBid): boolean {
    const player = this.players.find((p) => p.odusId === odusId)
    if (!player) return false
    if (player.seatIndex !== this.currentPlayer) return false
    if (this.phase !== SpadesPhase.Bidding) return false
    if (player.bid !== null) return false

    // Validate bid
    if (!Spades.isValidBid(bid, player.hand)) return false

    player.bid = bid
    this.events.onBidMade(player.seatIndex, bid, player.name)

    // Check if all players have bid
    const allBid = this.players.every(p => p.bid !== null)
    if (allBid) {
      this.bidsComplete = true
      this.phase = SpadesPhase.Playing
      this.currentPlayer = (this.dealer + 1) % 4
    } else {
      this.currentPlayer = (this.currentPlayer + 1) % 4
    }

    this.broadcastState()
    this.scheduleAITurn()
    return true
  }

  playCard(odusId: string, cardId: string): boolean {
    const player = this.players.find((p) => p.odusId === odusId)
    if (!player) return false
    if (player.seatIndex !== this.currentPlayer) return false
    if (this.phase !== SpadesPhase.Playing) return false

    const card = player.hand.find(c => c.id === cardId)
    if (!card) return false

    // Verify legal play
    const legalPlays = Spades.getLegalPlays(player.hand, this.currentTrick, this.spadesBroken)
    if (!legalPlays.some(c => c.id === cardId)) return false

    // Remove card from hand
    player.hand = player.hand.filter(c => c.id !== cardId)

    // Add to trick
    this.currentTrick.cards.push({ card, playerId: player.seatIndex })
    if (this.currentTrick.cards.length === 1) {
      this.currentTrick.leadingSuit = card.suit
    }

    // Break spades if spade was played
    if (card.suit === 'spades') {
      this.spadesBroken = true
    }

    this.events.onCardPlayed(player.seatIndex, card, player.name)

    // Check if trick complete
    if (this.currentTrick.cards.length === 4) {
      const winnerId = Spades.determineTrickWinner(this.currentTrick)
      this.currentTrick.winnerId = winnerId
      this.completedTricks.push(this.currentTrick)

      // Update winner's tricks won
      const winner = this.players[winnerId]
      if (winner) winner.tricksWon++

      this.events.onTrickComplete(
        winnerId,
        this.players[winnerId]?.name ?? '',
        this.currentTrick.cards.map(c => ({ playerId: c.playerId, card: c.card }))
      )

      this.phase = SpadesPhase.TrickComplete

      // Check if round complete
      if (this.completedTricks.length === 13) {
        setTimeout(() => this.completeRound(), GameTimings.roundPauseMs)
      } else {
        // Continue playing - shorter pause than round end
        setTimeout(() => {
          this.currentTrick = Spades.createSpadesTrick()
          this.currentPlayer = winnerId
          this.phase = SpadesPhase.Playing
          this.broadcastState()
          this.scheduleAITurn()
        }, GameTimings.trickPauseMs)
      }
    } else {
      this.currentPlayer = (this.currentPlayer + 1) % 4
      this.scheduleAITurn()
    }

    this.broadcastState()
    return true
  }

  private completeRound(): void {
    // Calculate scores
    const gameState = buildSpadesGameState({
      players: this.players,
      phase: this.phase,
      currentTrick: this.currentTrick,
      completedTricks: this.completedTricks,
      currentPlayer: this.currentPlayer,
      dealer: this.dealer,
      scores: this.scores,
      roundNumber: this.roundNumber,
      gameOver: this.gameOver,
      winner: this.winner,
      spadesBroken: this.spadesBroken,
      bidsComplete: this.bidsComplete,
      winScore: this.winScore,
      loseScore: this.loseScore,
    })
    const completedState = Spades.completeRound(gameState)

    this.scores = completedState.scores
    this.gameOver = completedState.gameOver
    this.winner = completedState.winner

    const teamTricks: [number, number] = [
      this.players.filter(p => p.teamId === 0).reduce((s, p) => s + p.tricksWon, 0),
      this.players.filter(p => p.teamId === 1).reduce((s, p) => s + p.tricksWon, 0),
    ]

    this.events.onRoundComplete(this.scores, teamTricks)

    if (this.gameOver) {
      this.phase = SpadesPhase.GameOver
      this.events.onGameOver(this.winner ?? 0, this.scores)
    } else {
      this.phase = SpadesPhase.RoundComplete
      // Start new round after delay
      setTimeout(() => {
        this.dealer = (this.dealer + 1) % 4
        this.roundNumber++
        this.startNewRound()
      }, 3000)
    }

    this.broadcastState()
  }

  private scheduleAITurn(): void {
    this.clearTurnTimer()

    const currentPlayerObj = this.players[this.currentPlayer]
    if (!currentPlayerObj) return

    if (currentPlayerObj.isHuman) {
      // Start turn reminder timer for human
      this.scheduleTurnReminder()
      return
    }

    // AI turn
    setTimeout(() => {
      if (this.phase === SpadesPhase.Bidding) {
        this.processAIBid()
      } else if (this.phase === SpadesPhase.Playing) {
        this.processAIPlay()
      }
    }, GameTimings.aiThinkMs)
  }

  private processAIBid(): void {
    const player = this.players[this.currentPlayer]
    if (!player || player.isHuman) return

    const gameState = buildSpadesGameState({
      players: this.players,
      phase: this.phase,
      currentTrick: this.currentTrick,
      completedTricks: this.completedTricks,
      currentPlayer: this.currentPlayer,
      dealer: this.dealer,
      scores: this.scores,
      roundNumber: this.roundNumber,
      gameOver: this.gameOver,
      winner: this.winner,
      spadesBroken: this.spadesBroken,
      bidsComplete: this.bidsComplete,
      winScore: this.winScore,
      loseScore: this.loseScore,
    })
    const bid = computeSpadesAIBid({ player, gameState })

    player.bid = bid
    this.events.onBidMade(player.seatIndex, bid, player.name)

    const allBid = this.players.every(p => p.bid !== null)
    if (allBid) {
      this.bidsComplete = true
      this.phase = SpadesPhase.Playing
      this.currentPlayer = (this.dealer + 1) % 4
    } else {
      this.currentPlayer = (this.currentPlayer + 1) % 4
    }

    this.broadcastState()
    this.scheduleAITurn()
  }

  private processAIPlay(): void {
    const player = this.players[this.currentPlayer]
    if (!player || player.isHuman) return

    const gameState = buildSpadesGameState({
      players: this.players,
      phase: this.phase,
      currentTrick: this.currentTrick,
      completedTricks: this.completedTricks,
      currentPlayer: this.currentPlayer,
      dealer: this.dealer,
      scores: this.scores,
      roundNumber: this.roundNumber,
      gameOver: this.gameOver,
      winner: this.winner,
      spadesBroken: this.spadesBroken,
      bidsComplete: this.bidsComplete,
      winScore: this.winScore,
      loseScore: this.loseScore,
    })
    const card = computeSpadesAIPlay({ player, gameState })

    // Play the card
    player.hand = player.hand.filter(c => c.id !== card.id)
    this.currentTrick.cards.push({ card, playerId: player.seatIndex })
    if (this.currentTrick.cards.length === 1) {
      this.currentTrick.leadingSuit = card.suit
    }

    if (card.suit === 'spades') {
      this.spadesBroken = true
    }

    this.events.onCardPlayed(player.seatIndex, card, player.name)

    if (this.currentTrick.cards.length === 4) {
      const winnerId = Spades.determineTrickWinner(this.currentTrick)
      this.currentTrick.winnerId = winnerId
      this.completedTricks.push(this.currentTrick)

      const winner = this.players[winnerId]
      if (winner) winner.tricksWon++

      this.events.onTrickComplete(
        winnerId,
        this.players[winnerId]?.name ?? '',
        this.currentTrick.cards.map(c => ({ playerId: c.playerId, card: c.card }))
      )

      this.phase = SpadesPhase.TrickComplete

      if (this.completedTricks.length === 13) {
        setTimeout(() => this.completeRound(), GameTimings.roundPauseMs)
      } else {
        setTimeout(() => {
          this.currentTrick = Spades.createSpadesTrick()
          this.currentPlayer = winnerId
          this.phase = SpadesPhase.Playing
          this.broadcastState()
          this.scheduleAITurn()
        }, GameTimings.roundPauseMs)
      }
    } else {
      this.currentPlayer = (this.currentPlayer + 1) % 4
      this.scheduleAITurn()
    }

    this.broadcastState()
  }

  private scheduleTurnReminder(): void {
    this.turnReminderTimeout = setTimeout(() => {
      const player = this.players[this.currentPlayer]
      if (!player?.odusId) return

      const reminderTick = advanceReminderTick({
        reminderCount: this.turnReminderCount,
        timeoutAfterReminders: this.TIMEOUT_AFTER_REMINDERS,
        timedOutPlayer: this.timedOutPlayer,
        playerIndex: this.currentPlayer,
      })

      this.turnReminderCount = reminderTick.nextReminderCount

      if (reminderTick.didTimeOut) {
        this.timedOutPlayer = reminderTick.nextTimedOutPlayer
        this.events.onPlayerTimedOut(this.currentPlayer, player.name)
        this.broadcastState()
        return
      }

      const actions = buildSpadesTurnOptions({
        phase: this.phase,
        hand: player.hand,
        currentTrick: this.currentTrick,
        spadesBroken: this.spadesBroken,
      })
      this.events.onTurnReminder(player.odusId, actions.actions, actions.cards)
      this.scheduleTurnReminder()
    }, this.TURN_REMINDER_DELAY)
  }

  private clearTurnTimer(): void {
    if (this.turnReminderTimeout) {
      clearTimeout(this.turnReminderTimeout)
      this.turnReminderTimeout = null
    }
    this.turnReminderCount = 0
  }

  private broadcastState(): void {
    // Increment state sequence once before broadcasting to all players
    this.stateSeq++

    // Broadcast to each human player with their hand visible
    for (const player of this.players) {
      if (player.odusId) {
        const state = buildSpadesClientState({
          forPlayerId: player.odusId,
          players: this.players,
          phase: this.phase,
          currentTrick: this.currentTrick,
          completedTricks: this.completedTricks,
          currentPlayer: this.currentPlayer,
          dealer: this.dealer,
          scores: this.scores,
          roundNumber: this.roundNumber,
          gameOver: this.gameOver,
          winner: this.winner,
          spadesBroken: this.spadesBroken,
          bidsComplete: this.bidsComplete,
          winScore: this.winScore,
          loseScore: this.loseScore,
          stateSeq: this.stateSeq,
          timedOutPlayer: this.timedOutPlayer,
        })
        this.events.onStateChange(player.odusId, state)

        // Notify if it's their turn
        if (player.seatIndex === this.currentPlayer && !this.gameOver) {
          const actions = buildSpadesTurnOptions({
            phase: this.phase,
            hand: player.hand,
            currentTrick: this.currentTrick,
            spadesBroken: this.spadesBroken,
          })
          this.events.onYourTurn(player.odusId, actions.actions, actions.cards)
        }
      }
    }

    // Broadcast spectator view (no hands visible)
    this.events.onStateChange(null, buildSpadesClientState({
      forPlayerId: null,
      players: this.players,
      phase: this.phase,
      currentTrick: this.currentTrick,
      completedTricks: this.completedTricks,
      currentPlayer: this.currentPlayer,
      dealer: this.dealer,
      scores: this.scores,
      roundNumber: this.roundNumber,
      gameOver: this.gameOver,
      winner: this.winner,
      spadesBroken: this.spadesBroken,
      bidsComplete: this.bidsComplete,
      winScore: this.winScore,
      loseScore: this.loseScore,
      stateSeq: this.stateSeq,
      timedOutPlayer: this.timedOutPlayer,
    }))
  }

  // Public methods for game management
  resetForNewGame(): void {
    this.clearTurnTimer()
    this.scores = [
      { teamId: 0, score: 0, bags: 0 },
      { teamId: 1, score: 0, bags: 0 },
    ]
    this.roundNumber = 1
    this.gameOver = false
    this.winner = null
    this.timedOutPlayer = null
    this.start()
  }

  /**
   * Cleanup all timers and resources before game deletion.
   * Must be called before removing the game from the registry.
   */
  cleanup(): void {
    this.clearTurnTimer()
    console.log(`SpadesGame ${this.id} cleanup: cleared all timers`)
  }
}
