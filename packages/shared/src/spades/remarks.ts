/**
 * Spades Remarks System
 *
 * Detects remark-worthy events by diffing state snapshots (plus explicit
 * event flags set by the game at trick/round completion) and maps them to
 * remark categories. Text selection + cooldown live in the shared engine.
 */

import { createGameRemarkEngine, type BotRemark, type RemarkEvent } from '../ai/remarkEngine.js'
import type { Sentiment } from '../ai/bots/index.js'

export type { RemarkMode } from '../ai/bots/index.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SpadesRemark = BotRemark

/** Event flags set by the game when trick/round events occur */
export interface SpadesRemarkFlags {
  /** Nil bid survived the round (set at scoring) */
  nilMade?: { playerId: number; blind: boolean }
  /** Nil bidder just won their first trick — the nil died live */
  nilBroken?: { playerId: number; blind: boolean }
  /** Team bid more tricks than they took (set at scoring) */
  setBid?: { teamId: number }
}

export interface SpadesRemarkState extends SpadesRemarkFlags {
  phase: string
  scores: { teamId: number; score: number; bags?: number }[]
  roundNumber: number
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

function detectEvents(
  oldState: SpadesRemarkState | null,
  newState: SpadesRemarkState,
  players: Player[]
): RemarkEvent[] {
  const events: RemarkEvent[] = []

  const aiPlayers = players.filter(p => !p.isHuman)
  if (aiPlayers.length === 0 || !oldState) return events

  const getAIOnTeam = (teamId: number) => aiPlayers.find(p => p.teamId === teamId)
  const getAINotOnTeam = (teamId: number) => aiPlayers.find(p => p.teamId !== teamId)
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
  if (!oldState.gameOver && newState.gameOver && newState.winner !== null) {
    const winningAI = getAIOnTeam(newState.winner)
    const losingAI = getAINotOnTeam(newState.winner)

    if (winningAI) push('game_won', 'celebrate', winningAI, 'positive', 90)
    if (losingAI) push('game_lost', 'concede', losingAI, 'negative', 70)
    return events
  }

  // Nil broken live — the bidder just won a trick mid-round
  if (newState.nilBroken) {
    const { playerId, blind } = newState.nilBroken
    const bidder = players.find(p => p.id === playerId)

    if (bidder && !bidder.isHuman) {
      push(blind ? 'blind_nil_broken' : 'nil_broken', 'wince_big', bidder, 'negative', 85)
    }
    // Opponent gloats — works even when the broken nil belongs to the human
    if (bidder) {
      const gloater = getAINotOnTeam(bidder.teamId)
      if (gloater) push('broke_nil', 'gloat', gloater, 'positive', 80)
    }
  }

  // Nil made (set at scoring)
  if (newState.nilMade) {
    const nilPlayer = getAIById(newState.nilMade.playerId)
    if (nilPlayer) {
      push(newState.nilMade.blind ? 'blind_nil_made' : 'nil_made', 'brag_big', nilPlayer, 'positive',
        newState.nilMade.blind ? 95 : 85)
    }
  }

  // Team got set
  if (newState.setBid) {
    const setTeamAI = getAIOnTeam(newState.setBid.teamId)
    if (setTeamAI) push('got_set', 'wince', setTeamAI, 'negative', 75)

    const celebrator = getAINotOnTeam(newState.setBid.teamId)
    if (celebrator) push('set_opponent', 'gloat', celebrator, 'positive', 80)
  }

  // Round complete: bag penalty + round won/lost
  const justCompletedRound =
    (newState.phase === 'round_complete' || newState.phase === 'game_over') &&
    (oldState.phase !== 'round_complete' && oldState.phase !== 'game_over')

  if (justCompletedRound) {
    const oldScore0 = oldState.scores.find(s => s.teamId === 0)?.score ?? 0
    const oldScore1 = oldState.scores.find(s => s.teamId === 1)?.score ?? 0
    const newScore0 = newState.scores.find(s => s.teamId === 0)?.score ?? 0
    const newScore1 = newState.scores.find(s => s.teamId === 1)?.score ?? 0

    // Bag penalty: bags are stored % 10, so they only ever decrease when the
    // 10-bag penalty (-100) was just applied
    for (const teamId of [0, 1]) {
      const oldBags = oldState.scores.find(s => s.teamId === teamId)?.bags
      const newBags = newState.scores.find(s => s.teamId === teamId)?.bags
      if (oldBags !== undefined && newBags !== undefined && newBags < oldBags) {
        const bagged = getAIOnTeam(teamId)
        if (bagged) push('bag_penalty', 'wince', bagged, 'negative', 70)
      }
    }

    const gain0 = newScore0 - oldScore0
    const gain1 = newScore1 - oldScore1

    if (gain0 !== gain1) {
      const winnerTeam = gain0 > gain1 ? 0 : 1
      const loserTeam = 1 - winnerTeam
      const loserGain = winnerTeam === 0 ? gain1 : gain0

      const winnerAI = getAIOnTeam(winnerTeam)
      if (winnerAI) push('round_won', 'brag', winnerAI, 'positive', 50)

      const loserAI = getAIOnTeam(loserTeam)
      if (loserAI && loserGain < 0) push('round_lost', 'wince', loserAI, 'negative', 40)
    }
  }

  return events
}

// ---------------------------------------------------------------------------
// Main Export
// ---------------------------------------------------------------------------

/**
 * Create a remark engine instance for one Spades game.
 * Holds the previous state snapshot and the remark cooldown per instance.
 */
export function createSpadesRemarkEngine() {
  return createGameRemarkEngine<SpadesRemarkState, Player>(detectEvents)
}
