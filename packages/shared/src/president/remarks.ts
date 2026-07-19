/**
 * President Remarks System
 *
 * Detects remark-worthy events by diffing state snapshots and maps them to
 * remark categories. Text selection + cooldown live in the shared engine.
 */

import { createGameRemarkEngine, type BotRemark, type RemarkEvent } from '../ai/remarkEngine.js'
import type { Sentiment } from '../ai/bots/index.js'
import { PlayerRank } from './types.js'

export type { RemarkMode } from '../ai/bots/index.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PresidentRemark = BotRemark

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

function scumRank(players: PresidentRemarkState['players']): number {
  const maxRank = Math.max(...players.map(p => p.rank ?? 0))
  return maxRank >= PlayerRank.ViceScum ? maxRank : -1
}

function detectEvents(
  oldState: PresidentRemarkState | null,
  newState: PresidentRemarkState,
  players: Player[]
): RemarkEvent[] {
  const events: RemarkEvent[] = []

  const aiPlayers = players.filter(p => !p.isHuman)
  if (aiPlayers.length === 0 || !oldState) return events

  const getAIById = (id: number) => aiPlayers.find(p => p.id === id)

  const push = (
    type: string,
    category: RemarkEvent['category'],
    player: Player,
    sentiment: Sentiment,
    probability: number
  ) => {
    events.push({ type, category, playerId: player.id, playerName: player.name, sentiment, probability })
  }

  // Game just ended
  if (!oldState.gameOver && newState.gameOver) {
    const firstFinisher = newState.finishedPlayers[0]
    if (firstFinisher !== undefined) {
      const winner = getAIById(firstFinisher)
      if (winner) push('game_won', 'celebrate', winner, 'positive', 90)

      const lastFinisher = newState.finishedPlayers[newState.finishedPlayers.length - 1]
      if (lastFinisher !== undefined && lastFinisher !== firstFinisher) {
        const loser = getAIById(lastFinisher)
        if (loser) push('game_lost', 'concede', loser, 'negative', 70)
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
        push('first_out', 'brag', finisher, 'positive', 85)
      } else if (finishPosition === totalPlayers) {
        push('last_out', 'wince', finisher, 'negative', 75)
      }
    }
  }

  // Pile was cleared
  if (newState.pileCleared && !oldState.pileCleared && oldState.lastPlayerId !== null) {
    const clearer = getAIById(oldState.lastPlayerId)
    if (clearer) push('pile_cleared', 'brag', clearer, 'positive', 60)
  }

  // Round complete: rank movements
  if (newState.roundNumber > oldState.roundNumber) {
    const oldScum = scumRank(oldState.players)
    const newScum = scumRank(newState.players)

    for (const newPlayer of newState.players) {
      const ai = getAIById(newPlayer.id)
      if (!ai) continue

      const oldRank = oldState.players.find(p => p.id === newPlayer.id)?.rank ?? null
      const newRank = newPlayer.rank

      if (newRank === PlayerRank.President) {
        if (oldRank !== null && oldScum !== -1 && oldRank === oldScum) {
          // Scum → President in one round: the great comeback
          push('rank_jump', 'brag_big', ai, 'positive', 90)
        } else if (oldRank === PlayerRank.President) {
          // Dynasty continues
          push('repeat_president', 'brag', ai, 'positive', 60)
        } else {
          push('round_won', 'brag', ai, 'positive', 70)
        }
      } else if (newScum !== -1 && newRank === newScum) {
        if (oldRank === PlayerRank.President) {
          // President → Scum: the great fall
          push('rank_fall', 'wince_big', ai, 'negative', 85)
        } else {
          push('round_lost', 'wince', ai, 'negative', 60)
        }
      }
    }
  }

  return events
}

// ---------------------------------------------------------------------------
// Main Export
// ---------------------------------------------------------------------------

/**
 * Create a remark engine instance for one President game.
 * Holds the previous state snapshot and the remark cooldown per instance.
 */
export function createPresidentRemarkEngine() {
  return createGameRemarkEngine<PresidentRemarkState, Player>(detectEvents)
}
