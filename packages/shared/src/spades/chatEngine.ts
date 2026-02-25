/**
 * Spades Chat Engine
 * 
 * Detects chat-worthy moments from Spades state changes.
 * Pure function: (oldState, newState) => ChatEvent | null
 */

import type { SpadesPhase, SpadesBidType } from './types.js'
import type { ChatTrigger, ChatEvent, ChatMode } from '../ai/chat/types.js'
import { shouldChat, recordChat, sortByPriority, pickWeighted } from '../ai/chat/picker.js'
import { getPhrasePool } from '../ai/chat/phrases.js'

// Minimal state snapshot for chat detection
export interface SpadesChatState {
  phase: SpadesPhase | string
  scores: { teamId: number; score: number; bags: number }[]
  currentPlayer: number
  roundNumber: number
  gameOver: boolean
  winner: number | null
  spadesBroken: boolean
  players: Array<{
    id: number
    teamId: number
    bid: { type: SpadesBidType; count: number } | null
    tricksWon: number
  }>
  // Tracking flags
  nilMade?: { playerId: number; blind: boolean }
  nilFailed?: { playerId: number; blind: boolean }
  setBid?: { teamId: number }  // Team just set their opponent
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
export function detectSpadesTriggers(
  oldState: SpadesChatState | null,
  newState: SpadesChatState,
  players: Array<{ id: number; name: string; isHuman: boolean; teamId: number }>
): { trigger: ChatTrigger; speaker: SpeakerInfo }[] {
  const triggers: { trigger: ChatTrigger; speaker: SpeakerInfo }[] = []
  
  // Get AI players for potential speakers
  const aiPlayers = players.filter(p => !p.isHuman)
  if (aiPlayers.length === 0) return triggers
  
  const getAIOnTeam = (teamId: number) => aiPlayers.find(p => p.teamId === teamId)
  const getAINotOnTeam = (teamId: number) => aiPlayers.find(p => p.teamId !== teamId)
  const getAIById = (id: number) => aiPlayers.find(p => p.id === id)
  
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
    return triggers
  }
  
  // Nil made
  if (newState.nilMade) {
    const nilPlayer = getAIById(newState.nilMade.playerId)
    if (nilPlayer) {
      triggers.push({
        trigger: newState.nilMade.blind ? 'spades_blind_nil_made' : 'spades_nil_made',
        speaker: { playerId: nilPlayer.id, playerName: nilPlayer.name, teamId: nilPlayer.teamId }
      })
    }
  }
  
  // Nil failed
  if (newState.nilFailed) {
    const failedPlayer = getAIById(newState.nilFailed.playerId)
    if (failedPlayer) {
      triggers.push({
        trigger: newState.nilFailed.blind ? 'spades_blind_nil_failed' : 'spades_nil_failed',
        speaker: { playerId: failedPlayer.id, playerName: failedPlayer.name, teamId: failedPlayer.teamId }
      })
    }
    // Opponent gloats
    const gloater = getAINotOnTeam(failedPlayer?.teamId ?? 0)
    if (gloater) {
      triggers.push({
        trigger: 'spades_opponent_nil_failed',
        speaker: { playerId: gloater.id, playerName: gloater.name, teamId: gloater.teamId }
      })
    }
  }
  
  // Team got set (setBid flag)
  if (newState.setBid) {
    const setTeamAI = getAIOnTeam(newState.setBid.teamId)
    if (setTeamAI) {
      triggers.push({
        trigger: 'spades_got_set',
        speaker: { playerId: setTeamAI.id, playerName: setTeamAI.name, teamId: setTeamAI.teamId }
      })
    }
    // Other team celebrates
    const celebrator = getAINotOnTeam(newState.setBid.teamId)
    if (celebrator) {
      triggers.push({
        trigger: 'spades_set_opponent',
        speaker: { playerId: celebrator.id, playerName: celebrator.name, teamId: celebrator.teamId }
      })
    }
  }
  
  // Round complete - check if phase just changed to RoundComplete or GameOver
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
    
    // Team that gained more this round "won" the round
    if (gain0 > gain1) {
      const winnerAI = getAIOnTeam(0)
      const loserAI = getAIOnTeam(1)
      if (winnerAI) {
        triggers.push({
          trigger: 'round_won',
          speaker: { playerId: winnerAI.id, playerName: winnerAI.name, teamId: 0 }
        })
      }
      if (loserAI && gain1 < 0) {
        // Only "lost" if actually lost points
        triggers.push({
          trigger: 'round_lost',
          speaker: { playerId: loserAI.id, playerName: loserAI.name, teamId: 1 }
        })
      }
    } else if (gain1 > gain0) {
      const winnerAI = getAIOnTeam(1)
      const loserAI = getAIOnTeam(0)
      if (winnerAI) {
        triggers.push({
          trigger: 'round_won',
          speaker: { playerId: winnerAI.id, playerName: winnerAI.name, teamId: 1 }
        })
      }
      if (loserAI && gain0 < 0) {
        triggers.push({
          trigger: 'round_lost',
          speaker: { playerId: loserAI.id, playerName: loserAI.name, teamId: 0 }
        })
      }
    }
  }
  
  return triggers
}

/**
 * Process state change and generate chat event if appropriate
 */
export function processSpadesChat(
  oldState: SpadesChatState | null,
  newState: SpadesChatState,
  players: Array<{ id: number; name: string; isHuman: boolean; teamId: number }>,
  mode: ChatMode,
  forceTrigger = false
): ChatEvent | null {
  // Detect all triggers
  const detected = detectSpadesTriggers(oldState, newState, players)
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
