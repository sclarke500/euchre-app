/**
 * Euchre Remarks System
 * 
 * Detects positive/negative events and fetches remarks from bot profiles.
 * Game logic only - knows nothing about individual bot personalities.
 */

import { getRemark, type RemarkMode, type Sentiment } from '../ai/bots/index.js'

// Re-export for convenience
export type { RemarkMode } from '../ai/bots/index.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EuchreRemark {
  playerId: number
  playerName: string
  text: string
  sentiment: Sentiment
}

// ---------------------------------------------------------------------------
// Event Probabilities
// ---------------------------------------------------------------------------

// Probability of generating a remark for each event type (percentage)
const eventProbability: Record<string, number> = {
  game_won: 90,
  game_lost: 70,
  euchred_opponent: 75,
  got_euchred: 70,
  alone_success: 85,
  made_call: 30,
  stole_deal: 60,
}

// Global cooldown
let lastRemarkTime = 0
const COOLDOWN_MS = 3000

// ---------------------------------------------------------------------------
// State Types
// ---------------------------------------------------------------------------

export interface EuchreRemarkState {
  phase: string
  scores: { teamId: number; score: number }[]
  currentRound: {
    trump: { suit: string; calledBy: number } | null
    goingAlone: boolean
    dealer: number
  } | null
  gameOver: boolean
  winner: number | null
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
  oldState: EuchreRemarkState | null,
  newState: EuchreRemarkState,
  players: Player[]
): DetectedEvent[] {
  const events: DetectedEvent[] = []
  
  const aiPlayers = players.filter(p => !p.isHuman)
  if (aiPlayers.length === 0 || !oldState) return events
  
  const getAIOnTeam = (teamId: number) => aiPlayers.find(p => p.teamId === teamId)
  const getAINotOnTeam = (teamId: number) => aiPlayers.find(p => p.teamId !== teamId)
  
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
  
  // Score changed = round completed
  const oldScore0 = oldState.scores.find(s => s.teamId === 0)?.score ?? 0
  const oldScore1 = oldState.scores.find(s => s.teamId === 1)?.score ?? 0
  const newScore0 = newState.scores.find(s => s.teamId === 0)?.score ?? 0
  const newScore1 = newState.scores.find(s => s.teamId === 1)?.score ?? 0
  
  const team0Gained = newScore0 - oldScore0
  const team1Gained = newScore1 - oldScore1
  
  if (team0Gained > 0 || team1Gained > 0) {
    const scoringTeam = team0Gained > 0 ? 0 : 1
    const calledBy = oldState.currentRound?.trump?.calledBy ?? -1
    const callingTeam = calledBy !== -1 ? (calledBy % 2) : -1
    const wasAlone = oldState.currentRound?.goingAlone ?? false
    const dealer = oldState.currentRound?.dealer ?? 0
    const dealerTeam = dealer % 2
    
    // Euchre: calling team didn't score
    const wasEuchre = callingTeam !== -1 && callingTeam !== scoringTeam
    
    if (wasEuchre) {
      // Team that got euchred (negative)
      const euchredAI = getAIOnTeam(callingTeam)
      if (euchredAI) {
        events.push({ 
          type: 'got_euchred', 
          playerId: euchredAI.id, 
          playerName: euchredAI.name,
          sentiment: 'negative'
        })
      }
      
      // Team that did the euchring (positive)
      const euchringAI = getAIOnTeam(scoringTeam)
      if (euchringAI) {
        events.push({ 
          type: 'euchred_opponent', 
          playerId: euchringAI.id, 
          playerName: euchringAI.name,
          sentiment: 'positive'
        })
      }
    } else if (wasAlone && callingTeam === scoringTeam) {
      // Made it going alone (positive)
      const caller = players.find(p => p.id === calledBy)
      if (caller && !caller.isHuman) {
        events.push({ 
          type: 'alone_success', 
          playerId: caller.id, 
          playerName: caller.name,
          sentiment: 'positive'
        })
      }
    } else if (callingTeam === scoringTeam) {
      // Made their call (positive)
      const caller = players.find(p => p.id === calledBy)
      if (caller && !caller.isHuman) {
        const eventType = dealerTeam !== callingTeam ? 'stole_deal' : 'made_call'
        events.push({ 
          type: eventType, 
          playerId: caller.id, 
          playerName: caller.name,
          sentiment: 'positive'
        })
      }
    }
  }
  
  return events
}

// ---------------------------------------------------------------------------
// Main Export
// ---------------------------------------------------------------------------

/**
 * Process state change and maybe generate a remark
 */
export function getEuchreRemark(
  oldState: EuchreRemarkState | null,
  newState: EuchreRemarkState,
  players: Player[],
  mode: RemarkMode
): EuchreRemark | null {
  // Cooldown check
  const now = Date.now()
  if (now - lastRemarkTime < COOLDOWN_MS) return null
  
  // Detect events
  const events = detectEvents(oldState, newState, players)
  if (events.length === 0) return null
  
  // Try each event
  for (const event of events) {
    // Roll against probability
    const prob = eventProbability[event.type] ?? 50
    if (Math.random() * 100 > prob) continue
    
    // Get remark from bot profile
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
