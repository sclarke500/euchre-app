/**
 * Lightweight pure-game golden replay harness (Phase 5).
 *
 * Feed an initial state + ordered actions through pure transitions and
 * assert terminal expectations. Same-ref rejection is checked when a step
 * is marked illegal.
 *
 * Not a full sim package — foundation for later AI training data pipelines.
 */

export interface GoldenStep<TState, TAction> {
  /** Seat / player id performing the action */
  seat: number
  action: TAction
  /** Human-readable label for failure messages */
  label?: string
  /**
   * When true, apply must return the same reference (illegal).
   * When false/omitted, apply must return a new object (legal).
   */
  expectReject?: boolean
}

export interface GoldenExpect<TState> {
  /** Terminal phase string/enum */
  phase?: unknown
  /** Arbitrary assertions after all steps */
  assert?: (state: TState) => void
}

export interface GoldenFixture<TState, TAction> {
  name: string
  initialState: TState
  steps: GoldenStep<TState, TAction>[]
  /**
   * Pure transition: (state, seat, action) => next
   * Illegal actions must return the same reference.
   */
  apply: (state: TState, seat: number, action: TAction) => TState
  expect?: GoldenExpect<TState>
}

export interface GoldenReplayResult<TState> {
  finalState: TState
  stepCount: number
}

/**
 * Run a golden fixture. Throws with a labeled message on contract violations.
 */
export function runGoldenReplay<TState, TAction>(
  fixture: GoldenFixture<TState, TAction>
): GoldenReplayResult<TState> {
  let state = fixture.initialState

  for (let i = 0; i < fixture.steps.length; i++) {
    const step = fixture.steps[i]!
    const label = step.label ?? `step ${i} seat=${step.seat}`
    const prev = state
    const next = fixture.apply(prev, step.seat, step.action)

    if (step.expectReject) {
      if (next !== prev) {
        throw new Error(
          `[golden:${fixture.name}] ${label}: expected same-ref reject, got new state`
        )
      }
      // stay on prev
      continue
    }

    if (next === prev) {
      throw new Error(
        `[golden:${fixture.name}] ${label}: expected legal transition (new object), got same ref`
      )
    }
    state = next
  }

  if (fixture.expect?.phase !== undefined) {
    const phase = (state as { phase?: unknown }).phase
    if (phase !== fixture.expect.phase) {
      throw new Error(
        `[golden:${fixture.name}] expected phase ${String(fixture.expect.phase)}, got ${String(phase)}`
      )
    }
  }

  fixture.expect?.assert?.(state)

  return { finalState: state, stepCount: fixture.steps.length }
}

/**
 * Vitest-friendly helper: runs the fixture and rethrows with expect semantics.
 * Import `runGoldenReplay` directly if you prefer plain throws.
 */
export function expectGoldenReplay<TState, TAction>(
  fixture: GoldenFixture<TState, TAction>
): TState {
  return runGoldenReplay(fixture).finalState
}
