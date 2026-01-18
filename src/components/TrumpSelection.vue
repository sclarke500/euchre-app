<template>
  <div class="trump-selection-overlay">
    <div class="trump-selection">
      <h2>{{ title }}</h2>

      <div v-if="currentRound?.turnUpCard && phase === GamePhase.BiddingRound1" class="turn-card">
        <p>Turn Card:</p>
        <Card :card="currentRound.turnUpCard" :selectable="false" />
      </div>

      <div v-if="isMyTurn" class="actions">
        <template v-if="phase === GamePhase.BiddingRound1">
          <ActionButtons
            :actions="round1Actions"
            @action="handleBidAction"
          />
        </template>
        <template v-else-if="phase === GamePhase.BiddingRound2">
          <ActionButtons
            :actions="round2Actions"
            @action="handleBidAction"
          />
        </template>
      </div>

      <div v-else class="waiting">
        <p>Waiting for {{ currentPlayerName }}...</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import { GamePhase, BidAction, Suit } from '@/models/types'
import type { Bid } from '@/models/types'
import Card from './Card.vue'
import ActionButtons from './ActionButtons.vue'

const gameStore = useGameStore()

const phase = computed(() => gameStore.phase)
const currentRound = computed(() => gameStore.currentRound)
const currentPlayer = computed(() => gameStore.currentPlayer)
const players = computed(() => gameStore.players)

const isMyTurn = computed(() => {
  return players.value[0]?.id === currentPlayer.value
})

const currentPlayerName = computed(() => {
  return players.value[currentPlayer.value]?.name ?? 'Unknown'
})

const title = computed(() => {
  if (phase.value === GamePhase.BiddingRound1) {
    return 'Bidding Round 1'
  }
  return 'Bidding Round 2 - Call Trump'
})

const round1Actions = computed(() => {
  const isDealer = currentPlayer.value === currentRound.value?.dealer

  return [
    {
      label: isDealer ? 'Pick Up' : 'Order Up',
      value: isDealer ? BidAction.PickUp : BidAction.OrderUp,
    },
    {
      label: 'Pass',
      value: BidAction.Pass,
    },
  ]
})

const round2Actions = computed(() => {
  const turnCardSuit = currentRound.value?.turnUpCard?.suit
  const availableSuits = Object.values(Suit).filter((s) => s !== turnCardSuit)

  return [
    ...availableSuits.map((suit) => ({
      label: suitSymbol(suit),
      value: suit,
    })),
    {
      label: 'Pass',
      value: BidAction.Pass,
    },
  ]
})

function suitSymbol(suit: Suit): string {
  switch (suit) {
    case Suit.Hearts:
      return '♥ Hearts'
    case Suit.Diamonds:
      return '♦ Diamonds'
    case Suit.Clubs:
      return '♣ Clubs'
    case Suit.Spades:
      return '♠ Spades'
    default:
      return ''
  }
}

function handleBidAction(action: string) {
  if (!isMyTurn.value) return

  const bid: Bid = {
    playerId: players.value[0]!.id,
    action: BidAction.Pass,
  }

  if (phase.value === GamePhase.BiddingRound1) {
    if (action === BidAction.OrderUp || action === BidAction.PickUp) {
      bid.action = action as BidAction
    } else {
      bid.action = BidAction.Pass
    }
  } else if (phase.value === GamePhase.BiddingRound2) {
    if (action === BidAction.Pass) {
      bid.action = BidAction.Pass
    } else {
      bid.action = BidAction.CallTrump
      bid.suit = action as Suit
    }
  }

  gameStore.makeBid(bid)
}
</script>

<style scoped lang="scss">
.trump-selection-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.trump-selection {
  background: linear-gradient(135deg, #2d5f3f 0%, #1a3d28 100%);
  border: 3px solid rgba(255, 255, 255, 0.3);
  padding: $spacing-lg;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  min-width: 320px;
  max-width: 400px;
  text-align: center;
  color: white;
  backdrop-filter: blur(10px);

  h2 {
    margin-bottom: $spacing-md;
    font-size: 1.5rem;
  }
}

.turn-card {
  margin: $spacing-md 0;

  p {
    margin-bottom: $spacing-sm;
    font-size: 1rem;
  }
}

.actions {
  margin-top: $spacing-md;
}

.waiting {
  margin-top: $spacing-md;
  font-size: 1rem;
  opacity: 0.9;

  p {
    animation: pulse 1.5s ease-in-out infinite;
  }
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
</style>
