<script setup lang="ts">
import { computed, ref } from 'vue'
import { usePresidentGameStore } from '@/stores/presidentGameStore'
import { PresidentPhase, sortHandByRank, type StandardCard, type Card as EuchreCard } from '@euchre/shared'
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
  return validPlays.value.some(play =>
    play.length === selectedCards.value.length &&
    play.every(c => selectedCardIds.value.has(c.id))
  )
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
    <!-- Header -->
    <div class="header">
      <button class="leave-btn" @click="showLeaveConfirm = true">
        ← Leave
      </button>
      <div class="round-info">
        Round {{ roundNumber }}
      </div>
    </div>

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
            v-for="(card, index) in (lastPlayedCards || [])"
            :key="card.id"
            class="pile-card"
            :style="{ transform: `translateX(${index * 20}px)` }"
          >
            <Card :card="toCard(card)" />
          </div>
          <div v-if="!lastPlayedCards || lastPlayedCards.length === 0" class="empty-pile">
            {{ currentPile.currentRank ? 'Passed' : 'Empty' }}
          </div>
        </div>
      </div>
    </div>

    <!-- Player hand -->
    <div class="player-area">
      <div class="player-info">
        <span class="player-name">{{ humanPlayer?.name || 'You' }}</span>
        <span v-if="humanPlayer?.finishOrder" class="player-rank">
          {{ store.getPlayerRankDisplay(humanPlayer.id) }}
        </span>
      </div>

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
      <div v-else-if="!humanPlayer?.finishOrder" class="waiting-message">
        Waiting for {{ players[currentPlayer]?.name }}...
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
  flex-direction: column;
  background: linear-gradient(135deg, #1e4d2b 0%, #0d2818 100%);
  color: white;
  overflow: hidden;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: $spacing-sm $spacing-md;
  background: rgba(0, 0, 0, 0.2);
}

.leave-btn {
  padding: $spacing-xs $spacing-sm;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  border-radius: 6px;
  font-size: 0.875rem;
  transition: background 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }
}

.round-info {
  font-weight: bold;
  font-size: 1.1rem;
}

.opponents-row {
  display: flex;
  justify-content: space-around;
  padding: $spacing-md;
  flex: 0 0 auto;
}

.opponent {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: $spacing-sm;
  border-radius: 8px;
  transition: background 0.2s;

  &.active {
    background: rgba(255, 255, 255, 0.1);
  }
}

.opponent-name {
  font-weight: bold;
  margin-bottom: $spacing-xs;
}

.opponent-cards {
  display: flex;
  margin-bottom: $spacing-xs;
}

.card-back {
  width: 30px;
  height: 42px;
  background: linear-gradient(135deg, #2c5aa0 0%, #1a3d6e 100%);
  border-radius: 4px;
  margin-left: -20px;
  border: 1px solid rgba(255, 255, 255, 0.3);

  &:first-child {
    margin-left: 0;
  }
}

.opponent-status {
  font-size: 0.75rem;
  opacity: 0.8;
}

.center-area {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pile-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: $spacing-lg;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 12px;
  min-width: 200px;
  min-height: 150px;
}

.pile-status {
  font-size: 0.875rem;
  opacity: 0.8;
  margin-bottom: $spacing-sm;
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
  padding: $spacing-md;
  background: rgba(0, 0, 0, 0.2);
}

.player-info {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  margin-bottom: $spacing-sm;
}

.player-name {
  font-weight: bold;
}

.player-rank {
  background: $secondary-color;
  padding: 2px $spacing-xs;
  border-radius: 4px;
  font-size: 0.75rem;
}

.hand-container {
  display: flex;
  justify-content: center;
  gap: -10px;
  margin-bottom: $spacing-md;
  flex-wrap: wrap;
}

.hand-card {
  margin-left: -15px;
  transition: transform 0.2s, filter 0.2s;

  &:first-child {
    margin-left: 0;
  }

  &.selectable {
    cursor: pointer;

    &:hover {
      transform: translateY(-8px);
    }
  }

  &.selected {
    transform: translateY(-15px);
    filter: brightness(1.1);
  }

  &.dimmed {
    filter: brightness(0.7);
  }
}

.action-buttons {
  display: flex;
  justify-content: center;
  gap: $spacing-md;
}

.action-btn {
  padding: $spacing-sm $spacing-xl;
  font-size: 1.1rem;
  font-weight: bold;
  border-radius: 8px;
  transition: all 0.2s;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.play-btn {
  background: $secondary-color;
  color: white;

  &:hover:not(:disabled) {
    background: color-mix(in srgb, $secondary-color 90%, white 10%);
    transform: scale(1.05);
  }
}

.pass-btn {
  background: rgba(255, 255, 255, 0.2);
  color: white;

  &:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.3);
  }
}

.waiting-message {
  text-align: center;
  opacity: 0.7;
  font-style: italic;
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
