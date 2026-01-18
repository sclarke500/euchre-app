import type { Trick, Trump } from '@/models/types'
import { countTricksWonByTeam } from './trick'

/**
 * Euchre scoring rules:
 * - Win 3-4 tricks (not alone): 1 point
 * - Win all 5 tricks (not alone): 2 points (march)
 * - Win 3-4 tricks alone: 1 point
 * - Win all 5 tricks alone: 4 points
 * - Defending team wins 3+ tricks: 2 points (euchre)
 * - First team to 10 points wins
 */

export interface RoundScore {
  team0Points: number
  team1Points: number
  wasEuchre: boolean
  wasMarch: boolean
  wasLoneHand: boolean
}

/**
 * Calculate points awarded for a completed round
 */
export function calculateRoundScore(tricks: Trick[], trump: Trump | null): RoundScore {
  if (!trump) {
    throw new Error('Cannot calculate score without trump')
  }

  const [team0Tricks, team1Tricks] = countTricksWonByTeam(tricks)

  // Determine which team called trump
  const callingTeam = trump.calledBy % 2 // 0 or 1
  const defendingTeam = callingTeam === 0 ? 1 : 0

  const callingTeamTricks = callingTeam === 0 ? team0Tricks : team1Tricks
  const defendingTeamTricks = callingTeam === 0 ? team1Tricks : team0Tricks

  let team0Points = 0
  let team1Points = 0
  let wasEuchre = false
  let wasMarch = false
  let wasLoneHand = trump.goingAlone

  // Check if calling team was euchred (defending team won 3+ tricks)
  if (defendingTeamTricks >= 3) {
    // Euchre! Defending team gets 2 points
    wasEuchre = true
    if (defendingTeam === 0) {
      team0Points = 2
    } else {
      team1Points = 2
    }
  }
  // Calling team won
  else if (callingTeamTricks >= 3) {
    // Check for march (all 5 tricks)
    const isMarch = callingTeamTricks === 5
    wasMarch = isMarch

    let points = 0
    if (trump.goingAlone) {
      // Alone hand: 4 points for march, 1 for 3-4 tricks
      points = isMarch ? 4 : 1
    } else {
      // Regular hand: 2 points for march, 1 for 3-4 tricks
      points = isMarch ? 2 : 1
    }

    if (callingTeam === 0) {
      team0Points = points
    } else {
      team1Points = points
    }
  }

  return {
    team0Points,
    team1Points,
    wasEuchre,
    wasMarch,
    wasLoneHand,
  }
}

/**
 * Update total game scores
 */
export function updateScores(
  currentScores: [number, number],
  roundScore: RoundScore
): [number, number] {
  return [
    currentScores[0] + roundScore.team0Points,
    currentScores[1] + roundScore.team1Points,
  ]
}

/**
 * Check if game is over (first team to 10 points)
 */
export function isGameOver(scores: [number, number]): boolean {
  return scores[0] >= 10 || scores[1] >= 10
}

/**
 * Get the winning team (null if game not over)
 */
export function getWinner(scores: [number, number]): number | null {
  if (scores[0] >= 10) return 0
  if (scores[1] >= 10) return 1
  return null
}

/**
 * Get a human-readable description of how points were scored
 */
export function getScoreDescription(roundScore: RoundScore, callingTeam: number): string {
  if (roundScore.wasEuchre) {
    return `Team ${callingTeam === 0 ? 1 : 0} euchred Team ${callingTeam}! +2 points`
  }

  if (roundScore.wasLoneHand && roundScore.wasMarch) {
    return `Team ${callingTeam} marched alone! +4 points`
  }

  if (roundScore.wasMarch) {
    return `Team ${callingTeam} marched! +2 points`
  }

  const teamPoints = callingTeam === 0 ? roundScore.team0Points : roundScore.team1Points
  if (teamPoints === 1) {
    return `Team ${callingTeam} won! +1 point`
  }

  return `+${teamPoints} points`
}

/**
 * Format score for display
 */
export function formatScore(team0Score: number, team1Score: number): string {
  return `${team0Score} - ${team1Score}`
}
