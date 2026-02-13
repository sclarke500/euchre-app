import { ref, computed, shallowRef, type ShallowRef } from 'vue'
import type { ComputedRef } from 'vue'
import {
  Deck,
  Hand,
  Pile,
  CardContainer,
  type ManagedCard,
  type BoardCardRef,
  type SandboxCard,
  type CardPosition,
} from '@/components/cardContainers'

export interface CardTableEngine {
  // Reactive state (for template binding)
  allCards: ComputedRef<ManagedCard[]>
  hands: Readonly<ShallowRef<Hand[]>>
  deck: Readonly<ShallowRef<Deck | null>>
  piles: Readonly<ShallowRef<Pile[]>>
  setCardRef: (cardId: string, el: any) => void

  // Container management
  createDeck: (position: { x: number; y: number }, scale?: number) => Deck
  createHand: (id: string, position: { x: number; y: number }, options?: ConstructorParameters<typeof Hand>[2]) => Hand
  createPile: (id: string, position: { x: number; y: number }, scale?: number) => Pile
  getDeck: () => Deck | null
  getHands: () => Hand[]
  getPiles: () => Pile[]
  getContainer: (id: string) => CardContainer | null
  removeContainer: (id: string) => void

  // Card operations
  addCardToDeck: (card: SandboxCard, faceUp?: boolean) => ManagedCard
  dealCard: (from: Deck, to: Hand, flightMs?: number) => Promise<ManagedCard | null>
  moveCard: (cardId: string, from: CardContainer, to: CardContainer, targetPos?: CardPosition, duration?: number) => Promise<void>
  flipCard: (cardId: string, faceUp: boolean, duration?: number) => Promise<void>

  // Bulk operations
  dealAll: (cardsPerHand: number, delayMs?: number, flightMs?: number) => Promise<void>

  // Card ref access
  getCardRef: (cardId: string) => BoardCardRef | undefined

  // Layout / reset
  refreshCards: () => void
  reset: () => void
}

export function useCardTable(): CardTableEngine {
  const deck = shallowRef<Deck | null>(null)
  const hands = shallowRef<Hand[]>([])
  const piles = shallowRef<Pile[]>([])

  // Manual reactivity trigger - increment to force re-render of card list
  const cardsTrigger = ref(0)
  function refreshCards() {
    cardsTrigger.value++
  }

  const allCards = computed<ManagedCard[]>(() => {
    cardsTrigger.value // depend on trigger
    const cards: ManagedCard[] = []
    const seenIds = new Set<string>()
    
    // Helper to add cards while filtering duplicates
    const addCards = (containerCards: ManagedCard[]) => {
      for (const managed of containerCards) {
        if (!seenIds.has(managed.card.id)) {
          seenIds.add(managed.card.id)
          cards.push(managed)
        } else {
          console.warn(`[CardTable] Duplicate card ID detected: ${managed.card.id}`)
        }
      }
    }
    
    if (deck.value) {
      addCards(deck.value.cards)
    }
    for (const hand of hands.value) {
      addCards(hand.cards)
    }
    for (const pile of piles.value) {
      addCards(pile.cards)
    }
    return cards
  })

  // Card ref management
  const cardRefs = new Map<string, BoardCardRef>()

  function setCardRef(cardId: string, el: any) {
    if (!el) {
      cardRefs.delete(cardId)
      return
    }
    const ref = el as BoardCardRef
    cardRefs.set(cardId, ref)
    // Wire up ref to the container that owns this card
    if (deck.value?.setCardRef(cardId, ref)) return
    for (const hand of hands.value) {
      if (hand.setCardRef(cardId, ref)) return
    }
    for (const pile of piles.value) {
      if (pile.setCardRef(cardId, ref)) return
    }
  }

  function getCardRef(cardId: string): BoardCardRef | undefined {
    return cardRefs.get(cardId)
  }

  // Container management
  function createDeck(position: { x: number; y: number }, scale: number = 1.0): Deck {
    const d = new Deck(position, scale)
    deck.value = d
    return d
  }

  function createHand(id: string, position: { x: number; y: number }, options?: ConstructorParameters<typeof Hand>[2]): Hand {
    const hand = new Hand(id, position, options)
    hands.value = [...hands.value, hand]
    return hand
  }

  function createPile(id: string, position: { x: number; y: number }, scale: number = 1.0): Pile {
    const pile = new Pile(id, position, scale)
    piles.value = [...piles.value, pile]
    return pile
  }

  function getDeck(): Deck | null {
    return deck.value
  }

  function getHands(): Hand[] {
    return hands.value
  }

  function getPiles(): Pile[] {
    return piles.value
  }

  function getContainer(id: string): CardContainer | null {
    if (deck.value?.id === id) return deck.value
    const hand = hands.value.find(h => h.id === id)
    if (hand) return hand
    const pile = piles.value.find(p => p.id === id)
    if (pile) return pile
    return null
  }

  function removeContainer(id: string) {
    if (deck.value?.id === id) {
      deck.value = null
      return
    }
    const handIdx = hands.value.findIndex(h => h.id === id)
    if (handIdx !== -1) {
      hands.value = hands.value.filter((_, i) => i !== handIdx)
      return
    }
    const pileIdx = piles.value.findIndex(p => p.id === id)
    if (pileIdx !== -1) {
      piles.value = piles.value.filter((_, i) => i !== pileIdx)
    }
  }

  // Card operations
  function addCardToDeck(card: SandboxCard, faceUp: boolean = false): ManagedCard {
    if (!deck.value) throw new Error('No deck created')
    return deck.value.addCard(card, faceUp)
  }

  async function dealCard(from: Deck, to: Hand, flightMs: number = 400): Promise<ManagedCard | null> {
    const managed = from.dealTo(to)
    if (!managed) return null

    const cardRef = cardRefs.get(managed.card.id)
    if (cardRef) {
      const startPos = cardRef.getPosition()
      const handIndex = to.cards.length - 1
      const targetPos = to.getCardPosition(handIndex)
      cardRef.setPosition({ ...startPos, zIndex: 1000 + handIndex })
      // Double rAF ensures browser paints start position before animating
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
      cardRef.moveTo(targetPos, flightMs)
    }

    return managed
  }

  async function moveCard(
    cardId: string,
    from: CardContainer,
    to: CardContainer,
    targetPos?: CardPosition,
    duration: number = 350
  ): Promise<void> {
    const managed = from.removeCard(cardId)
    if (!managed) return

    if (to instanceof Hand) {
      to.addManagedCard(managed)
    } else if (to instanceof Pile) {
      to.addManagedCard(managed)
    } else {
      to.cards.push(managed)
    }

    // Wire ref to new container
    const cardRef = cardRefs.get(cardId)
    if (cardRef) {
      to.setCardRef(cardId, cardRef)
      const target = targetPos ?? to.getCardPosition(to.cards.length - 1)
      await cardRef.moveTo(target, duration)
    }

    refreshCards()
  }

  async function flipCard(cardId: string, faceUp: boolean, duration: number = 400): Promise<void> {
    const cardRef = cardRefs.get(cardId)
    if (!cardRef) return

    const currentPos = cardRef.getPosition()
    await cardRef.moveTo({
      ...currentPos,
      flipY: faceUp ? 180 : 0,
    }, duration)
  }

  // Bulk operations
  async function dealAll(cardsPerHand: number, delayMs: number = 80, flightMs: number = 400): Promise<void> {
    if (!deck.value) return

    for (let round = 0; round < cardsPerHand; round++) {
      for (const hand of hands.value) {
        await dealCard(deck.value, hand, flightMs)
        if (delayMs > 0) {
          await new Promise(r => setTimeout(r, delayMs))
        }
      }
    }

    // Wait for last flight to complete
    await new Promise(r => setTimeout(r, flightMs))
    refreshCards()
  }

  function reset() {
    deck.value = null
    hands.value = []
    piles.value = []
    cardRefs.clear()
    refreshCards()
  }

  return {
    allCards,
    hands,
    deck,
    piles,
    setCardRef,
    createDeck,
    createHand,
    createPile,
    getDeck,
    getHands,
    getPiles,
    getContainer,
    removeContainer,
    addCardToDeck,
    dealCard,
    moveCard,
    flipCard,
    getCardRef,
    dealAll,
    refreshCards,
    reset,
  }
}
