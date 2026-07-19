import type {
  SpadesClientGameState,
  SpadesClientPlayer,
  SpadesGameState,
  SpadesPhase,
  SpadesPlayer,
  SpadesTeamScore,
  SpadesTrick,
} from '@67cards/shared'
import type { SpadesGamePlayer } from './types.js'

export function toSpadesPlayer(player: SpadesGamePlayer): SpadesPlayer {
  return {
    id: player.seatIndex,
    name: player.name,
    hand: player.hand,
    isHuman: player.isHuman,
    teamId: player.teamId,
    bid: player.bid,
    tricksWon: player.tricksWon,
  }
}

interface BuildSpadesGameStateParams {
  players: SpadesGamePlayer[]
  phase: SpadesPhase
  currentTrick: SpadesTrick
  completedTricks: SpadesTrick[]
  currentPlayer: number
  dealer: number
  scores: SpadesTeamScore[]
  roundNumber: number
  gameOver: boolean
  winner: number | null
  spadesBroken: boolean
  bidsComplete: boolean
  winScore: number
  loseScore: number
  blindNilEnabled?: boolean
  handRevealed?: boolean[]
}

export function buildSpadesGameState({
  players,
  phase,
  currentTrick,
  completedTricks,
  currentPlayer,
  dealer,
  scores,
  roundNumber,
  gameOver,
  winner,
  spadesBroken,
  bidsComplete,
  winScore,
  loseScore,
  blindNilEnabled = false,
  handRevealed = [true, true, true, true],
}: BuildSpadesGameStateParams): SpadesGameState {
  return {
    gameType: 'spades',
    players: players.map((p) => toSpadesPlayer(p)),
    phase,
    currentTrick,
    completedTricks,
    currentPlayer,
    dealer,
    scores,
    roundNumber,
    gameOver,
    winner,
    spadesBroken,
    bidsComplete,
    winScore,
    loseScore,
    blindNilEnabled,
    handRevealed,
  }
}

interface BuildSpadesClientStateParams {
  forPlayerId: string | null
  players: SpadesGamePlayer[]
  phase: SpadesPhase
  currentTrick: SpadesTrick
  completedTricks: SpadesTrick[]
  currentPlayer: number
  dealer: number
  scores: SpadesTeamScore[]
  roundNumber: number
  gameOver: boolean
  winner: number | null
  spadesBroken: boolean
  bidsComplete: boolean
  winScore: number
  loseScore: number
  stateSeq: number
  timedOutPlayer: number | null
  blindNilEnabled?: boolean
  handRevealed?: boolean[]
}

export function buildSpadesClientState({
  forPlayerId,
  players,
  phase,
  currentTrick,
  completedTricks,
  currentPlayer,
  dealer,
  scores,
  roundNumber,
  gameOver,
  winner,
  spadesBroken,
  bidsComplete,
  winScore,
  loseScore,
  stateSeq,
  timedOutPlayer,
  blindNilEnabled = false,
  handRevealed = [true, true, true, true],
}: BuildSpadesClientStateParams): SpadesClientGameState {
  const viewer = forPlayerId
    ? players.find((p) => p.odusId === forPlayerId)
    : null
  const viewerSeat = viewer?.seatIndex
  const viewerMaySeeHand =
    viewerSeat === undefined
      ? true
      : (handRevealed[viewerSeat] ?? true)

  const clientPlayers: SpadesClientPlayer[] = players.map((p) => {
    const clientPlayer: SpadesClientPlayer = {
      id: p.seatIndex,
      name: p.name,
      avatar: p.avatar,
      teamId: p.teamId,
      bid: p.bid,
      tricksWon: p.tricksWon,
      handSize: p.hand.length,
      isHuman: p.isHuman,
      disconnected: p.disconnected,
    }

    // Hide own hand until pure handRevealed (enforces blind-nil pre-look over the wire)
    if (forPlayerId && p.odusId === forPlayerId && viewerMaySeeHand) {
      clientPlayer.hand = p.hand
    }

    return clientPlayer
  })

  return {
    gameType: 'spades',
    players: clientPlayers,
    phase,
    currentTrick,
    completedTricks,
    currentPlayer,
    dealer,
    scores,
    roundNumber,
    gameOver,
    winner,
    spadesBroken,
    bidsComplete,
    winScore,
    loseScore,
    stateSeq,
    timedOutPlayer,
    blindNilEnabled,
    handRevealed: viewerSeat !== undefined ? (handRevealed[viewerSeat] ?? true) : true,
  }
}
