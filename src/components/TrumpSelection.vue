<template>
  <div class="trump-selection-overlay">
    <div class="trump-selection">
      <template v-if="phase === GamePhase.BiddingRound1">
        <div class="round1-actions">
          <div class="alone-option">
            <label>
              <input v-model="goingAlone" type="checkbox" />
              <span>Alone</span>
            </label>
          </div>
          <ActionButtons
            :actions="round1Actions"
            @action="handleBidAction"
          />
        </div>
      </template>
      <template v-else-if="phase === GamePhase.BiddingRound2">
        <div class="round2-header">Call Trump</div>
        <div class="suit-selection">
          <button
            v-for="suit in allSuits"
            :key="suit"
            :class="['suit-btn', getSuitColor(suit), { disabled: !isSuitSelectable(suit) }]"
            :disabled="!isSuitSelectable(suit)"
            @click="handleSuitSelect(suit)"
          >
            <span class="suit-symbol">{{ getSuitSymbol(suit) }}</span>
          </button>
        </div>
        <div class="round2-footer">
          <div class="alone-option">
            <label>
              <input v-model="goingAlone" type="checkbox" />
              <span>Alone</span>
            </label>
          </div>
          <button class="pass-btn" @click="handleBidAction(BidAction.Pass)">Pass</button>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import { GamePhase, BidAction, Suit } from '@/models/types'
import type { Bid } from '@/models/types'
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
  if (!isSuitSelectable(suit)) return

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
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  pointer-events: none;
}

.trump-selection {
  background: linear-gradient(135deg, #2d5f3f 0%, #1a3d28 100%);
  border: 2px solid rgba(255, 255, 255, 0.4);
  padding: $spacing-sm $spacing-md;
  border-radius: 10px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  text-align: center;
  color: white;
  backdrop-filter: blur(10px);
  pointer-events: auto;

  @media (max-height: 500px) {
    padding: $spacing-xs $spacing-sm;
    border-radius: 8px;
  }
}

.round1-actions {
  display: flex;
  align-items: center;
  gap: $spacing-sm;

  @media (max-height: 500px) {
    gap: $spacing-xs;
  }
}

.round2-header {
  font-size: 0.875rem;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: $spacing-xs;
  opacity: 0.9;

  @media (max-height: 500px) {
    font-size: 0.75rem;
    margin-bottom: 2px;
  }
}

.suit-selection {
  display: flex;
  gap: $spacing-xs;
  margin-bottom: $spacing-xs;

  @media (max-height: 500px) {
    gap: 4px;
    margin-bottom: 4px;
  }
}

.suit-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 8px;
  background: white;
  border: 2px solid white;
  cursor: pointer;
  transition: all 0.15s ease;

  @media (max-height: 500px) {
    width: 36px;
    height: 36px;
    border-radius: 6px;
  }

  .suit-symbol {
    font-size: 1.5rem;
    line-height: 1;

    @media (max-height: 500px) {
      font-size: 1.25rem;
    }
  }

  &.red .suit-symbol {
    color: #e74c3c;
  }

  &.black .suit-symbol {
    color: #2c3e50;
  }

  &:hover:not(.disabled) {
    transform: scale(1.1);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }

  &.disabled {
    opacity: 0.35;
    cursor: not-allowed;
    background: rgba(255, 255, 255, 0.5);
    border-color: rgba(255, 255, 255, 0.5);
  }
}

.round2-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: $spacing-sm;

  @media (max-height: 500px) {
    gap: $spacing-xs;
  }
}

.alone-option {
  label {
    display: inline-flex;
    align-items: center;
    gap: $spacing-xs;
    cursor: pointer;
    padding: 4px $spacing-sm;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    transition: background 0.15s ease;

    @media (max-height: 500px) {
      padding: 2px $spacing-xs;
      border-radius: 4px;
    }

    &:hover {
      background: rgba(255, 255, 255, 0.2);
    }
  }

  input[type="checkbox"] {
    width: 14px;
    height: 14px;
    cursor: pointer;
    accent-color: $secondary-color;

    @media (max-height: 500px) {
      width: 12px;
      height: 12px;
    }
  }

  span {
    font-size: 0.8rem;
    font-weight: bold;

    @media (max-height: 500px) {
      font-size: 0.7rem;
    }
  }
}

.pass-btn {
  padding: 4px $spacing-md;
  font-size: 0.8rem;
  font-weight: bold;
  background: transparent;
  color: white;
  border: 2px solid rgba(255, 255, 255, 0.5);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;

  @media (max-height: 500px) {
    padding: 2px $spacing-sm;
    font-size: 0.7rem;
    border-radius: 4px;
  }

  &:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.8);
  }
}
</style>
