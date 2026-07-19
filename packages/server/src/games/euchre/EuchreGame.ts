import type {
  Card,
  Bid,
  Suit,
  Round,
  TeamScore,
  ClientGameState,
  ChatMode,
  EuchreGameState,
  EuchreRules,
} from '@67cards/shared'
import {
  GamePhase,
  BidAction,
  chooseDealerDiscard,
  GameTracker,
  createEuchreRemarkEngine,
  type EuchreRemarkState,
  type RemarkMode,
  applyBid,
  applyDealerDiscard,
  applyPlay,
  continueAfterTrick,
  dealRound,
  startBiddingRound1,
  calculateRoundScore,
  DEFAULT_EUCHRE_RULES,
} from '@67cards/shared'
import { getRandomAINames, GameTimings } from '@67cards/shared'
import type { GameEvents, GameOptions, GamePlayer } from './types.js'
import { buildEuchreClientState } from './state.js'
import { buildEuchreTurnOptions } from './turns.js'
import { computeEuchreAIAction } from './ai.js'
import { advanceReminderTick } from '../shared/reminders.js'

export class EuchreGame {
  public readonly id: string
  private players: GamePlayer[] = []
  private currentRound: Round | null = null
  private scores: TeamScore[] = [
    { teamId: 0, score: 0 },
    { teamId: 1, score: 0 },
  ]
  private gameOver = false
  private winner: number | null = null
  private phase: GamePhase = GamePhase.Setup
  private currentDealer = 0
  private passCount = 0
  private biddingStartPlayer = 0
  private rules: EuchreRules = { ...DEFAULT_EUCHRE_RULES }
  private events: GameEvents
  private stateSeq = 0 // Incrementing sequence number for drift detection
  private turnReminderTimeout: ReturnType<typeof setTimeout> | null = null
  private readonly TURN_REMINDER_DELAY = 15000 // 15 seconds
  private turnReminderCount = 0 // Count reminders sent to current player
  private readonly TIMEOUT_AFTER_REMINDERS = 4 // Mark as timed out after 4 reminders (60 seconds)
  private timedOutPlayer: number | null = null // Seat index of player who timed out
  private readonly aiDifficulty: 'easy' | 'hard'
  private readonly aiTracker: GameTracker | null
  
  // Remarks engine (holds previous state snapshot + cooldown per game)
  private remarkEngine = createEuchreRemarkEngine()
  private chatMode: ChatMode = 'clean'

  constructor(id: string, events: GameEvents, options: GameOptions = {}) {
    this.id = id
    this.events = events
    this.aiDifficulty = options.aiDifficulty === 'hard' ? 'hard' : 'easy'
    this.aiTracker = this.aiDifficulty === 'hard' ? new GameTracker() : null
    this.chatMode = options.chatMode ?? 'clean'
    this.rules = {
      stickTheDealer: options.stickTheDealer ?? false,
      canadianLoner: options.canadianLoner ?? false,
    }
  }

  getStateSeq(): number {
    return this.stateSeq
  }

  isGameOver(): boolean {
    return this.gameOver
  }

  /**
   * Initialize the game with players
   */
  initializePlayers(humanPlayers: Array<{ odusId: string; name: string; avatar?: string; seatIndex: number }>): void {
    // Count how many AI players we need
    const aiCount = 4 - humanPlayers.length
    const aiNames = getRandomAINames(aiCount)
    let aiNameIndex = 0

    // Create all 4 players (fill empty seats with AI)
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
        })
      } else {
        this.players.push({
          odusId: null,
          seatIndex: i,
          name: aiNames[aiNameIndex++] ?? 'Tron',
          isHuman: false,
          hand: [],
          teamId: i % 2,
        })
      }
    }
  }

  /**
   * Start the game
   */
  start(): void {
    // Random starting dealer (0-3)
    this.currentDealer = Math.floor(Math.random() * 4)
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
  getStateForPlayer(odusId: string | null): ClientGameState {
    return buildEuchreClientState({
      odusId,
      players: this.players,
      currentRound: this.currentRound,
      phase: this.phase,
      scores: this.scores,
      currentDealer: this.currentDealer,
      gameOver: this.gameOver,
      winner: this.winner,
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

    // Also resend your_turn if it's this player's turn
    const playerIndex = this.players.findIndex((p) => p.odusId === odusId)
    if (playerIndex !== -1 && this.currentRound?.currentPlayer === playerIndex) {
      const player = this.players[playerIndex]!
      if (player.isHuman) {
        this.notifyPlayerTurn(odusId)
      }
    }
  }

  /**
   * Handle a bid from a player
   */
  handleBid(odusId: string, action: BidAction, suit?: Suit, goingAlone?: boolean): boolean {
    const playerIndex = this.players.findIndex((p) => p.odusId === odusId)
    if (playerIndex === -1) return false

    if (!this.currentRound || this.currentRound.currentPlayer !== playerIndex) {
      return false
    }

    if (this.phase !== GamePhase.BiddingRound1 && this.phase !== GamePhase.BiddingRound2) {
      return false
    }

    // Clear turn reminder and timeout status since player acted
    this.clearTurnReminderTimeout()
    if (this.timedOutPlayer === playerIndex) {
      this.timedOutPlayer = null
    }

    const bid: Bid = {
      playerId: playerIndex,
      action,
      suit,
      goingAlone,
    }

    return this.processBidInternal(bid)
  }

  /**
   * Handle a card play from a player
   */
  handlePlayCard(odusId: string, cardId: string): boolean {
    const playerIndex = this.players.findIndex((p) => p.odusId === odusId)
    if (playerIndex === -1) return false

    if (!this.currentRound || this.currentRound.currentPlayer !== playerIndex) {
      return false
    }

    if (this.phase !== GamePhase.Playing) {
      return false
    }

    const player = this.players[playerIndex]!
    const card = player.hand.find((c) => c.id === cardId)
    if (!card) return false

    // Clear turn reminder and timeout status since player acted
    this.clearTurnReminderTimeout()
    if (this.timedOutPlayer === playerIndex) {
      this.timedOutPlayer = null
    }

    // Legality enforced by pure applyPlay (same-ref reject)
    return this.playCardInternal(playerIndex, card)
  }

  /**
   * Handle dealer discard
   */
  handleDealerDiscard(odusId: string, cardId: string): boolean {
    const playerIndex = this.players.findIndex((p) => p.odusId === odusId)
    if (playerIndex === -1) return false

    if (this.phase !== GamePhase.DealerDiscard) return false
    if (this.currentRound?.currentPlayer !== playerIndex) return false

    this.clearTurnReminderTimeout()
    if (this.timedOutPlayer === playerIndex) {
      this.timedOutPlayer = null
    }

    const prev = this.toPureState()
    const next = applyDealerDiscard(prev, cardId)
    if (next === prev) return false

    this.applyPureState(next)
    this.broadcastState()
    this.processCurrentTurn()
    return true
  }

  // ---- Pure state bridge ----

  private toPureState(): EuchreGameState {
    return {
      players: this.players.map(p => ({
        id: p.seatIndex,
        name: p.name,
        hand: p.hand,
        isHuman: p.isHuman,
        teamId: p.teamId,
      })),
      currentRound: this.currentRound,
      scores: this.scores,
      gameOver: this.gameOver,
      winner: this.winner,
      phase: this.phase,
      currentDealer: this.currentDealer,
      passCount: this.passCount,
      biddingStartPlayer: this.biddingStartPlayer,
      rules: this.rules,
    }
  }

  private applyPureState(next: EuchreGameState): void {
    for (let i = 0; i < 4; i++) {
      const pure = next.players[i]
      const host = this.players[i]
      if (!pure || !host) continue
      host.hand = pure.hand
    }
    this.currentRound = next.currentRound
    this.scores = next.scores
    this.gameOver = next.gameOver
    this.winner = next.winner
    this.phase = next.phase
    this.currentDealer = next.currentDealer
    this.passCount = next.passCount
    this.biddingStartPlayer = next.biddingStartPlayer
  }

  // ---- Internal methods ----

  private startNewRound(): void {
    if (this.aiTracker) {
      this.aiTracker.reset()
    }

    const next = dealRound(this.toPureState())
    this.applyPureState(next)
    this.broadcastState()

    setTimeout(() => {
      const bidding = startBiddingRound1(this.toPureState())
      this.applyPureState(bidding)
      this.broadcastState()
      this.processCurrentTurn()
    }, GameTimings.phasePauseMs)
  }

  private processBidInternal(bid: Bid): boolean {
    if (!this.currentRound) return false

    const player = this.players[bid.playerId]!
    const prev = this.toPureState()
    const next = applyBid(prev, bid)
    if (next === prev) return false

    this.events.onBidMade(bid.playerId, bid, player.name)
    this.applyPureState(next)

    if (next.currentRound?.trump && this.aiTracker) {
      this.aiTracker.setTrump(next.currentRound.trump.suit)
    }

    // Redeal path (R2 all-pass): pure already dealt
    if (next.phase === GamePhase.Dealing) {
      this.broadcastState()
      setTimeout(() => {
        const bidding = startBiddingRound1(this.toPureState())
        this.applyPureState(bidding)
        this.broadcastState()
        this.processCurrentTurn()
      }, GameTimings.phasePauseMs)
      return true
    }

    // AI dealer discard
    if (next.phase === GamePhase.DealerDiscard && next.currentRound?.trump) {
      const dealerSeat = next.currentRound.dealer
      const dealer = this.players[dealerSeat]
      if (dealer && !dealer.isHuman) {
        const cardToDiscard = chooseDealerDiscard(dealer.hand, next.currentRound.trump.suit)
        const beforeDiscard = this.toPureState()
        const afterDiscard = applyDealerDiscard(beforeDiscard, cardToDiscard.id)
        if (afterDiscard !== beforeDiscard) {
          this.applyPureState(afterDiscard)
        }
      }
    }

    this.broadcastState()
    this.processCurrentTurn()
    return true
  }

  private playCardInternal(playerIndex: number, card: Card): boolean {
    if (!this.currentRound || !this.currentRound.trump) return false

    const player = this.players[playerIndex]!
    const prev = this.toPureState()
    const prevTrickCount = prev.currentRound?.tricks.length ?? 0
    const next = applyPlay(prev, playerIndex, card.id)
    if (next === prev) return false

    this.applyPureState(next)
    this.events.onCardPlayed(playerIndex, card, player.name)

    const trickJustCompleted =
      (next.currentRound?.tricks.length ?? 0) > prevTrickCount

    if (trickJustCompleted && next.currentRound) {
      const completedTrick = next.currentRound.tricks[next.currentRound.tricks.length - 1]!
      if (this.aiTracker) {
        this.aiTracker.recordTrick(completedTrick)
      }
      const winnerSeat = completedTrick.winnerId!
      this.events.onTrickComplete(
        winnerSeat,
        this.players[winnerSeat]?.name ?? '',
        completedTrick.cards.map(pc => ({ playerId: pc.playerId, card: pc.card }))
      )

      this.broadcastState()

      if (
        next.phase === GamePhase.RoundComplete ||
        next.phase === GamePhase.GameOver ||
        (next.currentRound.tricks.length >= 5)
      ) {
        setTimeout(() => this.emitRoundCompleteEvents(), GameTimings.roundPauseMs)
        return true
      }

      setTimeout(() => {
        const before = this.toPureState()
        const continued = continueAfterTrick(before)
        if (continued !== before) {
          this.applyPureState(continued)
        }
        this.broadcastState()
        this.processCurrentTurn()
      }, GameTimings.trickPauseMs)
      return true
    }

    this.broadcastState()
    this.processCurrentTurn()
    return true
  }

  /** Scores already applied by pure applyPlay → finishRound */
  private emitRoundCompleteEvents(): void {
    if (!this.currentRound?.trump) return

    const roundScore = calculateRoundScore(this.currentRound.tricks, this.currentRound.trump)
    let team0Tricks = 0
    let team1Tricks = 0
    for (const trick of this.currentRound.tricks) {
      if (trick.winnerId !== null) {
        if (trick.winnerId % 2 === 0) team0Tricks++
        else team1Tricks++
      }
    }

    this.events.onRoundComplete(
      this.scores,
      [team0Tricks, team1Tricks],
      [roundScore.team0Points, roundScore.team1Points]
    )
    this.broadcastState()

    if (this.gameOver) {
      this.events.onGameOver(this.winner!, this.scores)
      this.broadcastState()
    } else {
      setTimeout(() => {
        this.currentDealer = (this.currentDealer + 1) % 4
        this.startNewRound()
      }, 3000)
    }
  }

  private processCurrentTurn(): void {
    if (!this.currentRound) return

    const current = this.currentRound.currentPlayer
    const player = this.players[current]!

    // Human player - notify their turn
    if (player.isHuman && player.odusId) {
      this.notifyPlayerTurn(player.odusId)
      return
    }

    // AI turn - add delay for realism
    setTimeout(() => {
      if (!this.currentRound) return

      const action = computeEuchreAIAction({
        phase: this.phase,
        currentRound: this.currentRound,
        player,
        aiDifficulty: this.aiDifficulty,
        aiTracker: this.aiTracker,
      })

      if (action.type === 'bid') {
        this.processBidInternal(action.bid)
      } else if (action.type === 'play') {
        this.playCardInternal(player.seatIndex, action.card)
      }
    }, GameTimings.aiThinkMs)
  }

  private broadcastState(): void {
    // Capture state BEFORE incrementing seq for remarks engine
    const remarkStateSnapshot = this.getRemarkStateSnapshot()
    
    // Increment state sequence number
    this.stateSeq++

    // Send filtered state to each human player
    for (const player of this.players) {
      if (player.isHuman && player.odusId) {
        const state = this.getStateForPlayer(player.odusId)
        this.events.onStateChange(player.odusId, state)
      }
    }
    
    // Process bot remarks after state broadcast
    this.processBotChat(remarkStateSnapshot)
  }
  
  private getRemarkStateSnapshot(): EuchreRemarkState {
    return {
      phase: this.phase,
      scores: this.scores.map(s => ({ teamId: s.teamId, score: s.score })),
      currentRound: this.currentRound ? {
        trump: this.currentRound.trump ? {
          suit: this.currentRound.trump.suit,
          calledBy: this.currentRound.trump.calledBy,
        } : null,
        goingAlone: this.currentRound.goingAlone,
        dealer: this.currentRound.dealer,
      } : null,
      gameOver: this.gameOver,
      winner: this.winner,
    }
  }
  
  private getPlayersForChat() {
    return this.players.map(p => ({
      id: p.seatIndex,
      name: p.name,
      isHuman: p.isHuman,
      teamId: p.teamId,
    }))
  }
  
  private processBotChat(newRemarkState: EuchreRemarkState): void {
    // Only process if we have the event handler
    if (!this.events.onBotChat) return
    
    // Map ChatMode to RemarkMode
    const remarkMode: RemarkMode = this.chatMode === 'unhinged' ? 'spicy' : 'mild'
    
    const remark = this.remarkEngine.process(
      newRemarkState,
      this.getPlayersForChat(),
      remarkMode
    )

    if (remark) {
      this.events.onBotChat(remark.playerId, remark.playerName, remark.text)
    }
  }

  private notifyPlayerTurn(odusId: string): void {
    const playerIndex = this.players.findIndex((p) => p.odusId === odusId)
    if (playerIndex === -1) return

    const player = this.players[playerIndex]!
    const { validActions, validCards } = buildEuchreTurnOptions({
      playerIndex,
      player,
      phase: this.phase,
      currentDealer: this.currentDealer,
      passCount: this.passCount,
      currentRound: this.currentRound,
    })

    // Clear any existing reminder timeout
    this.clearTurnReminderTimeout()

    // Reset timeout tracking for new turn
    this.turnReminderCount = 0
    this.timedOutPlayer = null

    this.events.onYourTurn(odusId, validActions, validCards)

    // Set up a reminder if they don't act
    this.turnReminderTimeout = setTimeout(() => {
      this.sendTurnReminder(odusId, playerIndex)
    }, this.TURN_REMINDER_DELAY)
  }

  private sendTurnReminder(odusId: string, playerIndex: number): void {
    // Verify it's still this player's turn
    if (!this.currentRound || this.currentRound.currentPlayer !== playerIndex) {
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
      // Continue sending reminders but player is now marked as timed out
    }

    const { validActions, validCards } = buildEuchreTurnOptions({
      playerIndex,
      player,
      phase: this.phase,
      currentDealer: this.currentDealer,
      passCount: this.passCount,
      currentRound: this.currentRound,
    })
    console.log(`Sending turn reminder ${this.turnReminderCount} to player ${playerIndex}`)
    this.events.onTurnReminder(odusId, validActions, validCards)

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
   * Cleanup all timers and resources before game deletion.
   * Must be called before removing the game from the registry.
   */
  cleanup(): void {
    this.clearTurnReminderTimeout()
    console.log(`EuchreGame ${this.id} cleanup: cleared all timers`)
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
    player.avatar = undefined  // Clear avatar for AI players

    // Notify about the replacement
    this.events.onPlayerBooted(playerIndex, player.name)

    // Broadcast updated state
    this.broadcastState()

    // If it was this player's turn, have the AI take over
    if (this.currentRound && this.currentRound.currentPlayer === playerIndex) {
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
   * Mark a human player as disconnected (connection lost).
   * Player stays human, game pauses if it's their turn.
   */
  markPlayerDisconnected(playerIndex: number): boolean {
    const player = this.players[playerIndex]
    if (!player || !player.isHuman || player.disconnected) {
      return false
    }

    console.log(`Player ${player.name} (seat ${playerIndex}) disconnected`)
    player.disconnected = true

    // Pause turn timer if it's their turn
    if (this.currentRound?.currentPlayer === playerIndex) {
      this.clearTurnReminderTimeout()
    }

    this.events.onPlayerDisconnected?.(playerIndex, player.name)
    this.broadcastState()
    return true
  }

  /**
   * Mark a disconnected player as reconnected.
   * Resumes game if it was their turn.
   */
  markPlayerReconnected(playerIndex: number): boolean {
    const player = this.players[playerIndex]
    if (!player || !player.disconnected) {
      return false
    }

    console.log(`Player ${player.name} (seat ${playerIndex}) reconnected`)
    player.disconnected = false

    this.events.onPlayerReconnected?.(playerIndex, player.name)
    this.broadcastState()

    // If it's their turn, resend your_turn to restart the timer
    // (resendStateToPlayer in lobby handler handles this)

    return true
  }

  /**
   * Boot a disconnected player (convert to AI).
   * Other players can call this to continue the game.
   */
  bootDisconnectedPlayer(playerIndex: number): boolean {
    const player = this.players[playerIndex]
    if (!player || !player.disconnected) {
      return false
    }

    console.log(`Booting disconnected player ${player.name} (seat ${playerIndex})`)
    player.disconnected = false
    return this.replaceWithAI(playerIndex)
  }

  /**
   * Restore a disconnected player to their seat, replacing the AI that took over.
   * @deprecated Use markPlayerReconnected instead — players no longer get replaced with AI on disconnect
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
