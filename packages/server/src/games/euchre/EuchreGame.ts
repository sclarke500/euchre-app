import type {
  Card,
  Bid,
  Suit,
  Round,
  TeamScore,
  ClientGameState,
} from '@67cards/shared'
import {
  GamePhase,
  BidAction,
  createDeck,
  dealCards,
  createTrick,
  playCardToTrick,
  completeTrick,
  isTrickComplete,
  isPlayerSittingOut,
  getLegalPlays,
  calculateRoundScore,
  isGameOver,
  getWinner,
  processBid,
  chooseDealerDiscard,
  GameTracker,
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
  private events: GameEvents
  private stateSeq = 0 // Incrementing sequence number for drift detection
  private turnReminderTimeout: ReturnType<typeof setTimeout> | null = null
  private readonly TURN_REMINDER_DELAY = 15000 // 15 seconds
  private turnReminderCount = 0 // Count reminders sent to current player
  private readonly TIMEOUT_AFTER_REMINDERS = 4 // Mark as timed out after 4 reminders (60 seconds)
  private timedOutPlayer: number | null = null // Seat index of player who timed out
  private readonly aiDifficulty: 'easy' | 'hard'
  private readonly aiTracker: GameTracker | null

  constructor(id: string, events: GameEvents, options: GameOptions = {}) {
    this.id = id
    this.events = events
    this.aiDifficulty = options.aiDifficulty === 'hard' ? 'hard' : 'easy'
    this.aiTracker = this.aiDifficulty === 'hard' ? new GameTracker() : null
  }

  getStateSeq(): number {
    return this.stateSeq
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

    this.processBidInternal(bid)
    return true
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

    // Check if it's a legal play
    const legalPlays = getLegalPlays(player.hand, this.currentRound.currentTrick, this.currentRound.trump!.suit)
    if (!legalPlays.some((c) => c.id === cardId)) {
      return false
    }

    // Clear turn reminder and timeout status since player acted
    this.clearTurnReminderTimeout()
    if (this.timedOutPlayer === playerIndex) {
      this.timedOutPlayer = null
    }

    this.playCardInternal(playerIndex, card)
    return true
  }

  /**
   * Handle dealer discard
   */
  handleDealerDiscard(odusId: string, cardId: string): boolean {
    const playerIndex = this.players.findIndex((p) => p.odusId === odusId)
    if (playerIndex === -1) return false

    if (playerIndex !== this.currentDealer) return false
    if (this.phase !== GamePhase.DealerDiscard) return false

    const player = this.players[playerIndex]!
    const cardIndex = player.hand.findIndex((c) => c.id === cardId)
    if (cardIndex === -1) return false

    // Clear turn reminder and timeout status since player acted
    this.clearTurnReminderTimeout()
    if (this.timedOutPlayer === playerIndex) {
      this.timedOutPlayer = null
    }

    player.hand.splice(cardIndex, 1)
    this.startPlayingPhase()
    return true
  }

  // ---- Internal methods ----

  private startNewRound(): void {
    this.phase = GamePhase.Dealing

    if (this.aiTracker) {
      this.aiTracker.reset()
    }

    // Create and deal deck
    const deck = createDeck()
    const [hand0, hand1, hand2, hand3, kitty] = dealCards(deck)

    // Update player hands
    this.players[0]!.hand = hand0
    this.players[1]!.hand = hand1
    this.players[2]!.hand = hand2
    this.players[3]!.hand = hand3

    // Turn up card is first card of kitty
    const turnUpCard = kitty[0] ?? null

    // Create new round
    this.currentRound = {
      dealer: this.currentDealer,
      trump: null,
      tricks: [],
      currentTrick: createTrick(),
      kitty,
      turnUpCard,
      biddingRound: 1,
      currentPlayer: (this.currentDealer + 1) % 4,
      goingAlone: false,
      alonePlayer: null,
    }

    this.passCount = 0

    // Broadcast state to all players
    this.broadcastState()

    // Start bidding
    setTimeout(() => {
      this.phase = GamePhase.BiddingRound1
      this.broadcastState()
      this.processCurrentTurn()
    }, GameTimings.phasePauseMs)
  }

  private processBidInternal(bid: Bid): void {
    if (!this.currentRound) return

    const player = this.players[bid.playerId]!

    // Broadcast the bid
    this.events.onBidMade(bid.playerId, bid, player.name)

    console.log('Server processBidInternal - bid:', JSON.stringify(bid))
    const newTrump = processBid(bid, this.currentRound.turnUpCard, this.currentRound.trump)
    console.log('Server processBidInternal - newTrump:', JSON.stringify(newTrump))

    // If trump was set (someone ordered up or called)
    if (newTrump && !this.currentRound.trump) {
      this.currentRound.trump = newTrump
      console.log('Server trump set to:', this.currentRound.trump)
      this.currentRound.goingAlone = newTrump.goingAlone
      this.currentRound.alonePlayer = newTrump.goingAlone ? newTrump.calledBy : null

      if (this.aiTracker) {
        this.aiTracker.setTrump(newTrump.suit)
      }

      // If dealer picked up, they need to discard (unless partner is going alone)
      if (bid.action === BidAction.PickUp || bid.action === BidAction.OrderUp) {
        const alonePlayer = newTrump.goingAlone ? newTrump.calledBy : null
        if (!isPlayerSittingOut(this.currentRound.dealer, alonePlayer)) {
          this.handleDealerPickup()
          return
        }
      }

      // Start playing phase
      this.startPlayingPhase()
      return
    }

    // Pass - continue bidding
    if (bid.action === BidAction.Pass) {
      this.passCount++

      if (this.currentRound.biddingRound === 1) {
        if (this.passCount >= 4) {
          // Move to round 2
          this.currentRound.biddingRound = 2
          this.currentRound.currentPlayer = (this.currentRound.dealer + 1) % 4
          this.passCount = 0
          this.phase = GamePhase.BiddingRound2
        } else {
          this.currentRound.currentPlayer = (this.currentRound.currentPlayer + 1) % 4
        }
      } else {
        this.currentRound.currentPlayer = (this.currentRound.currentPlayer + 1) % 4
      }

      this.broadcastState()
      this.processCurrentTurn()
    }
  }

  private handleDealerPickup(): void {
    if (!this.currentRound || !this.currentRound.turnUpCard) return

    const dealer = this.players[this.currentRound.dealer]!
    const turnCard = this.currentRound.turnUpCard

    // Add turn card to dealer's hand
    dealer.hand.push(turnCard)

    // AI dealer discards automatically
    if (!dealer.isHuman && this.currentRound.trump) {
      const cardToDiscard = chooseDealerDiscard(dealer.hand, this.currentRound.trump.suit)
      const index = dealer.hand.findIndex((c) => c.id === cardToDiscard.id)
      if (index !== -1) {
        dealer.hand.splice(index, 1)
      }
      this.startPlayingPhase()
      return
    }

    // Human dealer needs to discard
    this.currentRound.currentPlayer = this.currentRound.dealer
    this.phase = GamePhase.DealerDiscard
    this.broadcastState()
    this.notifyPlayerTurn(dealer.odusId!)
  }

  private startPlayingPhase(): void {
    if (!this.currentRound) return

    this.phase = GamePhase.Playing
    this.currentRound.currentPlayer = (this.currentRound.dealer + 1) % 4

    // Skip if player is sitting out
    if (isPlayerSittingOut(this.currentRound.currentPlayer, this.currentRound.alonePlayer)) {
      this.currentRound.currentPlayer = (this.currentRound.currentPlayer + 1) % 4
    }

    this.broadcastState()
    this.processCurrentTurn()
  }

  private playCardInternal(playerIndex: number, card: Card): void {
    if (!this.currentRound || !this.currentRound.trump) return

    const player = this.players[playerIndex]!

    // Remove card from player's hand
    const cardIndex = player.hand.findIndex((c) => c.id === card.id)
    if (cardIndex !== -1) {
      player.hand.splice(cardIndex, 1)
    }

    // Add card to current trick
    this.currentRound.currentTrick = playCardToTrick(
      this.currentRound.currentTrick,
      card,
      playerIndex,
      this.currentRound.trump.suit
    )

    // Broadcast the card played
    this.events.onCardPlayed(playerIndex, card, player.name)

    // Check if trick is complete
    if (isTrickComplete(this.currentRound.currentTrick, this.currentRound.goingAlone)) {
      this.completeTrickAndContinue()
    } else {
      // Next player's turn
      this.advanceToNextPlayer()
      this.broadcastState()
      this.processCurrentTurn()
    }
  }

  private advanceToNextPlayer(): void {
    if (!this.currentRound) return

    this.currentRound.currentPlayer = (this.currentRound.currentPlayer + 1) % 4

    // Skip if sitting out
    if (isPlayerSittingOut(this.currentRound.currentPlayer, this.currentRound.alonePlayer)) {
      this.currentRound.currentPlayer = (this.currentRound.currentPlayer + 1) % 4
    }
  }

  private completeTrickAndContinue(): void {
    if (!this.currentRound || !this.currentRound.trump) return

    // Complete the trick
    const completedTrick = completeTrick(this.currentRound.currentTrick, this.currentRound.trump.suit)
    this.currentRound.tricks.push(completedTrick)

    if (this.aiTracker) {
      this.aiTracker.recordTrick(completedTrick)
    }

    const winner = this.players[completedTrick.winnerId!]!

    // Broadcast trick complete
    this.events.onTrickComplete(
      completedTrick.winnerId!,
      winner.name,
      completedTrick.cards.map((pc) => ({ playerId: pc.playerId, card: pc.card }))
    )

    this.phase = GamePhase.TrickComplete
    this.broadcastState()

    // Check if round is complete (5 tricks)
    if (this.currentRound.tricks.length === 5) {
      setTimeout(() => {
        this.completeRound()
      }, GameTimings.roundPauseMs)
    } else {
      // Start next trick
      setTimeout(() => {
        if (!this.currentRound || completedTrick.winnerId === null) return

        this.currentRound.currentTrick = createTrick()
        this.currentRound.currentPlayer = completedTrick.winnerId
        this.phase = GamePhase.Playing
        this.broadcastState()
        this.processCurrentTurn()
      }, GameTimings.roundPauseMs)
    }
  }

  private completeRound(): void {
    if (!this.currentRound || !this.currentRound.trump) return

    this.phase = GamePhase.RoundComplete

    // Calculate score
    const roundScore = calculateRoundScore(this.currentRound.tricks, this.currentRound.trump)
    const currentScores: [number, number] = [this.scores[0]?.score ?? 0, this.scores[1]?.score ?? 0]
    const newScores: [number, number] = [
      currentScores[0] + roundScore.team0Points,
      currentScores[1] + roundScore.team1Points,
    ]

    if (this.scores[0]) this.scores[0].score = newScores[0]
    if (this.scores[1]) this.scores[1].score = newScores[1]

    // Count tricks for each team
    let team0Tricks = 0
    let team1Tricks = 0
    for (const trick of this.currentRound.tricks) {
      if (trick.winnerId !== null) {
        if (trick.winnerId % 2 === 0) team0Tricks++
        else team1Tricks++
      }
    }

    // Broadcast round complete
    this.events.onRoundComplete(
      this.scores,
      [team0Tricks, team1Tricks],
      [roundScore.team0Points, roundScore.team1Points]
    )

    this.broadcastState()

    // Check for game over
    if (isGameOver(newScores)) {
      this.winner = getWinner(newScores)
      this.gameOver = true
      this.phase = GamePhase.GameOver

      this.events.onGameOver(this.winner!, this.scores)
      this.broadcastState()
    } else {
      // Next round
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
