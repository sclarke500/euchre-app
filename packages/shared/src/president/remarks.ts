/**
 * President Remarks System
 * 
 * Detects positive/negative events and fetches remarks from bot profiles.
 */

import { getRemark, type RemarkMode, type Sentiment } from '../ai/bots/index.js'
import type { PlayerRank } from './types.js'

export type { RemarkMode } from '../ai/bots/index.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PresidentRemark {
  playerId: number
  playerName: string
  text: string
  sentiment: Sentiment
}

// ---------------------------------------------------------------------------
// Event Probabilities
// ---------------------------------------------------------------------------

const eventProbability: Record<string, number> = {
  game_won: 90,
  game_lost: 70,
  first_out: 85,      // Became President
  last_out: 75,       // Became Scum
  pile_cleared: 60,   // Bombed the pile
  round_won: 70,      // Won the round
  round_lost: 60,     // Lost the round
}

// Global cooldown
let lastRemarkTime = 0
const COOLDOWN_MS = 3000

// ---------------------------------------------------------------------------
// State Types
// ---------------------------------------------------------------------------

export interface PresidentRemarkState {
  phase: string
  finishedPlayers: number[]
  lastPlayerId: number | null
  pileCleared: boolean
  roundNumber: number
  gameOver: boolean
  players: Array<{
    id: number
    rank: PlayerRank | null
  }>
}

interface Player {
  id: number
  name: string
  isHuman: boolean
}

// ---------------------------------------------------------------------------
// Event Detection
// ---------------------------------------------------------------------------

interface DetectedEvent {
  type: string
  playerId: number
  playerName: string
  sentiment: Sentiment
}

function detectEvents(
  oldState: PresidentRemarkState | null,
  newState: PresidentRemarkState,
  players: Player[]
): DetectedEvent[] {
  const events: DetectedEvent[] = []
  
  const aiPlayers = players.filter(p => !p.isHuman)
  if (aiPlayers.length === 0 || !oldState) return events
  
  const getAIById = (id: number) => aiPlayers.find(p => p.id === id)
  
  // Game just ended
  if (!oldState.gameOver && newState.gameOver) {
    const firstFinisher = newState.finishedPlayers[0]
    if (firstFinisher !== undefined) {
      const winner = getAIById(firstFinisher)
      if (winner) {
        events.push({
          type: 'game_won',
          playerId: winner.id,
          playerName: winner.name,
          sentiment: 'positive'
        })
      }
      
      const lastFinisher = newState.finishedPlayers[newState.finishedPlayers.length - 1]
      if (lastFinisher !== undefined && lastFinisher !== firstFinisher) {
        const loser = getAIById(lastFinisher)
        if (loser) {
          events.push({
            type: 'game_lost',
            playerId: loser.id,
            playerName: loser.name,
            sentiment: 'negative'
          })
        }
      }
    }
    return events
  }
  
  // Someone just finished
  if (newState.finishedPlayers.length > oldState.finishedPlayers.length) {
    const newlyFinished = newState.finishedPlayers.filter(
      id => !oldState.finishedPlayers.includes(id)
    )
    
    for (const finisherId of newlyFinished) {
      const finisher = getAIById(finisherId)
      if (!finisher) continue
      
      const finishPosition = newState.finishedPlayers.indexOf(finisherId) + 1
      const totalPlayers = players.length
      
      if (finishPosition === 1) {
        // First out - positive
        events.push({
          type: 'first_out',
          playerId: finisher.id,
          playerName: finisher.name,
          sentiment: 'positive'
        })
      } else if (finishPosition === totalPlayers) {
        // Last out - negative
        events.push({
          type: 'last_out',
          playerId: finisher.id,
          playerName: finisher.name,
          sentiment: 'negative'
        })
      }
    }
  }
  
  // Pile was cleared
  if (newState.pileCleared && !oldState.pileCleared && oldState.lastPlayerId !== null) {
    const clearer = getAIById(oldState.lastPlayerId)
    if (clearer) {
      events.push({
        type: 'pile_cleared',
        playerId: clearer.id,
        playerName: clearer.name,
        sentiment: 'positive'
      })
    }
  }
  
  // Round complete
  if (newState.roundNumber > oldState.roundNumber) {
    // New President (positive)
    const newPresident = newState.players.find(p => p.rank === 1)
    if (newPresident) {
      const presidentAI = getAIById(newPresident.id)
      if (presidentAI) {
        events.push({
          type: 'round_won',
          playerId: presidentAI.id,
          playerName: presidentAI.name,
          sentiment: 'positive'
        })
      }
    }
    
    // New Scum (negative)
    const maxRank = Math.max(...newState.players.map(p => p.rank ?? 0))
    const newScum = newState.players.find(p => p.rank === maxRank)
    if (newScum && maxRank >= 4) {
      const scumAI = getAIById(newScum.id)
      if (scumAI) {
        events.push({
          type: 'round_lost',
          playerId: scumAI.id,
          playerName: scumAI.name,
          sentiment: 'negative'
        })
      }
    }
  }
  
  return events
}

// ---------------------------------------------------------------------------
// Main Export
// ---------------------------------------------------------------------------

export function getPresidentRemark(
  oldState: PresidentRemarkState | null,
  newState: PresidentRemarkState,
  players: Player[],
  mode: RemarkMode
): PresidentRemark | null {
  const now = Date.now()
  if (now - lastRemarkTime < COOLDOWN_MS) return null
  
  const events = detectEvents(oldState, newState, players)
  if (events.length === 0) return null
  
  for (const event of events) {
    const prob = eventProbability[event.type] ?? 50
    if (Math.random() * 100 > prob) continue
    
    const text = getRemark(event.playerName, event.sentiment, mode)
    if (!text) continue
    
    lastRemarkTime = now
    return {
      playerId: event.playerId,
      playerName: event.playerName,
      text,
      sentiment: event.sentiment,
    }
  }
  
  return null
}
