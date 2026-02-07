<template>
  <div class="sandbox-v2">
    <!-- Controls -->
    <div class="controls">
      <h3>🎮 Card Engine v2</h3>
      
      <div class="control-group">
        <label>Cards per hand:</label>
        <input type="number" v-model.number="cardsPerHand" min="1" max="13" />
      </div>

      <div class="button-group">
        <button @click="handleNewDeck">🃏 New Deck</button>
        <button @click="handleDeal" :disabled="!hasDeck || isDealing">🎴 Deal</button>
        <button @click="handleFan" :disabled="!hasDealt">👐 Fan Hands</button>
        <button @click="handleStack" :disabled="!hasDealt">📚 Stack Hands</button>
        <button @click="handleReset">🔄 Reset</button>
      </div>

      <div class="status">
        <p>Deck: {{ deck?.cards.length ?? 0 }} cards</p>
        <p>Dealing: {{ isDealing ? 'Yes' : 'No' }}</p>
      </div>
    </div>

    <!-- Board -->
    <div ref="boardRef" class="board">
      <!-- All cards rendered here -->
      <BoardCard
        v-for="managed in allCards"
        :key="managed.card.id"
        :ref="(el) => setCardRef(managed.card.id, el)"
        :card="managed.card"
        :face-up="managed.faceUp"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, shallowRef, triggerRef } from 'vue'
import { createStandardDeck } from '@euchre/shared'
import BoardCard from './BoardCard.vue'
import { Deck, Hand, type ManagedCard, type BoardCardRef, type SandboxCard } from './cardContainers'

const boardRef = ref<HTMLElement | null>(null)
const cardsPerHand = ref(5)

// Containers (shallowRef since we manage reactivity manually)
const deck = shallowRef<Deck | null>(null)
const hands = shallowRef<Hand[]>([])

// State
const isDealing = ref(false)
const hasDealt = ref(false)

// Trigger for re-rendering cards
const cardsTrigger = ref(0)
function refreshCards() {
  cardsTrigger.value++
}

// All cards from all containers for rendering
const allCards = computed<ManagedCard[]>(() => {
  // Depend on trigger for manual reactivity
  const _ = cardsTrigger.value
  
  const cards: ManagedCard[] = []
  if (deck.value) {
    cards.push(...deck.value.cards)
  }
  for (const hand of hands.value) {
    cards.push(...hand.cards)
  }
  return cards
})

const hasDeck = computed(() => {
  const _ = cardsTrigger.value
  return (deck.value?.cards.length ?? 0) > 0
})

// Card refs
const cardRefs = new Map<string, BoardCardRef>()

function setCardRef(cardId: string, el: any) {
  if (el) {
    cardRefs.set(cardId, el as BoardCardRef)
    // Also set on the container
    deck.value?.setCardRef(cardId, el as BoardCardRef)
    for (const hand of hands.value) {
      hand.setCardRef(cardId, el as BoardCardRef)
    }
  } else {
    cardRefs.delete(cardId)
  }
}

// Get board dimensions
function getBoardCenter(): { x: number; y: number } {
  if (!boardRef.value) return { x: 400, y: 300 }
  const rect = boardRef.value.getBoundingClientRect()
  return { x: rect.width / 2, y: rect.height / 2 }
}

// Initialize containers with positions based on board size
function initializeContainers() {
  if (!boardRef.value) return
  
  const rect = boardRef.value.getBoundingClientRect()
  const cx = rect.width / 2
  const cy = rect.height / 2
  
  // Create deck at center
  deck.value = new Deck({ x: cx, y: cy })
  
  // Create 4 hands around the board
  hands.value = [
    new Hand('bottom', { x: cx, y: rect.height - 80 }, { 
      faceUp: true, 
      fanDirection: 'horizontal',
      fanSpacing: 30,
      rotation: 0 
    }),
    new Hand('left', { x: 100, y: cy }, { 
      faceUp: false, 
      fanDirection: 'vertical',
      fanSpacing: 20,
      rotation: 90 
    }),
    new Hand('top', { x: cx, y: 80 }, { 
      faceUp: false, 
      fanDirection: 'horizontal',
      fanSpacing: 20,
      rotation: 180 
    }),
    new Hand('right', { x: rect.width - 100, y: cy }, { 
      faceUp: false, 
      fanDirection: 'vertical',
      fanSpacing: 20,
      rotation: -90 
    }),
  ]
}

// Create a new deck
async function handleNewDeck() {
  handleReset()
  
  await nextTick()
  initializeContainers()
  
  if (!deck.value) return
  
  // Create cards (convert from StandardCard to SandboxCard)
  const standardCards = createStandardDeck()
  for (const sc of standardCards) {
    const card: SandboxCard = {
      id: sc.id,
      suit: sc.suit,
      rank: sc.rank,
    }
    deck.value.addCard(card, false)
  }
  
  refreshCards()
  
  // Wait for Vue to render the cards
  await nextTick()
  
  // Set initial positions
  for (let i = 0; i < deck.value.cards.length; i++) {
    const managed = deck.value.cards[i]
    const pos = deck.value.getCardPosition(i)
    managed?.ref?.setPosition(pos)
  }
}

// Deal cards to all hands
async function handleDeal() {
  if (!deck.value || isDealing.value) return
  
  isDealing.value = true
  
  const totalCards = cardsPerHand.value * hands.value.length
  let cardIndex = 0
  
  // Deal in rounds
  for (let round = 0; round < cardsPerHand.value; round++) {
    for (const hand of hands.value) {
      if (cardIndex >= totalCards) break
      
      // Deal from deck to hand
      const managed = deck.value.dealTo(hand)
      if (!managed) break
      
      // Capture position BEFORE moving
      const cardId = managed.card.id
      const cardRef = cardRefs.get(cardId)
      const startPos = cardRef?.getPosition()
      
      refreshCards()
      await nextTick()  // Wait for Vue to process the change
      
      // Re-grab ref after render (might be same or updated)
      const cardRefAfter = cardRefs.get(cardId)
      
      // Get target position (loose stack for now)
      const handIndex = hand.cards.length - 1
      const targetPos = hand.getCardPosition(handIndex)
      
      // Animate the card
      if (startPos && cardRefAfter) {
        // Restore starting position with high z-index
        cardRefAfter.setPosition({ ...startPos, zIndex: 1000 + cardIndex })
        
        // Start animation (don't await - let cards fly in parallel with delay)
        cardRefAfter.moveTo(targetPos, 300)
      }
      
      // Delay between cards being dealt
      await new Promise(r => setTimeout(r, 80))
      
      cardIndex++
    }
  }
  
  isDealing.value = false
  hasDealt.value = true
}

// Fan all hands
async function handleFan() {
  const promises = hands.value.map(hand => hand.setMode('fanned', 400))
  await Promise.all(promises)
}

// Stack all hands
async function handleStack() {
  const promises = hands.value.map(hand => hand.setMode('looseStack', 400))
  await Promise.all(promises)
}

// Reset everything
function handleReset() {
  deck.value = null
  hands.value = []
  cardRefs.clear()
  isDealing.value = false
  hasDealt.value = false
}

onMounted(() => {
  initializeContainers()
})
</script>

<style scoped lang="scss">
.sandbox-v2 {
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

  input {
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

.board {
  flex: 1;
  position: relative;
  background: 
    radial-gradient(ellipse at center, #1e5631 0%, #0d3320 70%),
    linear-gradient(135deg, #1e4d2b 0%, #0d2818 100%);
  overflow: hidden;
}
</style>
