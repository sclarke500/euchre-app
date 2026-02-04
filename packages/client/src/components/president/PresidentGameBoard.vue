<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { usePresidentGameAdapter } from '@/composables/usePresidentGameAdapter'
import { PresidentPhase, sortHandByRank, isValidPlay, type StandardCard, type Card as EuchreCard } from '@euchre/shared'
import BackButton from '../BackButton.vue'
import Card from '../Card.vue'
import Modal from '../Modal.vue'

// Helper to cast StandardCard to EuchreCard for the Card component
// Both have the same structure, just different TypeScript rank types
function toCard(card: StandardCard): EuchreCard {
  return card as unknown as EuchreCard
}

const props = withDefaults(defineProps<{
  mode?: 'singleplayer' | 'multiplayer'
}>(), {
  mode: 'singleplayer'
})

const emit = defineEmits<{
  leaveGame: []
}>()

const adapter = usePresidentGameAdapter(props.mode)

// Initialize/cleanup for multiplayer
onMounted(() => {
  if (adapter.isMultiplayer && adapter.initialize) {
    adapter.initialize()
  }
})

onUnmounted(() => {
  if (adapter.isMultiplayer && adapter.cleanup) {
    adapter.cleanup()
  }
})

// Debug watcher for valid plays changes
watch(() => adapter.validPlays.value, (newPlays, oldPlays) => {
  console.log('[DEBUG] validPlays changed:', {
    newPlays: newPlays.map(p => p.map(c => c.id)),
    oldPlays: oldPlays?.map(p => p.map(c => c.id)),
    isHumanTurn: adapter.isHumanTurn.value,
    humanHand: adapter.humanPlayer.value?.hand.map(c => c.id),
  })
}, { deep: true })

// Selected cards for multi-select
const selectedCardIds = ref<Set<string>>(new Set())

// Computed - use adapter for both single-player and multiplayer
const phase = computed(() => adapter.phase.value)
const players = computed(() => adapter.players.value)
const currentPlayer = computed(() => adapter.currentPlayer.value)
const humanPlayer = computed(() => adapter.humanPlayer.value)
const currentPile = computed(() => adapter.currentPile.value)
const isHumanTurn = computed(() => adapter.isHumanTurn.value)
const validPlays = computed(() => adapter.validPlays.value)
const lastPlayedCards = computed(() => adapter.lastPlayedCards.value)
const roundNumber = computed(() => adapter.roundNumber.value)

// Get the cards currently on the pile that need to be beaten
const pileCards = computed(() => {
  const plays = currentPile.value.plays
  if (plays.length === 0) return null
  // Return the most recent play's cards
  return plays[plays.length - 1]?.cards || null
})
const gameOver = computed(() => adapter.gameOver.value)
const finishedPlayers = computed(() => adapter.finishedPlayers.value)
const exchangeInfo = computed(() => adapter.exchangeInfo.value)
const isHumanGivingCards = computed(() => adapter.isHumanGivingCards.value)
const cardsToGiveCount = computed(() => adapter.cardsToGiveCount.value)

// Cards selected to give back during President/VP giving phase
const selectedGiveBackCards = ref<Set<string>>(new Set())

// Track completed exchange for summary modal
const completedExchange = ref<{
  youGave: StandardCard[]
  youReceived: StandardCard[]
  yourRole: string
} | null>(null)

// Sort human hand by rank
const sortedHand = computed(() => {
  if (!humanPlayer.value) return []
  return sortHandByRank(humanPlayer.value.hand)
})

// Get opponent players (everyone except the current player)
const opponents = computed(() => {
  return players.value.filter(p => p.id !== humanPlayer.value?.id)
})

// Check if a card is selectable (during normal play)
function isCardSelectable(card: StandardCard): boolean {
  // During give-back phase, cards are selectable for giving
  if (isHumanGivingCards.value) {
    return true // All cards can be given back
  }
  if (!isHumanTurn.value) return false
  // Check if this card can be part of a valid play
  return validPlays.value.some(play =>
    play.some(c => c.id === card.id)
  )
}

// Check if a card is selected (for play or give-back)
function isCardSelected(card: StandardCard): boolean {
  if (isHumanGivingCards.value) {
    return selectedGiveBackCards.value.has(card.id)
  }
  return selectedCardIds.value.has(card.id)
}

// Toggle card selection (handles both play and give-back modes)
function toggleCardSelection(card: StandardCard) {
  // Handle give-back phase selection
  if (isHumanGivingCards.value) {
    toggleGiveBackSelection(card)
    return
  }
  
  if (!isCardSelectable(card)) return

  const newSelected = new Set(selectedCardIds.value)

  if (newSelected.has(card.id)) {
    newSelected.delete(card.id)
  } else {
    // Check if this card can be added to current selection
    const selectedCards = sortedHand.value.filter(c => newSelected.has(c.id))

    if (selectedCards.length === 0) {
      // First card - just add it
      newSelected.add(card.id)
    } else {
      // Can only add cards of same rank
      const selectedRank = selectedCards[0]!.rank
      if (card.rank === selectedRank) {
        newSelected.add(card.id)
      } else {
        // Different rank - start new selection
        newSelected.clear()
        newSelected.add(card.id)
      }
    }
  }

  selectedCardIds.value = newSelected
}

// Toggle selection for give-back phase (President/VP choosing cards to give)
function toggleGiveBackSelection(card: StandardCard) {
  const newSelected = new Set(selectedGiveBackCards.value)
  
  if (newSelected.has(card.id)) {
    newSelected.delete(card.id)
  } else {
    // Can select up to cardsToGiveCount cards
    if (newSelected.size < cardsToGiveCount.value) {
      newSelected.add(card.id)
    } else {
      // Already at limit - replace oldest selection (or clear and add)
      newSelected.clear()
      newSelected.add(card.id)
    }
  }
  
  selectedGiveBackCards.value = newSelected
}

// Computed: cards selected for give-back
const selectedGiveBackCardsList = computed(() => {
  return sortedHand.value.filter(c => selectedGiveBackCards.value.has(c.id))
})

// Can confirm give-back selection?
const canConfirmGiveBack = computed(() => {
  return selectedGiveBackCards.value.size === cardsToGiveCount.value
})

// Confirm give-back selection
function confirmGiveBack() {
  if (!canConfirmGiveBack.value) return
  
  // Store the exchange info for summary modal
  completedExchange.value = {
    youGave: [...selectedGiveBackCardsList.value],
    youReceived: exchangeInfo.value?.youReceive ?? [],
    yourRole: exchangeInfo.value?.yourRole ?? 'President'
  }
  
  adapter.giveCardsBack(selectedGiveBackCardsList.value)
  selectedGiveBackCards.value = new Set()
}

// Dismiss exchange summary modal
function dismissExchangeSummary() {
  completedExchange.value = null
}

// Get selected cards
const selectedCards = computed(() => {
  return sortedHand.value.filter(c => selectedCardIds.value.has(c.id))
})

// Check if current selection is a valid play
const canPlaySelection = computed(() => {
  if (selectedCards.value.length === 0) return false
  // Validate directly using isValidPlay instead of checking against pre-generated valid plays
  // This allows any valid combination of same-rank cards, not just the first N cards
  return isValidPlay(selectedCards.value, currentPile.value, adapter.superTwosMode.value)
})

// Play selected cards
function playSelectedCards() {
  if (!canPlaySelection.value) return
  adapter.playCards(selectedCards.value)
  selectedCardIds.value = new Set()
}

// Pass turn
function passTurn() {
  adapter.pass()
  selectedCardIds.value = new Set()
}

// Leave game confirmation
const showLeaveConfirm = ref(false)

function confirmLeave() {
  showLeaveConfirm.value = false
  emit('leaveGame')
}

// Get pile display text
const pileStatus = computed(() => {
  if (!currentPile.value.currentRank) {
    return 'Lead any cards'
  }
  const count = currentPile.value.currentPlayType === 'single' ? '' :
    currentPile.value.currentPlayType === 'pair' ? 'Pair of ' :
    currentPile.value.currentPlayType === 'triple' ? 'Triple ' :
    'Quad '
  return `Beat: ${count}${currentPile.value.currentRank}s`
})

// Get player status
function getPlayerStatus(playerId: number): string {
  const player = players.value[playerId]
  if (!player) return ''

  if (player.finishOrder !== null) {
    return adapter.getPlayerRankDisplay(playerId) || `#${player.finishOrder}`
  }

  if (playerId === currentPlayer.value) {
    return 'Playing...'
  }

  return `${player.hand.length} cards`
}

// Show round complete modal
const showRoundComplete = computed(() =>
  phase.value === PresidentPhase.RoundComplete
)
</script>

<template>
  <div class="president-game-board">
    <BackButton @click="showLeaveConfirm = true" />

    <!-- Main game area -->
    <div class="game-main">
      <!-- Opponents row -->
      <div class="opponents-row">
        <div
          v-for="opponent in opponents"
          :key="opponent.id"
          :class="['opponent', { active: currentPlayer === opponent.id }]"
        >
          <div class="opponent-name">{{ opponent.name }}</div>
          <div class="opponent-cards">
            <div
              v-for="i in opponent.hand.length"
              :key="i"
              class="card-back"
            />
          </div>
          <div class="opponent-status">{{ getPlayerStatus(opponent.id) }}</div>
        </div>
      </div>

      <!-- Center pile -->
      <div class="center-area">
        <!-- Give cards prompt (inline, replaces pile during President giving phase) -->
        <div v-if="isHumanGivingCards" class="give-cards-prompt">
          <div class="give-prompt-title">You are {{ exchangeInfo?.yourRole }}</div>
          <div class="give-prompt-instruction">
            Select {{ cardsToGiveCount }} card{{ cardsToGiveCount > 1 ? 's' : '' }} to give to Scum
          </div>
        </div>
        
        <!-- Normal pile (hidden during giving phase) -->
        <div v-else class="pile-container">
          <div class="pile-status">{{ pileStatus }}</div>
          <div class="pile-cards">
            <div
              v-for="(card, index) in (pileCards || [])"
              :key="card.id"
              class="pile-card"
              :style="{ transform: `translateX(${index * 20}px)` }"
            >
              <Card :card="toCard(card)" />
            </div>
            <div v-if="!pileCards" class="empty-pile">
              Empty
            </div>
          </div>
        </div>
      </div>

      <!-- Player hand -->
      <div class="player-area">
        <div class="hand-container">
          <div
            v-for="card in sortedHand"
            :key="card.id"
            :class="['hand-card', {
              selectable: isCardSelectable(card),
              selected: isCardSelected(card),
              dimmed: isHumanTurn && !isCardSelectable(card)
            }]"
            @click="toggleCardSelection(card)"
          >
            <Card
              :card="toCard(card)"
              :selectable="isCardSelectable(card)"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Top right info (game name, round, waiting status) -->
    <div class="top-right-info">
      <h1 class="game-title">President</h1>
      <div class="round-info">Round {{ roundNumber }}</div>
      <div v-if="!isHumanTurn && !humanPlayer?.finishOrder" class="waiting-message">
        Waiting for {{ players[currentPlayer]?.name }}...
      </div>
    </div>

    <!-- Floating action panel -->
    <div :class="['floating-action-panel', { active: isHumanTurn || isHumanGivingCards }]">
      <div class="player-info-panel">
        <div class="player-name-panel">{{ humanPlayer?.name || 'You' }}</div>
        <span v-if="humanPlayer?.finishOrder" class="player-rank-panel">
          {{ adapter.getPlayerRankDisplay(humanPlayer.id) }}
        </span>
      </div>

      <!-- Selection feedback for give-back phase -->
      <div v-if="isHumanGivingCards" class="selection-feedback giving-mode">
        <div v-if="selectedGiveBackCards.size > 0" class="selection-count">
          {{ selectedGiveBackCards.size }}/{{ cardsToGiveCount }} selected
        </div>
        <div v-else class="hint-text">
          Tap cards to select
        </div>
      </div>

      <!-- Selection feedback for normal play -->
      <div v-else-if="isHumanTurn" class="selection-feedback">
        <div v-if="selectedCards.length > 0" class="selection-count">
          {{ selectedCards.length }} card{{ selectedCards.length !== 1 ? 's' : '' }} selected
        </div>
        <div v-if="!canPlaySelection && selectedCards.length > 0" class="invalid-hint">
          Invalid play
        </div>
        <div v-if="selectedCards.length === 0" class="hint-text">
          Tap cards to select
        </div>
      </div>

      <!-- Spacer to push buttons to bottom -->
      <div class="panel-spacer"></div>

      <!-- Action buttons for give-back phase -->
      <div v-if="isHumanGivingCards" class="action-buttons">
        <button
          class="action-btn give-btn"
          :disabled="!canConfirmGiveBack"
          @click="confirmGiveBack"
        >
          Give Cards ({{ selectedGiveBackCards.size }}/{{ cardsToGiveCount }})
        </button>
      </div>

      <!-- Action buttons for normal play -->
      <div v-else class="action-buttons">
        <button
          class="action-btn play-btn"
          :disabled="!isHumanTurn || !canPlaySelection"
          @click="playSelectedCards"
        >
          Play {{ selectedCards.length > 0 ? `(${selectedCards.length})` : '' }}
        </button>
        <button
          class="action-btn pass-btn"
          :disabled="!isHumanTurn || currentPile.currentRank === null"
          @click="passTurn"
        >
          Pass
        </button>
      </div>
    </div>

    <!-- Card exchange modal (for Scum/Vice-Scum showing what was exchanged) -->
    <Modal :show="!!exchangeInfo && !isHumanGivingCards" @close="() => {}">
      <div v-if="exchangeInfo" class="exchange-modal">
        <h3>Card Exchange</h3>
        <p class="exchange-role">You are <strong>{{ exchangeInfo.yourRole }}</strong></p>
        <div class="exchange-sections">
          <div class="exchange-section give">
            <div class="exchange-label">You gave:</div>
            <div class="exchange-cards-wrapper">
              <div class="exchange-cards">
                <div v-for="card in exchangeInfo.youGive" :key="card.id" class="small-card-wrapper">
                  <Card :card="toCard(card)" />
                </div>
              </div>
            </div>
          </div>
          <div class="exchange-section receive">
            <div class="exchange-label">You received:</div>
            <div class="exchange-cards-wrapper">
              <div class="exchange-cards">
                <div v-for="card in exchangeInfo.youReceive" :key="card.id" class="small-card-wrapper">
                  <Card :card="toCard(card)" />
                </div>
              </div>
            </div>
          </div>
        </div>
        <button class="modal-btn confirm" @click="adapter.acknowledgeExchange()">
          OK
        </button>
      </div>
    </Modal>
    
    <!-- Exchange summary modal (for President/VP after they've given cards) -->
    <Modal :show="!!completedExchange" @close="dismissExchangeSummary">
      <div v-if="completedExchange" class="exchange-modal">
        <h3>Card Exchange Complete</h3>
        <p class="exchange-role">You are <strong>{{ completedExchange.yourRole }}</strong></p>
        <div class="exchange-sections">
          <div class="exchange-section receive">
            <div class="exchange-label">You received:</div>
            <div class="exchange-cards-wrapper">
              <div class="exchange-cards">
                <div v-for="card in completedExchange.youReceived" :key="card.id" class="small-card-wrapper">
                  <Card :card="toCard(card)" />
                </div>
              </div>
            </div>
          </div>
          <div class="exchange-section give">
            <div class="exchange-label">You gave:</div>
            <div class="exchange-cards-wrapper">
              <div class="exchange-cards">
                <div v-for="card in completedExchange.youGave" :key="card.id" class="small-card-wrapper">
                  <Card :card="toCard(card)" />
                </div>
              </div>
            </div>
          </div>
        </div>
        <button class="modal-btn confirm" @click="dismissExchangeSummary">
          OK
        </button>
      </div>
    </Modal>

    <!-- Leave confirmation modal -->
    <Modal :show="showLeaveConfirm" @close="showLeaveConfirm = false">
      <div class="confirm-modal">
        <h3>Leave Game?</h3>
        <p>Are you sure you want to leave this game?</p>
        <div class="modal-buttons">
          <button class="modal-btn cancel" @click="showLeaveConfirm = false">
            Cancel
          </button>
          <button class="modal-btn confirm" @click="confirmLeave">
            Leave
          </button>
        </div>
      </div>
    </Modal>

    <!-- Round complete modal -->
    <Modal :show="showRoundComplete" @close="() => {}">
      <div class="round-complete-modal">
        <h3>Round {{ roundNumber }} Complete!</h3>
        <div class="rankings">
          <div
            v-for="(playerId, index) in finishedPlayers"
            :key="playerId"
            class="ranking-row"
          >
            <span class="position">#{{ index + 1 }}</span>
            <span class="name">{{ players[playerId]?.name }}</span>
            <span class="title">{{ adapter.getPlayerRankDisplay(playerId) }}</span>
          </div>
        </div>
        <p v-if="!gameOver" class="next-round-msg">Next round starting...</p>
      </div>
    </Modal>

    <!-- Game over modal -->
    <Modal :show="gameOver" @close="emit('leaveGame')">
      <div class="game-over-modal">
        <h2>Game Over!</h2>
        <h3>Final Rankings</h3>
        <div class="rankings">
          <div
            v-for="(playerId, index) in finishedPlayers"
            :key="playerId"
            class="ranking-row"
          >
            <span class="position">#{{ index + 1 }}</span>
            <span class="name">{{ players[playerId]?.name }}</span>
          </div>
        </div>
        <button class="modal-btn confirm" @click="emit('leaveGame')">
          Back to Menu
        </button>
      </div>
    </Modal>
  </div>
</template>

<style scoped lang="scss">
.president-game-board {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: row;
  background: linear-gradient(135deg, #1e4d2b 0%, #0d2818 100%);
  color: white;
  overflow: hidden;
  position: relative;

  // Mobile portrait: stack vertically
  @media (max-width: 768px) and (orientation: portrait) {
    flex-direction: column;
  }
}

.game-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
  height: 100%;
  min-height: 0;
  width: 100%;
}

.opponents-row {
  display: flex;
  justify-content: space-around;
  padding: calc(#{$spacing-md} / 2 + 20px) $spacing-md $spacing-md;
  padding-right: 200px; // Reserve space for top-right info
  flex: 0 0 auto;

  @media (max-height: 500px) {
    padding: $spacing-xs $spacing-sm;
    padding-right: 160px;
  }
}

.opponent {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: $spacing-sm;
  border-radius: 8px;
  border: 2px solid transparent;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;

  @media (max-height: 500px) {
    padding: $spacing-xs;
  }

  &.active {
    border-color: #f4d03f;
    box-shadow: 0 0 12px rgba(244, 208, 63, 0.6);
  }
}

.opponent-name {
  font-weight: bold;
  margin-bottom: $spacing-xs;

  @media (max-height: 500px) {
    font-size: 0.85rem;
    margin-bottom: 2px;
  }
}

.opponent-cards {
  display: flex;
  margin-bottom: $spacing-xs;

  @media (max-height: 500px) {
    margin-bottom: 2px;
  }
}

.card-back {
  width: 30px;
  height: 42px;
  background: linear-gradient(135deg, #2c5aa0 0%, #1a3d6e 100%);
  border-radius: 4px;
  margin-left: $card-overlap-pile;
  border: 1px solid rgba(255, 255, 255, 0.3);

  @media (max-height: 500px) {
    width: 22px;
    height: 32px;
    margin-left: -15px; // Tighter on small screens
    border-radius: 3px;
  }

  &:first-child {
    margin-left: 0;
  }
}

.opponent-status {
  font-size: 0.75rem;
  opacity: 0.8;

  @media (max-height: 500px) {
    font-size: 0.65rem;
  }
}

.center-area {
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
  overflow: hidden;
}

.pile-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: $spacing-lg;
  background: transparent;
  border-radius: 12px;
  min-width: 200px;
  min-height: 150px;
  border: 2px solid rgba(255, 255, 255, 0.2);

  @media (max-height: 500px) {
    padding: $spacing-sm;
    min-width: 150px;
    min-height: 100px;
  }
}

.pile-status {
  font-size: 0.875rem;
  opacity: 0.8;
  margin-bottom: $spacing-sm;

  @media (max-height: 500px) {
    font-size: 0.75rem;
    margin-bottom: $spacing-xs;
  }
}

.pile-cards {
  display: flex;
  position: relative;
  min-height: $card-height;
  align-items: center;
  justify-content: center;
}

.pile-card {
  position: absolute;
}

.empty-pile {
  color: rgba(255, 255, 255, 0.5);
  font-style: italic;
}

.player-area {
  flex: 0 0 auto;
  height: 105px; // Full card height
  overflow: visible;
  position: relative;
}

.hand-container {
  display: flex;
  justify-content: center;
  position: absolute;
  bottom: 0;
  left: 0;
  right: 200px; // Reserve space for floating action panel
  padding: 0 $spacing-md;

  @media (max-height: 500px) {
    right: 160px;
  }
}

.hand-card {
  margin-left: $card-overlap-hand;
  transform: translateY(50px); // Push cards down, showing only top ~55px
  transition: transform 0.15s ease-out;

  // Tighter overlap on small screens
  @media (max-height: 500px) {
    margin-left: $card-overlap-hand-tight;
  }

  &:first-child {
    margin-left: 0;
  }

  &.selectable {
    cursor: pointer;
  }

  &.selected {
    transform: translateY(25px); // Pop up when selected
  }

  // Use filter instead of opacity to avoid stacking/striping effect
  &.dimmed :deep(.card) {
    filter: brightness(0.7) saturate(0.5);
  }
}

// Top right info (game name, round, waiting status)
.top-right-info {
  position: fixed;
  top: $spacing-md;
  right: 10px;
  width: 180px;
  text-align: center;
  z-index: 100;

  @media (max-height: 500px) {
    top: $spacing-sm;
    width: 150px;
  }

  .game-title {
    font-family: 'Rock Salt', cursive;
    font-size: 1.4rem;
    font-weight: 400;
    margin: 0 0 $spacing-xs 0;
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
    color: white;

    @media (max-height: 500px) {
      font-size: 1rem;
    }
  }

  .round-info {
    font-weight: bold;
    font-size: 1rem;
    opacity: 0.9;

    @media (max-height: 500px) {
      font-size: 0.85rem;
    }
  }

  .waiting-message {
    margin-top: $spacing-sm;
    font-size: 0.85rem;
    opacity: 0.8;
    font-style: italic;

    @media (max-height: 500px) {
      font-size: 0.75rem;
      margin-top: $spacing-xs;
    }
  }
}

// Floating action panel
.floating-action-panel {
  position: fixed;
  bottom: 10px;
  right: 10px;
  width: 180px;
  min-height: 180px;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  padding: $spacing-md;
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
  z-index: 100;
  border: 2px solid transparent;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;

  @media (max-height: 500px) {
    width: 150px;
    min-height: 150px;
    padding: $spacing-sm;
    gap: $spacing-xs;
  }

  &.active {
    border-color: #f4d03f;
    box-shadow: 0 0 12px rgba(244, 208, 63, 0.6);
  }
}

.player-info-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $spacing-xs;
}

.player-name-panel {
  font-weight: bold;
  font-size: 1rem;

  @media (max-height: 500px) {
    font-size: 0.9rem;
  }
}

.player-rank-panel {
  background: $secondary-color;
  padding: 2px $spacing-xs;
  border-radius: 4px;
  font-size: 0.75rem;
}

.selection-feedback {
  padding: $spacing-xs $spacing-sm;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  font-size: 0.8rem;
  color: white;
  text-align: center;

  @media (max-height: 500px) {
    padding: $spacing-xs;
    font-size: 0.75rem;
  }

  .selection-count {
    font-weight: bold;
  }

  .invalid-hint {
    color: #ff6b6b;
    font-size: 0.75rem;
    font-style: italic;
  }

  .hint-text {
    opacity: 0.8;
    font-style: italic;
    font-size: 0.75rem;
  }
}

.panel-spacer {
  flex: 1;
}

.action-buttons {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
}

.action-btn {
  padding: $spacing-sm $spacing-md;
  font-size: 0.95rem;
  font-weight: bold;
  border-radius: 8px;
  transition: all 0.2s;
  width: 100%;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  border: none;
  cursor: pointer;

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    box-shadow: none;
  }

  @media (max-height: 500px) {
    padding: $spacing-xs $spacing-sm;
    font-size: 0.85rem;
  }
}

.play-btn {
  background: $secondary-color;
  color: white;

  &:active:not(:disabled) {
    transform: scale(0.98);
  }

  &:disabled {
    background: rgba(255, 255, 255, 0.1);
  }
}

.give-btn {
  background: #9b59b6;
  color: white;

  &:active:not(:disabled) {
    transform: scale(0.98);
  }

  &:disabled {
    background: rgba(255, 255, 255, 0.1);
  }
}

.pass-btn {
  background: rgba(255, 255, 255, 0.2);
  color: white;

  &:active:not(:disabled) {
    transform: scale(0.98);
  }
}

// Give cards prompt (inline in center area)
.give-cards-prompt {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: $spacing-lg;
  background: rgba(155, 89, 182, 0.2);
  border: 2px solid rgba(155, 89, 182, 0.6);
  border-radius: 12px;
  min-width: 250px;
  
  @media (max-height: 500px) {
    padding: $spacing-sm;
    min-width: 200px;
  }
  
  .give-prompt-title {
    font-size: 1.2rem;
    font-weight: bold;
    margin-bottom: $spacing-sm;
    color: #d4a5e8;
    
    @media (max-height: 500px) {
      font-size: 1rem;
    }
  }
  
  .give-prompt-instruction {
    font-size: 1rem;
    font-weight: bold;
    text-align: center;
    animation: pulse-glow 2s ease-in-out infinite;
    
    @media (max-height: 500px) {
      font-size: 0.9rem;
    }
  }
}

@keyframes pulse-glow {
  0%, 100% { opacity: 0.9; }
  50% { opacity: 1; text-shadow: 0 0 10px rgba(212, 165, 232, 0.5); }
}

.selection-feedback.giving-mode {
  background: rgba(155, 89, 182, 0.2);
  border: 1px solid rgba(155, 89, 182, 0.4);
}

// Modal styles
.confirm-modal,
.round-complete-modal,
.game-over-modal {
  padding: $spacing-lg;
  text-align: center;

  h2, h3 {
    margin-bottom: $spacing-md;
  }

  p {
    margin-bottom: $spacing-lg;
    opacity: 0.8;
  }
}

.modal-buttons {
  display: flex;
  justify-content: center;
  gap: $spacing-md;
}

.modal-btn {
  padding: $spacing-sm $spacing-lg;
  font-weight: bold;
  border-radius: 8px;

  &.cancel {
    background: rgba(255, 255, 255, 0.2);
    color: white;
  }

  &.confirm {
    background: $secondary-color;
    color: white;
  }

  &:active {
    transform: scale(0.97);
  }
}

.rankings {
  margin: $spacing-lg 0;
}

.ranking-row {
  display: flex;
  justify-content: center;
  gap: $spacing-md;
  padding: $spacing-sm;

  &:nth-child(odd) {
    background: rgba(255, 255, 255, 0.05);
  }
}

.position {
  font-weight: bold;
  width: 40px;
}

.name {
  flex: 1;
  text-align: left;
}

.title {
  opacity: 0.8;
  font-style: italic;
}

.next-round-msg {
  font-style: italic;
  opacity: 0.7;
}

// Card exchange modal
.exchange-modal {
  padding: $spacing-md;
  text-align: center;
  color: #333;

  h3 {
    margin-bottom: $spacing-xs;
    font-size: 1.1rem;
  }

  .exchange-role {
    font-size: 0.85rem;
    opacity: 0.9;
    margin-bottom: $spacing-sm;

    strong {
      color: $secondary-color;
    }
  }

  .modal-btn {
    margin-top: $spacing-sm;
    
    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }
}

.exchange-sections {
  display: flex;
  gap: $spacing-md;
}

.exchange-section {
  flex: 1;
  padding: $spacing-sm;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 6px;

  &.give {
    border-top: 3px solid #e74c3c;
  }

  &.receive {
    border-top: 3px solid #27ae60;
  }

  .exchange-label {
    font-size: 0.75rem;
    font-weight: bold;
    opacity: 0.8;
    margin-bottom: $spacing-xs;
    text-align: center;
  }
}

.exchange-cards-wrapper {
  overflow: visible;
}

.exchange-cards {
  display: flex;
  justify-content: center;
  gap: $spacing-xs;
}

.small-card-wrapper {
  // Scale the card down while maintaining proper spacing
  width: calc(#{$card-width} * 0.6);
  height: calc(#{$card-height} * 0.6);

  :deep(.card) {
    transform: scale(0.6);
    transform-origin: top left;
  }
}
</style>
