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
  setArcFan: (enabled: boolean) => void
}

export interface EngineCard {
  id: string
  suit: string
  rank: string
}

export interface ManagedCard {
  card: EngineCard
  faceUp: boolean
  ref: BoardCardRef | null
}

export abstract class CardContainer {
  id: string
  position: { x: number; y: number }  // Center position in pixels
  cards: ManagedCard[] = []
  
  constructor(id: string, position: { x: number; y: number }) {
    this.id = id
    this.position = position
  }
  
  addCard(card: EngineCard, faceUp: boolean = false): ManagedCard {
    const managed: ManagedCard = { card, faceUp, ref: null }
    this.cards.push(managed)
    return managed
  }
  
  removeCard(cardId: string): ManagedCard | null {
    const index = this.cards.findIndex(m => m.card.id === cardId)
    if (index === -1) return null
    const [removed] = this.cards.splice(index, 1)
    return removed ?? null
  }
  
  abstract getCardPosition(index: number): CardPosition

  async repositionAll(duration: number = 350): Promise<void> {
    const promises = this.cards.map((managed, index) => {
      const pos = this.getCardPosition(index)
      const ref = managed.ref
      // Omit flipY entirely - moveTo will preserve current visual flip state
      // This prevents layout operations from accidentally flipping cards
      return ref?.moveTo({
        x: pos.x,
        y: pos.y,
        rotation: pos.rotation,
        zIndex: pos.zIndex,
        scale: pos.scale,
        // flipY intentionally omitted
      }, duration)
    })
    await Promise.all(promises)
  }
  
  setCardRef(cardId: string, ref: BoardCardRef | null): boolean {
    const managed = this.cards.find(m => m.card.id === cardId)
    if (managed) {
      managed.ref = ref
      return true
    }
    return false
  }
}

export class Deck extends CardContainer {
  scale: number
  
  constructor(position: { x: number; y: number }, scale: number = 1.0) {
    super('deck', position)
    this.scale = scale
  }
  
  getCardPosition(index: number): CardPosition {
    return {
      x: this.position.x,
      y: this.position.y - index * 0.8,  // slight upward offset for stacked look
      rotation: 0,
      zIndex: 100 + index,
      scale: this.scale,
      flipY: 0,  // deck cards are always face-down by default
    }
  }
  
  dealTo(hand: Hand): ManagedCard | null {
    if (this.cards.length === 0) return null
    
    const managed = this.cards.pop()
    if (!managed) return null
    
    hand.addManagedCard(managed)
    return managed
  }
}

export type HandMode = 'looseStack' | 'fanned'

export class Hand extends CardContainer {
  mode: HandMode = 'looseStack'
  faceUp: boolean
  fanDirection: 'horizontal' | 'vertical'
  fanSpacing: number  // pixels between cards
  rotation: number    // rotation of the whole hand
  scale: number       // card scale (1.0 = normal)
  fanCurve: number    // degrees of rotation at edges (0 = flat, 15 = curved)
  angleToCenter: number  // angle in degrees pointing toward board center (kitty)
  isUser: boolean     // whether this is the human player's hand (affects fan rendering)

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
      angleToCenter?: number
      isUser?: boolean
    } = {}
  ) {
    super(id, position)
    this.faceUp = options.faceUp ?? false
    this.fanDirection = options.fanDirection ?? 'horizontal'
    this.fanSpacing = options.fanSpacing ?? 20
    this.rotation = options.rotation ?? 0
    this.scale = options.scale ?? 1.0
    this.fanCurve = options.fanCurve ?? 0
    this.angleToCenter = options.angleToCenter ?? 0
    this.isUser = options.isUser ?? false
  }
  
  static calcAngleToCenter(handPos: { x: number; y: number }, centerPos: { x: number; y: number }): number {
    return Math.atan2(centerPos.y - handPos.y, centerPos.x - handPos.x) * (180 / Math.PI)
  }
  
  getCardPosition(index: number): CardPosition {
    const cardCount = this.cards.length
    // Use individual card's faceUp state (authoritative), fall back to hand default
    const card = this.cards[index]
    const cardFaceUp = card ? card.faceUp : this.faceUp
    const flipY = cardFaceUp ? 180 : 0
    
    if (this.mode === 'looseStack') {
      // Deterministic pseudo-random scatter, scaled by hand scale
      const seed = index * 12345.6789
      const randomX = (Math.sin(seed) * 0.5) * 12 * this.scale
      const randomY = (Math.cos(seed) * 0.5) * 8 * this.scale
      const randomRot = (Math.sin(seed * 2) * 0.5) * 8
      
      // User hand z-index 300+ (below avatar at 500), opponents 200+
      const baseZ = this.isUser ? 300 : 200

      return {
        x: this.position.x + randomX,
        y: this.position.y + randomY - index * 0.5,
        rotation: this.rotation + randomRot,
        zIndex: baseZ + index,
        scale: this.scale,
        flipY,
      }
    }
    
    // Fanned mode
    const middleIndex = (cardCount - 1) / 2
    // User hand z-index 300+ (below avatar at 500), opponents 200+
    const baseZ = this.isUser ? 300 : 200

    // User arc fan: calculate position along an arc
    if (this.isUser && this.fanCurve > 0) {
      const spreadAngle = (index - middleIndex) * this.fanCurve
      const angleRad = spreadAngle * Math.PI / 180
      // Arc radius scales with card count: more cards = larger radius for spread
      // 5 cards: 300, 13 cards: 720 (much wider spread for big hands)
      const arcRadius = 200 + cardCount * 40
      // Cards positioned along arc, pivot point is below hand position
      const arcX = this.position.x + Math.sin(angleRad) * arcRadius
      const arcY = this.position.y - Math.cos(angleRad) * arcRadius + arcRadius
      return {
        x: arcX,
        y: arcY,
        rotation: spreadAngle,
        zIndex: baseZ + index,
        scale: this.scale,
        flipY,
      }
    }

    // Regular horizontal spread for opponents (or user without curve)
    const spreadAmount = (index - middleIndex) * this.fanSpacing * this.scale
    const rotRad = this.rotation * Math.PI / 180
    const offsetX = spreadAmount * Math.cos(rotRad)
    const offsetY = spreadAmount * Math.sin(rotRad)

    return {
      x: this.position.x + offsetX,
      y: this.position.y + offsetY,
      rotation: this.rotation,
      zIndex: baseZ + index,
      scale: this.scale,
      flipY,
    }
  }
  
  addManagedCard(managed: ManagedCard) {
    managed.faceUp = this.faceUp
    this.cards.push(managed)
  }
  
  async setMode(mode: HandMode, duration: number = 400): Promise<void> {
    this.mode = mode
    await this.repositionAll(duration)
  }
  
  flipCards(faceUp: boolean) {
    this.faceUp = faceUp
    for (const managed of this.cards) {
      managed.faceUp = faceUp
    }
  }
}

export class Pile extends CardContainer {
  private cardPositions = new Map<string, CardPosition>()
  scale: number

  constructor(id: string, position: { x: number; y: number }, scale: number = 1.0) {
    super(id, position)
    this.scale = scale
  }

  getCardPosition(index: number): CardPosition {
    const cardId = this.cards[index]?.card.id
    if (cardId && this.cardPositions.has(cardId)) {
      return this.cardPositions.get(cardId)!
    }
    // Default: stacked at pile center
    return {
      x: this.position.x,
      y: this.position.y,
      rotation: 0,
      zIndex: 200 + index,
      scale: this.scale,
    }
  }

  setCardTargetPosition(cardId: string, pos: CardPosition) {
    this.cardPositions.set(cardId, pos)
  }

  addManagedCard(managed: ManagedCard) {
    this.cards.push(managed)
  }

  clear() {
    this.cards = []
    this.cardPositions.clear()
  }
}

