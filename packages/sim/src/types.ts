/** Shared sim types (schemaVersion 1). */

export type GameKind = 'euchre' | 'spades' | 'president'

export type PolicyId =
  | 'hard'
  | 'easy'
  | 'random_legal'
  | 'noisy_hard'
  | 'noisy_easy'
  | string

export type LabelQuality = 'teacher' | 'exploratory' | 'noise'

export interface BuiltinPolicyContext<TState, TAction> {
  state: TState
  seat: number
  legal: TAction[]
  rng: () => number
  tracker?: unknown
}

export interface BuiltinPolicyChooseResult<TAction> {
  action: TAction
  exploratory: boolean
}

export interface BuiltinPolicy<TState, TAction> {
  id: PolicyId
  choose(ctx: BuiltinPolicyContext<TState, TAction>): BuiltinPolicyChooseResult<TAction>
}

export interface Step {
  schemaVersion: 1
  game: GameKind
  gameId: string
  seed: number
  gameIndex: number
  handIndex: number
  stepIndex: number
  seat: number
  phase: string
  observation: Record<string, unknown>
  legalActions: unknown[]
  action: unknown
  policyId: PolicyId
  exploratory: boolean
  labelQuality: LabelQuality
  handDelta?: number[]
  finalScores?: number[]
  finalWinner?: number | null
}

export interface RunHeader {
  schemaVersion: 1
  game: GameKind
  mixId: string
  epsilon: number
  seed: number
  games: number
  rules: Record<string, unknown>
  createdAt: string
  /** full | play_teacher (compact obs, teacher-play lines only) */
  dumpMode?: string
}

export interface GameStats {
  gameIndex: number
  seed: number
  winner: number | null
  finalScores: [number, number]
  hands: number
  steps: number
  aloneHands: number
  pointsPerHand: number
  policyIds: PolicyId[]
  /** Illegal apply / same-ref random-legal retries */
  fallbackCount: number
  /** play_model play-phase decisions that used the model (not hard) */
  modelPlayDecisions?: number
  /** play_model play-phase decisions that fell back to hard (low conf / illegal / error) */
  modelHardFallbacks?: number
}

export interface RunReport {
  games: number
  completed: number
  team0Wins: number
  team1Wins: number
  ties: number
  avgHands: number
  avgSteps: number
  avgAloneRate: number
  avgPointsPerHand: number
  fallbackSteps: number
  byPolicySeat: Record<string, { seats: number; teamWins: number }>
  hardVsEasy?: {
    hardSeatWins: number
    easySeatWins: number
    note: string
  }
  /** Aggregate play_model confidence-floor fallbacks (when any seat used play_model) */
  playModel?: {
    modelPlayDecisions: number
    modelHardFallbacks: number
    /** fraction of play_model card decisions that used hard instead of the model */
    hardFallbackRate: number
  }
}
