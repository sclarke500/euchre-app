<template>
  <div class="sandbox">
    <!-- Controls Panel -->
    <div class="controls">
      <h3>🎮 Animation Sandbox</h3>
      
      <div class="control-group">
        <label>Players:</label>
        <select v-model="playerCount" @change="resetTable">
          <option :value="2">2 Players</option>
          <option :value="3">3 Players</option>
          <option :value="4">4 Players</option>
          <option :value="5">5 Players</option>
          <option :value="6">6 Players</option>
        </select>
      </div>

      <div class="control-group">
        <label>Cards per hand:</label>
        <input type="number" v-model.number="cardsPerHand" min="1" max="13" />
      </div>

      <div class="button-group">
        <button @click="handleNewDeck">🃏 New Deck</button>
        <button @click="handleDeal" :disabled="!hasDeck">🎴 Deal</button>
        <button @click="handlePlayRandom" :disabled="!hasCards">▶️ Play Card</button>
        <button @click="handleCollect" :disabled="!hasPlayedCards">🧹 Collect</button>
        <button @click="resetTable">🔄 Reset</button>
      </div>

      <div class="status">
        <p>Deck: {{ table.cardsInDeck.value.length }} cards</p>
        <p>Your hand: {{ table.cardsInHand('bottom').length }} cards</p>
        <p>Play area: {{ table.cardsInPlayArea().length }} cards</p>
      </div>
    </div>

    <!-- Table Area -->
    <div class="table" :class="`players-${playerCount}`">
      <!-- Grid areas defined by player count -->
      
      <!-- Top positions -->
      <div v-if="hasPosition('top-left')" class="seat seat-top-left">
        <SandboxHand 
          :cards="table.cardsInHand('top-left')" 
          position="top-left"
          :is-current="false"
        />
      </div>
      
      <div v-if="hasPosition('top')" class="seat seat-top">
        <SandboxHand 
          :cards="table.cardsInHand('top')" 
          position="top"
          :is-current="false"
        />
      </div>
      
      <div v-if="hasPosition('top-right')" class="seat seat-top-right">
        <SandboxHand 
          :cards="table.cardsInHand('top-right')" 
          position="top-right"
          :is-current="false"
        />
      </div>

      <!-- Side positions -->
      <div v-if="hasPosition('left')" class="seat seat-left">
        <SandboxHand 
          :cards="table.cardsInHand('left')" 
          position="left"
          :is-current="false"
        />
      </div>

      <!-- Center play area -->
      <div class="play-area">
        <SandboxPlayArea 
          :cards="table.cardsInPlayArea()" 
          :player-count="playerCount"
        />
        
        <!-- Deck in center - hidden during dealing (flying cards become the deck) -->
        <div v-if="table.cardsInDeck.value.length > 0 && !isDealing" class="deck">
          <div class="deck-card" v-for="i in Math.min(5, table.cardsInDeck.value.length)" :key="i" 
               :style="{ transform: `translateY(${-i}px)` }">
          </div>
          <span class="deck-count">{{ table.cardsInDeck.value.length }}</span>
        </div>
      </div>
      
      <!-- Flying cards animation layer -->
      <div class="flying-layer">
        <SandboxFlyingCard
          v-for="flying in flyingCards"
          :key="flying.id"
          :card="flying.card"
          :target-position="flying.targetPosition"
          :delay="flying.delay"
          :stack-index="flying.stackIndex"
          :deal-order="flying.dealOrder"
          :total-cards="flyingCards.length"
          :on-complete="() => handleFlyingCardComplete(flying.id)"
        />
      </div>

      <div v-if="hasPosition('right')" class="seat seat-right">
        <SandboxHand 
          :cards="table.cardsInHand('right')" 
          position="right"
          :is-current="false"
        />
      </div>

      <!-- Bottom (player) position -->
      <div class="seat seat-bottom">
        <SandboxHand 
          :cards="table.cardsInHand('bottom')" 
          position="bottom"
          :is-current="true"
          @card-click="handleCardClick"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import { useTable, type TablePosition, type Card } from '@/engine'
import SandboxHand from './SandboxHand.vue'
import SandboxPlayArea from './SandboxPlayArea.vue'
import SandboxFlyingCard from './SandboxFlyingCard.vue'

const playerCount = ref<2 | 3 | 4 | 5 | 6>(4)
const cardsPerHand = ref(5)

const table = useTable(playerCount.value)

// Flying cards for deal animation
interface FlyingCard {
  card: Card
  targetPosition: TablePosition
  delay: number
  stackIndex: number  // Position in player's stack
  dealOrder: number   // Overall order dealt (0 = first card dealt)
  id: string
  landed: boolean     // Has this card reached its stack position?
}
const flyingCards = ref<FlyingCard[]>([])
const isDealing = ref(false)
const allCardsLanded = ref(false)

// Track how many cards each player has received (for stacking)
const stackCounts = ref<Map<TablePosition, number>>(new Map())

// Computed helpers
const hasDeck = computed(() => table.cardsInDeck.value.length > 0)
const hasCards = computed(() => table.cardsInHand('bottom').length > 0)
const hasPlayedCards = computed(() => table.cardsInPlayArea().length > 0)

function hasPosition(pos: TablePosition): boolean {
  return table.layout.value.positions.includes(pos)
}

// Actions
function resetTable() {
  table.reset()
  table.setPlayerCount(playerCount.value)
  flyingCards.value = []
  isDealing.value = false
  allCardsLanded.value = false
}

function handleNewDeck() {
  resetTable()
  table.initializeDeck(false)
}

function handleDeal() {
  if (isDealing.value) return
  isDealing.value = true
  allCardsLanded.value = false
  
  const deckCards = [...table.cardsInDeck.value]
  const positions = table.layout.value.positions
  const totalCards = cardsPerHand.value * positions.length
  
  // Reset stack counts
  stackCounts.value = new Map()
  for (const pos of positions) {
    stackCounts.value.set(pos, 0)
  }
  
  // Create flying card entries
  const newFlyingCards: FlyingCard[] = []
  let cardIndex = 0
  
  // Deal in rounds (one card to each player per round) - like a real dealer
  for (let round = 0; round < cardsPerHand.value; round++) {
    for (const position of positions) {
      if (cardIndex >= deckCards.length || cardIndex >= totalCards) break
      
      const card = deckCards[cardIndex]
      if (!card) break
      
      // All cards start face down (will flip for human after landing)
      card.faceUp = false
      
      // Get current stack count for this position
      const currentStackIndex = stackCounts.value.get(position) ?? 0
      stackCounts.value.set(position, currentStackIndex + 1)
      
      newFlyingCards.push({
        card: { ...card },
        targetPosition: position,
        delay: cardIndex * 3000, // 3s between cards
        stackIndex: currentStackIndex,
        dealOrder: cardIndex,  // Track overall deal order for z-index
        id: `fly-${card.id}-${Date.now()}`,
        landed: false,
      })
      
      cardIndex++
    }
  }
  
  flyingCards.value = newFlyingCards
}

function handleFlyingCardComplete(flyingId: string) {
  const flying = flyingCards.value.find(f => f.id === flyingId)
  if (!flying) return
  
  // Mark as landed (card stays visible in stack)
  flying.landed = true
  
  // Check if ALL cards have landed
  const allLanded = flyingCards.value.every(f => f.landed)
  
  if (allLanded) {
    allCardsLanded.value = true
    
    // Wait a moment to show the stacks, then move to hands
    setTimeout(() => {
      moveStacksToHands()
    }, 800)  // Show stacks for 800ms before forming hands
  }
}

function moveStacksToHands() {
  // Move all flying cards to their respective hands
  for (const flying of flyingCards.value) {
    table.moveCard(flying.card.id, { zone: 'hand', position: flying.targetPosition }, false)
    
    // Update card's faceUp state
    const card = table.cards.value.get(flying.card.id)
    if (card) {
      card.faceUp = flying.targetPosition === 'bottom'
    }
  }
  
  // Clear flying cards and end dealing
  flyingCards.value = []
  isDealing.value = false
  allCardsLanded.value = false
}

function handleCardClick(cardId: string) {
  table.playCard(cardId, 'bottom')
}

function handlePlayRandom() {
  // Each player plays a random card
  for (const position of table.layout.value.positions) {
    const hand = table.cardsInHand(position)
    if (hand.length > 0) {
      const randomCard = hand[Math.floor(Math.random() * hand.length)]
      if (randomCard) {
        table.playCard(randomCard.id, position)
      }
    }
  }
}

function handleCollect() {
  // Collect to a random winner
  const positions = table.layout.value.positions
  const winner = positions[Math.floor(Math.random() * positions.length)]
  if (winner) {
    table.collectTrick(winner)
  }
}
</script>

<style scoped lang="scss">
.sandbox {
  display: flex;
  height: 100vh;
  background: #1a1a2e;
  color: #fff;
}

.controls {
  width: 260px;
  padding: 20px;
  background: #252542;
  display: flex;
  flex-direction: column;
  gap: 20px;

  h3 {
    margin: 0;
    padding-bottom: 10px;
    border-bottom: 1px solid #444;
  }
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: 5px;

  label {
    font-size: 12px;
    color: #888;
    text-transform: uppercase;
  }

  select, input {
    padding: 8px;
    border-radius: 6px;
    border: 1px solid #444;
    background: #1a1a2e;
    color: #fff;
    font-size: 14px;
  }
}

.button-group {
  display: flex;
  flex-direction: column;
  gap: 8px;

  button {
    padding: 10px;
    border-radius: 6px;
    border: none;
    background: #4a4a6a;
    color: #fff;
    font-size: 14px;
    cursor: pointer;
    transition: background 0.2s;

    &:hover:not(:disabled) {
      background: #5a5a8a;
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }
}

.status {
  margin-top: auto;
  padding: 15px;
  background: #1a1a2e;
  border-radius: 8px;
  font-size: 13px;

  p {
    margin: 5px 0;
    color: #888;
  }
}

// Table layout using CSS Grid
.table {
  flex: 1;
  display: grid;
  gap: 10px;
  padding: 20px;
  position: relative;  // Needed for flying-layer positioning
  background: 
    radial-gradient(ellipse at center, #1e5631 0%, #0d3320 70%),
    linear-gradient(135deg, #1e4d2b 0%, #0d2818 100%);
  
  // Default 4-player layout
  grid-template-columns: 1fr 2fr 1fr;
  grid-template-rows: 1fr 2fr 1fr;
  grid-template-areas:
    ".    top    ."
    "left center right"
    ".    bottom .";

  &.players-2 {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr 2fr 1fr;
    grid-template-areas:
      "top"
      "center"
      "bottom";
  }

  &.players-3 {
    grid-template-columns: 1fr 2fr 1fr;
    grid-template-rows: 1fr 2fr 1fr;
    grid-template-areas:
      ".    .      ."
      "left center right"
      ".    bottom .";
  }

  &.players-5 {
    grid-template-columns: 1fr 1fr 1fr 1fr 1fr;
    grid-template-rows: 1fr 2fr 1fr;
    grid-template-areas:
      ".    top-left .      top-right ."
      "left .        center .         right"
      ".    .        bottom .         .";
  }

  &.players-6 {
    grid-template-columns: 1fr 1fr 1fr 1fr 1fr;
    grid-template-rows: 1fr 2fr 1fr;
    grid-template-areas:
      ".    top-left top    top-right ."
      "left .        center .         right"
      ".    .        bottom .         .";
  }
}

.seat {
  display: flex;
  align-items: center;
  justify-content: center;
  
  &-top { grid-area: top; }
  &-top-left { grid-area: top-left; }
  &-top-right { grid-area: top-right; }
  &-left { grid-area: left; }
  &-right { grid-area: right; }
  &-bottom { grid-area: bottom; }
}

.play-area {
  grid-area: center;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 1;  // Low z-index so flying-layer can be above
}

.deck {
  position: absolute;
  width: 70px;
  height: 100px;
  z-index: 100;  // Below flying cards
  
  .deck-card {
    position: absolute;
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, #1a3a7c 0%, #0d1f4d 100%);
    border-radius: 6px;
    border: 2px solid #2a4a9c;
  }
  
  .deck-count {
    position: absolute;
    bottom: -25px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 12px;
    color: #888;
  }
}

.flying-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1000;  // Above deck
  pointer-events: none;
}
</style>
