<template>
  <CardTable
    ref="tableRef"
    :player-count="4"
    :player-names="playerNames"
    :player-statuses="playerStatuses"
    :avatar-opacities="[1, 1, 1, 1]"
    :engine="engine"
    :dealer-seat="dealerSeat"
    :current-turn-seat="currentTurnSeat"
    :dimmed-card-ids="dimmedCardIds"
    layout="normal"
    @card-click="handleCardClick"
  >
    <!-- Player bid info tags -->
    <template v-for="(player, i) in store.players" :key="i" #[`player-info-${i}`]>
      <div v-if="player.bid" class="info-chip bid-chip">
        {{ getBidDisplay(player.bid) }}
      </div>
      <div v-if="store.phase === 'playing' || store.phase === 'trick_complete'" class="info-chip tricks-chip">
        {{ player.tricksWon }}
      </div>
    </template>

    <!-- Scoreboard -->
    <div class="scoreboard spades-scoreboard">
      <div class="score-header">
        <span></span>
        <span>Pts</span>
        <span>Bid</span>
        <span>Trk</span>
        <span>Bag</span>
      </div>
      <div class="score-row">
        <span class="score-label">Us</span>
        <span class="score-value">{{ scores[0]?.score ?? 0 }}</span>
        <span class="score-tricks">{{ store.teamBids[0] }}</span>
        <span class="score-tricks">{{ store.teamTricks[0] }}</span>
        <span class="score-bags">{{ scores[0]?.bags ?? 0 }}</span>
      </div>
      <div class="score-row">
        <span class="score-label">Them</span>
        <span class="score-value">{{ scores[1]?.score ?? 0 }}</span>
        <span class="score-tricks">{{ store.teamBids[1] }}</span>
        <span class="score-tricks">{{ store.teamTricks[1] }}</span>
        <span class="score-bags">{{ scores[1]?.bags ?? 0 }}</span>
      </div>
    </div>

    <!-- Leave button -->
    <button class="leave-btn" @click="handleLeaveClick">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </button>

    <!-- Spades Broken indicator -->
    <div v-if="store.spadesBroken" class="spades-broken-indicator">
      ♠ Broken
    </div>

    <!-- Round indicator -->
    <div class="round-indicator">
      Round {{ store.roundNumber }}
    </div>

    <!-- Game Over overlay -->
    <div v-if="store.gameOver" class="game-over-overlay">
      <div class="game-over-panel">
        <div class="game-over-title">Game Over</div>
        <div class="game-over-result">{{ winnerText }}</div>
        <div class="game-over-scores">
          <span>Us {{ scores[0]?.score ?? 0 }} - {{ scores[1]?.score ?? 0 }} Them</span>
        </div>
        <div class="game-over-actions">
          <button class="action-btn primary" @click="handlePlayAgain">Play Again</button>
          <button class="action-btn" @click="emit('leave-game')">Exit</button>
        </div>
      </div>
    </div>

    <!-- Leave confirmation -->
    <div v-if="showLeaveConfirm" class="game-over-overlay">
      <div class="game-over-panel">
        <div class="game-over-title">Leave Game?</div>
        <div class="panel-message">You'll forfeit the current game.</div>
        <div class="game-over-actions">
          <button class="action-btn" @click="confirmLeave">Leave</button>
          <button class="action-btn primary" @click="showLeaveConfirm = false">Stay</button>
        </div>
      </div>
    </div>

    <!-- Action panel -->
    <div class="action-panel" :class="{ 'is-my-turn': store.isHumanTurn }">
      <div class="panel-header">
        <div class="panel-name">{{ userName }}</div>
      </div>

      <!-- Bidding phase -->
      <template v-if="store.isHumanBidding">
        <div class="panel-message">Your bid</div>
        <div class="bid-selector">
          <select v-model="selectedBid" class="bid-select">
            <option v-for="n in 14" :key="n-1" :value="n-1">{{ n-1 }}</option>
          </select>
          <button class="action-btn primary" @click="handleBid">Bid {{ selectedBid }}</button>
        </div>
        <div class="special-bids">
          <button class="action-btn nil-btn" @click="handleNilBid">Nil</button>
        </div>
      </template>

      <!-- Playing phase -->
      <template v-else-if="store.isHumanPlaying">
        <div class="panel-message">Your turn - play a card</div>
      </template>

      <!-- Waiting -->
      <template v-else-if="store.phase === 'bidding'">
        <div class="panel-message">Waiting for bids...</div>
      </template>

      <template v-else-if="store.phase === 'playing' || store.phase === 'trick_complete'">
        <div class="panel-message">{{ currentPlayerName }}'s turn</div>
      </template>
    </div>
  </CardTable>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { SpadesPhase, SpadesBidType, Spades, type SpadesBid, type StandardCard } from '@euchre/shared'
import CardTable from '../CardTable.vue'
import { useCardTable } from '@/composables/useCardTable'
import { computeTableLayout } from '@/composables/useTableLayout'
import { useSpadesStore } from '@/stores/spadesStore'

const emit = defineEmits<{
  'leave-game': []
}>()

const store = useSpadesStore()
const engine = useCardTable()
const tableRef = ref<InstanceType<typeof CardTable> | null>(null)

const showLeaveConfirm = ref(false)
const selectedBid = ref(3)
const boardRef = ref<HTMLElement | null>(null)
const tableCenter = ref({ x: 0, y: 0 })

// Player names
const playerNames = computed(() => store.players.map(p => p.name))

// Player statuses for display
const playerStatuses = computed(() => {
  return store.players.map(p => {
    if (store.phase === SpadesPhase.Bidding) {
      return p.bid ? getBidDisplay(p.bid) : ''
    }
    return ''
  })
})

// Dealer seat (always player seat 0 in this simplified version)
const dealerSeat = computed(() => {
  // Rotate based on dealer
  return store.dealer
})

// Current turn seat
const currentTurnSeat = computed(() => {
  if (store.phase === SpadesPhase.Bidding || store.phase === SpadesPhase.Playing) {
    return store.currentPlayer
  }
  return -1
})

// Dimmed card IDs (cards that can't be legally played)
const dimmedCardIds = computed(() => {
  if (!store.isHumanPlaying) return new Set<string>()
  
  const human = store.humanPlayer
  if (!human) return new Set<string>()
  
  const validIds = new Set(store.validPlays.map(c => c.id))
  return new Set(human.hand.filter(c => !validIds.has(c.id)).map(c => c.id))
})

// Scores
const scores = computed(() => store.scores)

// User info
const userName = computed(() => store.humanPlayer?.name ?? 'You')

const currentPlayerName = computed(() => {
  return store.players[store.currentPlayer]?.name ?? ''
})

// Winner text
const winnerText = computed(() => {
  if (store.winner === null) return ''
  const myTeam = store.humanPlayer?.teamId ?? 0
  return store.winner === myTeam ? 'You Win!' : 'You Lose'
})

// Get bid display text
function getBidDisplay(bid: SpadesBid): string {
  return Spades.getBidDisplayText(bid)
}

// Handle card click
function handleCardClick(cardId: string) {
  if (!store.isHumanPlaying) return
  
  const human = store.humanPlayer
  if (!human) return
  
  const card = human.hand.find(c => c.id === cardId)
  if (!card) return
  
  // Check if legal
  if (!store.validPlays.some(c => c.id === cardId)) return
  
  store.playCard(card)
}

// Bidding actions
function handleBid() {
  store.makeBid({ type: SpadesBidType.Normal, count: selectedBid.value })
}

function handleNilBid() {
  store.makeBid({ type: SpadesBidType.Nil, count: 0 })
}

// Leave game
function handleLeaveClick() {
  showLeaveConfirm.value = true
}

function confirmLeave() {
  showLeaveConfirm.value = false
  emit('leave-game')
}

// Play again
function handlePlayAgain() {
  store.startNewGame()
  initializeBoard()
}

// Initialize card engine with hands
async function initializeBoard() {
  engine.reset()
  
  await nextTick()
  
  // Get board reference from CardTable
  if (tableRef.value) {
    boardRef.value = tableRef.value.boardRef
  }
  
  // Get board dimensions
  const board = boardRef.value
  if (!board) return

  const layout = computeTableLayout(board.offsetWidth, board.offsetHeight, 'normal', 4)
  tableCenter.value = layout.tableCenter

  // Create deck in center
  engine.createDeck({ x: tableCenter.value.x, y: tableCenter.value.y }, 0.8)

  // Create hands for 4 players based on table layout
  for (let i = 0; i < 4; i++) {
    const seat = layout.seats[i]!
    engine.createHand(`hand-${i}`, seat.handPosition, {
      fanSpacing: seat.isUser ? 30 : 16,
      faceUp: seat.isUser,
      rotation: seat.rotation,
      scale: seat.isUser ? 1.0 : 0.7,
      fanCurve: 0,
      angleToCenter: seat.angleToCenter,
      isUser: seat.isUser,
    })
  }

  // Create center pile
  engine.createPile('center', { x: tableCenter.value.x, y: tableCenter.value.y }, 0.8)
  
  engine.refreshCards()
}

// Watch for game state changes and update cards
watch(() => store.phase, async (newPhase) => {
  if (newPhase === SpadesPhase.Dealing) {
    await initializeBoard()
    
    // Add cards to deck then deal
    for (const player of store.players) {
      for (const card of player.hand) {
        engine.addCardToDeck({
          id: card.id,
          suit: card.suit,
          rank: card.rank,
        }, false)
      }
    }

    // Ensure card refs exist before dealing
    engine.refreshCards()
    await nextTick()

    const deck = engine.getDeck()
    if (deck) {
      for (let i = 0; i < deck.cards.length; i++) {
        deck.cards[i]?.ref?.setPosition(deck.getCardPosition(i))
      }
    }
    
    // Deal animation
    await engine.dealAll(13, 50, 200)

    // Fan hands after deal
    await Promise.all(engine.getHands().map(hand => hand.setMode('fanned', 250)))

    // Flip user's cards face up and sort them
    const userHand = engine.getHands().find(h => h.id === 'hand-0')
    if (userHand) {
      // Flip all user cards face up
      for (const managed of userHand.cards) {
        const ref = engine.getCardRef(managed.card.id)
        if (ref) {
          const pos = ref.getPosition()
          await ref.moveTo({ ...pos, flipY: 180 }, 200)
        }
      }
      
      // Sort user's hand by suit (spades first) then rank
      const suitOrder: Record<string, number> = { spades: 0, hearts: 1, clubs: 2, diamonds: 3 }
      const rankOrder: Record<string, number> = { 
        '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
        'J': 11, 'Q': 12, 'K': 13, 'A': 14 
      }
      
      userHand.cards.sort((a, b) => {
        const suitDiff = (suitOrder[a.card.suit] ?? 99) - (suitOrder[b.card.suit] ?? 99)
        if (suitDiff !== 0) return suitDiff
        return (rankOrder[a.card.rank] ?? 0) - (rankOrder[b.card.rank] ?? 0)
      })
      
      // Reposition after sort
      await userHand.repositionAll(300)
    }

    store.dealAnimationComplete()
  }
}, { immediate: true })

function getTrickCardTarget(index: number) {
  const radius = 18
  const angle = (index / 4) * Math.PI * 2
  return {
    x: tableCenter.value.x + Math.cos(angle) * radius,
    y: tableCenter.value.y + Math.sin(angle) * radius,
    rotation: (index % 2 === 0 ? -6 : 6),
    zIndex: 500 + index,
    scale: 0.9,
    flipY: 180,
  }
}

onMounted(async () => {
  await nextTick()
  // Ensure CardTable has mounted and boardRef is available
  if (tableRef.value) {
    boardRef.value = tableRef.value.boardRef
  }

  store.setPlayAnimationCallback(async ({ card, playerId }) => {
    const pile = engine.getPiles().find(p => p.id === 'center')
    const fromHand = engine.getHands().find(h => h.id === `hand-${playerId}`)
    if (!pile || !fromHand) return

    const cardIndex = Math.max(0, store.currentTrick.cards.length - 1)
    const target = getTrickCardTarget(cardIndex)
    await engine.moveCard(card.id, fromHand, pile, target, 300)
  })

  store.setTrickCompleteCallback(async () => {
    const pile = engine.getPiles().find(p => p.id === 'center')
    const board = boardRef.value
    if (!pile || !board) return

    const offX = board.offsetWidth + 200
    const offY = tableCenter.value.y
    const moves = pile.cards.map((managed, i) => {
      const ref = engine.getCardRef(managed.card.id)
      return ref?.moveTo({
        x: offX,
        y: offY,
        rotation: 20,
        zIndex: 100 + i,
        scale: 0.6,
      }, 300)
    })
    await Promise.all(moves)
    pile.clear()
    engine.refreshCards()
  })

  store.startNewGame()
})

onUnmounted(() => {
  engine.reset()
})
</script>

<style scoped lang="scss">
// Standard layout: scoreboard top-left, action panel bottom-left
.scoreboard {
  position: absolute;
  top: 10px;
  left: max(10px, env(safe-area-inset-left));
  z-index: 500;
  background: rgba(20, 20, 30, 0.88);
  border: 1px solid #444;
  border-radius: 8px;
  padding: 8px 10px;
  backdrop-filter: blur(8px);
  font-size: 14px;
  color: #ccc;
}

.spades-scoreboard {
  .score-header {
    display: grid;
    grid-template-columns: 50px 40px 40px 30px 30px;
    gap: 4px;
    font-size: 0.7rem;
    opacity: 0.7;
    margin-bottom: 4px;
  }
  
  .score-row {
    display: grid;
    grid-template-columns: 50px 40px 40px 30px 30px;
    gap: 4px;
  }
  
  .score-bags {
    color: #f39c12;
  }
}

.leave-btn {
  position: absolute;
  top: 10px;
  right: max(10px, env(safe-area-inset-right));
  z-index: 500;
  width: 40px;
  height: 40px;
  border-radius: 8px;
  border: 1px solid #444;
  background: rgba(20, 20, 30, 0.8);
  color: #ccc;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:hover {
    background: rgba(40, 40, 50, 0.9);
  }
  
  svg {
    width: 24px;
    height: 24px;
  }
}

.action-panel {
  position: absolute;
  bottom: max(10px, env(safe-area-inset-bottom));
  left: max(10px, env(safe-area-inset-left));
  z-index: 500;
  background: rgba(20, 20, 30, 0.9);
  border: 1px solid #444;
  border-radius: 12px;
  padding: 12px 16px;
  backdrop-filter: blur(8px);
  min-width: 180px;
  
  &.is-my-turn {
    border-color: #4CAF50;
    box-shadow: 0 0 10px rgba(76, 175, 80, 0.3);
  }
  
  .panel-header {
    margin-bottom: 8px;
  }
  
  .panel-name {
    font-weight: 600;
    color: #fff;
    font-size: 1rem;
  }
  
  .panel-message {
    color: #aaa;
    font-size: 0.9rem;
    margin-bottom: 8px;
  }
}

.action-btn {
  padding: 8px 16px;
  border-radius: 8px;
  border: none;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  
  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }
  
  &.primary {
    background: #4CAF50;
    color: white;
    
    &:hover {
      background: #45a049;
    }
  }
}

.spades-broken-indicator {
  position: absolute;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.7);
  color: #3498db;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 0.85rem;
  font-weight: bold;
}

.round-indicator {
  position: absolute;
  top: 10px;
  right: 60px;
  background: rgba(0, 0, 0, 0.5);
  color: white;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 0.85rem;
}

.bid-chip {
  background: rgba(52, 152, 219, 0.8);
  color: white;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: bold;
}

.tricks-chip {
  background: rgba(46, 204, 113, 0.8);
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.7rem;
  margin-left: 4px;
}

.bid-selector {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}

.bid-select {
  padding: 8px 12px;
  font-size: 1rem;
  border-radius: 8px;
  border: none;
  background: white;
  color: #1e4d2b;
}

.special-bids {
  display: flex;
  gap: 8px;
}

.nil-btn {
  background: #e74c3c !important;
  color: white !important;
}

.info-chip {
  display: inline-block;
  margin-right: 4px;
}
</style>
