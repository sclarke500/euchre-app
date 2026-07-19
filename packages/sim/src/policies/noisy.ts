import type { BuiltinPolicy, BuiltinPolicyContext } from '../types.js'
import { uniformPick } from '../rng.js'

/** ε-greedy wrapper: with probability ε pick uniform legal (exploratory). */
export function noisyPolicy<TState, TAction>(
  inner: BuiltinPolicy<TState, TAction>,
  epsilon: number,
  id?: string
): BuiltinPolicy<TState, TAction> {
  return {
    id: id ?? `noisy_${inner.id}`,
    choose(ctx: BuiltinPolicyContext<TState, TAction>) {
      if (ctx.legal.length === 0) {
        throw new Error(`noisy(${inner.id}): no legal actions`)
      }
      if (ctx.rng() < epsilon) {
        return { action: uniformPick(ctx.legal, ctx.rng), exploratory: true }
      }
      const r = inner.choose(ctx)
      return { action: r.action, exploratory: false }
    },
  }
}
