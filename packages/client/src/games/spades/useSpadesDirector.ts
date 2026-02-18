import { computed, nextTick, onMounted, onUnmounted, ref, watch, type Ref } from 'vue'
import { SpadesPhase, type SpadesBid, type StandardCard } from '@67cards/shared'
import { useCardController, cardControllerPresets } from '@/composables/useCardController'
import type { CardTableEngine } from '@/composables/useCardTable'
import type { SpadesGameAdapter } from './useSpadesGameAdapter'

export interface SpadesDirectorOptions {
  mode: 'singleplayer' | 'multiplayer'
  tableRef: Ref<{ boardRef: HTMLElement | null } | null>
  boardRef: Ref<HTMLElement | null>
  onGameLost: () => void
}

export function useSpadesDirector(
  game: SpadesGameAdapter,
  engine: CardTableEngine,
  options: SpadesDirectorOptions
) {
  const { mode, tableRef, boardRef, onGameLost } = options

  function playerIdToSeatIndex(playerId: number): number {
    const myId = game.humanPlayer.value?.id ?? 0
    return (playerId - myId + 4) % 4
  }

  function seatIndexToPlayerId(seatIndex: number): number {
    const myId = game.humanPlayer.value?.id ?? 0
    return (seatIndex + myId) % 4
  }

  function getPlayerAtSeat(seatIndex: number) {
    const playerId = seatIndexToPlayerId(seatIndex)
    return game.players.value.find((player) => player.id === playerId)
  }

  const cardController = useCardController(engine, boardRef, {
    layout: 'normal',
    playerCount: 4,
    userSeatIndex: 0,
    playerIdToSeatIndex,
    userHandScale: 1.6,
    opponentHandScale: 0.7,
    userFanSpacing: 30,
    opponentFanSpacing: 16,
    playMoveMs: 350,
    ...cardControllerPresets.spades,
  })

  const opponentsHidden = ref(false)
  const animatedTrickCardIds = ref<Set<string>>(new Set())
  const completedTricksAnimated = ref(0)
  const processingMultiplayerAnimations = ref(false)
  const pendingMultiplayerAnimationPass = ref(false)

  const playerNames = computed(() => {
    const names: string[] = []
    for (let seat = 0; seat < 4; seat++) {
      const player = getPlayerAtSeat(seat)
      names.push(player?.name ?? `Player ${seat}`)
    }
    return names
  })

  const playerStatuses = computed(() => ['', '', '', ''])

  const dealerSeat = computed(() => playerIdToSeatIndex(game.dealer.value))

  const currentTurnSeat = computed(() => {
    if (game.phase.value === SpadesPhase.Bidding || game.phase.value === SpadesPhase.Playing) {
      return playerIdToSeatIndex(game.currentPlayer.value)
    }
    return -1
  })

  const dimmedCardIds = computed(() => {
    if (!game.isHumanPlaying.value) return new Set<string>()
    const human = game.humanPlayer.value
    if (!human) return new Set<string>()

    const validIds = new Set(game.validPlays.value.map((card) => card.id))
    return new Set(human.hand.filter((card) => !validIds.has(card.id)).map((card) => card.id))
  })

  const suitOrder: Record<string, number> = { spades: 0, hearts: 1, clubs: 2, diamonds: 3 }
  const rankOrder: Record<string, number> = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
    J: 11, Q: 12, K: 13, A: 14,
  }

  function sortSpadesHand(cards: StandardCard[]): StandardCard[] {
    const sorted = [...cards]
    sorted.sort((left, right) => {
      const suitDiff = (suitOrder[left.suit] ?? 99) - (suitOrder[right.suit] ?? 99)
      if (suitDiff !== 0) return suitDiff
      return (rankOrder[right.rank] ?? 0) - (rankOrder[left.rank] ?? 0)
    })
    return sorted
  }

  function buildDealPlayers() {
    const players: Array<{ hand?: StandardCard[]; handSize?: number }> = []
    for (let seat = 0; seat < 4; seat++) {
      const player = getPlayerAtSeat(seat)
      players.push({
        hand: player?.hand,
        handSize: player?.handSize ?? player?.hand?.length ?? 0,
      })
    }
    return players
  }

  async function animateCompletedTricksDelta() {
    while (completedTricksAnimated.value < game.completedTricks.value.length) {
      const trick = game.completedTricks.value[completedTricksAnimated.value]
      if (!trick) {
        completedTricksAnimated.value++
        continue
      }

      const trickCards = trick.cards ?? []
      for (let index = 0; index < trickCards.length; index++) {
        const played = trickCards[index]
        if (!played || animatedTrickCardIds.value.has(played.card.id)) continue
        await cardController.playCard(played.card, played.playerId, index)
        animatedTrickCardIds.value.add(played.card.id)
      }

      await cardController.completeTrick(trick.winnerId ?? 0)
      completedTricksAnimated.value++
    }
  }

  async function animateCurrentTrickDelta() {
    const cards = game.currentTrick.value.cards ?? []
    for (let index = 0; index < cards.length; index++) {
      const played = cards[index]
      if (!played || animatedTrickCardIds.value.has(played.card.id)) continue
      await cardController.playCard(played.card, played.playerId, index)
      animatedTrickCardIds.value.add(played.card.id)
    }
  }

  async function processMultiplayerAnimationPass() {
    if (mode !== 'multiplayer') return

    if (processingMultiplayerAnimations.value) {
      pendingMultiplayerAnimationPass.value = true
      return
    }

    processingMultiplayerAnimations.value = true
    try {
      do {
        pendingMultiplayerAnimationPass.value = false
        await animateCompletedTricksDelta()
        await animateCurrentTrickDelta()
      } while (pendingMultiplayerAnimationPass.value)
    } finally {
      processingMultiplayerAnimations.value = false
    }
  }

  async function setupBoardReference() {
    await nextTick()
    if (tableRef.value) {
      boardRef.value = tableRef.value.boardRef
    }
  }

  async function initializeBoard() {
    await setupBoardReference()
    cardController.setupTable(game.dealer.value)
  }

  watch(
    () => game.phase.value,
    async (newPhase) => {
      if (newPhase !== SpadesPhase.Dealing) return

      if (mode === 'multiplayer') {
        game.enableQueueMode?.()
      }

      await initializeBoard()

      opponentsHidden.value = false
      animatedTrickCardIds.value = new Set<string>()
      completedTricksAnimated.value = 0

      await cardController.dealFromPlayers(buildDealPlayers(), {
        revealUserHand: false,
        focusUserHand: true,
        dealDelayMs: 50,
        dealFlightMs: 200,
        fanDurationMs: 450,
        dealerSeatIndex: game.dealer.value,
        sortAfterDeal: false,
        sortUserHand: sortSpadesHand,
      })

      // Only reveal and sort user hand if cards should be visible (not in blind nil decision)
      if (game.userCardsRevealed.value) {
        await cardController.revealUserHand(350)
        await cardController.sortUserHand(sortSpadesHand, 300)
      }

      if (mode === 'multiplayer') {
        game.disableQueueMode?.()
      }

      game.dealAnimationComplete()
    },
    { immediate: true }
  )

  watch(
    () => [game.currentTrick.value.cards.length, game.completedTricks.value.length, game.phase.value],
    async () => {
      if (mode !== 'multiplayer') return
      if (game.phase.value === SpadesPhase.Setup || game.phase.value === SpadesPhase.Dealing) return
      await processMultiplayerAnimationPass()
    },
    { immediate: true }
  )

  watch(
    () => [game.phase.value, game.bidsComplete.value, game.currentTrick.value.cards.length],
    async ([phase, bidsComplete, trickCount]) => {
      if (phase === SpadesPhase.Playing && bidsComplete && trickCount === 0 && !opponentsHidden.value) {
        await cardController.hideOpponentHands()
        opponentsHidden.value = true
      }
    }
  )

  // Watch for blind nil decision - reveal cards when user chooses to see them (or bids blind nil)
  watch(
    () => game.userCardsRevealed.value,
    async (revealed) => {
      if (revealed) {
        await cardController.revealUserHand(350)
        await cardController.sortUserHand(sortSpadesHand, 300)
      }
    }
  )

  watch(
    () => game.gameLost.value,
    (lost) => {
      if (lost) {
        onGameLost()
      }
    }
  )

  // Exposed start function for board to call after resume prompt
  function initializeGame() {
    game.startNewGame()
  }

  function loadSavedGame() {
    game.loadFromLocalStorage?.()
  }

  onMounted(async () => {
    await initializeBoard()

    game.setPlayAnimationCallback(async ({ card, playerId }: { card: StandardCard; playerId: number }) => {
      const cardIndex = Math.max(0, game.currentTrick.value.cards.length - 1)
      await cardController.playCard(card, playerId, cardIndex)
    })

    game.setTrickCompleteCallback(async (winnerId: number) => {
      await cardController.completeTrick(winnerId)
    })

    if (mode === 'multiplayer') {
      game.initialize?.()
    }
    // For singleplayer, board will call initializeGame() or loadSavedGame() after checking for saved state
  })

  onUnmounted(() => {
    if (mode === 'multiplayer') {
      game.cleanup?.()
    }
    engine.reset()
  })

  return {
    cardController,
    playerIdToSeatIndex,
    seatIndexToPlayerId,
    getPlayerAtSeat,
    playerNames,
    playerStatuses,
    dealerSeat,
    currentTurnSeat,
    dimmedCardIds,
    initializeGame,
    loadSavedGame,
  }
}
