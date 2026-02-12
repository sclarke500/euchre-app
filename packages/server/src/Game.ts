import type {
  Player,
  Card,
  Trick,
  Trump,
  Bid,
  Suit,
  GameState,
  Round,
  TeamScore,
  ClientGameState,
  ClientPlayer,
} from '@euchre/shared'
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
  makeAIBidRound1,
  makeAIBidRound2,
  chooseCardToPlay,
  chooseDealerDiscard,
  isPartnerWinning,
  GameTracker,
  makeAIBidRound1Hard,
  makeAIBidRound2Hard,
  chooseCardToPlayHard,
  isPartnerWinningHard,
} from '@euchre/shared'
import { getRandomAINames } from '@euchre/shared'

export interface GamePlayer {
  odusId: string | null // null for AI players
  seatIndex: number
  name: string
  isHuman: boolean
  hand: Card[]
  teamId: number
}

export interface GameEvents {
  onStateChange: (playerId: string | null, state: ClientGameState) => void
  onBidMade: (playerId: number, bid: Bid, playerName: string) => void
  onCardPlayed: (playerId: number, card: Card, playerName: string) => void
  onTrickComplete: (winnerId: number, winnerName: string, cards: Array<{ playerId: number; card: Card }>) => void
  onRoundComplete: (scores: TeamScore[], tricksTaken: [number, number], pointsAwarded: [number, number]) => void
  onGameOver: (winningTeam: number, finalScores: TeamScore[]) => void
  onYourTurn: (playerId: string, validActions: string[], validCards?: string[]) => void
  onTurnReminder: (playerId: string, validActions: string[], validCards?: string[]) => void
  onPlayerTimedOut: (playerId: number, playerName: string) => void
  onPlayerBooted: (playerId: number, playerName: string) => void
}

export interface GameOptions {
  aiDifficulty?: 'easy' | 'hard'
}

export class Game {
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
  initializePlayers(humanPlayers: Array<{ odusId: string; name: string; seatIndex: number }>): void {
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
    const playerIndex = odusId ? this.players.findIndex((p) => p.odusId === odusId) : -1

    const clientPlayers: ClientPlayer[] = this.players.map((p, index) => ({
      id: index,
      name: p.name,
      handSize: p.hand.length,
      hand: index === playerIndex ? p.hand : undefined, // Only include cards for this player
      isHuman: p.isHuman,
      teamId: p.teamId,
    }))

    // Count tricks taken by each team and player
    let team0Tricks = 0
    let team1Tricks = 0
    const tricksWonByPlayer: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 }
    if (this.currentRound) {
      for (const trick of this.currentRound.tricks) {
        if (trick.winnerId !== null) {
          if (trick.winnerId % 2 === 0) team0Tricks++
          else team1Tricks++
          tricksWonByPlayer[trick.winnerId] = (tricksWonByPlayer[trick.winnerId] ?? 0) + 1
        }
      }
    }

    console.log('Server getStateForPlayer - this.currentRound?.trump:', this.currentRound?.trump)

    return {
      phase: this.phase,
      players: clientPlayers,
      currentPlayer: this.currentRound?.currentPlayer ?? 0,
      scores: this.scores,
      currentTrick: this.currentRound?.currentTrick ?? null,
      completedTricks: this.currentRound?.tricks.length ?? 0,
      trump: this.currentRound?.trump?.suit ?? null,
      trumpCalledBy: this.currentRound?.trump?.calledBy ?? null,
      goingAlone: this.currentRound?.goingAlone ?? false,
      turnUpCard: this.currentRound?.turnUpCard ?? null,
      biddingRound: this.currentRound?.biddingRound ?? null,
      dealer: this.currentDealer,
      gameOver: this.gameOver,
      winner: this.winner,
      tricksTaken: [team0Tricks, team1Tricks] as [number, number],
      tricksWonByPlayer,
      stateSeq: this.stateSeq,
      timedOutPlayer: this.timedOutPlayer,
    }
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

    // Clear turn reminder since player acted
    this.clearTurnReminderTimeout()

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

    // Clear turn reminder since player acted
    this.clearTurnReminderTimeout()

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

    // Clear turn reminder since player acted
    this.clearTurnReminderTimeout()

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
    }, 500)
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
      }, 1500)
    } else {
      // Start next trick
      setTimeout(() => {
        if (!this.currentRound || completedTrick.winnerId === null) return

        this.currentRound.currentTrick = createTrick()
        this.currentRound.currentPlayer = completedTrick.winnerId
        this.phase = GamePhase.Playing
        this.broadcastState()
        this.processCurrentTurn()
      }, 1500)
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

      if (this.phase === GamePhase.BiddingRound1) {
        if (!this.currentRound.turnUpCard) return
        const aiPlayer = { id: player.seatIndex, name: player.name, hand: player.hand, isHuman: false, teamId: player.teamId }
        const bid = this.aiDifficulty === 'hard'
          ? makeAIBidRound1Hard(aiPlayer, this.currentRound.turnUpCard, this.currentRound.dealer)
          : makeAIBidRound1(aiPlayer, this.currentRound.turnUpCard, this.currentRound.dealer)
        this.processBidInternal(bid)
      } else if (this.phase === GamePhase.BiddingRound2) {
        if (!this.currentRound.turnUpCard) return
        const aiPlayer = { id: player.seatIndex, name: player.name, hand: player.hand, isHuman: false, teamId: player.teamId }
        const bid = this.aiDifficulty === 'hard'
          ? makeAIBidRound2Hard(aiPlayer, this.currentRound.turnUpCard.suit, this.currentRound.dealer)
          : makeAIBidRound2(aiPlayer, this.currentRound.turnUpCard.suit, this.currentRound.dealer)
        this.processBidInternal(bid)
      } else if (this.phase === GamePhase.Playing && this.currentRound.trump) {
        const aiPlayer = { id: player.seatIndex, name: player.name, hand: player.hand, isHuman: false, teamId: player.teamId }
        let card: Card
        if (this.aiDifficulty === 'hard' && this.aiTracker) {
          const partnerWinning = isPartnerWinningHard(
            this.currentRound.currentTrick,
            player.seatIndex,
            this.currentRound.trump.suit
          )
          card = chooseCardToPlayHard(
            aiPlayer,
            this.currentRound.currentTrick,
            this.currentRound.trump.suit,
            partnerWinning,
            this.aiTracker
          )
        } else {
          const partnerWinning = isPartnerWinning(
            this.currentRound.currentTrick,
            player.seatIndex,
            this.currentRound.trump.suit
          )
          card = chooseCardToPlay(
            aiPlayer,
            this.currentRound.currentTrick,
            this.currentRound.trump.suit,
            partnerWinning
          )
        }
        this.playCardInternal(player.seatIndex, card)
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
    const { validActions, validCards } = this.getValidActionsForPlayer(playerIndex)

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

  private getValidActionsForPlayer(playerIndex: number): { validActions: string[]; validCards: string[] | undefined } {
    const player = this.players[playerIndex]!
    let validActions: string[] = []
    let validCards: string[] | undefined

    if (this.phase === GamePhase.BiddingRound1) {
      validActions = playerIndex === this.currentDealer
        ? [BidAction.PickUp, BidAction.Pass]
        : [BidAction.OrderUp, BidAction.Pass]
    } else if (this.phase === GamePhase.BiddingRound2) {
      // Dealer must call (stick the dealer)
      if (playerIndex === this.currentDealer && this.passCount >= 3) {
        validActions = [BidAction.CallTrump]
      } else {
        validActions = [BidAction.CallTrump, BidAction.Pass]
      }
    } else if (this.phase === GamePhase.Playing && this.currentRound?.trump) {
      validActions = ['play_card']
      const legalPlays = getLegalPlays(player.hand, this.currentRound.currentTrick, this.currentRound.trump.suit)
      validCards = legalPlays.map((c) => c.id)
    } else if (this.phase === GamePhase.DealerDiscard) {
      validActions = ['discard']
      validCards = player.hand.map((c) => c.id)
    }

    return { validActions, validCards }
  }

  private sendTurnReminder(odusId: string, playerIndex: number): void {
    // Verify it's still this player's turn
    if (!this.currentRound || this.currentRound.currentPlayer !== playerIndex) {
      return
    }

    this.turnReminderCount++
    const player = this.players[playerIndex]!

    // Check if player has timed out (exceeded reminder limit)
    if (this.turnReminderCount >= this.TIMEOUT_AFTER_REMINDERS && this.timedOutPlayer === null) {
      console.log(`Player ${playerIndex} (${player.name}) has timed out`)
      this.timedOutPlayer = playerIndex
      this.events.onPlayerTimedOut(playerIndex, player.name)
      // Continue sending reminders but player is now marked as timed out
    }

    const { validActions, validCards } = this.getValidActionsForPlayer(playerIndex)
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
   * Boot a timed-out player and replace with AI
   */
  bootPlayer(playerIndex: number): boolean {
    // Can only boot the player who has timed out
    if (this.timedOutPlayer !== playerIndex) {
      return false
    }

    const player = this.players[playerIndex]
    if (!player || !player.isHuman) {
      return false
    }

    console.log(`Booting player ${playerIndex} (${player.name}) and replacing with AI`)

    // Clear timeout state
    this.clearTurnReminderTimeout()
    this.turnReminderCount = 0
    this.timedOutPlayer = null

    // Convert player to AI
    const aiNames = getRandomAINames(1)
    player.isHuman = false
    player.name = aiNames[0] ?? 'Bot'
    player.odusId = null

    // Notify about the boot
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
   * Check if a player is timed out (for external queries)
   */
  isPlayerTimedOut(playerIndex: number): boolean {
    return this.timedOutPlayer === playerIndex
  }
}
