import { computed, ref, watch } from 'vue'
import { Spades, SpadesBidType, SpadesPhase, type SpadesBid } from '@67cards/shared'
import type { SpadesGameAdapter } from './useSpadesGameAdapter'

export interface SpadesRoundSummary {
  usBid: number
  themBid: number
  usTricks: number
  themTricks: number
  usBags: number
  themBags: number
  usBasePoints: number
  themBasePoints: number
  usNilBonus: number
  themNilBonus: number
  usNilPenalty: number
  themNilPenalty: number
  usBagPenalty: number
  themBagPenalty: number
  usTotal: number
  themTotal: number
}

function createEmptyRoundSummary(): SpadesRoundSummary {
  return {
    usBid: 0,
    themBid: 0,
    usTricks: 0,
    themTricks: 0,
    usBags: 0,
    themBags: 0,
    usBasePoints: 0,
    themBasePoints: 0,
    usNilBonus: 0,
    themNilBonus: 0,
    usNilPenalty: 0,
    themNilPenalty: 0,
    usBagPenalty: 0,
    themBagPenalty: 0,
    usTotal: 0,
    themTotal: 0,
  }
}

export function useSpadesBoardUi(adapter: SpadesGameAdapter, mode: 'singleplayer' | 'multiplayer') {
  const showRoundSummary = ref(false)
  const roundSummary = ref<SpadesRoundSummary>(createEmptyRoundSummary())
  const selectedBid = ref(3)

  const scores = computed(() => adapter.scores.value)

  const handBags = computed<[number, number]>(() => {
    const result: [number, number] = [0, 0]

    for (let teamId = 0; teamId < 2; teamId++) {
      let teamBid = 0
      let teamTricks = 0

      for (const player of adapter.players.value) {
        if (player.teamId !== teamId) continue
        if (player.bid?.type === 'normal') {
          teamBid += player.bid.count
        }
        teamTricks += player.tricksWon ?? 0
      }

      result[teamId] = Math.max(0, teamTricks - teamBid)
    }

    return result
  })

  const userName = computed(() => adapter.humanPlayer.value?.name ?? 'You')

  const currentPlayerName = computed(() => {
    return adapter.players.value[adapter.currentPlayer.value]?.name ?? ''
  })

  const winnerText = computed(() => {
    if (adapter.winner.value === null) return ''
    const myTeam = adapter.humanPlayer.value?.teamId ?? 0
    return adapter.winner.value === myTeam ? 'You Win!' : 'You Lose'
  })

  function getBidDisplay(bid: SpadesBid): string {
    return Spades.getBidDisplayText(bid)
  }

  function handleBid() {
    if (selectedBid.value === 0) {
      // 0 = Nil bid
      adapter.makeBid({ type: SpadesBidType.Nil, count: 0 })
    } else {
      adapter.makeBid({ type: SpadesBidType.Normal, count: selectedBid.value })
    }
  }

  function dismissRoundSummary() {
    showRoundSummary.value = false
    adapter.startNextRound()
  }

  watch(
    () => adapter.phase.value,
    async (newPhase) => {
      if (newPhase === SpadesPhase.RoundComplete) {
        await new Promise((resolve) => setTimeout(resolve, 800))

        const usScore = Spades.calculateRoundScore(
          adapter.players.value,
          0,
          adapter.scores.value[0]?.bags ?? 0,
        )
        const themScore = Spades.calculateRoundScore(
          adapter.players.value,
          1,
          adapter.scores.value[1]?.bags ?? 0,
        )

        const usBags = Math.max(0, usScore.tricksWon - usScore.baseBid)
        const themBags = Math.max(0, themScore.tricksWon - themScore.baseBid)

        roundSummary.value = {
          usBid: usScore.baseBid,
          themBid: themScore.baseBid,
          usTricks: usScore.tricksWon,
          themTricks: themScore.tricksWon,
          usBags,
          themBags,
          usBasePoints: usScore.tricksWon >= usScore.baseBid ? usScore.baseBid * 10 : -usScore.baseBid * 10,
          themBasePoints: themScore.tricksWon >= themScore.baseBid ? themScore.baseBid * 10 : -themScore.baseBid * 10,
          usNilBonus: usScore.nilBonus,
          themNilBonus: themScore.nilBonus,
          usNilPenalty: usScore.nilPenalty,
          themNilPenalty: themScore.nilPenalty,
          usBagPenalty: Math.abs(usScore.bagsPenalty),
          themBagPenalty: Math.abs(themScore.bagsPenalty),
          usTotal: usScore.roundPoints,
          themTotal: themScore.roundPoints,
        }

        showRoundSummary.value = true
      }

      if (mode === 'multiplayer' && newPhase !== SpadesPhase.RoundComplete) {
        showRoundSummary.value = false
      }

      if (newPhase === SpadesPhase.Bidding) {
        selectedBid.value = 3
      }
    },
    { immediate: true }
  )

  return {
    showRoundSummary,
    roundSummary,
    selectedBid,
    scores,
    handBags,
    userName,
    currentPlayerName,
    winnerText,
    getBidDisplay,
    handleBid,
    dismissRoundSummary,
  }
}
