import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  SpadesPhase,
  SpadesBidType,
  Spades,
  type SpadesGameState,
  type SpadesPlayer,
  type SpadesBid,
  type SpadesTrick,
  type SpadesTeamScore,
  type StandardCard,
  getRandomAINames,
  SpadesTracker,
  chooseSpadesCardHard,
  chooseSpadesBidHard,
} from '@67cards/shared'
import { useSettingsStore } from '@/stores/settingsStore'

export const useSpadesStore = defineStore('spadesGame', () => {
  const settingsStore = useSettingsStore()
  const tracker = new SpadesTracker()

  // State
  const players = ref<SpadesPlayer[]>([])
  const phase = ref<SpadesPhase>(SpadesPhase.Setup)
  const currentTrick = ref<SpadesTrick>(Spades.createSpadesTrick())
  const completedTricks = ref<SpadesTrick[]>([])
  const currentPlayer = ref(0)
  const dealer = ref(0)
  const scores = ref<SpadesTeamScore[]>([
    { teamId: 0, score: 0, bags: 0 },
    { teamId: 1, score: 0, bags: 0 },
  ])
  const roundNumber = ref(1)
  const gameOver = ref(false)
  const winner = ref<number | null>(null)
  const spadesBroken = ref(false)
  const bidsComplete = ref(false)
  const gameLost = ref(false) // Always false for singleplayer, but keeps interface consistent
  const winScore = ref(500)
  const loseScore = ref(-200)

  // Animation callbacks
  let dealCompleteResolve: (() => void) | null = null
  let playAnimationCallback: ((play: { card: StandardCard; playerId: number }) => Promise<void>) | null = null
  let trickCompleteCallback: ((winnerId: number) => Promise<void>) | null = null

  // Computed
  const gameState = computed<SpadesGameState>(() => ({
    gameType: 'spades',
    players: players.value,
    phase: phase.value,
    currentTrick: currentTrick.value,
    completedTricks: completedTricks.value,
    currentPlayer: currentPlayer.value,
    dealer: dealer.value,
    scores: scores.value,
    roundNumber: roundNumber.value,
    gameOver: gameOver.value,
    winner: winner.value,
    spadesBroken: spadesBroken.value,
    bidsComplete: bidsComplete.value,
    winScore: winScore.value,
    loseScore: loseScore.value,
  }))

  const humanPlayer = computed(() =>
    players.value.find(p => p.isHuman)
  )

  const isHumanTurn = computed(() => {
    const human = humanPlayer.value
    return human && currentPlayer.value === human.id
  })

  const isHumanBidding = computed(() => {
    return isHumanTurn.value && phase.value === SpadesPhase.Bidding
  })

  const isHumanPlaying = computed(() => {
    return isHumanTurn.value && phase.value === SpadesPhase.Playing
  })

  const validPlays = computed(() => {
    const human = humanPlayer.value
    if (!human || !isHumanPlaying.value) return []
    return Spades.getLegalPlays(human.hand, currentTrick.value, spadesBroken.value)
  })

  const teamBids = computed(() => {
    return [
      Spades.getTeamBidDisplay(players.value, 0),
      Spades.getTeamBidDisplay(players.value, 1),
    ]
  })

  const teamTricks = computed<[number, number]>(() => {
    const team0 = players.value
      .filter(p => p.teamId === 0)
      .reduce((sum, p) => sum + p.tricksWon, 0)
    const team1 = players.value
      .filter(p => p.teamId === 1)
      .reduce((sum, p) => sum + p.tricksWon, 0)
    return [team0, team1]
  })

  // Animation callbacks setters
  function setPlayAnimationCallback(cb: typeof playAnimationCallback) {
    playAnimationCallback = cb
  }

  function setTrickCompleteCallback(cb: typeof trickCompleteCallback) {
    trickCompleteCallback = cb
  }

  function dealAnimationComplete() {
    if (dealCompleteResolve) {
      const resolve = dealCompleteResolve
      dealCompleteResolve = null
      resolve()
    }
  }

  // Actions
  function startNewGame() {
    const aiNames = getRandomAINames(3)
    const playerName = localStorage.getItem('odusNickname')?.trim() || 'You'
    const playerNames = [playerName, ...aiNames]

    const state = Spades.createSpadesGame(playerNames, 0, 500, -200)
    applyState(state)

    // Deal cards
    startRound()
  }

  function startRound() {
    tracker.reset()
    const dealtState = Spades.dealSpadesCards(gameState.value)
    applyState(dealtState)
    phase.value = SpadesPhase.Dealing

    // Wait for deal animation
    const advancePhase = () => {
      const biddingState = Spades.startBiddingPhase(gameState.value)
      applyState(biddingState)
      processAITurn()
    }

    dealCompleteResolve = advancePhase
    // Fallback: if no deal animation callback arrives, advance anyway.
    // Use a longer window so deal + reveal animations can finish.
    setTimeout(() => {
      if (dealCompleteResolve === advancePhase) {
        dealCompleteResolve = null
        advancePhase()
      }
    }, 6000)
  }

  function startNextRound() {
    const newRoundState = Spades.startNewRound(gameState.value)
    applyState(newRoundState)
    startRound()
  }

  function makeBid(bid: SpadesBid) {
    const human = humanPlayer.value
    if (!human || !isHumanBidding.value) return

    const state = Spades.processBid(gameState.value, human.id, bid)
    applyState(state)

    if (state.phase === SpadesPhase.Playing) {
      processAITurn()
    } else {
      processAITurn()
    }
  }

  async function playCard(card: StandardCard) {
    const human = humanPlayer.value
    if (!human || !isHumanPlaying.value) return

    // Verify legal play
    if (!validPlays.value.some(c => c.id === card.id)) return

    await executePlayCard(human.id, card)
  }

  async function executePlayCard(playerId: number, card: StandardCard) {
    const prevTrickLength = currentTrick.value.cards.length
    const state = Spades.playCard(gameState.value, playerId, card)
    applyState(state)

    // Wait for play animation
    if (playAnimationCallback) {
      await playAnimationCallback({ card, playerId })
    }

    // Check if trick complete
    if (state.phase === SpadesPhase.TrickComplete) {
      const lastTrick = state.completedTricks[state.completedTricks.length - 1]

      // Record completed trick for hard AI tracking
      if (lastTrick) tracker.recordTrick(lastTrick)

      if (lastTrick && trickCompleteCallback) {
        // Brief pause to let user see the completed trick before sweep
        await new Promise(r => setTimeout(r, 600))
        await trickCompleteCallback(lastTrick.winnerId ?? 0)
      }

      // Check if round complete
      if (state.completedTricks.length === 13) {
        // Wait for trick-complete animation to settle before showing modal
        await new Promise(r => setTimeout(r, 1000))

        // Round is complete - apply final scoring
        const scoredState = Spades.completeRound(gameState.value)
        applyState(scoredState)
        
        if (scoredState.gameOver) {
          phase.value = SpadesPhase.GameOver
        } else {
          // Show round summary (UI will call startNextRound when ready)
          phase.value = SpadesPhase.RoundComplete
        }
        return
      }

      // Continue to next trick
      await new Promise(r => setTimeout(r, 500))
      const continueState = Spades.continuePlay(gameState.value)
      applyState(continueState)
      processAITurn()
    } else {
      processAITurn()
    }
  }

  function processAITurn() {
    const playerId = currentPlayer.value
    const player = players.value[playerId]
    if (!player) return

    // Human player - wait for input
    if (player.isHuman) return

    const hard = settingsStore.isHardAI()

    // AI turn - schedule with delay
    setTimeout(async () => {
      // Guard: verify it's still this player's turn (state may have changed)
      if (currentPlayer.value !== playerId) {
        console.warn('[Spades] AI turn skipped - no longer this player\'s turn')
        return
      }

      // Re-fetch player from current state
      const currentPlayerObj = players.value[playerId]
      if (!currentPlayerObj || currentPlayerObj.isHuman) {
        console.warn('[Spades] AI turn skipped - player state changed')
        return
      }

      if (phase.value === SpadesPhase.Bidding) {
        const bid = hard
          ? chooseSpadesBidHard(currentPlayerObj, gameState.value)
          : Spades.chooseSpadesBid(currentPlayerObj, gameState.value)
        const state = Spades.processBid(gameState.value, playerId, bid)
        applyState(state)
        processAITurn()
      } else if (phase.value === SpadesPhase.Playing) {
        const card = hard
          ? chooseSpadesCardHard(currentPlayerObj, gameState.value, tracker)
          : Spades.chooseSpadesCard(currentPlayerObj, gameState.value)
        await executePlayCard(playerId, card)
      }
    }, 800)
  }

  function applyState(state: SpadesGameState) {
    players.value = state.players
    phase.value = state.phase
    currentTrick.value = state.currentTrick
    completedTricks.value = state.completedTricks
    currentPlayer.value = state.currentPlayer
    dealer.value = state.dealer
    scores.value = state.scores
    roundNumber.value = state.roundNumber
    gameOver.value = state.gameOver
    winner.value = state.winner
    spadesBroken.value = state.spadesBroken
    bidsComplete.value = state.bidsComplete
  }

  return {
    // State
    players,
    phase,
    currentTrick,
    completedTricks,
    currentPlayer,
    dealer,
    scores,
    roundNumber,
    gameOver,
    winner,
    spadesBroken,
    bidsComplete,
    gameLost,
    gameState,

    // Computed
    humanPlayer,
    isHumanTurn,
    isHumanBidding,
    isHumanPlaying,
    validPlays,
    teamBids,
    teamTricks,

    // Actions
    startNewGame,
    startRound,
    startNextRound,
    makeBid,
    playCard,
    dealAnimationComplete,
    setPlayAnimationCallback,
    setTrickCompleteCallback,
  }
})
