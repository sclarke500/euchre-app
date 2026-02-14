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
        <span v-if="player.isHuman">{{ player.name }}:</span>
        {{ getBidDisplay(player.bid) }}
      </div>
    </template>

    <!-- Scoreboard (simplified - just points and bags) -->
    <div class="scoreboard spades-scoreboard">
      <div class="score-row">
        <span class="score-label">Us</span>
        <span class="score-value">{{ scores[0]?.score ?? 0 }}</span>
        <span class="score-bags">{{ scores[0]?.bags ?? 0 }}🎒</span>
      </div>
      <div class="score-row">
        <span class="score-label">Them</span>
        <span class="score-value">{{ scores[1]?.score ?? 0 }}</span>
        <span class="score-bags">{{ scores[1]?.bags ?? 0 }}🎒</span>
      </div>
    </div>

    <!-- Leave button -->
    <button class="leave-btn" @click="handleLeaveClick">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </button>

    <!-- Bug report button -->
    <button class="bug-btn" title="Report a bug" @click="openBugReport">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </button>

    <!-- Bug Report Modal -->
    <Modal :show="showBugReport" @close="showBugReport = false">
      <template #default>
        <div class="bug-title">Bug Report</div>
        <p class="bug-desc">{{ reportDescription }}</p>
        <textarea 
          v-model="reportDescription" 
          class="bug-textarea" 
          placeholder="Describe what went wrong..."
          rows="3"
        />
        <div class="bug-status" :class="{ success: reportStatus.includes('Sent') }">{{ reportStatus }}</div>
        <div class="bug-actions">
          <button class="action-btn primary" :disabled="sendingReport" @click="sendBugReportAction">
            {{ sendingReport ? 'Sending...' : 'Send Report' }}
          </button>
          <button class="action-btn" @click="copyBugReport">Copy</button>
          <button class="action-btn" @click="showBugReport = false">Close</button>
        </div>
      </template>
    </Modal>

    <!-- Spades Broken indicator -->
    <div v-if="store.spadesBroken" class="spades-broken-indicator">
      ♠ Broken
    </div>

    <!-- Round Summary Modal -->
    <Transition name="modal-fade">
      <div v-if="showRoundSummary" class="game-over-overlay">
        <div class="round-summary-panel">
          <div class="round-summary-title">Round Complete</div>
          <div class="round-summary-table">
            <div class="summary-header">
              <span></span>
              <span>Us</span>
              <span>Them</span>
            </div>
            <div class="summary-row">
              <span>Bid</span>
              <span>{{ roundSummary.usBid }}</span>
              <span>{{ roundSummary.themBid }}</span>
            </div>
            <div class="summary-row">
              <span>Tricks</span>
              <span>{{ roundSummary.usTricks }}</span>
              <span>{{ roundSummary.themTricks }}</span>
            </div>
            <div class="summary-row">
              <span>Base Points</span>
              <span :class="{ positive: roundSummary.usBasePoints > 0, negative: roundSummary.usBasePoints < 0 }">
                {{ roundSummary.usBasePoints >= 0 ? '+' : '' }}{{ roundSummary.usBasePoints }}
              </span>
              <span :class="{ positive: roundSummary.themBasePoints > 0, negative: roundSummary.themBasePoints < 0 }">
                {{ roundSummary.themBasePoints >= 0 ? '+' : '' }}{{ roundSummary.themBasePoints }}
              </span>
            </div>
            <div v-if="roundSummary.usNilBonus || roundSummary.themNilBonus" class="summary-row">
              <span>Nil Bonus</span>
              <span class="positive">{{ roundSummary.usNilBonus ? '+' + roundSummary.usNilBonus : '' }}</span>
              <span class="positive">{{ roundSummary.themNilBonus ? '+' + roundSummary.themNilBonus : '' }}</span>
            </div>
            <div v-if="roundSummary.usNilPenalty || roundSummary.themNilPenalty" class="summary-row">
              <span>Nil Failed</span>
              <span class="negative">{{ roundSummary.usNilPenalty ? '-' + roundSummary.usNilPenalty : '' }}</span>
              <span class="negative">{{ roundSummary.themNilPenalty ? '-' + roundSummary.themNilPenalty : '' }}</span>
            </div>
            <div v-if="roundSummary.usBagPenalty || roundSummary.themBagPenalty" class="summary-row">
              <span>Bag Penalty</span>
              <span class="negative">{{ roundSummary.usBagPenalty ? '-' + roundSummary.usBagPenalty : '' }}</span>
              <span class="negative">{{ roundSummary.themBagPenalty ? '-' + roundSummary.themBagPenalty : '' }}</span>
            </div>
            <div class="summary-row total">
              <span>Round Total</span>
              <span :class="{ positive: roundSummary.usTotal > 0, negative: roundSummary.usTotal < 0 }">
                {{ roundSummary.usTotal >= 0 ? '+' : '' }}{{ roundSummary.usTotal }}
              </span>
              <span :class="{ positive: roundSummary.themTotal > 0, negative: roundSummary.themTotal < 0 }">
                {{ roundSummary.themTotal >= 0 ? '+' : '' }}{{ roundSummary.themTotal }}
              </span>
            </div>
            <div class="summary-row game-total">
              <span>Game Score</span>
              <span>{{ scores[0]?.score ?? 0 }}</span>
              <span>{{ scores[1]?.score ?? 0 }}</span>
            </div>
          </div>
          <div class="game-over-actions">
            <button class="action-btn primary" @click="dismissRoundSummary">Continue</button>
          </div>
        </div>
      </div>
    </Transition>

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
        <div class="panel-name">
          {{ userName }}
          <span v-if="store.humanPlayer?.bid" class="info-chip bid-chip user-bid-chip">
            {{ getBidDisplay(store.humanPlayer.bid) }}
          </span>
        </div>
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
import Modal from '../Modal.vue'
import { useCardTable } from '@/composables/useCardTable'
import { useCardController, cardControllerPresets } from '@/composables/useCardController'
import { useSpadesStore } from '@/stores/spadesStore'
import { useSpadesMultiplayerStore } from '@/stores/spadesMultiplayerStore'
import { sendBugReport } from '@/services/autoBugReport'

const props = withDefaults(defineProps<{
  mode?: 'singleplayer' | 'multiplayer'
}>(), {
  mode: 'singleplayer',
})

const emit = defineEmits<{
  'leave-game': []
}>()

const singleStore = useSpadesStore()
const multiplayerStore = useSpadesMultiplayerStore()
const store = (props.mode === 'multiplayer' ? multiplayerStore : singleStore) as any
const engine = useCardTable()
const tableRef = ref<InstanceType<typeof CardTable> | null>(null)

const showLeaveConfirm = ref(false)
const selectedBid = ref(3)
const boardRef = ref<HTMLElement | null>(null)
const cardController = useCardController(engine, boardRef, {
  layout: 'normal',
  playerCount: 4,
  userSeatIndex: () => store.humanPlayer?.id ?? 0,
  userHandScale: 1.6,
  opponentHandScale: 0.7,
  userFanSpacing: 30,
  opponentFanSpacing: 16,
  userFanCurve: 0,
  playMoveMs: 350,
  ...cardControllerPresets.spades,
})
const showRoundSummary = ref(false)
const showBugReport = ref(false)
const reportDescription = ref('')
const reportStatus = ref('')
const sendingReport = ref(false)
const opponentsHidden = ref(false)
const animatedTrickCardIds = ref<Set<string>>(new Set())
const completedTricksAnimated = ref(0)
const processingMultiplayerAnimations = ref(false)
const pendingMultiplayerAnimationPass = ref(false)
const roundSummary = ref({
  usBid: 0,
  themBid: 0,
  usTricks: 0,
  themTricks: 0,
  usBasePoints: 0,
  themBasePoints: 0,
  usNilBonus: 0,
  themNilBonus: 0,
  usNilPenalty: 0,
  themNilPenalty: 0,
  usBagPenalty: 0,
  themBagPenalty: 0,
  usTotal: 0,
  themTotal: 0,
})

// Player names
const playerNames = computed(() => store.players.map((p: { name: string }) => p.name))

// Player statuses for display
const playerStatuses = computed(() => {
  return store.players.map(() => '')
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
  
  const human = store.humanPlayer as { hand: Array<{ id: string }> } | undefined
  if (!human) return new Set<string>()
  
  const validIds = new Set<string>(store.validPlays.map((c: { id: string }) => c.id))
  return new Set<string>(human.hand.filter((c: { id: string }) => !validIds.has(c.id)).map((c: { id: string }) => c.id))
})

// Scores
const scores = computed(() => store.scores)

// User info
const userName = computed(() => store.humanPlayer?.name ?? 'You')

const currentPlayerName = computed(() => {
  return store.players[store.currentPlayer]?.name ?? ''
})

const suitOrder: Record<string, number> = { spades: 0, hearts: 1, clubs: 2, diamonds: 3 }
const rankOrder: Record<string, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  'J': 11, 'Q': 12, 'K': 13, 'A': 14,
}

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
  
  const card = human.hand.find((c: { id: string }) => c.id === cardId)
  if (!card) return
  
  // Check if legal
  if (!store.validPlays.some((c: { id: string }) => c.id === cardId)) return
  
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

// ── Bug Report ──────────────────────────────────────────────────────────
function openBugReport() {
  reportStatus.value = ''
  showBugReport.value = true
}

function buildBugReportPayload() {
  return {
    gameType: 'spades',
    mode: props.mode,
    phase: store.phase,
    currentPlayer: store.currentPlayer,
    roundNumber: store.roundNumber,
    scores: store.scores,
    spadesBroken: store.spadesBroken,
    players: store.players.map((p: any) => ({
      id: p.id,
      name: p.name,
      bid: p.bid,
      tricksWon: p.tricksWon,
      handSize: p.hand?.length ?? p.handSize ?? 0,
    })),
    currentTrick: store.currentTrick,
    completedTricksCount: store.completedTricks?.length ?? 0,
    description: reportDescription.value,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
  }
}

async function sendBugReportAction() {
  sendingReport.value = true
  reportStatus.value = 'Sending...'
  try {
    const payload = buildBugReportPayload()
    await sendBugReport({
      ...payload,
      reportType: 'user',
      userDescription: reportDescription.value.trim() || 'No description provided',
    })
    reportStatus.value = 'Sent! Thanks for reporting.'
    setTimeout(() => { showBugReport.value = false }, 1500)
  } catch (err) {
    console.error('Failed to send report:', err)
    reportStatus.value = 'Failed to send. Try copying instead.'
  } finally {
    sendingReport.value = false
  }
}

async function copyBugReport() {
  try {
    const payload = buildBugReportPayload()
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
    reportStatus.value = 'Copied to clipboard!'
  } catch (err) {
    console.error('Failed to copy:', err)
    reportStatus.value = 'Failed to copy'
  }
}

// Play again
function handlePlayAgain() {
  store.startNewGame()
  initializeBoard()
}

// Dismiss round summary and start next round
function dismissRoundSummary() {
  showRoundSummary.value = false
  store.startNextRound()
}

function buildDealPlayers() {
  return store.players.map((player: { hand?: StandardCard[]; handSize?: number }) => ({
    hand: player.hand,
    handSize: player.handSize,
  }))
}

async function animateCompletedTricksDelta() {
  while (completedTricksAnimated.value < store.completedTricks.length) {
    const trick = store.completedTricks[completedTricksAnimated.value]
    if (!trick) {
      completedTricksAnimated.value++
      continue
    }

    const trickCards = trick.cards ?? []
    for (let i = 0; i < trickCards.length; i++) {
      const played = trickCards[i]
      if (!played || animatedTrickCardIds.value.has(played.card.id)) continue
      await cardController.playCard(played.card, played.playerId, i)
      animatedTrickCardIds.value.add(played.card.id)
    }

    await cardController.completeTrick(trick.winnerId ?? 0)
    completedTricksAnimated.value++
  }
}

async function animateCurrentTrickDelta() {
  const cards = store.currentTrick.cards ?? []
  for (let i = 0; i < cards.length; i++) {
    const played = cards[i]
    if (!played || animatedTrickCardIds.value.has(played.card.id)) continue
    await cardController.playCard(played.card, played.playerId, i)
    animatedTrickCardIds.value.add(played.card.id)
  }
}

async function processMultiplayerAnimationPass() {
  if (props.mode !== 'multiplayer') return

  if (processingMultiplayerAnimations.value) {
    pendingMultiplayerAnimationPass.value = true
    return
  }

  processingMultiplayerAnimations.value = true
  try {
    do {
      pendingMultiplayerAnimationPass.value = false
      await animateCompletedTricksDelta()
      await animateCurrentTrickDelta()
    } while (pendingMultiplayerAnimationPass.value)
  } finally {
    processingMultiplayerAnimations.value = false
  }
}

// Initialize card engine with hands
async function initializeBoard() {
  await nextTick()

  // Get board reference from CardTable
  if (tableRef.value) {
    boardRef.value = tableRef.value.boardRef
  }

  cardController.setupTable(store.dealer)
}

// Watch for game state changes and update cards
watch(() => store.phase, async (newPhase) => {
  if (newPhase === SpadesPhase.Dealing) {
    if (props.mode === 'multiplayer') {
      store.enableQueueMode()
    }

    await initializeBoard()

    opponentsHidden.value = false
    animatedTrickCardIds.value = new Set<string>()
    completedTricksAnimated.value = 0

    await cardController.dealFromPlayers(buildDealPlayers(), {
      revealUserHand: false,
      focusUserHand: true,
      dealDelayMs: 50,
      dealFlightMs: 200,
      fanDurationMs: 450,
      dealerSeatIndex: store.dealer,
      sortAfterDeal: false,
      sortUserHand: (cards) => {
        const sorted = [...cards]
        sorted.sort((a, b) => {
          const suitDiff = (suitOrder[a.suit] ?? 99) - (suitOrder[b.suit] ?? 99)
          if (suitDiff !== 0) return suitDiff
          return (rankOrder[a.rank] ?? 0) - (rankOrder[b.rank] ?? 0)
        })
        return sorted
      },
    })

    await cardController.revealUserHand(350)
    await cardController.sortUserHand((cards) => {
      const sorted = [...cards]
      sorted.sort((a, b) => {
        const suitDiff = (suitOrder[a.suit] ?? 99) - (suitOrder[b.suit] ?? 99)
        if (suitDiff !== 0) return suitDiff
        return (rankOrder[a.rank] ?? 0) - (rankOrder[b.rank] ?? 0)
      })
      return sorted
    }, 300)

    if (props.mode === 'multiplayer') {
      store.disableQueueMode()
    }

    store.dealAnimationComplete()
  }
  
  // Show round summary modal when round completes
  if (newPhase === SpadesPhase.RoundComplete) {
    await new Promise(r => setTimeout(r, 800))
    // Calculate round scores
    const usScore = Spades.calculateRoundScore(store.players, 0, store.scores[0]?.bags ?? 0)
    const themScore = Spades.calculateRoundScore(store.players, 1, store.scores[1]?.bags ?? 0)
    
    roundSummary.value = {
      usBid: usScore.baseBid,
      themBid: themScore.baseBid,
      usTricks: usScore.tricksWon,
      themTricks: themScore.tricksWon,
      usBasePoints: usScore.tricksWon >= usScore.baseBid ? usScore.baseBid * 10 : -usScore.baseBid * 10,
      themBasePoints: themScore.tricksWon >= themScore.baseBid ? themScore.baseBid * 10 : -themScore.baseBid * 10,
      usNilBonus: usScore.nilBonus,
      themNilBonus: themScore.nilBonus,
      usNilPenalty: usScore.nilPenalty,
      themNilPenalty: themScore.nilPenalty,
      usBagPenalty: Math.abs(usScore.bagsPenalty),
      themBagPenalty: Math.abs(themScore.bagsPenalty),
      usTotal: usScore.roundPoints,
      themTotal: themScore.roundPoints,
    }
    
    showRoundSummary.value = true
  }

  if (props.mode === 'multiplayer' && newPhase !== SpadesPhase.RoundComplete) {
    showRoundSummary.value = false
  }
}, { immediate: true })

watch(
  () => [store.currentTrick.cards.length, store.completedTricks.length, store.phase],
  async () => {
    if (props.mode !== 'multiplayer') return
    if (store.phase === SpadesPhase.Setup || store.phase === SpadesPhase.Dealing) return
    await processMultiplayerAnimationPass()
  },
  { immediate: true }
)

watch(
  () => [store.phase, store.bidsComplete, store.currentTrick.cards.length],
  async ([phase, bidsComplete, trickCount]) => {
    if (phase === SpadesPhase.Playing && bidsComplete && trickCount === 0 && !opponentsHidden.value) {
      await cardController.hideOpponentHands()
      opponentsHidden.value = true
    }
  }
)

onMounted(async () => {
  await nextTick()
  // Ensure CardTable has mounted and boardRef is available
  if (tableRef.value) {
    boardRef.value = tableRef.value.boardRef
  }

  cardController.setupTable(store.dealer)

  store.setPlayAnimationCallback(async ({ card, playerId }: { card: StandardCard; playerId: number }) => {
    const cardIndex = Math.max(0, store.currentTrick.cards.length - 1)
    await cardController.playCard(card, playerId, cardIndex)
  })

  store.setTrickCompleteCallback(async (winnerId: number) => {
    await cardController.completeTrick(winnerId)
  })

  if (props.mode === 'multiplayer') {
    store.initialize()
  } else {
    store.startNewGame()
  }
})

onUnmounted(() => {
  if (props.mode === 'multiplayer') {
    store.cleanup()
  }
  engine.reset()
})
</script>

<style scoped lang="scss">
// Standard layout: scoreboard top-right, action panel bottom-left
.scoreboard {
  position: absolute;
  top: 10px;
  right: max(60px, env(safe-area-inset-right) + 50px);
  z-index: 500;
  background: rgba(20, 20, 30, 0.88);
  border: 1px solid #444;
  border-radius: 8px;
  padding: 8px 12px;
  backdrop-filter: blur(8px);
  font-size: 14px;
  color: #ccc;
}

.spades-scoreboard {
  .score-row {
    display: flex;
    gap: 12px;
    align-items: center;
    padding: 2px 0;
    
    &:first-child {
      border-bottom: 1px solid rgba(255,255,255,0.1);
      padding-bottom: 4px;
      margin-bottom: 2px;
    }
  }
  
  .score-label {
    font-weight: 600;
    min-width: 40px;
  }
  
  .score-value {
    font-weight: 700;
    font-size: 16px;
    color: #fff;
    min-width: 40px;
    text-align: right;
  }
  
  .score-bags {
    font-size: 12px;
    color: #f39c12;
  }
}

.round-summary-panel {
  background: rgba(20, 20, 30, 0.95);
  border: 1px solid #555;
  border-radius: 12px;
  padding: 20px;
  min-width: 280px;
  max-width: 90vw;
}

.round-summary-title {
  font-size: 1.3rem;
  font-weight: 700;
  color: #fff;
  text-align: center;
  margin-bottom: 16px;
}

.round-summary-table {
  margin-bottom: 16px;
}

.summary-header {
  display: grid;
  grid-template-columns: 1fr 60px 60px;
  gap: 8px;
  padding: 4px 0;
  border-bottom: 1px solid rgba(255,255,255,0.2);
  margin-bottom: 8px;
  font-weight: 600;
  color: #aaa;
  text-align: center;
  
  span:first-child {
    text-align: left;
  }
}

.summary-row {
  display: grid;
  grid-template-columns: 1fr 60px 60px;
  gap: 8px;
  padding: 4px 0;
  color: #ccc;
  text-align: center;
  
  span:first-child {
    text-align: left;
    color: #aaa;
  }
  
  &.total {
    border-top: 1px solid rgba(255,255,255,0.2);
    margin-top: 8px;
    padding-top: 8px;
    font-weight: 700;
    color: #fff;
  }
  
  &.game-total {
    border-top: 2px solid rgba(255,215,0,0.5);
    margin-top: 8px;
    padding-top: 8px;
    font-weight: 700;
    font-size: 1.1rem;
    color: #ffd700;
  }
  
  .positive {
    color: #4CAF50;
  }
  
  .negative {
    color: #e74c3c;
  }
}

.game-over-overlay {
  position: absolute;
  inset: 0;
  z-index: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
}

.game-over-panel {
  background: rgba(20, 20, 30, 0.95);
  border: 1px solid #555;
  border-radius: 12px;
  padding: 20px 28px;
  text-align: center;
  min-width: 200px;
  backdrop-filter: blur(10px);
}

.game-over-title {
  font-size: 18px;
  font-weight: 700;
  color: #fff;
  margin-bottom: 6px;
}

.game-over-result {
  font-size: 14px;
  font-weight: 600;
  color: #ffd700;
  margin-bottom: 4px;
}

.game-over-scores {
  font-size: 12px;
  color: #aaa;
  margin-bottom: 14px;
}

.game-over-actions {
  display: flex;
  gap: 8px;
  justify-content: center;
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity var(--anim-medium) ease, transform var(--anim-medium) ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
  transform: scale(0.92);
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

.bug-btn {
  position: absolute;
  top: 10px;
  right: max(58px, calc(env(safe-area-inset-right) + 48px));
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

.bug-title {
  font-size: 1.25rem;
  font-weight: bold;
  margin-bottom: 8px;
}

.bug-desc {
  color: #aaa;
  margin-bottom: 12px;
}

.bug-textarea {
  width: 100%;
  padding: 8px;
  border-radius: 6px;
  border: 1px solid #444;
  background: rgba(0, 0, 0, 0.3);
  color: #fff;
  resize: vertical;
  margin-bottom: 8px;
}

.bug-status {
  font-size: 0.875rem;
  color: #aaa;
  min-height: 20px;
  margin-bottom: 8px;

  &.success {
    color: #4CAF50;
  }
}

.bug-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.action-panel {
  position: absolute;
  bottom: 12px;
  right: max(12px, env(safe-area-inset-right));
  z-index: 600;
  background: rgba(20, 20, 30, 0.9);
  border: 1px solid #444;
  border-radius: 12px;
  padding: 12px 16px;
  backdrop-filter: blur(8px);
  min-width: 180px;
  
  &.is-my-turn {
    border: 2px solid rgba(255, 215, 0, 0.5);
    background: rgba(40, 38, 20, 0.92);
    box-shadow:
      0 0 12px rgba(255, 215, 0, 0.2),
      0 0 30px rgba(255, 215, 0, 0.08);
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
    background: linear-gradient(135deg, #d4a84b 0%, #b8942f 100%);
    color: #1a1a1a;
    
    &:hover {
      background: linear-gradient(135deg, #e0b555 0%, #c9a340 100%);
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
