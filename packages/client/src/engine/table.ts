/**
 * Card Game Engine - Table State Management
 * 
 * Manages card positions and computes animations for state transitions.
 */

import { ref, computed, type Ref } from 'vue'
import type { 
  Card, 
  Suit, 
  Rank, 
  CardLocation, 
  TablePosition, 
  TableLayout, 
  TableState,
  AnimationRequest,
  Player
} from './types'
import { LAYOUTS } from './types'

// ============================================================================
// DECK CREATION
// ============================================================================

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades']
const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']

export function createDeck(includeJokers = false): Card[] {
  const cards: Card[] = []
  
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      cards.push({
        id: `${rank}-${suit}`,
        suit,
        rank,
        faceUp: false
      })
    }
  }
  
  if (includeJokers) {
    cards.push({ id: 'joker-1', suit: 'spades', rank: 'Joker', faceUp: false })
    cards.push({ id: 'joker-2', suit: 'hearts', rank: 'Joker', faceUp: false })
  }
  
  return cards
}

export function shuffleDeck(cards: Card[]): Card[] {
  const shuffled = [...cards]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

// ============================================================================
// TABLE STATE COMPOSABLE
// ============================================================================

export function useTable(initialPlayerCount: number = 4) {
  // Core state
  const cards: Ref<Map<string, Card>> = ref(new Map())
  const cardLocations: Ref<Map<string, CardLocation>> = ref(new Map())
  const players: Ref<Player[]> = ref([])
  const layout: Ref<TableLayout> = ref(LAYOUTS[initialPlayerCount] || LAYOUTS[4])
  
  // Animation queue
  const pendingAnimations: Ref<AnimationRequest[]> = ref([])
  const isAnimating = ref(false)

  // -------------------------------------------------------------------------
  // SETUP
  // -------------------------------------------------------------------------

  function setPlayerCount(count: 2 | 3 | 4 | 5 | 6) {
    layout.value = LAYOUTS[count] ?? LAYOUTS[4]
    
    // Create players for each position
    players.value = layout.value.positions.map((position, index) => ({
      id: `player-${index}`,
      name: index === 0 ? 'You' : `Player ${index + 1}`,
      position,
      isHuman: index === 0,
      isCurrentTurn: false
    }))
  }

  function initializeDeck(includeJokers = false) {
    const deck = shuffleDeck(createDeck(includeJokers))
    
    cards.value.clear()
    cardLocations.value.clear()
    
    deck.forEach(card => {
      cards.value.set(card.id, card)
      cardLocations.value.set(card.id, { zone: 'deck' })
    })
  }

  // -------------------------------------------------------------------------
  // CARD QUERIES
  // -------------------------------------------------------------------------

  const cardsInDeck = computed(() => 
    Array.from(cardLocations.value.entries())
      .filter(([_, loc]) => loc.zone === 'deck')
      .map(([id]) => cards.value.get(id)!)
  )

  function cardsInHand(position: TablePosition) {
    return Array.from(cardLocations.value.entries())
      .filter(([_, loc]) => loc.zone === 'hand' && loc.position === position)
      .map(([id]) => cards.value.get(id)!)
  }

  function cardsInPlayArea(position?: TablePosition) {
    return Array.from(cardLocations.value.entries())
      .filter(([_, loc]) => {
        if (loc.zone !== 'play-area') return false
        if (position && loc.position !== position) return false
        return true
      })
      .map(([id]) => cards.value.get(id)!)
  }

  const cardsInKitty = computed(() =>
    Array.from(cardLocations.value.entries())
      .filter(([_, loc]) => loc.zone === 'kitty')
      .map(([id]) => cards.value.get(id)!)
  )

  // -------------------------------------------------------------------------
  // CARD MOVEMENTS (with animation requests)
  // -------------------------------------------------------------------------

  function moveCard(cardId: string, to: CardLocation, animate = true): AnimationRequest | null {
    const from = cardLocations.value.get(cardId)
    if (!from) return null

    // Update state
    cardLocations.value.set(cardId, to)

    // Queue animation
    if (animate && from.zone !== to.zone) {
      const request: AnimationRequest = {
        type: getAnimationType(from, to),
        cardId,
        from,
        to
      }
      pendingAnimations.value.push(request)
      return request
    }
    
    return null
  }

  function getAnimationType(from: CardLocation, to: CardLocation): AnimationRequest['type'] {
    if (from.zone === 'deck' && to.zone === 'hand') return 'deal'
    if (from.zone === 'hand' && to.zone === 'play-area') return 'play'
    if (from.zone === 'play-area' && to.zone === 'won-tricks') return 'collect'
    if (from.zone === 'hand' && to.zone === 'discard') return 'discard'
    return 'deal' // fallback
  }

  // -------------------------------------------------------------------------
  // HIGH-LEVEL ACTIONS
  // -------------------------------------------------------------------------

  function dealCards(cardsPerPlayer: number, faceUp = true) {
    const deckCards = cardsInDeck.value
    const positions = layout.value.positions
    
    let cardIndex = 0
    const animations: AnimationRequest[] = []
    
    // Deal in rounds (one card to each player, repeat)
    for (let round = 0; round < cardsPerPlayer; round++) {
      for (const position of positions) {
        if (cardIndex >= deckCards.length) break
        
        const card = deckCards[cardIndex]
        if (!card) break
        card.faceUp = position === 'bottom' ? faceUp : false // only show human's cards
        
        const anim = moveCard(card.id, { zone: 'hand', position })
        if (anim) {
          anim.delay = cardIndex * 100 // stagger deal
          animations.push(anim)
        }
        cardIndex++
      }
    }
    
    return animations
  }

  function playCard(cardId: string, fromPosition: TablePosition) {
    const card = cards.value.get(cardId)
    if (!card) return null
    
    card.faceUp = true
    return moveCard(cardId, { zone: 'play-area', position: fromPosition })
  }

  function collectTrick(winnerPosition: TablePosition) {
    const playAreaCards = cardsInPlayArea()
    const animations: AnimationRequest[] = []
    
    playAreaCards.forEach((card, index) => {
      const anim = moveCard(card.id, { zone: 'won-tricks', position: winnerPosition })
      if (anim) {
        anim.delay = index * 50
        animations.push(anim)
      }
    })
    
    return animations
  }

  function flipCard(cardId: string) {
    const card = cards.value.get(cardId)
    if (card) {
      card.faceUp = !card.faceUp
    }
  }

  function reset() {
    cards.value.clear()
    cardLocations.value.clear()
    pendingAnimations.value = []
  }

  // Initialize with defaults
  setPlayerCount(initialPlayerCount as 2 | 3 | 4 | 5 | 6)

  return {
    // State
    cards,
    cardLocations,
    players,
    layout,
    pendingAnimations,
    isAnimating,
    
    // Queries
    cardsInDeck,
    cardsInHand,
    cardsInPlayArea,
    cardsInKitty,
    
    // Setup
    setPlayerCount,
    initializeDeck,
    reset,
    
    // Actions
    moveCard,
    dealCards,
    playCard,
    collectTrick,
    flipCard,
  }
}

export type TableEngine = ReturnType<typeof useTable>
