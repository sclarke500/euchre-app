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
      <!-- Table surface -->
      <div class="table-surface"></div>
      
      <!-- Player avatars (outside table) -->
      <div 
        v-for="(hand, i) in hands" 
        :key="'avatar-' + hand.id"
        class="player-avatar"
        :class="{ 'is-user': i === 0 }"
        :style="getAvatarStyle(i)"
      >
        <div class="avatar-circle">{{ i === 0 ? '👤' : `P${i + 1}` }}</div>
      </div>
      
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

// Table layout - stored for avatar positioning
const tableLayout = ref({
  x: 0, y: 0,  // table center
  width: 0, height: 0,  // table dimensions
  playerCount: 5,
})

// Avatar positions (calculated based on table)
const avatarPositions = ref<Array<{ x: number; y: number }>>([])

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

// Get avatar position style
function getAvatarStyle(playerIndex: number) {
  const pos = avatarPositions.value[playerIndex]
  if (!pos) return {}
  return {
    left: `${pos.x}px`,
    top: `${pos.y}px`,
  }
}

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
  const boardW = rect.width
  const boardH = rect.height
  
  // Table dimensions - positioned in upper portion, room for user's hand below
  const tableMargin = 60  // More space around table
  const userHandHeight = 150
  const tableW = boardW - tableMargin * 2
  const tableH = boardH - userHandHeight - tableMargin
  const tableX = boardW / 2  // center X
  const tableY = tableMargin + tableH / 2  // center Y (shifted up)
  
  tableLayout.value = {
    x: tableX,
    y: tableY,
    width: tableW,
    height: tableH,
    playerCount: 5,
  }
  
  // Table center (where kitty will be)
  const center = { x: tableX, y: tableY }
  
  // Create deck at table center (will be kitty position)
  deck.value = new Deck({ x: tableX, y: tableY })
  
  // Player positions
  const playerCount = 5
  hands.value = []
  avatarPositions.value = []
  
  // Ellipse for opponent hands ON the table
  const handRx = tableW * 0.35  // hands inside table
  const handRy = tableH * 0.35
  
  // Avatar offset from table edge
  const avatarOffset = 40
  
  // Helper: find where ray from center at angle intersects rectangle edge
  function getRectEdgePoint(angle: number, halfW: number, halfH: number, offset: number) {
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    
    // Find intersection with rectangle edges
    // Rectangle edges at ±halfW (left/right) and ±halfH (top/bottom)
    let x, y
    
    if (Math.abs(cos) * halfH > Math.abs(sin) * halfW) {
      // Hits left or right edge
      x = cos > 0 ? halfW + offset : -(halfW + offset)
      y = sin * (halfW + offset) / Math.abs(cos)
    } else {
      // Hits top or bottom edge
      y = sin > 0 ? halfH + offset : -(halfH + offset)
      x = cos * (halfH + offset) / Math.abs(sin)
    }
    
    return { x, y }
  }
  
  for (let i = 0; i < playerCount; i++) {
    const isUser = i === 0
    
    if (isUser) {
      // User's hand is below the table
      const userPos = { x: tableX, y: boardH - 60 }
      const angleToCenter = Hand.calcAngleToCenter(userPos, center)
      
      hands.value.push(new Hand('player-0', userPos, {
        faceUp: false,
        fanDirection: 'horizontal',
        fanSpacing: 30,
        rotation: 0,  // User's cards face up
        scale: 1.3,
        fanCurve: 8,
        angleToCenter,
      }))
      
      // User avatar at bottom center (below hand)
      avatarPositions.value.push({ x: tableX, y: boardH - 20 })
    } else {
      // Opponent hands ON the table, arranged around upper arc
      // Skip the bottom position (that's the user), distribute others on top arc
      const opponentIndex = i - 1  // 0 to 3 for opponents
      const opponentCount = playerCount - 1
      // Spread from left to right across the top
      const angle = Math.PI + (opponentIndex + 0.5) * Math.PI / opponentCount
      
      const handPos = {
        x: tableX + handRx * Math.cos(angle),
        y: tableY + handRy * Math.sin(angle),
      }
      const angleToCenter = Hand.calcAngleToCenter(handPos, center)
      
      hands.value.push(new Hand(`player-${i}`, handPos, {
        faceUp: false,
        fanDirection: 'horizontal',
        fanSpacing: 12,
        rotation: angleToCenter + 90,
        scale: 0.5,
        fanCurve: 3,
        angleToCenter,
      }))
      
      // Avatar outside the table - use rectangle edge positioning
      const avatarEdge = getRectEdgePoint(angle, tableW / 2, tableH / 2, avatarOffset)
      avatarPositions.value.push({
        x: tableX + avatarEdge.x,
        y: tableY + avatarEdge.y,
      })
    }
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
  background: #1a1a2e;  // Dark background outside table
  overflow: hidden;
}

.table-surface {
  position: absolute;
  top: 60px;
  left: 60px;
  right: 60px;
  bottom: 150px;  // Room for user's hand
  border-radius: 40px;
  background: 
    radial-gradient(ellipse at center, #1e5631 0%, #0d3320 70%),
    linear-gradient(135deg, #1e4d2b 0%, #0d2818 100%);
  border: 8px solid #3d2817;  // Wood-colored border
  box-shadow: 
    inset 0 0 60px rgba(0, 0, 0, 0.4),
    0 4px 20px rgba(0, 0, 0, 0.5);
}

.player-avatar {
  position: absolute;
  transform: translate(-50%, -50%);
  z-index: 50;
  
  .avatar-circle {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: #3a3a5a;
    border: 3px solid #5a5a8a;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    font-weight: bold;
    color: #fff;
    box-shadow: 0 3px 12px rgba(0, 0, 0, 0.4);
  }
  
  &.is-user {
    display: none;  // Hide user avatar for now
  }
}
</style>
