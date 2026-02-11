import type {
  PresidentPlayer,
  PresidentPile,
  PresidentGameState,
  PlayerRank,
  PlayType,
  StandardCard,
} from '@euchre/shared'
import {
  PresidentPhase,
  createPresidentGame,
  dealPresidentCards,
  processPlay,
  processPass,
  assignRanks,
  getNextActivePlayer,
  createEmptyPile,
  findValidPlays,
  isValidPlay,
  canPlay,
  choosePresidentPlay,
  chooseCardsToGive,
  getLowestCards,
  getHighestCards,
  getRankDisplayName,
  getRandomAINames,
} from '@euchre/shared'
import type {
  PresidentClientGameState,
  PresidentClientPlayer,
} from '@euchre/shared'

export interface PresidentGamePlayer {
  odusId: string | null // null for AI players
  seatIndex: number
  name: string
  isHuman: boolean
  hand: StandardCard[]
  rank: PlayerRank | null
  finishOrder: number | null
  cardsToGive: number
  cardsToReceive: number
}

export interface PresidentGameEvents {
  onStateChange: (playerId: string | null, state: PresidentClientGameState) => void
  onPlayMade: (playerId: number, cards: StandardCard[], playType: PlayType, playerName: string) => void
  onPassed: (playerId: number, playerName: string) => void
  onPileCleared: (nextPlayerId: number) => void
  onPlayerFinished: (playerId: number, playerName: string, finishPosition: number, rank: PlayerRank) => void
  onRoundComplete: (rankings: Array<{ playerId: number; rank: PlayerRank; name: string }>, roundNumber: number) => void
  onGameOver: (finalRankings: Array<{ playerId: number; name: string; rank: PlayerRank }>) => void
  onCardExchangeInfo: (playerId: string, youGive: StandardCard[], youReceive: StandardCard[], otherPlayerName: string, yourRole: string) => void
  onAwaitingGiveCards: (playerId: string, cardsToGive: number, receivedCards: StandardCard[], yourRole: string) => void
  onYourTurn: (playerId: string, validActions: string[], validPlays: string[][]) => void
  onTurnReminder: (playerId: string, validActions: string[], validPlays: string[][]) => void
  onPlayerTimedOut: (playerId: number, playerName: string) => void
  onPlayerBooted: (playerId: number, playerName: string) => void
}

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
  
  // Card exchange state - track who still needs to give cards
  private awaitingGiveCards: number | null = null // seat index of player we're waiting on
  private pendingExchangeReceivedCards: Map<number, StandardCard[]> = new Map() // what each player received

  constructor(id: string, events: PresidentGameEvents, maxPlayers: number = 4, superTwosMode: boolean = false) {
    this.id = id
    this.events = events
    this.maxPlayers = maxPlayers
    this.superTwosMode = superTwosMode
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
    const playerIndex = odusId ? this.players.findIndex((p) => p.odusId === odusId) : -1

    const clientPlayers: PresidentClientPlayer[] = this.players.map((p, index) => ({
      id: index,
      name: p.name,
      handSize: p.hand.length,
      hand: index === playerIndex ? p.hand : undefined, // Only include cards for this player
      isHuman: p.isHuman,
      rank: p.rank,
      finishOrder: p.finishOrder,
      cardsToGive: p.cardsToGive,
      cardsToReceive: p.cardsToReceive,
    }))

    return {
      gameType: 'president',
      phase: this.phase,
      players: clientPlayers,
      currentPlayer: this.currentPlayer,
      currentPile: this.currentPile,
      consecutivePasses: this.consecutivePasses,
      finishedPlayers: this.finishedPlayers,
      roundNumber: this.roundNumber,
      gameOver: this.gameOver,
      lastPlayerId: this.lastPlayerId,
      superTwosMode: this.superTwosMode,
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

    const playerIndex = this.players.findIndex((p) => p.odusId === odusId)
    if (playerIndex === -1) return

    const player = this.players[playerIndex]!

    // Resend awaiting_give_cards if this player needs to give cards (PresidentGiving phase)
    if (this.phase === PresidentPhase.PresidentGiving && this.awaitingGiveCards === playerIndex) {
      const cardsToGive = player.rank === 1 ? 2 : 1
      const receivedCards = this.pendingExchangeReceivedCards.get(playerIndex) ?? []
      const roleNames: Record<number, string> = { 1: 'President', 2: 'Vice President' }
      const yourRole = roleNames[player.rank ?? 0] ?? 'Unknown'
      
      console.log('Resending awaiting_give_cards to player', playerIndex, player.name)
      this.events.onAwaitingGiveCards(odusId, cardsToGive, receivedCards, yourRole)
      return
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

    // Clear turn reminder since player acted
    this.clearTurnReminderTimeout()

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

    // Clear turn reminder since player acted
    this.clearTurnReminderTimeout()

    this.passInternal(playerIndex)
    return true
  }

  /**
   * Handle a player giving cards during the card exchange phase (President/VP)
   */
  handleGiveCards(odusId: string, cardIds: string[]): boolean {
    console.log('handleGiveCards called:', { odusId, cardIds })
    
    const playerIndex = this.players.findIndex((p) => p.odusId === odusId)
    if (playerIndex === -1) {
      console.log('handleGiveCards: player not found')
      return false
    }

    if (this.phase !== PresidentPhase.PresidentGiving) {
      console.log('handleGiveCards: wrong phase', this.phase)
      return false
    }

    if (this.awaitingGiveCards !== playerIndex) {
      console.log('handleGiveCards: not awaiting this player', { awaitingGiveCards: this.awaitingGiveCards, playerIndex })
      return false
    }

    const player = this.players[playerIndex]!

    // Find the cards in hand
    const cards: StandardCard[] = []
    for (const cardId of cardIds) {
      const card = player.hand.find((c) => c.id === cardId)
      if (!card) {
        console.log('handleGiveCards: card not in hand', cardId)
        return false
      }
      cards.push(card)
    }

    // Validate correct number of cards
    const expectedCount = player.rank === 1 ? 2 : 1
    console.log('handleGiveCards: rank check', { rank: player.rank, expectedCount, actualCount: cards.length })
    if (cards.length !== expectedCount) {
      console.log('handleGiveCards: wrong card count')
      return false
    }

    console.log('handleGiveCards: calling giveCards')
    this.giveCards(playerIndex, cards)
    return true
  }

  // ---- Internal methods ----

  private startNewRound(): void {
    try {
      console.log('startNewRound called, roundNumber:', this.roundNumber)
      this.phase = PresidentPhase.Dealing

      // Build game state for shared functions
      const gameState = this.buildGameState()

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
        // Do card exchange
        setTimeout(() => {
          try {
            this.phase = PresidentPhase.CardExchange
            this.processCardExchange()
          } catch (error) {
            console.error('Error in setTimeout -> processCardExchange:', error)
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

  private processCardExchange(): void {
    try {
      this.processCardExchangeInternal()
    } catch (error) {
      console.error('Error in processCardExchange:', error)
      console.error('Players state:', JSON.stringify(this.players.map(p => ({
        id: p.seatIndex,
        name: p.name,
        rank: p.rank,
        handSize: p.hand.length,
        cardsToGive: p.cardsToGive,
        cardsToReceive: p.cardsToReceive,
      })), null, 2))
      throw error
    }
  }

  private processCardExchangeInternal(): void {
    // Two-phase card exchange:
    // Phase 1: Scum/Vice-Scum MUST give their best cards (automatic)
    // Phase 2: President/VP CHOOSE which cards to give back (manual for humans)

    const president = this.players.find(p => p.rank === 1) // PlayerRank.President
    const scum = this.players.find(p => p.rank === 4) // PlayerRank.Scum
    const vp = this.players.find(p => p.rank === 2) // PlayerRank.VicePresident
    // Vice Scum is a Citizen with cardsToGive = 1
    const viceScum = this.players.find(p => p.cardsToGive === 1 && p.rank === 3) // PlayerRank.Citizen

    // Helper to convert to PresidentPlayer for shared functions
    const toPresidentPlayer = (p: PresidentGamePlayer): PresidentPlayer => ({
      id: p.seatIndex,
      name: p.name,
      hand: p.hand,
      isHuman: p.isHuman,
      rank: p.rank,
      finishOrder: p.finishOrder,
      cardsToGive: p.cardsToGive,
      cardsToReceive: p.cardsToReceive,
    })

    // Clear pending exchange state
    this.pendingExchangeReceivedCards.clear()

    // PHASE 1: Scum gives best cards to President (automatic)
    if (president && scum) {
      const scumCards = chooseCardsToGive(toPresidentPlayer(scum), 2)
      const scumCardIds = new Set(scumCards.map(c => c.id))
      
      // Remove cards from Scum, add to President
      scum.hand = scum.hand.filter(c => !scumCardIds.has(c.id))
      president.hand = [...president.hand, ...scumCards]
      
      // Track what President received (for give-back phase)
      this.pendingExchangeReceivedCards.set(president.seatIndex, scumCards)
      
      // Notify Scum what they gave (they don't choose, it's automatic)
      if (scum.isHuman && scum.odusId) {
        // Scum will see their exchange info after President gives back
      }
    }

    // PHASE 1b: Vice-Scum gives best card to VP (automatic) 
    if (vp && viceScum) {
      const viceScumCards = chooseCardsToGive(toPresidentPlayer(viceScum), 1)
      const viceScumCardIds = new Set(viceScumCards.map(c => c.id))
      
      // Remove cards from Vice-Scum, add to VP
      viceScum.hand = viceScum.hand.filter(c => !viceScumCardIds.has(c.id))
      vp.hand = [...vp.hand, ...viceScumCards]
      
      // Track what VP received
      this.pendingExchangeReceivedCards.set(vp.seatIndex, viceScumCards)
    }

    this.broadcastState()

    // PHASE 2: President/VP choose which cards to give back
    // Start with President
    if (president) {
      this.startGiveBackPhase(president.seatIndex)
    } else {
      // No president? Start playing (shouldn't happen)
      this.finishCardExchange()
    }
  }

  private startGiveBackPhase(playerSeatIndex: number): void {
    const player = this.players[playerSeatIndex]
    if (!player) {
      this.finishCardExchange()
      return
    }

    const cardsToGive = player.rank === 1 ? 2 : 1 // President gives 2, VP gives 1
    const receivedCards = this.pendingExchangeReceivedCards.get(playerSeatIndex) ?? []
    const roleNames: Record<number, string> = { 1: 'President', 2: 'Vice President' }
    const yourRole = roleNames[player.rank ?? 0] ?? 'Unknown'

    if (player.isHuman && player.odusId) {
      // Human player - wait for their choice
      this.phase = PresidentPhase.PresidentGiving
      this.awaitingGiveCards = playerSeatIndex
      
      this.events.onAwaitingGiveCards(
        player.odusId,
        cardsToGive,
        receivedCards,
        yourRole
      )
      this.broadcastState()
    } else {
      // AI player - auto-choose lowest cards
      const toPresidentPlayer = (p: PresidentGamePlayer): PresidentPlayer => ({
        id: p.seatIndex,
        name: p.name,
        hand: p.hand,
        isHuman: p.isHuman,
        rank: p.rank,
        finishOrder: p.finishOrder,
        cardsToGive: p.cardsToGive,
        cardsToReceive: p.cardsToReceive,
      })
      
      const cardsToGiveBack = getLowestCards(player.hand, cardsToGive)
      
      // Small delay for AI to feel more natural
      setTimeout(() => {
        this.completeGiveBack(playerSeatIndex, cardsToGiveBack)
      }, 500)
    }
  }

  // Called when a player submits their give-back cards
  public giveCards(playerSeatIndex: number, cards: StandardCard[]): void {
    if (this.phase !== PresidentPhase.PresidentGiving) {
      console.warn('giveCards called but not in PresidentGiving phase')
      return
    }
    if (this.awaitingGiveCards !== playerSeatIndex) {
      console.warn('giveCards called by wrong player')
      return
    }
    
    const player = this.players[playerSeatIndex]
    if (!player) return
    
    const expectedCount = player.rank === 1 ? 2 : 1
    if (cards.length !== expectedCount) {
      console.warn(`Expected ${expectedCount} cards but got ${cards.length}`)
      return
    }
    
    // Validate player has these cards
    const cardIds = new Set(cards.map(c => c.id))
    const hasAllCards = cards.every(c => player.hand.some(h => h.id === c.id))
    if (!hasAllCards) {
      console.warn('Player does not have all submitted cards')
      return
    }
    
    this.completeGiveBack(playerSeatIndex, cards)
  }

  private completeGiveBack(playerSeatIndex: number, cards: StandardCard[]): void {
    const player = this.players[playerSeatIndex]
    if (!player) {
      console.error('completeGiveBack: player not found for seatIndex', playerSeatIndex)
      return
    }

    console.log('completeGiveBack:', {
      playerSeatIndex,
      playerRank: player.rank,
      playerName: player.name,
      cardsToGive: cards.map(c => c.id),
      playerHandSize: player.hand.length,
    })

    // Find the recipient (Scum for President, Vice-Scum for VP)
    let recipient: PresidentGamePlayer | undefined
    if (player.rank === 1) {
      recipient = this.players.find(p => p.rank === 4) // Scum
      console.log('Looking for Scum (rank 4), found:', recipient?.name ?? 'NONE', 'All ranks:', this.players.map(p => ({ name: p.name, rank: p.rank })))
    } else if (player.rank === 2) {
      recipient = this.players.find(p => p.cardsToGive === 1 && p.rank === 3) // Vice-Scum
      console.log('Looking for Vice-Scum, found:', recipient?.name ?? 'NONE')
    }

    if (recipient) {
      const cardIds = new Set(cards.map(c => c.id))
      
      // Remove cards from giver, add to recipient
      player.hand = player.hand.filter(c => !cardIds.has(c.id))
      recipient.hand = [...recipient.hand, ...cards]

      // Notify both players of the exchange
      const receivedCards = this.pendingExchangeReceivedCards.get(playerSeatIndex) ?? []
      const roleNames: Record<number, string> = { 1: 'President', 2: 'Vice President', 3: 'Citizen', 4: 'Scum' }
      
      // Notify the giver (President/VP)
      if (player.isHuman && player.odusId) {
        this.events.onCardExchangeInfo(
          player.odusId,
          cards,
          receivedCards,
          recipient.name,
          roleNames[player.rank ?? 0] ?? 'Unknown'
        )
      }
      
      // Notify the recipient (Scum/Vice-Scum)
      const recipientReceivedCards = this.pendingExchangeReceivedCards.get(recipient.seatIndex)
      const recipientGaveCards = recipientReceivedCards // What they gave = what giver received
      if (recipient.isHuman && recipient.odusId) {
        // For Scum: they gave their best cards, received the cards President just gave
        const scumGave = receivedCards // Scum gave what President received
        this.events.onCardExchangeInfo(
          recipient.odusId,
          scumGave,
          cards, // Scum received what President gave
          player.name,
          roleNames[recipient.rank ?? 0] ?? 'Scum'
        )
      }
    } else {
      // BUG: recipient not found! Cards won't be transferred!
      console.error('completeGiveBack: NO RECIPIENT FOUND! Cards not transferred!', {
        playerRank: player.rank,
        allPlayers: this.players.map(p => ({ name: p.name, rank: p.rank, seatIndex: p.seatIndex })),
      })
    }

    this.awaitingGiveCards = null
    this.broadcastState()

    // Check if VP also needs to give cards
    const vp = this.players.find(p => p.rank === 2)
    if (player.rank === 1 && vp && this.pendingExchangeReceivedCards.has(vp.seatIndex)) {
      // President done, now VP's turn
      setTimeout(() => {
        this.startGiveBackPhase(vp.seatIndex)
      }, 500)
    } else {
      // All done, start playing
      setTimeout(() => {
        this.finishCardExchange()
      }, 1500)
    }
  }

  private finishCardExchange(): void {
    // Scum leads after card exchange (default rule)
    const scum = this.players.find(p => p.rank === 4)
    this.currentPlayer = scum?.seatIndex ?? 0
    this.phase = PresidentPhase.Playing
    this.pendingExchangeReceivedCards.clear()
    this.broadcastState()
    this.processCurrentTurn()
  }

  private playCardsInternal(playerIndex: number, cards: StandardCard[]): void {
    const player = this.players[playerIndex]!

    // Use shared processPlay function
    const gameState = this.buildGameState()
    const newState = processPlay(gameState, playerIndex, cards)

    // Update local state from result
    this.updateFromGameState(newState)

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
    const gameState = this.buildGameState()
    const newState = processPass(gameState, playerIndex)

    // Check if pile was cleared
    const pileCleared = newState.currentPile.currentRank === null &&
                        this.currentPile.currentRank !== null

    // Update local state
    this.updateFromGameState(newState)

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
      const gameState = this.buildGameState()
      console.log('Game state built, players finishOrders:', gameState.players.map(p => p.finishOrder))
      const rankedState = assignRanks(gameState)
      console.log('Ranks assigned:', rankedState.players.map(p => ({ id: p.id, rank: p.rank, cardsToGive: p.cardsToGive })))
      this.updateFromGameState(rankedState)

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
      const gameState = this.buildGameState()
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

      const presidentPlayer: PresidentPlayer = {
        id: player.seatIndex,
        name: player.name,
        hand: player.hand,
        isHuman: false,
        rank: player.rank,
        finishOrder: player.finishOrder,
        cardsToGive: player.cardsToGive,
        cardsToReceive: player.cardsToReceive,
      }

      const gameState = this.buildGameState()
      const play = choosePresidentPlay(presidentPlayer, this.currentPile, gameState)

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
    const validPlays = findValidPlays(player.hand, this.currentPile, this.superTwosMode)
    const canPassFlag = this.currentPile.currentRank !== null

    const validActions: string[] = []
    if (validPlays.length > 0) validActions.push('play')
    if (canPassFlag) validActions.push('pass')

    // Convert valid plays to card ID arrays
    const validPlayIds = validPlays.map(vp => vp.map(c => c.id))

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

    this.turnReminderCount++
    const player = this.players[playerIndex]!

    // Check if player has timed out (exceeded reminder limit)
    if (this.turnReminderCount >= this.TIMEOUT_AFTER_REMINDERS && this.timedOutPlayer === null) {
      console.log(`Player ${playerIndex} (${player.name}) has timed out`)
      this.timedOutPlayer = playerIndex
      this.events.onPlayerTimedOut(playerIndex, player.name)
    }

    const validPlays = findValidPlays(player.hand, this.currentPile, this.superTwosMode)
    const canPassFlag = this.currentPile.currentRank !== null

    const validActions: string[] = []
    if (validPlays.length > 0) validActions.push('play')
    if (canPassFlag) validActions.push('pass')

    const validPlayIds = validPlays.map(vp => vp.map(c => c.id))

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
    if (this.currentPlayer === playerIndex) {
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

  // ---- Helper methods to bridge local state and shared game state ----

  private buildGameState(): PresidentGameState {
    return {
      gameType: 'president',
      players: this.players.map(p => ({
        id: p.seatIndex,
        name: p.name,
        hand: p.hand,
        isHuman: p.isHuman,
        rank: p.rank,
        finishOrder: p.finishOrder,
        cardsToGive: p.cardsToGive,
        cardsToReceive: p.cardsToReceive,
      })),
      phase: this.phase,
      currentPile: this.currentPile,
      currentPlayer: this.currentPlayer,
      consecutivePasses: this.consecutivePasses,
      finishedPlayers: this.finishedPlayers,
      roundNumber: this.roundNumber,
      gameOver: this.gameOver,
      lastPlayerId: this.lastPlayerId,
      rules: {
        superTwosMode: this.superTwosMode,
        whoLeads: 'scum',
        playStyle: 'multiLoop',
      },
      pendingExchanges: [],
      awaitingGiveBack: this.awaitingGiveCards,
    }
  }

  private updateFromGameState(state: PresidentGameState): void {
    // Update players
    for (let i = 0; i < this.players.length && i < state.players.length; i++) {
      const statePlayer = state.players[i]!
      const localPlayer = this.players[i]!
      localPlayer.hand = statePlayer.hand
      localPlayer.rank = statePlayer.rank
      localPlayer.finishOrder = statePlayer.finishOrder
      localPlayer.cardsToGive = statePlayer.cardsToGive
      localPlayer.cardsToReceive = statePlayer.cardsToReceive
    }

    this.phase = state.phase
    this.currentPile = state.currentPile
    this.currentPlayer = state.currentPlayer
    this.consecutivePasses = state.consecutivePasses
    this.finishedPlayers = state.finishedPlayers
    this.gameOver = state.gameOver
    this.lastPlayerId = state.lastPlayerId
  }
}
