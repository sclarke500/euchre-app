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
          <div class="alone-option">
            <label>
              <input v-model="goingAlone" type="checkbox" />
              <span>Go Alone</span>
            </label>
          </div>
          <ActionButtons
            :actions="round1Actions"
            @action="handleBidAction"
          />
        </template>
        <template v-else-if="phase === GamePhase.BiddingRound2">
          <div class="suit-selection">
            <button
              v-for="suit in allSuits"
              :key="suit"
              :class="['suit-btn', getSuitColor(suit), { disabled: !isSuitSelectable(suit) }]"
              :disabled="!isSuitSelectable(suit)"
              @click="handleSuitSelect(suit)"
            >
              <span class="suit-symbol">{{ getSuitSymbol(suit) }}</span>
              <span class="suit-name">{{ getSuitName(suit) }}</span>
            </button>
          </div>
          <div class="alone-option">
            <label>
              <input v-model="goingAlone" type="checkbox" />
              <span>Go Alone</span>
            </label>
          </div>
          <button class="pass-btn" @click="handleBidAction(BidAction.Pass)">Pass</button>
        </template>
      </div>

      <div v-else class="waiting">
        <p>Waiting for {{ currentPlayerName }}...</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
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

// Go alone checkbox state
const goingAlone = ref(false)

// All suits in display order
const allSuits = [Suit.Hearts, Suit.Diamonds, Suit.Clubs, Suit.Spades]

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

const turnCardSuit = computed(() => currentRound.value?.turnUpCard?.suit)

function isSuitSelectable(suit: Suit): boolean {
  return suit !== turnCardSuit.value
}

function getSuitSymbol(suit: Suit): string {
  switch (suit) {
    case Suit.Hearts:
      return '♥'
    case Suit.Diamonds:
      return '♦'
    case Suit.Clubs:
      return '♣'
    case Suit.Spades:
      return '♠'
    default:
      return ''
  }
}

function getSuitName(suit: Suit): string {
  switch (suit) {
    case Suit.Hearts:
      return 'Hearts'
    case Suit.Diamonds:
      return 'Diamonds'
    case Suit.Clubs:
      return 'Clubs'
    case Suit.Spades:
      return 'Spades'
    default:
      return ''
  }
}

function getSuitColor(suit: Suit): string {
  return suit === Suit.Hearts || suit === Suit.Diamonds ? 'red' : 'black'
}

function handleSuitSelect(suit: Suit) {
  if (!isMyTurn.value || !isSuitSelectable(suit)) return

  const bid: Bid = {
    playerId: players.value[0]!.id,
    action: BidAction.CallTrump,
    suit: suit,
    goingAlone: goingAlone.value,
  }

  goingAlone.value = false
  gameStore.makeBid(bid)
}

function handleBidAction(action: string) {
  if (!isMyTurn.value) return

  const bid: Bid = {
    playerId: players.value[0]!.id,
    action: BidAction.Pass,
    goingAlone: goingAlone.value,
  }

  if (phase.value === GamePhase.BiddingRound1) {
    if (action === BidAction.OrderUp || action === BidAction.PickUp) {
      bid.action = action as BidAction
    } else {
      bid.action = BidAction.Pass
    }
  } else if (phase.value === GamePhase.BiddingRound2) {
    bid.action = BidAction.Pass
  }

  goingAlone.value = false
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

  @media (max-height: 500px) {
    padding: $spacing-md;
    min-width: 280px;
  }

  h2 {
    margin-bottom: $spacing-md;
    font-size: 1.5rem;

    @media (max-height: 500px) {
      font-size: 1.25rem;
      margin-bottom: $spacing-sm;
    }
  }
}

.turn-card {
  margin: $spacing-md 0;

  p {
    margin-bottom: $spacing-sm;
    font-size: 1rem;
  }

  @media (max-height: 500px) {
    margin: $spacing-sm 0;
  }
}

.actions {
  margin-top: $spacing-md;

  @media (max-height: 500px) {
    margin-top: $spacing-sm;
  }
}

.suit-selection {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: $spacing-sm;
  margin-bottom: $spacing-md;

  @media (max-height: 500px) {
    gap: $spacing-xs;
    margin-bottom: $spacing-sm;
  }
}

.suit-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: $spacing-md;
  border-radius: 8px;
  background: white;
  border: 2px solid white;
  cursor: pointer;
  transition: all 0.2s ease;

  @media (max-height: 500px) {
    padding: $spacing-sm;
  }

  .suit-symbol {
    font-size: 2rem;
    line-height: 1;

    @media (max-height: 500px) {
      font-size: 1.5rem;
    }
  }

  .suit-name {
    font-size: 0.875rem;
    font-weight: bold;
    margin-top: $spacing-xs;

    @media (max-height: 500px) {
      font-size: 0.75rem;
    }
  }

  &.red {
    color: #e74c3c;

    .suit-symbol {
      color: #e74c3c;
    }
  }

  &.black {
    color: #2c3e50;

    .suit-symbol {
      color: #2c3e50;
    }
  }

  &:hover:not(.disabled) {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }

  &.disabled {
    opacity: 0.4;
    cursor: not-allowed;
    background: rgba(255, 255, 255, 0.5);
    border-color: rgba(255, 255, 255, 0.5);
  }
}

.alone-option {
  margin-bottom: $spacing-md;

  @media (max-height: 500px) {
    margin-bottom: $spacing-sm;
  }

  label {
    display: inline-flex;
    align-items: center;
    gap: $spacing-sm;
    cursor: pointer;
    padding: $spacing-xs $spacing-md;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    transition: background 0.2s ease;

    &:hover {
      background: rgba(255, 255, 255, 0.2);
    }
  }

  input[type="checkbox"] {
    width: 18px;
    height: 18px;
    cursor: pointer;
    accent-color: $secondary-color;
  }

  span {
    font-size: 1rem;
    font-weight: bold;

    @media (max-height: 500px) {
      font-size: 0.875rem;
    }
  }
}

.pass-btn {
  padding: $spacing-md $spacing-lg;
  font-size: 1rem;
  font-weight: bold;
  background: transparent;
  color: white;
  border: 2px solid rgba(255, 255, 255, 0.5);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 100px;

  @media (max-height: 500px) {
    padding: $spacing-sm $spacing-md;
    font-size: 0.875rem;
  }

  &:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.8);
  }
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
