#!/usr/bin/env node
/**
 * Sim CLI
 *
 *   npm run sim -- euchre --games 100 --mix default --seed 42 --out data/euchre.jsonl --report
 *   npm run sim -- euchre --policies hard,easy,hard,easy --mirror --pairs 1000 --report
 *   npm run sim -- euchre --policies play_model,easy,play_model,easy --play-model … --python …
 */
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runEuchreSim } from './runners/euchre.js'
import { buildReport, formatReport } from './report/summary.js'
import { buildMirrorReport, formatMirrorReport } from './report/mirror.js'
import { PlayModelBridge } from './policies/playModel.js'
import type { PolicyId } from './types.js'

const REPO_TRAINING = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../../training')

function usage(): never {
  console.log(`Usage:
  sim euchre [options]

Options:
  --games N            Number of games (default 100). With --mirror, number of pairs.
  --pairs N            Alias for --games when using --mirror
  --seed N             Master seed (default 42)
  --mix default        Sample seat policies from default mix
  --policies a,b,c,d   Fixed seat policies (overrides --mix; required for --mirror)
  --mirror             Mirrored-deal eval: each pair = same seed, policies rotated +1
  --epsilon E          ε for noisy_* (default 0.1)
  --out PATH           JSONL output (optional)
  --report             Print summary (includes mirror report when --mirror)
  --stick-dealer       Enable stick-the-dealer
  --canadian-loner     Enable Canadian loner
  --play-model PATH    joblib model for play_model seats (hybrid hard-bid)
  --python PATH        Python binary (default: python3)
  --training-cwd PATH  Dir with euchre_play package (default: repo training/)
  --dump-mode MODE     full | play_teacher (default full)
  -h, --help           Show help

Policies: hard | easy | random_legal | noisy_hard | noisy_easy | play_model

Metrics:
  Inner loop (fast):  python -m euchre_play.action_match --model … --val …
  Milestone (mirror): sim … --mirror --pairs 1000 --policies hard,easy,hard,easy --report
  Avoid HGB for eval (too slow over subprocess); iterate with MLP only.
`)
  process.exit(1)
}

function parseArgs(argv: string[]) {
  const args = argv.slice(2)
  if (args.length === 0 || args[0] === '-h' || args[0] === '--help') usage()
  const game = args[0]
  if (game !== 'euchre') {
    console.error(`Unknown game: ${game}. Only "euchre" is supported in S1.`)
    process.exit(1)
  }

  let games = 100
  let seed = 42
  let epsilon = 0.1
  let out: string | null = null
  let report = false
  let policies: [PolicyId, PolicyId, PolicyId, PolicyId] | undefined
  let stickTheDealer = false
  let canadianLoner = false
  let useMix = true
  let playModel: string | null = null
  let python = 'python3'
  let trainingCwd = REPO_TRAINING
  let dumpMode: 'full' | 'play_teacher' = 'full'
  let mirror = false

  for (let i = 1; i < args.length; i++) {
    const a = args[i]!
    const next = () => {
      const v = args[++i]
      if (v === undefined) {
        console.error(`Missing value for ${a}`)
        process.exit(1)
      }
      return v
    }
    switch (a) {
      case '--games':
      case '--pairs':
        games = parseInt(next(), 10)
        break
      case '--seed':
        seed = parseInt(next(), 10)
        break
      case '--epsilon':
        epsilon = parseFloat(next())
        break
      case '--out':
        out = resolve(next())
        break
      case '--report':
        report = true
        break
      case '--mirror':
        mirror = true
        break
      case '--mix':
        useMix = true
        next()
        break
      case '--policies': {
        const parts = next().split(',').map(s => s.trim())
        if (parts.length !== 4) {
          console.error('--policies requires exactly 4 comma-separated ids')
          process.exit(1)
        }
        policies = parts as [PolicyId, PolicyId, PolicyId, PolicyId]
        useMix = false
        break
      }
      case '--stick-dealer':
        stickTheDealer = true
        break
      case '--canadian-loner':
        canadianLoner = true
        break
      case '--play-model':
        playModel = resolve(next())
        break
      case '--python':
        python = next()
        break
      case '--training-cwd':
        trainingCwd = resolve(next())
        break
      case '--dump-mode': {
        const m = next()
        if (m !== 'full' && m !== 'play_teacher') {
          console.error('--dump-mode must be full or play_teacher')
          process.exit(1)
        }
        dumpMode = m
        break
      }
      case '-h':
      case '--help':
        usage()
        break
      default:
        console.error(`Unknown flag: ${a}`)
        usage()
    }
  }

  if (mirror && useMix) {
    console.error('--mirror requires --policies (fixed seats), not --mix')
    process.exit(1)
  }

  return {
    games,
    seed,
    epsilon,
    out,
    report,
    policies: useMix ? undefined : policies,
    rules: { stickTheDealer, canadianLoner },
    playModel,
    python,
    trainingCwd,
    dumpMode,
    mirror,
  }
}

async function main() {
  const opts = parseArgs(process.argv)
  if (opts.out) {
    mkdirSync(dirname(opts.out), { recursive: true })
  }

  let bridge: PlayModelBridge | undefined
  const needsModel = opts.policies?.includes('play_model') || false
  if (needsModel) {
    if (!opts.playModel) {
      console.error('play_model seats require --play-model PATH')
      process.exit(1)
    }
    bridge = new PlayModelBridge({
      python: opts.python,
      modelPath: opts.playModel,
      cwd: opts.trainingCwd,
    })
  }

  const t0 = Date.now()
  let done = 0
  const unit = opts.mirror ? 'pairs' : 'games'
  const { stats, stepsWritten, mirrorPairs } = await runEuchreSim({
    games: opts.games,
    seed: opts.seed,
    epsilon: opts.epsilon,
    policies: opts.policies,
    rules: opts.rules,
    outPath: opts.out,
    playModelBridge: bridge,
    dumpMode: opts.dumpMode,
    mirror: opts.mirror,
    onGame: () => {
      done++
      if (opts.games >= 50 && done % Math.max(1, Math.floor(opts.games / 10)) === 0) {
        process.stderr.write(`  … ${done}/${opts.games} ${unit}\n`)
      }
    },
  })

  const ms = Date.now() - t0
  const gamesPlayed = opts.mirror ? opts.games * 2 : opts.games
  process.stderr.write(
    `Finished ${opts.games} ${unit} (${gamesPlayed} games) in ${(ms / 1000).toFixed(2)}s` +
      ` (${stepsWritten} steps)` +
      (opts.out ? ` → ${opts.out}` : '') +
      '\n'
  )

  if (opts.report) {
    if (mirrorPairs) {
      console.log(formatMirrorReport(buildMirrorReport(mirrorPairs)))
      console.log('')
    }
    console.log(formatReport(buildReport(stats)))
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
