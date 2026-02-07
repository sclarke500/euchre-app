// Card container system for sandbox
// Containers own cards and manage their positions

export interface CardPosition {
  x: number
  y: number
  rotation: number
  zIndex: number
  scale?: number    // 1.0 = normal size
  flipY?: number    // 0-180 degrees for flip animation
}

export interface BoardCardRef {
  moveTo: (target: CardPosition, duration?: number) => Promise<void>
  setPosition: (pos: CardPosition) => void
  getPosition: () => CardPosition
}

// Simple card type for the sandbox
export interface SandboxCard {
  id: string
  suit: string
  rank: string
}

export interface ManagedCard {
  card: SandboxCard
  faceUp: boolean
  ref: BoardCardRef | null
}

// Base container - uses plain arrays (Vue components handle reactivity)
export abstract class CardContainer {
  id: string
  position: { x: number; y: number }  // Center position in pixels
  cards: ManagedCard[] = []
  
  constructor(id: string, position: { x: number; y: number }) {
    this.id = id
    this.position = position
  }
  
  // Add a card to this container
  addCard(card: SandboxCard, faceUp: boolean = false): ManagedCard {
    const managed: ManagedCard = { card, faceUp, ref: null }
    this.cards.push(managed)
    return managed
  }
  
  // Remove a card from this container
  removeCard(cardId: string): ManagedCard | null {
    const index = this.cards.findIndex(m => m.card.id === cardId)
    if (index === -1) return null
    const [removed] = this.cards.splice(index, 1)
    return removed ?? null
  }
  
  // Get position for a card at given index
  abstract getCardPosition(index: number): CardPosition
  
  // Reposition all cards (with animation)
  async repositionAll(duration: number = 350): Promise<void> {
    const promises = this.cards.map((managed, index) => {
      const pos = this.getCardPosition(index)
      return managed.ref?.moveTo(pos, duration)
    })
    await Promise.all(promises)
  }
  
  // Set ref for a card
  setCardRef(cardId: string, ref: BoardCardRef | null) {
    const managed = this.cards.find(m => m.card.id === cardId)
    if (managed) {
      managed.ref = ref
    }
  }
}

// Deck container - cards stacked on top of each other
export class Deck extends CardContainer {
  constructor(position: { x: number; y: number }) {
    super('deck', position)
  }
  
  getCardPosition(index: number): CardPosition {
    // Stack cards with slight offset
    return {
      x: this.position.x,
      y: this.position.y - index * 0.5,
      rotation: 0,
      zIndex: 100 + index,
    }
  }
  
  // Deal top card to a hand
  dealTo(hand: Hand): ManagedCard | null {
    if (this.cards.length === 0) return null
    
    // Remove from top of deck (last card)
    const managed = this.cards.pop()
    if (!managed) return null
    
    // Add to hand
    hand.addManagedCard(managed)
    return managed
  }
}

// Hand container - cards fanned out
export type HandMode = 'looseStack' | 'fanned'

export class Hand extends CardContainer {
  mode: HandMode = 'looseStack'
  faceUp: boolean
  fanDirection: 'horizontal' | 'vertical'
  fanSpacing: number  // pixels between cards
  rotation: number    // rotation of the whole hand
  scale: number       // card scale (1.0 = normal)
  fanCurve: number    // degrees of rotation at edges (0 = flat, 15 = curved)
  
  constructor(
    id: string, 
    position: { x: number; y: number },
    options: {
      faceUp?: boolean
      fanDirection?: 'horizontal' | 'vertical'
      fanSpacing?: number
      rotation?: number
      scale?: number
      fanCurve?: number
    } = {}
  ) {
    super(id, position)
    this.faceUp = options.faceUp ?? false
    this.fanDirection = options.fanDirection ?? 'horizontal'
    this.fanSpacing = options.fanSpacing ?? 20
    this.rotation = options.rotation ?? 0
    this.scale = options.scale ?? 1.0
    this.fanCurve = options.fanCurve ?? 0
  }
  
  getCardPosition(index: number): CardPosition {
    const cardCount = this.cards.length
    
    if (this.mode === 'looseStack') {
      // Random-ish loose stack
      const seed = index * 12345.6789
      const randomX = (Math.sin(seed) * 0.5) * 12
      const randomY = (Math.cos(seed) * 0.5) * 8
      const randomRot = (Math.sin(seed * 2) * 0.5) * 8
      
      return {
        x: this.position.x + randomX,
        y: this.position.y + randomY - index * 0.5,
        rotation: this.rotation + randomRot,
        zIndex: 200 + index,
        scale: 1.0,  // Normal size during deal
      }
    }
    
    // Fanned mode - use hand's scale
    const totalWidth = (cardCount - 1) * this.fanSpacing * this.scale
    const startOffset = -totalWidth / 2
    const fanOffset = startOffset + index * this.fanSpacing * this.scale
    
    // Calculate curve: -1 at first card, 0 at center, +1 at last card
    const normalizedPos = cardCount > 1 
      ? (index / (cardCount - 1)) * 2 - 1  // -1 to +1
      : 0
    
    // Arc offset magnitude (center cards get max offset)
    const arcAmount = (1 - normalizedPos * normalizedPos) * this.fanCurve * 0.8
    
    // Calculate arc direction based on rotation (arc bows toward table center)
    // rotation=0 (bottom): arc up (-y), rotation=180 (top): arc down (+y)
    // rotation=90 (left): arc right (+x), rotation=-90 (right): arc left (-x)
    const rotRad = this.rotation * Math.PI / 180
    const arcX = Math.sin(rotRad) * arcAmount
    const arcY = -Math.cos(rotRad) * arcAmount
    
    // Curve rotation for cards (fan out from center)
    // For vertical fans, invert so it looks like horizontal fan but rotated
    const curveMult = this.fanDirection === 'vertical' ? -1 : 1
    const curveRotation = normalizedPos * this.fanCurve * curveMult
    
    let x = this.position.x
    let y = this.position.y
    
    if (this.fanDirection === 'horizontal') {
      x += fanOffset
    } else {
      y += fanOffset
    }
    
    // Apply arc offset toward table center
    x += arcX
    y += arcY
    
    return {
      x,
      y,
      rotation: this.rotation + curveRotation,
      zIndex: 200 + index,
      scale: this.scale,
    }
  }
  
  // Add an already-managed card (from deck)
  addManagedCard(managed: ManagedCard) {
    managed.faceUp = this.faceUp
    this.cards.push(managed)
  }
  
  // Set display mode and reposition
  async setMode(mode: HandMode, duration: number = 400): Promise<void> {
    this.mode = mode
    await this.repositionAll(duration)
  }
  
  // Flip all cards face up or down
  flipCards(faceUp: boolean) {
    this.faceUp = faceUp
    for (const managed of this.cards) {
      managed.faceUp = faceUp
    }
  }
}

// Play area - cards played to center
export class PlayArea extends CardContainer {
  playerPositions: Map<string, { x: number; y: number; rotation: number }>
  
  constructor(position: { x: number; y: number }) {
    super('playArea', position)
    this.playerPositions = new Map()
  }
  
  // Set where each player's cards go in the play area
  setPlayerPosition(playerId: string, pos: { x: number; y: number; rotation: number }) {
    this.playerPositions.set(playerId, pos)
  }
  
  getCardPosition(index: number): CardPosition {
    // Default center stacking
    return {
      x: this.position.x + index * 20,
      y: this.position.y,
      rotation: 0,
      zIndex: 300 + index,
    }
  }
  
  // Get position for a specific player's played card
  getPlayerCardPosition(playerId: string): CardPosition {
    const pos = this.playerPositions.get(playerId)
    if (!pos) {
      return this.getCardPosition(this.cards.length)
    }
    return {
      x: pos.x,
      y: pos.y,
      rotation: pos.rotation,
      zIndex: 300 + this.cards.length,
    }
  }
}
