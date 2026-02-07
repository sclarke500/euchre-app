<template>
  <div class="sandbox">
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

// Animation constants
const DEAL_FLIGHT_MS = 400
const DEAL_DELAY_MS = 80

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
  
  // Board center (where kitty will be)
  const center = { x: cx, y: cy }
  
  // Create deck at bottom right corner
  deck.value = new Deck({ x: rect.width, y: rect.height })
  
  // Position players around an ellipse
  const playerCount = 5
  const rx = cx - 100  // horizontal radius
  const ry = cy - 80   // vertical radius
  
  hands.value = []
  for (let i = 0; i < playerCount; i++) {
    // Start from bottom (user), go clockwise
    const angle = (Math.PI / 2) + (i * 2 * Math.PI / playerCount)
    const pos = {
      x: cx + rx * Math.cos(angle),
      y: cy + ry * Math.sin(angle),
    }
    const angleToCenter = Hand.calcAngleToCenter(pos, center)
    const isUser = i === 0
    
    hands.value.push(new Hand(`player-${i}`, pos, {
      faceUp: false,
      fanDirection: 'horizontal',
      fanSpacing: isUser ? 30 : 15,
      rotation: angleToCenter + 90,  // Rotate so cards face inward
      scale: isUser ? 1.3 : 0.6,
      fanCurve: isUser ? 8 : 0,
      angleToCenter,
    }))
  }
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
      
      // Capture position and ref BEFORE moving
      const cardId = managed.card.id
      const cardRef = cardRefs.get(cardId)
      const startPos = cardRef?.getPosition()
      
      // Get target position (card is now in hand)
      const handIndex = hand.cards.length - 1
      const targetPos = hand.getCardPosition(handIndex)
      
      // Animate the card (don't refresh yet - we have the ref)
      if (startPos && cardRef) {
        // Set high z-index (no transition)
        cardRef.setPosition({ ...startPos, zIndex: 1000 + cardIndex })
        
        // Wait for browser to paint the start position before animating
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
        
        // Now animate to target
        cardRef.moveTo(targetPos, DEAL_FLIGHT_MS)
      }
      
      // Delay between cards being dealt
      await new Promise(r => setTimeout(r, DEAL_DELAY_MS))
      
      cardIndex++
    }
  }
  
  // Wait for last card's animation to complete before refreshing
  await new Promise(r => setTimeout(r, DEAL_FLIGHT_MS))
  
  // Now refresh to sync Vue's view with the new card ownership
  refreshCards()
  
  isDealing.value = false
  hasDealt.value = true
}

// Fan all hands
async function handleFan() {
  if (!boardRef.value) return
  const rect = boardRef.value.getBoundingClientRect()
  
  const userHand = hands.value[0]  // First hand is always user
  if (userHand) {
    // Step 1: Move user hand down and flip cards (180 deg)
    userHand.position = { x: rect.width / 2, y: rect.height }
    
    // Animate each card to new position with flip
    for (const managed of userHand.cards) {
      const cardRef = cardRefs.get(managed.card.id)
      if (cardRef) {
        const currentPos = cardRef.getPosition()
        cardRef.moveTo({
          ...currentPos,
          y: rect.height,
          flipY: 180,  // Flip the card
        }, 500)
      }
    }
    
    // Wait for flip/move to complete
    // Cards now at flipY=180, faceUp=false → showFaceUp=true (showing face)
    // Don't change anything - the visual is correct
    await new Promise(r => setTimeout(r, 550))
  }
  
  // Step 2: All hands fan and resize simultaneously
  const fanPromises = hands.value.map(hand => hand.setMode('fanned', 400))
  await Promise.all(fanPromises)
  
  refreshCards()
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
