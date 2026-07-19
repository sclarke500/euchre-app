import type {
  SpadesTrick,
  SpadesBid,
  SpadesTeamScore,
  ChatMode,
} from '@67cards/shared'
import {
  SpadesPhase,
  SpadesBidType,
  Spades,
  getRandomAINames,
  GameTimings,
  createSpadesRemarkEngine,
  type SpadesRemarkState,
  type SpadesRemarkFlags,
  type RemarkMode,
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
  /** Table rule (default off until Spades table settings carry it). */
  private blindNilEnabled = false
  private handRevealed: boolean[] = [true, true, true, true]
  private events: SpadesGameEvents
  private stateSeq = 0
  private turnReminderTimeout: ReturnType<typeof setTimeout> | null = null
  private readonly TURN_REMINDER_DELAY = 15000
  private turnReminderCount = 0
  private readonly TIMEOUT_AFTER_REMINDERS = 4
  private timedOutPlayer: number | null = null
  
  // Remarks engine (holds previous state snapshot + cooldown per game)
  private remarkEngine = createSpadesRemarkEngine()
  private chatMode: ChatMode = 'clean'
  private remarkEventFlags: SpadesRemarkFlags = {}

  constructor(id: string, events: SpadesGameEvents, options: { chatMode?: 'clean' | 'unhinged' } = {}) {
    this.id = id
    this.events = events
    this.chatMode = options.chatMode ?? 'clean'
  }

  getStateSeq(): number {
    return this.stateSeq
  }

  isGameOver(): boolean {
    return this.gameOver
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
      blindNilEnabled: this.blindNilEnabled,
      handRevealed: this.handRevealed,
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
    this.handRevealed = this.players.map(() => !this.blindNilEnabled)

    this.broadcastState()

    // Start bidding after deal animation
    setTimeout(() => {
      this.phase = SpadesPhase.Bidding
      this.broadcastState()
      this.scheduleAITurn()
    }, GameTimings.roundPauseMs)
  }

  /**
   * Pure-path reveal for blind-nil pre-look (forfeits BlindNil for this seat).
   * Additive host API; no-op when blind nil is off / already revealed.
   */
  revealHand(odusId: string): boolean {
    const player = this.players.find((p) => p.odusId === odusId)
    if (!player) return false
    if (player.seatIndex !== this.currentPlayer) return false
    if (this.phase !== SpadesPhase.Bidding) return false

    const prev = this.toPureState()
    const next = Spades.processRevealHand(prev, player.seatIndex)
    if (next === prev) return false

    this.applyPureState(next)
    this.broadcastState()
    return true
  }

  makeBid(odusId: string, bid: SpadesBid): boolean {
    const player = this.players.find((p) => p.odusId === odusId)
    if (!player) return false
    if (player.seatIndex !== this.currentPlayer) return false
    if (this.phase !== SpadesPhase.Bidding) return false
    if (player.bid !== null) return false

    const prev = this.toPureState()
    const next = Spades.processBid(prev, player.seatIndex, bid)
    if (next === prev) return false

    this.applyPureState(next)
    this.events.onBidMade(player.seatIndex, bid, player.name)

    this.broadcastState()
    this.scheduleAITurn()
    return true
  }

  /** Snapshot mutable host fields into pure SpadesGameState. */
  private toPureState() {
    return buildSpadesGameState({
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
      blindNilEnabled: this.blindNilEnabled,
      handRevealed: this.handRevealed,
    })
  }

  /** Apply full pure SpadesGameState onto mutable host fields. */
  private applyPureState(next: ReturnType<typeof buildSpadesGameState>): void {
    for (let i = 0; i < 4; i++) {
      const pure = next.players[i]
      const host = this.players[i]
      if (!pure || !host) continue
      host.hand = pure.hand
      host.bid = pure.bid
      host.tricksWon = pure.tricksWon
    }
    this.phase = next.phase
    this.currentTrick = next.currentTrick
    this.completedTricks = next.completedTricks
    this.currentPlayer = next.currentPlayer
    this.dealer = next.dealer
    this.scores = next.scores
    this.roundNumber = next.roundNumber
    this.gameOver = next.gameOver
    this.winner = next.winner
    this.spadesBroken = next.spadesBroken
    this.bidsComplete = next.bidsComplete
    this.handRevealed = next.handRevealed
  }

  playCard(odusId: string, cardId: string): boolean {
    const player = this.players.find((p) => p.odusId === odusId)
    if (!player) return false
    if (player.seatIndex !== this.currentPlayer) return false
    if (this.phase !== SpadesPhase.Playing) return false

    const card = player.hand.find(c => c.id === cardId)
    if (!card) return false

    return this.applyPlay(player.seatIndex, card)
  }

  /**
   * Pure play path: Spades.playCard → apply → events → schedule continue/round.
   * Illegal → same-ref reject (returns false).
   */
  private applyPlay(seatIndex: number, card: { id: string; suit: string; rank: string }): boolean {
    const player = this.players[seatIndex]
    if (!player) return false

    const prev = this.toPureState()
    const next = Spades.playCard(prev, seatIndex, card as any)
    if (next === prev) return false

    const prevTrickCount = prev.completedTricks.length
    const trickJustCompleted = next.completedTricks.length > prevTrickCount

    this.applyPureState(next)
    this.events.onCardPlayed(seatIndex, card as any, player.name)

    if (trickJustCompleted) {
      const lastTrick = next.completedTricks[next.completedTricks.length - 1]!
      const winnerId = lastTrick.winnerId ?? 0
      const winner = this.players[winnerId]
      if (winner) this.flagNilBrokenIfNeeded(winner)

      this.events.onTrickComplete(
        winnerId,
        this.players[winnerId]?.name ?? '',
        lastTrick.cards.map(c => ({ playerId: c.playerId, card: c.card }))
      )

      // 13th trick: pure playCard already called completeRound (scores applied)
      if (
        next.completedTricks.length === 13 ||
        next.phase === SpadesPhase.RoundComplete ||
        next.phase === SpadesPhase.GameOver
      ) {
        this.broadcastState()
        setTimeout(() => this.emitRoundCompleteAfterScoring(), GameTimings.roundPauseMs)
        return true
      }

      // Mid-round trick: pure left phase TrickComplete; continue after pause
      this.broadcastState()
      setTimeout(() => {
        const before = this.toPureState()
        const continued = Spades.continuePlay(before)
        if (continued !== before) {
          this.applyPureState(continued)
        }
        this.broadcastState()
        this.scheduleAITurn()
      }, GameTimings.trickPauseMs)
      return true
    }

    this.broadcastState()
    this.scheduleAITurn()
    return true
  }

  /**
   * Host shell after pure completeRound already applied scores (13th trick via playCard).
   * Do not call Spades.completeRound again — that would double-score.
   */
  private emitRoundCompleteAfterScoring(): void {
    this.detectRoundEndChatEvents(this.toPureState())

    const teamTricks: [number, number] = [
      this.players.filter(p => p.teamId === 0).reduce((s, p) => s + p.tricksWon, 0),
      this.players.filter(p => p.teamId === 1).reduce((s, p) => s + p.tricksWon, 0),
    ]

    this.events.onRoundComplete(this.scores, teamTricks)

    if (this.gameOver) {
      this.phase = SpadesPhase.GameOver
      this.events.onGameOver(this.winner ?? 0, this.scores)
      this.broadcastState()
      return
    }

    this.phase = SpadesPhase.RoundComplete
    this.broadcastState()

    // Clients show round-summary ~3.5s after broadcast — keep above that before redeal
    setTimeout(() => {
      this.dealer = (this.dealer + 1) % 4
      this.roundNumber++
      this.startNewRound()
    }, 5000)
  }
  
  // Live nil-death detection: the moment a nil bidder wins their first trick
  private flagNilBrokenIfNeeded(winner: SpadesGamePlayer): void {
    const bidType = winner.bid?.type
    const isNilBid = bidType === SpadesBidType.Nil || bidType === SpadesBidType.BlindNil
    if (isNilBid && winner.tricksWon === 1) {
      this.remarkEventFlags.nilBroken = {
        playerId: winner.seatIndex,
        blind: bidType === SpadesBidType.BlindNil,
      }
    }
  }

  private detectRoundEndChatEvents(gameState: ReturnType<typeof buildSpadesGameState>): void {
    // Check for made nils (failures are remarked live via nilBroken)
    for (const player of gameState.players) {
      if (!player.bid) continue

      const isNilBid = player.bid.type === SpadesBidType.Nil || player.bid.type === SpadesBidType.BlindNil

      if (isNilBid && player.tricksWon === 0) {
        this.remarkEventFlags.nilMade = {
          playerId: player.id,
          blind: player.bid.type === SpadesBidType.BlindNil,
        }
      }
    }
    
    // Check for sets
    for (const team of [0, 1] as const) {
      const teamPlayers = gameState.players.filter(p => p.teamId === team)
      const totalBid = teamPlayers.reduce((sum, p) => {
        if (!p.bid || p.bid.type === SpadesBidType.Nil || p.bid.type === SpadesBidType.BlindNil) return sum
        return sum + p.bid.count
      }, 0)
      const totalTricks = teamPlayers.reduce((sum, p) => sum + p.tricksWon, 0)
      
      if (totalBid > totalTricks) {
        this.remarkEventFlags.setBid = { teamId: team }
      }
    }
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

    let gameState = this.toPureState()
    // AI reveals first when blind-nil pre-look is active (never bids BlindNil)
    if (gameState.blindNilEnabled && !(gameState.handRevealed[player.seatIndex] ?? true)) {
      const revealed = Spades.processRevealHand(gameState, player.seatIndex)
      if (revealed !== gameState) {
        this.applyPureState(revealed)
        gameState = revealed
      }
    }

    const bid = computeSpadesAIBid({ player, gameState })
    const next = Spades.processBid(gameState, player.seatIndex, bid)
    if (next === gameState) return

    this.applyPureState(next)
    this.events.onBidMade(player.seatIndex, bid, player.name)

    this.broadcastState()
    this.scheduleAITurn()
  }

  private processAIPlay(): void {
    const player = this.players[this.currentPlayer]
    if (!player || player.isHuman) return

    const gameState = this.toPureState()
    const card = computeSpadesAIPlay({ player, gameState })
    this.applyPlay(player.seatIndex, card)
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
    // Capture state for remarks engine before incrementing seq
    const remarkStateSnapshot = this.getRemarkStateSnapshot()
    
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
          blindNilEnabled: this.blindNilEnabled,
          handRevealed: this.handRevealed,
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
      blindNilEnabled: this.blindNilEnabled,
      handRevealed: this.handRevealed,
    }))
    
    // Process bot remarks after state broadcast
    this.processBotChat(remarkStateSnapshot)
    
    // Clear remark event flags after processing
    this.remarkEventFlags = {}
  }
  
  private getRemarkStateSnapshot(): SpadesRemarkState {
    return {
      phase: this.phase,
      scores: this.scores.map(s => ({ teamId: s.teamId, score: s.score, bags: s.bags })),
      roundNumber: this.roundNumber,
      gameOver: this.gameOver,
      winner: this.winner,
      ...this.remarkEventFlags,
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
  
  private processBotChat(newRemarkState: SpadesRemarkState): void {
    if (!this.events.onBotChat) return
    
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
