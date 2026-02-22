// President scoring and rankings

import { PlayerRank, type PresidentGameState, type PresidentPlayer } from './types.js'

/**
 * Get display name for a player rank
 */
export function getRankDisplayName(rank: PlayerRank | null): string {
  switch (rank) {
    case PlayerRank.President:
      return 'President'
    case PlayerRank.VicePresident:
      return 'Vice President'
    case PlayerRank.Citizen:
      return 'Citizen'
    case PlayerRank.ViceScum:
      return 'Vice Scum'
    case PlayerRank.Scum:
      return 'Scum'
    default:
      return 'Unranked'
  }
}

/**
 * Get short display name for a player rank
 */
export function getRankShortName(rank: PlayerRank | null): string {
  switch (rank) {
    case PlayerRank.President:
      return 'P'
    case PlayerRank.VicePresident:
      return 'VP'
    case PlayerRank.Citizen:
      return 'C'
    case PlayerRank.ViceScum:
      return 'VS'
    case PlayerRank.Scum:
      return 'S'
    default:
      return '-'
  }
}

/**
 * Calculate points for a player based on finish order
 * Higher finish = more points
 */
export function calculateRoundPoints(
  finishOrder: number,
  totalPlayers: number
): number {
  // First place gets most points
  return totalPlayers - finishOrder + 1
}

/**
 * Get cumulative scores across all rounds
 * Returns map of playerId -> total points
 */
export function calculateCumulativeScores(
  state: PresidentGameState,
  roundHistory: { finishOrder: number; playerId: number }[][]
): Map<number, number> {
  const scores = new Map<number, number>()

  // Initialize all players with 0
  for (const player of state.players) {
    scores.set(player.id, 0)
  }

  // Add up points from each round
  for (const round of roundHistory) {
    for (const { finishOrder, playerId } of round) {
      const currentScore = scores.get(playerId) ?? 0
      const points = calculateRoundPoints(finishOrder, state.players.length)
      scores.set(playerId, currentScore + points)
    }
  }

  return scores
}

/**
 * Get ranked players (sorted by current finish order)
 */
export function getRankedPlayers(state: PresidentGameState): PresidentPlayer[] {
  return [...state.players]
    .filter(p => p.finishOrder !== null)
    .sort((a, b) => (a.finishOrder ?? 999) - (b.finishOrder ?? 999))
}

/**
 * Get the overall winner based on cumulative scores
 */
export function getOverallWinner(
  scores: Map<number, number>,
  players: PresidentPlayer[]
): PresidentPlayer | null {
  let maxScore = -1
  let winner: PresidentPlayer | null = null

  for (const player of players) {
    const score = scores.get(player.id) ?? 0
    if (score > maxScore) {
      maxScore = score
      winner = player
    }
  }

  return winner
}

/**
 * Format rankings for display
 */
export function formatRankings(state: PresidentGameState): string[] {
  const ranked = getRankedPlayers(state)

  return ranked.map((player, index) => {
    const position = index + 1
    const rankName = getRankDisplayName(player.rank)
    return `${position}. ${player.name} - ${rankName}`
  })
}
