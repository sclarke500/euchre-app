/**
 * President Chat Engine
 * 
 * Detects chat-worthy moments from President state changes.
 * Pure function: (oldState, newState) => ChatEvent | null
 */

import type { PresidentPhase, PlayerRank } from './types.js'
import type { ChatTrigger, ChatEvent, ChatMode } from '../ai/chat/types.js'
import { shouldChat, recordChat, sortByPriority, pickWeighted } from '../ai/chat/picker.js'
import { getPhrasePool } from '../ai/chat/phrases.js'

// Minimal state snapshot for chat detection
export interface PresidentChatState {
  phase: PresidentPhase | string
  currentPlayer: number
  finishedPlayers: number[]  // Player IDs in finish order
  consecutivePasses: number
  lastPlayerId: number | null
  pileCleared: boolean  // Did pile just get cleared?
  roundNumber: number
  gameOver: boolean
  players: Array<{
    id: number
    rank: PlayerRank | null
    cardCount: number
  }>
}

// Who should speak for a given trigger
interface SpeakerInfo {
  playerId: number
  playerName: string
}

/**
 * Detect chat triggers by comparing old and new state
 */
export function detectPresidentTriggers(
  oldState: PresidentChatState | null,
  newState: PresidentChatState,
  players: Array<{ id: number; name: string; isHuman: boolean }>
): { trigger: ChatTrigger; speaker: SpeakerInfo }[] {
  const triggers: { trigger: ChatTrigger; speaker: SpeakerInfo }[] = []
  
  // Get AI players for potential speakers
  const aiPlayers = players.filter(p => !p.isHuman)
  if (aiPlayers.length === 0) return triggers
  
  const getAIById = (id: number) => aiPlayers.find(p => p.id === id)
  
  // No old state = initial state, nothing to compare
  if (!oldState) return triggers
  
  // Game just ended
  if (!oldState.gameOver && newState.gameOver) {
    // Find who won (first in finishedPlayers across rounds, or best rank)
    const firstFinisher = newState.finishedPlayers[0]
    if (firstFinisher !== undefined) {
      const winner = getAIById(firstFinisher)
      if (winner) {
        triggers.push({
          trigger: 'game_won',
          speaker: { playerId: winner.id, playerName: winner.name }
        })
      }
      
      // Find losers (last finisher)
      const lastFinisher = newState.finishedPlayers[newState.finishedPlayers.length - 1]
      if (lastFinisher !== undefined && lastFinisher !== firstFinisher) {
        const loser = getAIById(lastFinisher)
        if (loser) {
          triggers.push({
            trigger: 'game_lost',
            speaker: { playerId: loser.id, playerName: loser.name }
          })
        }
      }
    }
    return triggers
  }
  
  // Someone just finished (new entry in finishedPlayers)
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
        // First out - President!
        triggers.push({
          trigger: 'president_first_out',
          speaker: { playerId: finisher.id, playerName: finisher.name }
        })
      } else if (finishPosition === totalPlayers) {
        // Last out - Scum!
        triggers.push({
          trigger: 'president_last_out',
          speaker: { playerId: finisher.id, playerName: finisher.name }
        })
      } else if (finishPosition === 2) {
        // Second out - VP
        triggers.push({
          trigger: 'president_second_out',
          speaker: { playerId: finisher.id, playerName: finisher.name }
        })
      }
    }
  }
  
  // Pile was just cleared (bomb or instant win)
  if (newState.pileCleared && !oldState.pileCleared && oldState.lastPlayerId !== null) {
    const clearer = getAIById(oldState.lastPlayerId)
    if (clearer) {
      triggers.push({
        trigger: 'president_pile_cleared',
        speaker: { playerId: clearer.id, playerName: clearer.name }
      })
    }
  }
  
  // Round complete (new round started)
  if (newState.roundNumber > oldState.roundNumber) {
    // Someone who became President
    const newPresident = newState.players.find(p => p.rank === 1)
    if (newPresident) {
      const presidentAI = getAIById(newPresident.id)
      if (presidentAI) {
        triggers.push({
          trigger: 'round_won',
          speaker: { playerId: presidentAI.id, playerName: presidentAI.name }
        })
      }
    }
    
    // Someone who became Scum
    const maxRank = Math.max(...newState.players.map(p => p.rank ?? 0))
    const newScum = newState.players.find(p => p.rank === maxRank)
    if (newScum && maxRank >= 4) {
      const scumAI = getAIById(newScum.id)
      if (scumAI) {
        triggers.push({
          trigger: 'round_lost',
          speaker: { playerId: scumAI.id, playerName: scumAI.name }
        })
      }
    }
  }
  
  return triggers
}

/**
 * Process state change and generate chat event if appropriate
 */
export function processPresidentChat(
  oldState: PresidentChatState | null,
  newState: PresidentChatState,
  players: Array<{ id: number; name: string; isHuman: boolean }>,
  mode: ChatMode,
  forceTrigger = false
): ChatEvent | null {
  // Detect all triggers
  const detected = detectPresidentTriggers(oldState, newState, players)
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
