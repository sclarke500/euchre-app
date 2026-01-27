<template>
  <Modal :show="true">
    <div class="trump-selection">
      <template v-if="phase === GamePhase.BiddingRound1">
      <div class="round1-content">
        <div class="kitty-stack">
          <div class="kitty-back"></div>
          <Card v-if="turnUpCard" :card="turnUpCard" class="turn-up-card" />
        </div>
        <div class="round1-actions">
          <button class="action-btn primary" @click="handleOrderUp">
            {{ isDealer ? 'Pick Up' : 'Order Up' }}
          </button>
          <button class="action-btn secondary" @click="handlePass">
            Pass
          </button>
          <div class="alone-option">
            <label>
              <input v-model="goingAlone" type="checkbox" />
              <span>Go Alone</span>
            </label>
          </div>
        </div>
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
        <button class="action-btn secondary" @click="handlePass">Pass</button>
        <div class="alone-option">
          <label>
            <input v-model="goingAlone" type="checkbox" />
            <span>Go Alone</span>
          </label>
        </div>
      </div>
    </template>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import { computed, ref, inject } from 'vue'
import type { GameAdapter } from '@/composables/useGameAdapter'
import { GamePhase, BidAction, Suit } from '@euchre/shared'
import Card from './Card.vue'
import Modal from './Modal.vue'

const game = inject<GameAdapter>('game')!

const phase = computed(() => game.phase.value)
const dealer = computed(() => game.dealer.value)
const myPlayerId = computed(() => game.myPlayerId.value)
const turnUpCard = computed(() => game.turnUpCard.value)

const goingAlone = ref(false)

const allSuits = [Suit.Hearts, Suit.Diamonds, Suit.Clubs, Suit.Spades]

const isDealer = computed(() => myPlayerId.value === dealer.value)

const turnCardSuit = computed(() => turnUpCard.value?.suit)

function isSuitSelectable(suit: Suit): boolean {
  return suit !== turnCardSuit.value
}

function getSuitSymbol(suit: Suit | undefined): string {
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

function getSuitColor(suit: Suit | undefined): string {
  return suit === Suit.Hearts || suit === Suit.Diamonds ? 'red' : 'black'
}

function handleSuitSelect(suit: Suit) {
  if (!isSuitSelectable(suit)) return
  game.makeBid(BidAction.CallTrump, suit, goingAlone.value)
  goingAlone.value = false
}

function handleOrderUp() {
  const action = isDealer.value ? BidAction.PickUp : BidAction.OrderUp
  game.makeBid(action, undefined, goingAlone.value)
  goingAlone.value = false
}

function handlePass() {
  game.makeBid(BidAction.Pass)
  goingAlone.value = false
}
</script>

<style scoped lang="scss">
.trump-selection {
  padding: $spacing-sm;
}

.round1-content {
  display: flex;
  align-items: center;
  gap: $spacing-lg;
}

.kitty-stack {
  position: relative;
  width: 90px;
  height: 126px;
}

.kitty-back {
  position: absolute;
  top: 4px;
  left: 4px;
  width: 90px;
  height: 126px;
  border-radius: 8px;
  background: linear-gradient(135deg, #4a69bd 0%, #6a89cc 50%, #4a69bd 100%);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.turn-up-card {
  position: absolute;
  top: 0;
  left: 0;
}

.round1-actions {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
}

.action-btn {
  padding: $spacing-sm $spacing-lg;
  font-size: 1rem;
  font-weight: bold;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
  min-width: 120px;
  border: none;

  &.primary {
    background: #2d5f3f;
    color: white;

    &:hover {
      background: #3d7f52;
    }
  }

  &.secondary {
    background: #e0e0e0;
    color: #333;

    &:hover {
      background: #d0d0d0;
    }
  }

  &:active {
    transform: scale(0.97);
  }
}

.round2-header {
  font-size: 1rem;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: $spacing-md;
  color: #333;
  text-align: center;
}

.suit-selection {
  display: flex;
  gap: $spacing-sm;
  margin-bottom: $spacing-md;
  justify-content: center;
}

.suit-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 10px;
  background: white;
  border: 2px solid #ddd;
  cursor: pointer;
  transition: all 0.15s ease;

  .suit-symbol {
    font-size: 2rem;
    line-height: 1;
  }

  &.red .suit-symbol {
    color: #e74c3c;
  }

  &.black .suit-symbol {
    color: #2c3e50;
  }

  &:hover:not(.disabled) {
    transform: scale(1.1);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    border-color: #999;
  }

  &:active:not(.disabled) {
    transform: scale(0.95);
  }

  &.disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
}

.round2-footer {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $spacing-sm;
}

.alone-option {
  label {
    display: inline-flex;
    align-items: center;
    gap: $spacing-xs;
    cursor: pointer;
    font-size: 0.85rem;
    color: #555;
  }

  input[type="checkbox"] {
    width: 16px;
    height: 16px;
    cursor: pointer;
    accent-color: #2d5f3f;
  }

  span {
    font-weight: 500;
  }
}

</style>
