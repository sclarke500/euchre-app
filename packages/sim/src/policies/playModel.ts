/**
 * S1.5 throwaway bridge: learned play over a Python subprocess.
 * Hybrid behavior: hard for bid/discard, model for play.
 * Low-confidence model predictions fall back to hard (not random).
 */
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { createInterface, type Interface } from 'node:readline'
import type { EuchreAction, EuchreGameState } from '@67cards/shared'
import { euchreActionKey, GamePhase } from '@67cards/shared'
import { encodeEuchreObservation } from '../encode/euchre.js'
import type { BuiltinPolicyContext } from '../types.js'
import { hardPolicy } from './euchre.js'

export interface PlayModelBridgeOptions {
  python: string
  modelPath: string
  /** Directory containing euchre_play package (training/) */
  cwd: string
  /** Below this max-legal proba, use hard AI instead of model (default 0.35). */
  confidenceFloor?: number
}

interface ServerMsg {
  type: string
  action?: EuchreAction
  confidence?: number
  message?: string
}

export class PlayModelBridge {
  private child: ChildProcessWithoutNullStreams | null = null
  private rl: Interface | null = null
  private queue: Array<{
    resolve: (v: ServerMsg) => void
    reject: (e: Error) => void
  }> = []
  private ready = false
  readonly confidenceFloor: number

  constructor(private readonly opts: PlayModelBridgeOptions) {
    // Higher floor: model is often overconfident on mistakes; prefer hard when unsure.
    this.confidenceFloor = opts.confidenceFloor ?? 0.75
  }

  async start(): Promise<void> {
    if (this.child) return
    this.child = spawn(
      this.opts.python,
      ['-m', 'euchre_play.serve', '--model', this.opts.modelPath],
      {
        cwd: this.opts.cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env },
      }
    )

    this.rl = createInterface({ input: this.child.stdout })
    this.rl.on('line', line => {
      let msg: ServerMsg
      try {
        msg = JSON.parse(line) as ServerMsg
      } catch {
        return
      }
      const waiter = this.queue.shift()
      if (waiter) waiter.resolve(msg)
    })

    this.child.stderr.on('data', (buf: Buffer) => {
      for (const line of buf.toString().split('\n')) {
        if (!line.trim()) continue
        try {
          const j = JSON.parse(line) as { type?: string }
          if (j.type === 'ready') this.ready = true
        } catch {
          /* ignore */
        }
      }
    })

    this.child.on('exit', code => {
      const err = new Error(`play model process exited (${code})`)
      while (this.queue.length) this.queue.shift()!.reject(err)
      this.child = null
      this.ready = false
    })

    const deadline = Date.now() + 60_000
    while (!this.ready && Date.now() < deadline) {
      await sleep(50)
      if (!this.child) throw new Error('play model failed to start')
    }
    if (!this.ready) {
      await this.request({ type: 'ping' })
      this.ready = true
    }
  }

  private request(payload: unknown): Promise<ServerMsg> {
    if (!this.child?.stdin) return Promise.reject(new Error('play model not started'))
    return new Promise((resolve, reject) => {
      this.queue.push({ resolve, reject })
      this.child!.stdin.write(JSON.stringify(payload) + '\n', err => {
        if (err) {
          this.queue.pop()
          reject(err)
        }
      })
    })
  }

  async predict(
    observation: Record<string, unknown>,
    legal: EuchreAction[]
  ): Promise<{ action: EuchreAction; confidence: number }> {
    const res = await this.request({ type: 'predict', observation, legal })
    if (res.type === 'error') throw new Error(res.message ?? 'play model error')
    if (res.type !== 'action' || !res.action) {
      throw new Error(`unexpected response: ${JSON.stringify(res)}`)
    }
    return { action: res.action, confidence: res.confidence ?? 1 }
  }

  async stop(): Promise<void> {
    if (!this.child) return
    try {
      await this.request({ type: 'shutdown' })
    } catch {
      /* ignore */
    }
    try {
      this.child.kill('SIGTERM')
    } catch {
      /* ignore */
    }
    this.child = null
    this.rl?.close()
    this.rl = null
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

/** Hybrid: hard bids/discard, model plays cards; low confidence → hard. */
export async function choosePlayModel(
  bridge: PlayModelBridge,
  ctx: BuiltinPolicyContext<EuchreGameState, EuchreAction>
): Promise<{ action: EuchreAction; exploratory: boolean }> {
  if (ctx.state.phase !== GamePhase.Playing) {
    return hardPolicy.choose(ctx)
  }
  if (ctx.legal.length === 0) throw new Error('play_model: no legal actions')

  const observation = encodeEuchreObservation(ctx.state, ctx.seat, ctx.legal, 'compact')
  try {
    const { action, confidence } = await bridge.predict(observation, ctx.legal)
    const legalOk = ctx.legal.some(a => euchreActionKey(a) === euchreActionKey(action))
    if (!legalOk || confidence < bridge.confidenceFloor) {
      // Prefer hard over random when model is unsure or illegal
      return hardPolicy.choose(ctx)
    }
    return { action, exploratory: false }
  } catch {
    return hardPolicy.choose(ctx)
  }
}
