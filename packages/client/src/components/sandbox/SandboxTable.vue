<template>
  <div class="sandbox">
    <!-- Controls -->
    <div class="controls">
      <h3>🎮 Card Engine v2</h3>
      
      <div class="control-group">
        <label>Table Layout:</label>
        <select v-model="tableLayout" @change="handleReset">
          <option value="normal">Normal (4 players)</option>
          <option value="wide">Wide (5+ players)</option>
        </select>
      </div>
      
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
      <!-- Table surface with avatars positioned around it -->
      <div ref="tableRef" class="table-surface" :class="tableLayout">
        <!-- Player avatars positioned via CSS classes -->
        <div 
          v-for="(hand, i) in hands" 
          :key="'avatar-' + hand.id"
          class="player-avatar"
          :class="[`seat-${i}`, { 'is-user': i === 0 }]"
        >
          <div class="avatar-circle">{{ i === 0 ? '👤' : `P${i + 1}` }}</div>
          <div class="player-name">{{ i === 0 ? 'You' : `Player ${i + 1}` }}</div>
        </div>
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
const tableRef = ref<HTMLElement | null>(null)
const cardsPerHand = ref(5)
const tableLayout = ref<'normal' | 'wide'>('wide')  // normal = 4 players, wide = 5+ players

// Containers (shallowRef since we manage reactivity manually)
const deck = shallowRef<Deck | null>(null)
const hands = shallowRef<Hand[]>([])

// Table dimensions (calculated)
const tableDimensions = ref({
  x: 0, y: 0,  // table center
  width: 0, height: 0,  // table dimensions
  playerCount: 5,
})

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
  const boardW = rect.width
  const boardH = rect.height
  
  // Table dimensions - using percentages to match CSS
  const isWideLayout = tableLayout.value === 'wide'
  const tableMarginX = isWideLayout ? 0.05 : 0.15  // 5% wide, 15% normal
  const tableMarginTop = 0.06  // 6% top
  const userAreaPct = 0.20     // 20% for user's hand area
  const tableW = boardW * (1 - tableMarginX * 2)
  const tableH = boardH * (1 - tableMarginTop - userAreaPct)
  const tableX = boardW / 2  // center X
  const tableY = boardH * tableMarginTop + tableH / 2  // center Y
  
  tableDimensions.value = {
    x: tableX,
    y: tableY,
    width: tableW,
    height: tableH,
    playerCount: tableLayout.value === 'normal' ? 4 : 5,
  }
  
  // Table center (where kitty will be)
  const center = { x: tableX, y: tableY }
  
  // Create deck at table center (will be kitty position)
  deck.value = new Deck({ x: tableX, y: tableY }, 1.0)
  
  // Player positions based on layout
  const isWide = tableLayout.value === 'wide'
  const playerCount = isWide ? 5 : 4
  hands.value = []
  
  // Table bounds in board coordinates
  const tableLeft = boardW * tableMarginX
  const tableTop = boardH * tableMarginTop
  const tableRight = tableLeft + tableW
  const tableBottom = tableTop + tableH
  
  // Distance from table edge for opponent hands
  const handInset = Math.min(tableW, tableH) * 0.12
  
  // Seat definitions based on layout
  // Normal (4 players): user at bottom, one opponent on each other side
  // Wide (5 players): user at bottom, 2 at top, 1 each side
  const seats = isWide ? [
    { side: 'bottom', pos: 0.5, rotation: 0 },      // Player 0 (user)
    { side: 'left', pos: 0.5, rotation: 90 },       // Player 1 - left
    { side: 'top', pos: 0.25, rotation: 180 },      // Player 2 - top left
    { side: 'top', pos: 0.75, rotation: 180 },      // Player 3 - top right
    { side: 'right', pos: 0.5, rotation: -90 },     // Player 4 - right
  ] : [
    { side: 'bottom', pos: 0.5, rotation: 0 },      // Player 0 (user)
    { side: 'left', pos: 0.5, rotation: 90 },       // Player 1 - left
    { side: 'top', pos: 0.5, rotation: 180 },       // Player 2 - top (partner)
    { side: 'right', pos: 0.5, rotation: -90 },     // Player 3 - right
  ]
  
  for (let i = 0; i < playerCount; i++) {
    const isUser = i === 0
    const seat = seats[i]
    if (!seat) continue
    
    let handX: number, handY: number
    
    // Position hand on table, inset from edge
    switch (seat.side) {
      case 'left':
        handX = tableLeft + handInset
        handY = tableTop + seat.pos * tableH
        break
      case 'right':
        handX = tableRight - handInset
        handY = tableTop + seat.pos * tableH
        break
      case 'top':
        handX = tableLeft + seat.pos * tableW
        handY = tableTop + handInset
        break
      default: // bottom (user)
        handX = tableX
        handY = tableBottom - handInset
    }
    
    const handPos = { x: handX, y: handY }
    const angleToCenter = Hand.calcAngleToCenter(handPos, center)
    
    hands.value.push(new Hand(`player-${i}`, handPos, {
      faceUp: false,
      fanDirection: 'horizontal',
      fanSpacing: isUser ? 30 : 12,
      rotation: seat.rotation,  // Aligned with table edge
      scale: 1.0,  // Base scale
      fanCurve: isUser ? 8 : 0,  // Only user gets curve
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
    // Step 1: Move user's cards to bottom center, enlarge, and flip
    const targetY = rect.height - 50  // Near bottom of board
    const targetX = rect.width / 2
    const targetScale = 1.4  // Larger for user's fanned hand
    
    // Update hand position and scale for fanned state
    userHand.position = { x: targetX, y: targetY }
    userHand.scale = targetScale
    userHand.fanSpacing = 40  // Wider spacing when enlarged
    
    // Animate each card to new position with flip and scale
    // Include originY now so there's no jump when fanning adds it
    const originDistance = 120 * targetScale
    for (const managed of userHand.cards) {
      const cardRef = cardRefs.get(managed.card.id)
      if (cardRef) {
        const currentPos = cardRef.getPosition()
        cardRef.moveTo({
          ...currentPos,
          x: targetX,
          y: targetY,
          scale: targetScale,
          flipY: 180,  // Flip the card
          originX: 0,
          originY: originDistance,
        }, 500)
      }
    }
    
    // Wait for flip/move to complete
    await new Promise(r => setTimeout(r, 550))
  }
  
  // Step 2: Scale up opponent hands and fan all
  for (let i = 1; i < hands.value.length; i++) {
    const hand = hands.value[i]
    if (hand) hand.scale = 0.8  // Slightly larger when fanned
  }
  
  const fanPromises = hands.value.map(hand => hand.setMode('fanned', 400))
  await Promise.all(fanPromises)
  
  refreshCards()
}

// Stack all hands
async function handleStack() {
  // Reset all hands to base scale
  for (const hand of hands.value) {
    hand.scale = 1.0
  }
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
  height: 100%;
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

  input, select {
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
  top: 6%;
  bottom: 20%;  // Room for user's hand
  border-radius: 40px;
  background: 
    radial-gradient(ellipse at center, #2d7a4a 0%, #1a5c35 70%),
    linear-gradient(135deg, #2a6b40 0%, #1a4d2d 100%);
  border: 8px solid #3d2817;  // Wood-colored border
  box-shadow: 
    inset 0 0 60px rgba(0, 0, 0, 0.3),
    0 4px 20px rgba(0, 0, 0, 0.5);
  
  // Watermark logo
  &::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 200px;
    height: 200px;
    background: url('@/assets/AppLogo.png') center/contain no-repeat;
    opacity: 0.08;
    pointer-events: none;
  }
  
  // Wide layout (5+ players) - rectangular
  &.wide {
    left: 5%;
    right: 5%;
  }
  
  // Normal layout (4 players) - more square
  &.normal {
    left: 15%;
    right: 15%;
    border-radius: 30px;
  }
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
  
  .player-name {
    margin-top: 4px;
    font-size: 12px;
    color: #ccc;
    text-align: center;
    white-space: nowrap;
  }
  
  // Seat positions (relative to table-surface)
  &.seat-0 { display: none; }  // User - hidden
  &.seat-1 { left: 0; top: 50%; transform: translate(-50%, -50%); }  // Left
  &.seat-2 { left: 25%; top: 0; transform: translate(-50%, -50%); }  // Top left (wide) / Top center (normal)
  &.seat-3 { left: 75%; top: 0; transform: translate(-50%, -50%); }  // Top right (wide) / Right (normal)
  &.seat-4 { left: 100%; top: 50%; transform: translate(-50%, -50%); }  // Right (wide only)
  
  // Normal layout overrides (4 players)
  .table-surface.normal & {
    &.seat-2 { left: 50%; top: 0; }  // Top center (partner)
    &.seat-3 { left: 100%; top: 50%; }  // Right
    &.seat-4 { display: none; }  // No 5th player
  }
}
</style>
