<script setup lang="ts">
import { computed, ref } from 'vue'
import { usePresidentGameStore } from '@/stores/presidentGameStore'
import { PresidentPhase, sortHandByRank, isValidPlay, type StandardCard, type Card as EuchreCard } from '@euchre/shared'
import Card from '../Card.vue'
import Modal from '../Modal.vue'

// Helper to cast StandardCard to EuchreCard for the Card component
// Both have the same structure, just different TypeScript rank types
function toCard(card: StandardCard): EuchreCard {
  return card as unknown as EuchreCard
}

const emit = defineEmits<{
  leaveGame: []
}>()

const store = usePresidentGameStore()

// Selected cards for multi-select
const selectedCardIds = ref<Set<string>>(new Set())

// Computed
const phase = computed(() => store.phase)
const players = computed(() => store.players)
const currentPlayer = computed(() => store.currentPlayer)
const humanPlayer = computed(() => store.humanPlayer)
const currentPile = computed(() => store.currentPile)
const isHumanTurn = computed(() => store.isHumanTurn)
const validPlays = computed(() => store.validPlays)
const canHumanPlay = computed(() => store.canHumanPlay)
const lastPlayedCards = computed(() => store.lastPlayedCards)
const roundNumber = computed(() => store.roundNumber)

// Get the cards currently on the pile that need to be beaten
const pileCards = computed(() => {
  const plays = currentPile.value.plays
  if (plays.length === 0) return null
  // Return the most recent play's cards
  return plays[plays.length - 1]?.cards || null
})
const gameOver = computed(() => store.gameOver)
const finishedPlayers = computed(() => store.finishedPlayers)

// Sort human hand by rank
const sortedHand = computed(() => {
  if (!humanPlayer.value) return []
  return sortHandByRank(humanPlayer.value.hand)
})

// Get opponent players (everyone except human)
const opponents = computed(() => {
  return players.value.filter(p => !p.isHuman)
})

// Check if a card is selectable
function isCardSelectable(card: StandardCard): boolean {
  if (!isHumanTurn.value) return false
  // Check if this card can be part of a valid play
  return validPlays.value.some(play =>
    play.some(c => c.id === card.id)
  )
}

// Check if a card is selected
function isCardSelected(card: StandardCard): boolean {
  return selectedCardIds.value.has(card.id)
}

// Toggle card selection
function toggleCardSelection(card: StandardCard) {
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

// Get selected cards
const selectedCards = computed(() => {
  return sortedHand.value.filter(c => selectedCardIds.value.has(c.id))
})

// Check if current selection is a valid play
const canPlaySelection = computed(() => {
  if (selectedCards.value.length === 0) return false
  // Validate directly using isValidPlay instead of checking against pre-generated valid plays
  // This allows any valid combination of same-rank cards, not just the first N cards
  return isValidPlay(selectedCards.value, currentPile.value)
})

// Play selected cards
function playSelectedCards() {
  if (!canPlaySelection.value) return
  store.playCards(selectedCards.value)
  selectedCardIds.value = new Set()
}

// Pass turn
function passTurn() {
  store.pass()
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
    return store.getPlayerRankDisplay(playerId) || `#${player.finishOrder}`
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
    <!-- Floating back button -->
    <button class="back-button" @click="showLeaveConfirm = true">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="15 18 9 12 15 6"></polyline>
      </svg>
    </button>

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
        <div class="pile-container">
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

    <!-- Right action panel -->
    <div class="action-panel">
      <!-- Top section: Game name and round -->
      <div class="panel-top">
        <h1 class="game-title">President</h1>
        <div class="round-info">Round {{ roundNumber }}</div>
      </div>

      <!-- Bottom section: Player info and actions -->
      <div class="panel-bottom">
        <div :class="['player-info-panel', { active: isHumanTurn }]">
          <div class="player-name-panel">{{ humanPlayer?.name || 'You' }}</div>
          <span v-if="humanPlayer?.finishOrder" class="player-rank-panel">
            {{ store.getPlayerRankDisplay(humanPlayer.id) }}
          </span>
        </div>

        <!-- Selection feedback -->
        <div v-if="isHumanTurn" class="selection-feedback">
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
        <div v-else-if="!humanPlayer?.finishOrder" class="waiting-message">
          Waiting for {{ players[currentPlayer]?.name }}...
        </div>

        <!-- Action buttons -->
        <div v-if="isHumanTurn" class="action-buttons">
          <button
            class="action-btn play-btn"
            :disabled="!canPlaySelection"
            @click="playSelectedCards"
          >
            Play {{ selectedCards.length > 0 ? `(${selectedCards.length})` : '' }}
          </button>
          <button
            class="action-btn pass-btn"
            :disabled="currentPile.currentRank === null"
            @click="passTurn"
          >
            Pass
          </button>
        </div>
      </div>
    </div>

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
            <span class="title">{{ store.getPlayerRankDisplay(playerId) }}</span>
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
}

.back-button {
  position: fixed;
  top: $spacing-md;
  left: $spacing-md;
  z-index: 10100;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: white;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  svg {
    width: 16px;
    height: 16px;
  }
}

.opponents-row {
  display: flex;
  justify-content: space-around;
  padding: calc(#{$spacing-md} / 2 + 20px) $spacing-md $spacing-md;
  flex: 0 0 auto;

  @media (max-height: 500px) {
    padding: $spacing-xs $spacing-sm;
  }
}

.opponent {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: $spacing-sm;
  border-radius: 8px;
  transition: background 0.2s;

  @media (max-height: 500px) {
    padding: $spacing-xs;
  }

  &.active {
    background: rgba(255, 255, 255, 0.15);
    box-shadow: 0 0 8px rgba(255, 255, 255, 0.2);
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
  margin-left: -20px;
  border: 1px solid rgba(255, 255, 255, 0.3);

  @media (max-height: 500px) {
    width: 22px;
    height: 32px;
    margin-left: -15px;
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
  right: 0;
  padding: 0 $spacing-md;
}

.hand-card {
  margin-left: -25px;
  transform: translateY(50px); // Push cards down, showing only top ~55px
  transition: transform 0.15s ease-out;

  // Tighter overlap on small screens
  @media (max-height: 500px) {
    margin-left: -35px;
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

// Right action panel
.action-panel {
  width: 200px;
  flex: 0 0 200px;
  background: rgba(0, 0, 0, 0.3);
  border-left: 2px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
  padding: 0;
  height: 100%;
  overflow: hidden;

  // Smaller screens in landscape: narrower panel
  @media (max-height: 500px) {
    width: 150px;
    flex: 0 0 150px;
  }

  // Mobile portrait: full width at bottom
  @media (max-width: 768px) and (orientation: portrait) {
    width: 100%;
    flex: 0 0 auto;
    border-left: none;
    border-top: 2px solid rgba(255, 255, 255, 0.1);
    max-height: 200px;
  }
}

.panel-top {
  padding: $spacing-lg $spacing-md;
  border-bottom: 2px solid rgba(255, 255, 255, 0.1);
  text-align: center;
  flex-shrink: 0;

  @media (max-height: 500px) {
    padding: $spacing-sm $spacing-xs;
  }

  .game-title {
    font-family: 'Rock Salt', cursive;
    font-size: 1.4rem;
    font-weight: 400;
    margin: 0 0 $spacing-sm 0;
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
    color: white;

    @media (max-height: 500px) {
      font-size: 1rem;
      margin: 0 0 $spacing-xs 0;
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
}

.panel-bottom {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: $spacing-md;
  gap: $spacing-md;
  overflow-y: auto;

  @media (max-height: 500px) {
    padding: $spacing-sm;
    gap: $spacing-sm;
  }
}

.player-info-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $spacing-xs;
  padding: $spacing-sm;
  border-radius: 8px;
  transition: background 0.2s;

  @media (max-height: 500px) {
    padding: $spacing-xs;
  }

  &.active {
    background: rgba(255, 255, 255, 0.15);
    box-shadow: 0 0 8px rgba(255, 255, 255, 0.2);
  }
}

.player-name-panel {
  font-weight: bold;
  font-size: 1.1rem;

  @media (max-height: 500px) {
    font-size: 0.95rem;
  }
}

.player-rank-panel {
  background: $secondary-color;
  padding: 2px $spacing-xs;
  border-radius: 4px;
  font-size: 0.75rem;
}

.selection-feedback {
  padding: $spacing-sm;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  font-size: 0.9rem;
  color: white;
  text-align: center;

  @media (max-height: 500px) {
    padding: $spacing-xs;
    font-size: 0.8rem;
  }

  .selection-count {
    font-weight: bold;
    margin-bottom: $spacing-xs;
  }

  .invalid-hint {
    color: #ff6b6b;
    font-size: 0.85rem;
    font-style: italic;

    @media (max-height: 500px) {
      font-size: 0.75rem;
    }
  }

  .hint-text {
    opacity: 0.8;
    font-style: italic;
    font-size: 0.85rem;

    @media (max-height: 500px) {
      font-size: 0.75rem;
    }
  }
}

.action-buttons {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
  flex: 1;
  justify-content: flex-end;
}

.action-btn {
  padding: $spacing-md;
  font-size: 1.1rem;
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

  // Small landscape screens: compact buttons
  @media (max-height: 500px) {
    padding: $spacing-sm;
    font-size: 0.95rem;
  }
}

.play-btn {
  background: $secondary-color;
  color: white;

  &:hover:not(:disabled),
  &:active:not(:disabled) {
    background: color-mix(in srgb, $secondary-color 90%, white 10%);
    transform: scale(1.02);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  }

  &:disabled {
    background: rgba(255, 255, 255, 0.1);
  }
}

.pass-btn {
  background: rgba(255, 255, 255, 0.2);
  color: white;

  &:hover:not(:disabled),
  &:active:not(:disabled) {
    background: rgba(255, 255, 255, 0.3);
    transform: scale(1.02);
  }
}

.waiting-message {
  text-align: center;
  opacity: 0.8;
  font-style: italic;
  padding: $spacing-sm;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
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
  transition: all 0.2s;

  &.cancel {
    background: rgba(255, 255, 255, 0.2);
    color: white;
  }

  &.confirm {
    background: $secondary-color;
    color: white;
  }

  &:hover {
    transform: scale(1.05);
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
</style>
