/**
 * Spades Remarks System
 * 
 * Detects positive/negative events and fetches remarks from bot profiles.
 */

import { getRemark, type RemarkMode, type Sentiment } from '../ai/bots/index.js'
import type { SpadesBidType } from './types.js'

export type { RemarkMode } from '../ai/bots/index.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SpadesRemark {
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
  nil_made: 85,
  nil_failed: 80,
  opponent_nil_failed: 75,
  got_set: 75,
  set_opponent: 80,
  round_won: 50,
  round_lost: 40,
}

// Global cooldown
let lastRemarkTime = 0
const COOLDOWN_MS = 3000

// ---------------------------------------------------------------------------
// State Types
// ---------------------------------------------------------------------------

export interface SpadesRemarkState {
  phase: string
  scores: { teamId: number; score: number }[]
  roundNumber: number
  gameOver: boolean
  winner: number | null
  // Event flags (set by game when events occur)
  nilMade?: { playerId: number }
  nilFailed?: { playerId: number }
  setBid?: { teamId: number }
}

interface Player {
  id: number
  name: string
  isHuman: boolean
  teamId: number
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
  oldState: SpadesRemarkState | null,
  newState: SpadesRemarkState,
  players: Player[]
): DetectedEvent[] {
  const events: DetectedEvent[] = []
  
  const aiPlayers = players.filter(p => !p.isHuman)
  if (aiPlayers.length === 0 || !oldState) return events
  
  const getAIOnTeam = (teamId: number) => aiPlayers.find(p => p.teamId === teamId)
  const getAINotOnTeam = (teamId: number) => aiPlayers.find(p => p.teamId !== teamId)
  const getAIById = (id: number) => aiPlayers.find(p => p.id === id)
  
  // Game just ended
  if (!oldState.gameOver && newState.gameOver && newState.winner !== null) {
    const winningAI = getAIOnTeam(newState.winner)
    const losingAI = getAINotOnTeam(newState.winner)
    
    if (winningAI) {
      events.push({
        type: 'game_won',
        playerId: winningAI.id,
        playerName: winningAI.name,
        sentiment: 'positive'
      })
    }
    if (losingAI) {
      events.push({
        type: 'game_lost',
        playerId: losingAI.id,
        playerName: losingAI.name,
        sentiment: 'negative'
      })
    }
    return events
  }
  
  // Nil made (positive for nil bidder)
  if (newState.nilMade) {
    const nilPlayer = getAIById(newState.nilMade.playerId)
    if (nilPlayer) {
      events.push({
        type: 'nil_made',
        playerId: nilPlayer.id,
        playerName: nilPlayer.name,
        sentiment: 'positive'
      })
    }
  }
  
  // Nil failed (negative for nil bidder, positive for opponents)
  if (newState.nilFailed) {
    const failedPlayer = getAIById(newState.nilFailed.playerId)
    if (failedPlayer) {
      events.push({
        type: 'nil_failed',
        playerId: failedPlayer.id,
        playerName: failedPlayer.name,
        sentiment: 'negative'
      })
      
      // Opponent gloats
      const gloater = getAINotOnTeam(failedPlayer.teamId)
      if (gloater) {
        events.push({
          type: 'opponent_nil_failed',
          playerId: gloater.id,
          playerName: gloater.name,
          sentiment: 'positive'
        })
      }
    }
  }
  
  // Team got set
  if (newState.setBid) {
    const setTeamAI = getAIOnTeam(newState.setBid.teamId)
    if (setTeamAI) {
      events.push({
        type: 'got_set',
        playerId: setTeamAI.id,
        playerName: setTeamAI.name,
        sentiment: 'negative'
      })
    }
    
    // Other team celebrates
    const celebrator = getAINotOnTeam(newState.setBid.teamId)
    if (celebrator) {
      events.push({
        type: 'set_opponent',
        playerId: celebrator.id,
        playerName: celebrator.name,
        sentiment: 'positive'
      })
    }
  }
  
  // Round complete
  const justCompletedRound = 
    (newState.phase === 'round_complete' || newState.phase === 'game_over') &&
    (oldState.phase !== 'round_complete' && oldState.phase !== 'game_over')
  
  if (justCompletedRound) {
    const oldScore0 = oldState.scores.find(s => s.teamId === 0)?.score ?? 0
    const oldScore1 = oldState.scores.find(s => s.teamId === 1)?.score ?? 0
    const newScore0 = newState.scores.find(s => s.teamId === 0)?.score ?? 0
    const newScore1 = newState.scores.find(s => s.teamId === 1)?.score ?? 0
    
    const gain0 = newScore0 - oldScore0
    const gain1 = newScore1 - oldScore1
    
    if (gain0 > gain1) {
      const winnerAI = getAIOnTeam(0)
      const loserAI = getAIOnTeam(1)
      if (winnerAI) {
        events.push({
          type: 'round_won',
          playerId: winnerAI.id,
          playerName: winnerAI.name,
          sentiment: 'positive'
        })
      }
      if (loserAI && gain1 < 0) {
        events.push({
          type: 'round_lost',
          playerId: loserAI.id,
          playerName: loserAI.name,
          sentiment: 'negative'
        })
      }
    } else if (gain1 > gain0) {
      const winnerAI = getAIOnTeam(1)
      const loserAI = getAIOnTeam(0)
      if (winnerAI) {
        events.push({
          type: 'round_won',
          playerId: winnerAI.id,
          playerName: winnerAI.name,
          sentiment: 'positive'
        })
      }
      if (loserAI && gain0 < 0) {
        events.push({
          type: 'round_lost',
          playerId: loserAI.id,
          playerName: loserAI.name,
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

export function getSpadesRemark(
  oldState: SpadesRemarkState | null,
  newState: SpadesRemarkState,
  players: Player[],
  mode: RemarkMode
): SpadesRemark | null {
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
