/**
 * Euchre Chat Engine
 * 
 * Detects chat-worthy moments from Euchre state changes.
 * Pure function: (oldState, newState) => ChatEvent | null
 */

import type { Round } from './types.js'
import type { ChatTrigger, ChatEvent, ChatMode } from '../ai/chat/types.js'
import { shouldChat, recordChat, sortByPriority, pickWeighted } from '../ai/chat/picker.js'
import { getPhrasePool } from '../ai/chat/phrases.js'

// Minimal state snapshot for chat detection
export interface EuchreChatState {
  phase: string
  scores: { teamId: number; score: number }[]
  currentRound: {
    trump: { suit: string; calledBy: number } | null
    goingAlone: boolean
    dealer: number
    tricks: Array<{
      winnerId: number | null
      cards: Array<{ card: { suit: string; rank: string }; playerId: number }>
    }>
  } | null
  gameOver: boolean
  winner: number | null
}

// Who should speak for a given trigger
interface SpeakerInfo {
  playerId: number
  playerName: string
  teamId: number
}

/**
 * Detect chat triggers by comparing old and new state
 */
export function detectEuchreTriggers(
  oldState: EuchreChatState | null,
  newState: EuchreChatState,
  players: Array<{ id: number; name: string; isHuman: boolean; teamId: number }>
): { trigger: ChatTrigger; speaker: SpeakerInfo }[] {
  const triggers: { trigger: ChatTrigger; speaker: SpeakerInfo }[] = []
  
  // Get AI players for potential speakers
  const aiPlayers = players.filter(p => !p.isHuman)
  if (aiPlayers.length === 0) return triggers
  
  const getAIOnTeam = (teamId: number) => aiPlayers.find(p => p.teamId === teamId)
  const getAINotOnTeam = (teamId: number) => aiPlayers.find(p => p.teamId !== teamId)
  
  // No old state = initial state, nothing to compare
  if (!oldState) return triggers
  
  // Game just ended
  if (!oldState.gameOver && newState.gameOver && newState.winner !== null) {
    const winningAI = getAIOnTeam(newState.winner)
    const losingAI = getAINotOnTeam(newState.winner)
    
    if (winningAI) {
      triggers.push({ 
        trigger: 'game_won', 
        speaker: { playerId: winningAI.id, playerName: winningAI.name, teamId: winningAI.teamId }
      })
    }
    if (losingAI) {
      triggers.push({ 
        trigger: 'game_lost', 
        speaker: { playerId: losingAI.id, playerName: losingAI.name, teamId: losingAI.teamId }
      })
    }
    return triggers // Game over is the only trigger that matters
  }
  
  // Score changed = round just completed
  const oldScore0 = oldState.scores.find(s => s.teamId === 0)?.score ?? 0
  const oldScore1 = oldState.scores.find(s => s.teamId === 1)?.score ?? 0
  const newScore0 = newState.scores.find(s => s.teamId === 0)?.score ?? 0
  const newScore1 = newState.scores.find(s => s.teamId === 1)?.score ?? 0
  
  const team0Gained = newScore0 - oldScore0
  const team1Gained = newScore1 - oldScore1
  
  if (team0Gained > 0 || team1Gained > 0) {
    const scoringTeam = team0Gained > 0 ? 0 : 1
    const pointsGained = team0Gained > 0 ? team0Gained : team1Gained
    const calledBy = oldState.currentRound?.trump?.calledBy ?? -1
    const callingTeam = calledBy !== -1 ? (calledBy % 2) : -1
    const wasAlone = oldState.currentRound?.goingAlone ?? false
    const dealer = oldState.currentRound?.dealer ?? 0
    const dealerTeam = dealer % 2
    
    // Euchre detection: calling team didn't score
    const wasEuchre = callingTeam !== -1 && callingTeam !== scoringTeam
    
    if (wasEuchre) {
      // Team that got euchred
      const euchredAI = getAIOnTeam(callingTeam)
      if (euchredAI) {
        // Self-blame if they were the caller
        const trigger: ChatTrigger = euchredAI.id === calledBy ? 'called_trump_euchred' : 'got_euchred'
        triggers.push({ 
          trigger, 
          speaker: { playerId: euchredAI.id, playerName: euchredAI.name, teamId: euchredAI.teamId }
        })
      }
      
      // Team that did the euchring
      const euchringAI = getAIOnTeam(scoringTeam)
      if (euchringAI) {
        triggers.push({ 
          trigger: 'euchred_opponent', 
          speaker: { playerId: euchringAI.id, playerName: euchringAI.name, teamId: euchringAI.teamId }
        })
      }
    } else if (wasAlone) {
      // Alone hand
      const caller = players.find(p => p.id === calledBy)
      if (caller && !caller.isHuman) {
        const wasMarch = pointsGained === 4
        triggers.push({ 
          trigger: wasMarch ? 'alone_march' : 'alone_success', 
          speaker: { playerId: caller.id, playerName: caller.name, teamId: caller.teamId }
        })
      }
    } else if (callingTeam === scoringTeam) {
      // Made their call
      const caller = players.find(p => p.id === calledBy)
      if (caller && !caller.isHuman) {
        // Check if they stole the deal (called when opponents dealt)
        if (dealerTeam !== callingTeam) {
          triggers.push({ 
            trigger: 'stole_deal', 
            speaker: { playerId: caller.id, playerName: caller.name, teamId: caller.teamId }
          })
        }
        triggers.push({ 
          trigger: 'called_trump_made', 
          speaker: { playerId: caller.id, playerName: caller.name, teamId: caller.teamId }
        })
      }
    }
  }
  
  return triggers
}

/**
 * Process state change and generate chat event if appropriate
 */
export function processEuchreChat(
  oldState: EuchreChatState | null,
  newState: EuchreChatState,
  players: Array<{ id: number; name: string; isHuman: boolean; teamId: number }>,
  mode: ChatMode,
  forceTrigger = false
): ChatEvent | null {
  // Detect all triggers
  const detected = detectEuchreTriggers(oldState, newState, players)
  if (detected.length === 0) return null
  
  // Sort by priority and try each until one fires
  const sorted = sortByPriority(detected.map(d => d.trigger))
  
  for (const trigger of sorted) {
    if (!shouldChat(trigger, forceTrigger)) continue
    
    // Find the speaker for this trigger
    const match = detected.find(d => d.trigger === trigger)
    if (!match) continue
    
    // Pick a phrase
    const pool = getPhrasePool(trigger, mode)
    const text = pickWeighted(pool)
    if (!text) continue
    
    // Record the chat for cooldown
    recordChat()
    
    return {
      odusId: `ai-${match.speaker.playerId}`,
      seatIndex: match.speaker.playerId,
      playerName: match.speaker.playerName,
      text,
      trigger,
    }
  }
  
  return null
}
