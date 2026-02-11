<template>
  <div class="sandbox">
    <!-- Board takes full space -->
    <div ref="boardRef" class="board">
      <!-- Floating controls dropdown -->
      <div class="controls-dropdown" :class="{ open: controlsOpen }">
        <button class="controls-toggle" @click="controlsOpen = !controlsOpen">
          {{ controlsOpen ? '✕' : '☰' }}
        </button>
        <div v-show="controlsOpen" class="controls-panel">
          <div class="control-group">
            <label>Layout</label>
            <select v-model="tableLayout" @change="handleReset">
              <option value="normal">Normal (4 players)</option>
              <option value="wide">Wide (5+ players)</option>
            </select>
          </div>
          <div class="control-group">
            <label>Cards</label>
            <input type="number" v-model.number="cardsPerHand" min="1" max="13" />
          </div>
          <div class="button-row">
            <button @click="handleNewDeck">Deck</button>
            <button @click="handleDeal" :disabled="!hasDeck || isDealing">Deal</button>
            <button @click="handleFan" :disabled="!hasDealt">Fan</button>
            <button @click="handleStack" :disabled="!hasDealt">Stack</button>
            <button @click="handleReset">Reset</button>
          </div>
          <div class="status">Deck: {{ engine.deck.value?.cards.length ?? 0 }}</div>
        </div>
      </div>
      <!-- Table surface -->
      <div ref="tableRef" class="table-surface" :class="tableLayout">
        <!-- Player avatars positioned outside the table -->
        <div
          v-for="(hand, i) in engine.hands.value"
          :key="'avatar-' + hand.id"
          class="player-avatar"
          :class="[`seat-${i}`, { 'is-user': i === 0 }]"
        >
          <div class="avatar-circle">{{ playerNames[i]?.[0] ?? '?' }}</div>
          <div class="player-name">{{ playerNames[i] }}</div>
          <!-- Slot for future info tags (dealer chip, turn indicator, etc.) -->
          <div class="info-tags"></div>
        </div>
      </div>
      
      <!-- All cards rendered here -->
      <BoardCard
        v-for="managed in engine.allCards.value"
        :key="managed.card.id"
        :ref="(el) => engine.setCardRef(managed.card.id, el)"
        :card="managed.card"
        :face-up="managed.faceUp"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { createStandardDeck, getRandomAINames } from '@euchre/shared'
import BoardCard from '../BoardCard.vue'
import type { SandboxCard } from '../cardContainers'
import { useCardTable } from '@/composables/useCardTable'
import { computeTableLayout } from '@/composables/useTableLayout'

const boardRef = ref<HTMLElement | null>(null)
const tableRef = ref<HTMLElement | null>(null)
const cardsPerHand = ref(5)
const tableLayout = ref<'normal' | 'wide'>('wide')
const controlsOpen = ref(false)
const playerNames = ref<string[]>([])

const engine = useCardTable()

const DEAL_FLIGHT_MS = 400
const DEAL_DELAY_MS = 80

const isDealing = ref(false)
const hasDealt = ref(false)

const hasDeck = computed(() => {
  engine.allCards.value // trigger reactivity
  return (engine.getDeck()?.cards.length ?? 0) > 0
})

function initializeContainers() {
  if (!boardRef.value) return

  const w = boardRef.value.offsetWidth
  const h = boardRef.value.offsetHeight
  const isWide = tableLayout.value === 'wide'
  const playerCount = isWide ? 5 : 4

  const layout = computeTableLayout(w, h, tableLayout.value, playerCount)

  engine.createDeck(layout.tableCenter, 1.0)

  playerNames.value = ['You', ...getRandomAINames(playerCount - 1)]

  for (let i = 0; i < layout.seats.length; i++) {
    const seat = layout.seats[i]!
    const isUser = seat.isUser

    engine.createHand(`player-${i}`, seat.handPosition, {
      faceUp: false,
      fanDirection: 'horizontal',
      fanSpacing: isUser ? 30 : 12,
      rotation: seat.rotation,
      scale: 1.0,
      fanCurve: isUser ? 8 : 0,
      angleToCenter: seat.angleToCenter,
      isUser,
    })
  }
}

async function handleNewDeck() {
  handleReset()

  await nextTick()
  initializeContainers()

  const deck = engine.getDeck()
  if (!deck) return

  const standardCards = createStandardDeck()
  for (const sc of standardCards) {
    const card: SandboxCard = { id: sc.id, suit: sc.suit, rank: sc.rank }
    engine.addCardToDeck(card, false)
  }

  engine.refreshCards()

  await nextTick()

  for (let i = 0; i < deck.cards.length; i++) {
    const managed = deck.cards[i]
    const pos = deck.getCardPosition(i)
    managed?.ref?.setPosition(pos)
  }
}

async function handleDeal() {
  const deck = engine.getDeck()
  if (!deck || isDealing.value) return

  isDealing.value = true
  await engine.dealAll(cardsPerHand.value, DEAL_DELAY_MS, DEAL_FLIGHT_MS)
  isDealing.value = false
  hasDealt.value = true
}

async function handleFan() {
  if (!boardRef.value) return
  const hands = engine.getHands()

  const userHand = hands[0]
  if (userHand) {
    const targetY = boardRef.value.offsetHeight - 50
    const targetX = boardRef.value.offsetWidth / 2
    const targetScale = 1.4

    userHand.position = { x: targetX, y: targetY }
    userHand.scale = targetScale
    userHand.fanSpacing = 40

    for (const managed of userHand.cards) {
      engine.getCardRef(managed.card.id)?.setArcFan(true)
    }

    for (const managed of userHand.cards) {
      const cardRef = engine.getCardRef(managed.card.id)
      if (cardRef) {
        const currentPos = cardRef.getPosition()
        cardRef.moveTo({
          ...currentPos,
          x: targetX,
          y: targetY,
          scale: targetScale,
          flipY: 180,
        }, 500)
      }
    }

    await new Promise(r => setTimeout(r, 550))
  }

  for (let i = 1; i < hands.length; i++) {
    const hand = hands[i]
    if (hand) hand.scale = 0.65
  }

  const fanPromises = hands.map(hand => hand.setMode('fanned', 400))
  await Promise.all(fanPromises)

  engine.refreshCards()
}

async function handleStack() {
  const hands = engine.getHands()

  for (const hand of hands) {
    hand.scale = 1.0
  }

  const userHand = hands[0]
  if (userHand) {
    for (const managed of userHand.cards) {
      engine.getCardRef(managed.card.id)?.setArcFan(false)
    }
  }

  const promises = hands.map(hand => hand.setMode('looseStack', 400))
  await Promise.all(promises)
}

function handleReset() {
  engine.reset()
  isDealing.value = false
  hasDealt.value = false
}

onMounted(() => {
  initializeContainers()
})
</script>

<style scoped lang="scss">
.sandbox {
  height: 100%;
  color: #fff;
}

.controls-dropdown {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 500;

  .controls-toggle {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    border: 1px solid #444;
    background: rgba(30, 30, 40, 0.85);
    color: #ccc;
    font-size: 18px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(8px);

    &:hover { background: rgba(50, 50, 65, 0.9); }
  }

  .controls-panel {
    margin-top: 6px;
    padding: 12px;
    background: rgba(30, 30, 40, 0.92);
    border: 1px solid #444;
    border-radius: 10px;
    backdrop-filter: blur(10px);
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 200px;
  }
}

.control-group {
  display: flex;
  align-items: center;
  gap: 8px;

  label {
    font-size: 11px;
    color: #888;
    text-transform: uppercase;
    min-width: 42px;
  }

  input, select {
    flex: 1;
    padding: 5px 8px;
    border-radius: 5px;
    border: 1px solid #444;
    background: #1e1e28;
    color: #fff;
    font-size: 13px;
  }

  input[type="number"] { width: 50px; flex: 0; }
}

.button-row {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;

  button {
    padding: 5px 10px;
    border-radius: 5px;
    border: none;
    background: #4a4a6a;
    color: #fff;
    font-size: 12px;
    cursor: pointer;
    transition: background var(--anim-fast);

    &:hover:not(:disabled) { background: #5a5a8a; }
    &:disabled { opacity: 0.4; cursor: not-allowed; }
  }
}

.status {
  font-size: 11px;
  color: #666;
}

.board {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;

  // Table palette — change these to retheme
  --felt: #24735a;
  --felt-dark: #1a5440;
  --rail: #4a3728;
  --rail-accent: #5c4533;
  --surface-bg: #23232e;

  background:
    radial-gradient(ellipse at center 40%, rgba(255,255,255,0.04) 0%, transparent 50%),
    radial-gradient(ellipse at center 40%, var(--surface-bg) 0%, #181820 100%);
}

.table-surface {
  position: absolute;
  top: 15%;
  bottom: 20%;  // Room for user's hand
  border-radius: 40px;
  background:
    radial-gradient(ellipse at center, var(--felt) 0%, var(--felt-dark) 70%);
  border: 8px solid var(--rail);
  box-shadow:
    inset 0 0 60px rgba(0, 0, 0, 0.25),
    0 4px 20px rgba(0, 0, 0, 0.5),
    0 0 0 2px var(--rail-accent);
  
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
    left: 10%;
    right: 10%;
  }
  
  // Normal layout (4 players) - more square
  &.normal {
    left: 30%;
    right: 30%;
    border-radius: 30px;
  }
}

.player-avatar {
  position: absolute;
  transform: translate(-50%, -50%);
  z-index: 300;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;

  .avatar-circle {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: #333344;
    border: 2px solid #4a4a60;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 15px;
    font-weight: bold;
    color: #ccc;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
  }

  .player-name {
    padding: 1px 8px;
    font-size: 11px;
    font-weight: 600;
    color: #ccc;
    white-space: nowrap;
    background: rgba(0, 0, 0, 0.5);
    border-radius: 4px;
  }

  .info-tags {
    display: flex;
    gap: 4px;
  }

  // Seat positions - outside the table in the margins
  &.seat-0 { display: none; }  // User - hidden
  &.seat-1 { left: -40px; top: 50%; }
  &.seat-2 { left: 25%; top: -30px; }
  &.seat-3 { left: 75%; top: -30px; }
  &.seat-4 { left: calc(100% + 40px); top: 50%; }

  // Normal layout overrides (4 players)
  .table-surface.normal & {
    &.seat-2 { left: 50%; top: -30px; }
    &.seat-3 { left: calc(100% + 40px); top: 50%; }
    &.seat-4 { display: none; }
  }
}
</style>
