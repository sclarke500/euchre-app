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

// Track container width for dynamic card overlap
const handContainerRef = ref<HTMLElement | null>(null)
const containerWidth = ref(0)

// Update container width on mount and resize
onMounted(() => {
  updateContainerWidth()
  window.addEventListener('resize', updateContainerWidth)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateContainerWidth)
})

function updateContainerWidth() {
  if (handContainerRef.value) {
    containerWidth.value = handContainerRef.value.clientWidth
  } else {
    // Fallback: estimate based on window width minus action panel and padding
    containerWidth.value = window.innerWidth - 240
  }
}

// Calculate dynamic overlap based on card count and available width
const cardWidth = 83 // From _variables.scss
const minVisiblePerCard = 20 // Minimum pixels visible per card for tapping

const dynamicCardOverlap = computed(() => {
  const cardCount = sortedHand.value.length
  if (cardCount <= 1) return 0
  
  const availableWidth = containerWidth.value || (window.innerWidth - 240)
  
  // Calculate: availableWidth = cardWidth + (cardCount - 1) * (cardWidth + overlap)
  // Solve for overlap: overlap = (availableWidth - cardWidth) / (cardCount - 1) - cardWidth
  const maxOverlap = (availableWidth - cardWidth) / (cardCount - 1) - cardWidth
  
  // Clamp between reasonable values
  // More negative = more overlap (cards closer together)
  // -35 is default (tighter), -(cardWidth - minVisible) is maximum overlap
  const defaultOverlap = -35
  const maxAllowedOverlap = -(cardWidth - minVisiblePerCard) // -63
  
  // Use the more negative value (tighter) if needed to fit
  return Math.max(maxAllowedOverlap, Math.min(defaultOverlap, maxOverlap))
})

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

// Track sweep animation state
const isSweeping = ref(false)
const sweepingCards = ref<StandardCard[] | null>(null)

// Get the cards currently on the pile that need to be beaten
const pileCards = computed(() => {
  const plays = currentPile.value.plays
  if (plays.length === 0) return null
  // Return the most recent play's cards
  return plays[plays.length - 1]?.cards || null
})

// Watch for pile clearing to trigger sweep animation
watch(pileCards, (newCards, oldCards) => {
  // If we had cards and now we don't, sweep them away
  if (oldCards && oldCards.length > 0 && !newCards) {
    sweepingCards.value = oldCards
    // Pause to let players see the final cards, then sweep
    setTimeout(() => {
      isSweeping.value = true
      // Clear the sweep after animation completes
      setTimeout(() => {
        isSweeping.value = false
        sweepingCards.value = null
      }, 400)
    }, 500)
  }
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

// Get opponent players in correct turn order (clockwise from human's perspective)
const allOpponents = computed(() => {
  const human = humanPlayer.value
  const allPlayers = players.value
  
  if (!human) return allPlayers
  
  const humanIndex = allPlayers.findIndex(p => p.id === human.id)
  if (humanIndex === -1) return allPlayers.filter(p => p.id !== human.id)
  
  // Reorder: start from player after human, wrap around, exclude human
  const reordered: typeof allPlayers = []
  for (let i = 1; i < allPlayers.length; i++) {
    const idx = (humanIndex + i) % allPlayers.length
    reordered.push(allPlayers[idx]!)
  }
  return reordered
})

// Split opponents into left, top, right for proper table layout
// For 4-5 players: all on top row
// For 6-7 players: 1 left, rest top, 1 right  
// For 8 players: 2 left, 3 top, 2 right
const leftOpponents = computed(() => {
  const opps = allOpponents.value
  if (opps.length <= 4) return [] // 4-5 players: no side positions
  if (opps.length <= 6) return opps.slice(0, 1).filter(Boolean) // 6-7 players: 1 on left
  // 8 players (7 opponents): 2 on left
  return opps.slice(0, 2).filter(Boolean)
})

const topOpponents = computed(() => {
  const opps = allOpponents.value
  if (opps.length <= 4) return opps.filter(Boolean) // 4-5 players: all on top
  if (opps.length <= 6) return opps.slice(1, opps.length - 1).filter(Boolean) // 6-7 players: middle ones on top
  // 8 players (7 opponents): middle 3 on top
  return opps.slice(2, 5).filter(Boolean)
})

const rightOpponents = computed(() => {
  const opps = allOpponents.value
  if (opps.length <= 4) return [] // 4-5 players: no side positions
  if (opps.length <= 6) return opps.slice(opps.length - 1).filter(Boolean) // 6-7 players: 1 on right
  // 8 players (7 opponents): 2 on right
  return opps.slice(5, 7).filter(Boolean)
})

// Legacy: for backward compatibility
const opponents = allOpponents

// Check if a card is selectable (during normal play)
function isCardSelectable(card: StandardCard): boolean {
  // During give-back phase, cards are selectable for giving
  if (isHumanGivingCards.value) {
    return true // All cards can be given back
  }
  if (!isHumanTurn.value) return false
  // Check if this card's RANK can be part of a valid play
  // (validPlays only contains specific card IDs, but any card of that rank is playable)
  return validPlays.value.some(play =>
    play.some(c => c.rank === card.rank)
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
  
  // Store the exchange info for summary modal (single-player only)
  // In multiplayer, server sends president_card_exchange_info which populates exchangeInfo
  if (!adapter.isMultiplayer) {
    completedExchange.value = {
      youGave: [...selectedGiveBackCardsList.value],
      youReceived: exchangeInfo.value?.youReceive ?? [],
      yourRole: exchangeInfo.value?.yourRole ?? 'President'
    }
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

// Manual resync for multiplayer
function handleResync() {
  if (adapter.requestResync) {
    adapter.requestResync()
  }
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

// Get player status (card count or playing indicator)
function getPlayerStatus(playerId: number): string {
  const player = players.value[playerId]
  if (!player) return ''

  if (player.finishOrder !== null) {
    return 'Finished'
  }

  if (playerId === currentPlayer.value) {
    return 'Playing...'
  }

  return `${player.hand.length} cards`
}

// Get player rank badge (from previous round)
function getPlayerRankBadge(playerId: number): string | null {
  const player = players.value[playerId]
  if (!player?.rank) return null
  
  const rankLabels: Record<number, string> = {
    1: '👑', // President
    2: '🎖️', // Vice President  
    3: '',   // Citizen - no badge
    4: '💩', // Scum
  }
  return rankLabels[player.rank] || null
}

// Show round complete modal
const showRoundComplete = computed(() =>
  phase.value === PresidentPhase.RoundComplete
)
</script>

<template>
  <div class="president-game-board">
    <!-- Watermark -->
    <div class="table-watermark">
      <span class="watermark-67">67</span>
      <span class="watermark-name">PRESIDENT</span>
    </div>

    <BackButton @click="showLeaveConfirm = true" />
    
    <!-- Resync button for multiplayer -->
    <button 
      v-if="adapter.isMultiplayer" 
      class="resync-btn"
      @click="handleResync"
      title="Refresh game state"
    >
      🔄
    </button>

    <!-- Main game area -->
    <div class="game-main">
      <!-- Left side opponents (for 6+ players) -->
      <div v-if="leftOpponents.length > 0" class="opponents-left">
        <div
          v-for="opponent in leftOpponents"
          :key="opponent.id"
          :class="['opponent', { active: currentPlayer === opponent.id }]"
        >
          <div class="opponent-name">
            <span v-if="getPlayerRankBadge(opponent.id)" class="rank-badge">{{ getPlayerRankBadge(opponent.id) }}</span>
            {{ opponent.name }}
          </div>
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

      <!-- Center column (top opponents + pile + hand) -->
      <div class="game-center">
        <!-- Top opponents row -->
        <div class="opponents-row">
          <div
            v-for="opponent in topOpponents"
            :key="opponent.id"
            :class="['opponent', { active: currentPlayer === opponent.id }]"
          >
            <div class="opponent-name">
              <span v-if="getPlayerRankBadge(opponent.id)" class="rank-badge">{{ getPlayerRankBadge(opponent.id) }}</span>
              {{ opponent.name }}
            </div>
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
          <div class="give-prompt-title">You are {{ exchangeInfo?.yourRole }}!</div>
          
          <!-- Show cards received from Scum -->
          <div v-if="exchangeInfo?.youReceive?.length" class="received-cards-section">
            <div class="received-label">You received from Scum:</div>
            <div class="received-cards">
              <div v-for="card in exchangeInfo.youReceive" :key="card.id" class="received-card">
                <Card :card="toCard(card)" />
              </div>
            </div>
          </div>
          
          <div class="give-prompt-instruction">
            Now select {{ cardsToGiveCount }} card{{ cardsToGiveCount > 1 ? 's' : '' }} from your hand to give back
          </div>
        </div>
        
        <!-- Normal pile (hidden during giving phase) -->
        <div v-else class="pile-container">
          <div class="pile-status">{{ pileStatus }}</div>
          <div :class="['pile-cards', { sweeping: isSweeping }]">
            <!-- Show sweeping cards during animation, otherwise current pile -->
            <div
              v-for="(card, index) in (isSweeping ? sweepingCards : pileCards) || []"
              :key="card.id"
              class="pile-card"
              :style="{ transform: `translateX(${index * 20}px)` }"
            >
              <Card :card="toCard(card)" />
            </div>
            <div v-if="!pileCards && !isSweeping" class="empty-pile">
              Empty
            </div>
          </div>
        </div>
      </div>

        <!-- Player hand -->
        <div class="player-area">
          <div ref="handContainerRef" class="hand-container">
            <div
              v-for="(card, index) in sortedHand"
              :key="card.id"
              :class="['hand-card', {
                selectable: isCardSelectable(card),
                selected: isCardSelected(card),
                dimmed: isHumanTurn && !isCardSelectable(card)
              }]"
              :style="index > 0 ? { marginLeft: `${dynamicCardOverlap}px` } : {}"
              @click="toggleCardSelection(card)"
            >
              <Card
                :card="toCard(card)"
                :selectable="isCardSelectable(card)"
              />
            </div>
          </div>
        </div>
      </div><!-- end game-center -->

      <!-- Right side opponents (for 6+ players) -->
      <div v-if="rightOpponents.length > 0" class="opponents-right">
        <div
          v-for="opponent in rightOpponents"
          :key="opponent.id"
          :class="['opponent', { active: currentPlayer === opponent.id }]"
        >
          <div class="opponent-name">
            <span v-if="getPlayerRankBadge(opponent.id)" class="rank-badge">{{ getPlayerRankBadge(opponent.id) }}</span>
            {{ opponent.name }}
          </div>
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
    </div><!-- end game-main -->

    <!-- Scoreboard (top right, like other games) -->
    <div class="scoreboard">
      <div class="score-row">
        <span class="score-label">Round</span>
        <span class="score-value">{{ roundNumber }}</span>
      </div>
      <div v-if="!isHumanTurn && !humanPlayer?.finishOrder" class="waiting-row">
        Waiting for {{ players[currentPlayer]?.name }}...
      </div>
    </div>

    <!-- Floating action panel -->
    <div :class="['floating-action-panel', { active: isHumanTurn || isHumanGivingCards }]">
      <div class="player-info-panel">
        <div class="player-name-panel">
          <span v-if="humanPlayer && getPlayerRankBadge(humanPlayer.id)" class="rank-badge">{{ getPlayerRankBadge(humanPlayer.id) }}</span>
          {{ humanPlayer?.name || 'You' }}
        </div>
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
      <div v-if="exchangeInfo" class="exchange-modal dialog-panel">
        <h3 class="dialog-title">Card Exchange</h3>
        <p class="exchange-role dialog-text">You are <strong>{{ exchangeInfo.yourRole }}</strong></p>
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
        <button class="modal-btn dialog-btn dialog-btn--primary confirm" @click="adapter.acknowledgeExchange()">
          OK
        </button>
      </div>
    </Modal>
    
    <!-- Exchange summary modal (for President/VP after they've given cards) -->
    <Modal :show="!!completedExchange" @close="dismissExchangeSummary">
      <div v-if="completedExchange" class="exchange-modal dialog-panel">
        <h3 class="dialog-title">Card Exchange Complete</h3>
        <p class="exchange-role dialog-text">You are <strong>{{ completedExchange.yourRole }}</strong></p>
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
        <button class="modal-btn dialog-btn dialog-btn--primary confirm" @click="dismissExchangeSummary">
          OK
        </button>
      </div>
    </Modal>

    <!-- Leave confirmation modal -->
    <Modal :show="showLeaveConfirm" @close="showLeaveConfirm = false">
      <div class="confirm-modal dialog-panel">
        <h3 class="dialog-title">Leave Game?</h3>
        <p class="dialog-text">Are you sure you want to leave this game?</p>
        <div class="modal-buttons dialog-actions">
          <button class="modal-btn dialog-btn dialog-btn--muted cancel" @click="showLeaveConfirm = false">
            Cancel
          </button>
          <button class="modal-btn dialog-btn dialog-btn--primary confirm" @click="confirmLeave">
            Leave
          </button>
        </div>
      </div>
    </Modal>

    <!-- Round complete modal -->
    <Modal :show="showRoundComplete" @close="() => {}">
      <div class="round-complete-modal dialog-panel">
        <h3 class="dialog-title">Round {{ roundNumber }} Complete!</h3>
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
        <p v-if="!gameOver" class="next-round-msg dialog-text">Next round starting...</p>
      </div>
    </Modal>

    <!-- Game over modal -->
    <Modal :show="gameOver" @close="emit('leaveGame')">
      <div class="game-over-modal dialog-panel">
        <h2 class="dialog-title">Game Over!</h2>
        <h3 class="dialog-title">Final Rankings</h3>
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
        <button class="modal-btn dialog-btn dialog-btn--primary confirm" @click="emit('leaveGame')">
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
  // Only top safe area padding - bottom handled by player-area
  padding-top: env(safe-area-inset-top, 0px);

  // Mobile portrait: stack vertically
  @media (max-width: 768px) and (orientation: portrait) {
    flex-direction: column;
  }
}

.resync-btn {
  position: fixed;
  top: calc(env(safe-area-inset-top, 0px) + 10px);
  left: 50px; // Next to back button
  z-index: 100;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.15);
  color: white;
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background var(--anim-fast), transform var(--anim-fast);

  &:hover {
    background: rgba(255, 255, 255, 0.25);
  }

  &:active {
    transform: rotate(180deg);
  }
}

.game-main {
  flex: 1;
  display: flex;
  flex-direction: row; // Changed: left | center | right layout
  min-width: 0;
  overflow: hidden;
  height: 100%;
  min-height: 0;
  width: 100%;
}

// Center column contains top opponents, pile, and player hand
.game-center {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

// Left side opponents (vertical column)
.opponents-left {
  display: flex;
  flex-direction: column-reverse; // Bottom player first (closest to human in turn order)
  justify-content: center;
  gap: $spacing-md;
  padding: $spacing-md;
  width: 120px;
  flex-shrink: 0;

  @media (max-height: 500px) {
    width: 90px;
    padding: $spacing-sm;
    gap: $spacing-sm;
  }

  .opponent {
    width: 100%;
  }
}

// Right side opponents (vertical column)
.opponents-right {
  display: flex;
  flex-direction: column; // Top player first (closer in turn order)
  justify-content: center;
  gap: $spacing-md;
  padding: $spacing-md;
  padding-right: calc($spacing-md + 190px); // Reserve space for floating panel
  width: calc(120px + 190px);
  flex-shrink: 0;

  @media (max-height: 500px) {
    width: calc(90px + 160px);
    padding: $spacing-sm;
    padding-right: calc($spacing-sm + 160px);
    gap: $spacing-sm;
  }

  .opponent {
    width: 120px;

    @media (max-height: 500px) {
      width: 90px;
    }
  }
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
  transition: border-color var(--anim-fast) ease, box-shadow var(--anim-fast) ease;

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
  display: flex;
  align-items: center;
  gap: 4px;

  @media (max-height: 500px) {
    font-size: 0.85rem;
    margin-bottom: 2px;
  }
}

.rank-badge {
  font-size: 1.1em;
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
  overflow: visible; // Allow sweep animation to be visible
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

  &.sweeping {
    animation: sweepRight var(--anim-medium) ease-out forwards;
  }
}

@keyframes sweepRight {
  0% {
    transform: translateX(0);
    opacity: 1;
  }
  100% {
    transform: translateX(300px);
    opacity: 0;
  }
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
  // Card height + safe area for home indicator
  height: calc(105px + env(safe-area-inset-bottom, 0px));
  overflow: visible;
  position: relative;
}

.hand-container {
  display: flex;
  justify-content: center;
  position: absolute;
  // Position above safe area (home indicator)
  bottom: env(safe-area-inset-bottom, 0px);
  // Minimum padding + safe area for notch/Dynamic Island
  left: calc(16px + env(safe-area-inset-left, 0px));
  right: calc(200px + env(safe-area-inset-right, 0px));
  padding: 0 8px;

  @media (max-height: 500px) {
    right: calc(165px + env(safe-area-inset-right, 0px));
  }
}

.hand-card {
  // margin-left is now applied dynamically via inline style for responsive fit
  transform: translateY(50px); // Push cards down, showing only top ~55px
  transition: transform var(--anim-fast) ease-out, margin-left var(--anim-fast) ease-out;

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

// Watermark (centered, like CardTable)
.table-watermark {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  opacity: 0.1;
  pointer-events: none;
  user-select: none;
  z-index: 1;
  
  .watermark-67 {
    font-family: 'Rock Salt', cursive;
    font-size: 4rem;
    font-weight: 400;
    color: white;
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
  }
  
  .watermark-name {
    font-family: 'Rock Salt', cursive;
    font-size: 1.8rem;
    font-weight: 400;
    color: white;
    text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.3);
    letter-spacing: 0.15em;
  }
}

// Scoreboard (top right, matching Euchre/Spades style)
.scoreboard {
  position: fixed;
  top: 10px;
  right: max(12px, env(safe-area-inset-right));
  z-index: 500;
  background: rgba(20, 20, 30, 0.88);
  border: 1px solid #444;
  border-radius: 8px;
  padding: 0;
  backdrop-filter: blur(8px);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  font-size: 14px;
  color: #ccc;
  min-width: 100px;

  .score-row {
    display: flex;
    justify-content: space-between;
    gap: $spacing-md;
    padding: 6px 12px;
    align-items: center;
  }

  .score-label {
    font-weight: 600;
    font-size: 13px;
  }

  .score-value {
    font-weight: 700;
    font-size: 15px;
    color: #fff;
  }

  .waiting-row {
    padding: 6px 12px;
    font-size: 0.75rem;
    opacity: 0.8;
    font-style: italic;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    text-align: center;
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
  transition: border-color var(--anim-fast) ease, box-shadow var(--anim-fast) ease;

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
  transition: all var(--anim-fast);
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
    animation: pulse-glow var(--anim-pulse) ease-in-out infinite;
    
    @media (max-height: 500px) {
      font-size: 0.9rem;
    }
  }
  
  .received-cards-section {
    margin: $spacing-sm 0;
    text-align: center;
    
    .received-label {
      font-size: 0.85rem;
      opacity: 0.9;
      margin-bottom: $spacing-xs;
    }
    
    .received-cards {
      display: flex;
      justify-content: center;
      gap: $spacing-xs;
      
      .received-card {
        transform: scale(0.7);
        transform-origin: center;
      }
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
