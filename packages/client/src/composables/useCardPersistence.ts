/**
 * Card Engine Persistence
 * 
 * Handles saving/restoring card engine state to sessionStorage for instant
 * reconnect recovery. Persists semantic state (card ownership, order) not
 * coordinates — positions are recomputed from current layout on restore.
 */

// ─── Types ─────────────────────────────────────────────────────────────────

export interface Fingerprint {
  stateSeq: number
  phase: string
  dealer?: number
  currentPlayer?: number
  trickCount?: number
  myHandHash: string
}

export interface ContainerSnapshot {
  id: string
  cardIds: string[]
}

export interface HandSnapshot extends ContainerSnapshot {
  mode: 'fanned' | 'looseStack'
  faceUp: boolean
}

export interface PileSnapshot extends ContainerSnapshot {
  metadata?: Record<string, unknown>
}

export interface CardEngineSnapshot {
  version: 1
  savedAt: number
  gameType: string
  sessionKey: string
  fingerprint: Fingerprint
  containers: {
    deck: ContainerSnapshot | null
    hands: HandSnapshot[]
    piles: PileSnapshot[]
  }
  cards: Record<string, { suit: string; rank: string }>
}

// ─── Storage Keys ──────────────────────────────────────────────────────────

function getStorageKey(gameType: string, sessionKey: string): string {
  return `cardEngine:${gameType}:${sessionKey}`
}

// ─── Serialization ─────────────────────────────────────────────────────────

export function serializeEngine(
  engine: {
    getDeck: () => { id: string; cards: Array<{ card: { id: string; suit: string; rank: string } }> } | null
    getHands: () => Array<{ id: string; mode: string; faceUp: boolean; cards: Array<{ card: { id: string; suit: string; rank: string }; faceUp: boolean }> }>
    getPiles: () => Array<{ id: string; cards: Array<{ card: { id: string; suit: string; rank: string } }> }>
  },
  gameType: string,
  sessionKey: string,
  fingerprint: Fingerprint
): CardEngineSnapshot {
  const cards: Record<string, { suit: string; rank: string }> = {}
  
  // Serialize deck
  const deck = engine.getDeck()
  const deckSnapshot: ContainerSnapshot | null = deck ? {
    id: deck.id,
    cardIds: deck.cards.map(m => {
      cards[m.card.id] = { suit: m.card.suit, rank: m.card.rank }
      return m.card.id
    }),
  } : null
  
  // Serialize hands
  const hands = engine.getHands()
  const handSnapshots: HandSnapshot[] = hands.map(hand => {
    const snapshot: HandSnapshot = {
      id: hand.id,
      cardIds: hand.cards.map(m => {
        cards[m.card.id] = { suit: m.card.suit, rank: m.card.rank }
        return m.card.id
      }),
      mode: hand.mode as 'fanned' | 'looseStack',
      faceUp: hand.faceUp,
    }
    return snapshot
  })
  
  // Serialize piles
  const piles = engine.getPiles()
  const pileSnapshots: PileSnapshot[] = piles.map(pile => ({
    id: pile.id,
    cardIds: pile.cards.map(m => {
      cards[m.card.id] = { suit: m.card.suit, rank: m.card.rank }
      return m.card.id
    }),
  }))
  
  return {
    version: 1,
    savedAt: Date.now(),
    gameType,
    sessionKey,
    fingerprint,
    containers: {
      deck: deckSnapshot,
      hands: handSnapshots,
      piles: pileSnapshots,
    },
    cards,
  }
}

// ─── Storage Operations ────────────────────────────────────────────────────

export function saveSnapshot(snapshot: CardEngineSnapshot): boolean {
  try {
    const key = getStorageKey(snapshot.gameType, snapshot.sessionKey)
    const json = JSON.stringify(snapshot)
    sessionStorage.setItem(key, json)
    console.log(`[CardPersistence] Saved snapshot (${json.length} bytes)`, {
      gameType: snapshot.gameType,
      stateSeq: snapshot.fingerprint.stateSeq,
      phase: snapshot.fingerprint.phase,
      cardCount: Object.keys(snapshot.cards).length,
    })
    return true
  } catch (err) {
    console.warn('[CardPersistence] Failed to save snapshot:', err)
    return false
  }
}

export function loadSnapshot(gameType: string, sessionKey: string): CardEngineSnapshot | null {
  try {
    const key = getStorageKey(gameType, sessionKey)
    const json = sessionStorage.getItem(key)
    if (!json) return null
    
    const snapshot = JSON.parse(json) as CardEngineSnapshot
    
    // Version check
    if (snapshot.version !== 1) {
      console.warn('[CardPersistence] Incompatible snapshot version:', snapshot.version)
      clearSnapshot(gameType, sessionKey)
      return null
    }
    
    console.log('[CardPersistence] Loaded snapshot', {
      gameType: snapshot.gameType,
      stateSeq: snapshot.fingerprint.stateSeq,
      phase: snapshot.fingerprint.phase,
      age: Math.round((Date.now() - snapshot.savedAt) / 1000) + 's',
    })
    
    return snapshot
  } catch (err) {
    console.warn('[CardPersistence] Failed to load snapshot:', err)
    clearSnapshot(gameType, sessionKey)
    return null
  }
}

export function clearSnapshot(gameType: string, sessionKey: string): void {
  const key = getStorageKey(gameType, sessionKey)
  sessionStorage.removeItem(key)
  console.log('[CardPersistence] Cleared snapshot:', key)
}

// ─── Fingerprint Comparison ────────────────────────────────────────────────

export function fingerprintsMatch(a: Fingerprint, b: Fingerprint): boolean {
  // Core match: stateSeq and phase must match
  if (a.stateSeq !== b.stateSeq) return false
  if (a.phase !== b.phase) return false
  
  // Hand hash must match (catches card changes)
  if (a.myHandHash !== b.myHandHash) return false
  
  return true
}

export function isSnapshotFresh(snapshot: CardEngineSnapshot, maxAgeMs: number = 5 * 60 * 1000): boolean {
  return Date.now() - snapshot.savedAt < maxAgeMs
}

// ─── Utility ───────────────────────────────────────────────────────────────

export function buildHandHash(cardIds: string[]): string {
  return [...cardIds].sort().join(',')
}
