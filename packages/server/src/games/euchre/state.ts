import type { ClientGameState, ClientPlayer, Round, TeamScore } from '@67cards/shared'
import type { GamePlayer } from './types.js'

interface BuildEuchreClientStateParams {
  odusId: string | null
  players: GamePlayer[]
  currentRound: Round | null
  phase: ClientGameState['phase']
  scores: TeamScore[]
  currentDealer: number
  gameOver: boolean
  winner: number | null
  stateSeq: number
  timedOutPlayer: number | null
}

export function buildEuchreClientState({
  odusId,
  players,
  currentRound,
  phase,
  scores,
  currentDealer,
  gameOver,
  winner,
  stateSeq,
  timedOutPlayer,
}: BuildEuchreClientStateParams): ClientGameState {
  const playerIndex = odusId ? players.findIndex((p) => p.odusId === odusId) : -1

  const clientPlayers: ClientPlayer[] = players.map((p, index) => ({
    id: index,
    name: p.name,
    handSize: p.hand.length,
    hand: index === playerIndex ? p.hand : undefined,
    isHuman: p.isHuman,
    teamId: p.teamId,
  }))

  let team0Tricks = 0
  let team1Tricks = 0
  const tricksWonByPlayer: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 }

  if (currentRound) {
    for (const trick of currentRound.tricks) {
      if (trick.winnerId !== null) {
        if (trick.winnerId % 2 === 0) team0Tricks++
        else team1Tricks++
        tricksWonByPlayer[trick.winnerId] = (tricksWonByPlayer[trick.winnerId] ?? 0) + 1
      }
    }
  }

  return {
    phase,
    players: clientPlayers,
    currentPlayer: currentRound?.currentPlayer ?? 0,
    scores,
    currentTrick: currentRound?.currentTrick ?? null,
    completedTricks: currentRound?.tricks.length ?? 0,
    trump: currentRound?.trump?.suit ?? null,
    trumpCalledBy: currentRound?.trump?.calledBy ?? null,
    goingAlone: currentRound?.goingAlone ?? false,
    turnUpCard: currentRound?.turnUpCard ?? null,
    biddingRound: currentRound?.biddingRound ?? null,
    dealer: currentDealer,
    gameOver,
    winner,
    tricksTaken: [team0Tricks, team1Tricks] as [number, number],
    tricksWonByPlayer,
    stateSeq,
    timedOutPlayer,
  }
}
