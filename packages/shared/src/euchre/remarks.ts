/**
 * Euchre Remarks System
 *
 * Detects remark-worthy events by diffing state snapshots and maps them to
 * remark categories. Text selection + cooldown live in the shared engine
 * (ai/remarkEngine.ts); bot voices live in the bot profiles (ai/bots/).
 */

import { createGameRemarkEngine, type BotRemark, type RemarkEvent } from '../ai/remarkEngine.js'
import type { Sentiment } from '../ai/bots/index.js'

// Re-export for convenience
export type { RemarkMode } from '../ai/bots/index.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EuchreRemark = BotRemark

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

// Game is played to 10 points
const GAME_POINT_SCORE = 9

function detectEvents(
  oldState: EuchreRemarkState | null,
  newState: EuchreRemarkState,
  players: Player[]
): RemarkEvent[] {
  const events: RemarkEvent[] = []

  const aiPlayers = players.filter(p => !p.isHuman)
  if (aiPlayers.length === 0 || !oldState) return events

  const getAIOnTeam = (teamId: number) => aiPlayers.find(p => p.teamId === teamId)
  const getAINotOnTeam = (teamId: number) => aiPlayers.find(p => p.teamId !== teamId)

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

  // Score changed = round completed
  const oldScore0 = oldState.scores.find(s => s.teamId === 0)?.score ?? 0
  const oldScore1 = oldState.scores.find(s => s.teamId === 1)?.score ?? 0
  const newScore0 = newState.scores.find(s => s.teamId === 0)?.score ?? 0
  const newScore1 = newState.scores.find(s => s.teamId === 1)?.score ?? 0

  const team0Gained = newScore0 - oldScore0
  const team1Gained = newScore1 - oldScore1

  if (team0Gained > 0 || team1Gained > 0) {
    const scoringTeam = team0Gained > 0 ? 0 : 1
    const pointsGained = scoringTeam === 0 ? team0Gained : team1Gained
    const calledBy = oldState.currentRound?.trump?.calledBy ?? -1
    const callingTeam = calledBy !== -1 ? (calledBy % 2) : -1
    const wasAlone = oldState.currentRound?.goingAlone ?? false
    const dealer = oldState.currentRound?.dealer ?? 0
    const dealerTeam = dealer % 2
    const caller = players.find(p => p.id === calledBy)

    // Euchre: calling team didn't score
    const wasEuchre = callingTeam !== -1 && callingTeam !== scoringTeam

    if (wasEuchre && wasAlone) {
      // Euchred a loner — the sweetest euchre there is
      const gloater = getAIOnTeam(scoringTeam)
      if (gloater) push('euchred_loner', 'gloat', gloater, 'positive', 90)

      // The loner winces hard
      if (caller && !caller.isHuman) push('got_euchred_alone', 'wince_big', caller, 'negative', 80)
    } else if (wasEuchre) {
      const euchredAI = getAIOnTeam(callingTeam)
      if (euchredAI) push('got_euchred', 'wince', euchredAI, 'negative', 70)

      const euchringAI = getAIOnTeam(scoringTeam)
      if (euchringAI) push('euchred_opponent', 'gloat', euchringAI, 'positive', 75)
    } else if (wasAlone && callingTeam === scoringTeam) {
      if (caller && !caller.isHuman) {
        if (pointsGained >= 4) {
          // Alone march — took all 5 tricks solo, 4 points
          push('alone_march', 'brag_big', caller, 'positive', 95)
        } else {
          push('alone_success', 'brag', caller, 'positive', 85)
        }
      }
    } else if (callingTeam === scoringTeam) {
      if (pointsGained >= 2) {
        // March — took all 5 tricks with partner
        const marcher = (caller && !caller.isHuman) ? caller : getAIOnTeam(callingTeam)
        if (marcher) push('march', 'brag_big', marcher, 'positive', 70)
      } else if (caller && !caller.isHuman) {
        if (dealerTeam !== callingTeam) {
          push('stole_deal', 'brag', caller, 'positive', 60)
        } else {
          push('made_call', 'brag', caller, 'positive', 30)
        }
      }
    }

    // Game point tension: a team just reached 9 (game is to 10)
    for (const teamId of [0, 1]) {
      const oldScore = teamId === 0 ? oldScore0 : oldScore1
      const newScore = teamId === 0 ? newScore0 : newScore1
      if (oldScore < GAME_POINT_SCORE && newScore >= GAME_POINT_SCORE && !newState.gameOver) {
        const teamAI = getAIOnTeam(teamId)
        if (teamAI) push('game_point', 'ominous', teamAI, 'positive', 45)
      }
    }
  }

  return events
}

// ---------------------------------------------------------------------------
// Main Export
// ---------------------------------------------------------------------------

/**
 * Create a remark engine instance for one Euchre game.
 * Holds the previous state snapshot and the remark cooldown per instance.
 */
export function createEuchreRemarkEngine() {
  return createGameRemarkEngine<EuchreRemarkState, Player>(detectEvents)
}
