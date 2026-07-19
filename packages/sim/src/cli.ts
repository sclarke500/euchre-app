#!/usr/bin/env node
/**
 * Sim CLI
 *
 *   npm run sim -- euchre --games 100 --mix default --seed 42 --out data/euchre.jsonl --report
 *   npm run sim -- euchre --policies hard,easy,hard,easy --report
 */
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { runEuchreSim } from './runners/euchre.js'
import { buildReport, formatReport } from './report/summary.js'
import type { PolicyId } from './types.js'

function usage(): never {
  console.log(`Usage:
  sim euchre [options]

Options:
  --games N            Number of games (default 100)
  --seed N             Master seed (default 42)
  --mix default        Sample seat policies from default mix
  --policies a,b,c,d   Fixed seat policies (overrides --mix)
  --epsilon E          ε for noisy_* (default 0.1)
  --out PATH           JSONL output (optional)
  --report             Print summary
  --stick-dealer       Enable stick-the-dealer
  --canadian-loner     Enable Canadian loner
  -h, --help           Show help

Policies: hard | easy | random_legal | noisy_hard | noisy_easy
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
      case '--mix':
        useMix = true
        next() // consume name (only "default" for now)
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
      case '-h':
      case '--help':
        usage()
        break
      default:
        console.error(`Unknown flag: ${a}`)
        usage()
    }
  }

  return {
    games,
    seed,
    epsilon,
    out,
    report,
    policies: useMix ? undefined : policies,
    rules: { stickTheDealer, canadianLoner },
  }
}

async function main() {
  const opts = parseArgs(process.argv)
  if (opts.out) {
    mkdirSync(dirname(opts.out), { recursive: true })
  }

  const t0 = Date.now()
  let done = 0
  const { stats, stepsWritten } = await runEuchreSim({
    games: opts.games,
    seed: opts.seed,
    epsilon: opts.epsilon,
    policies: opts.policies,
    rules: opts.rules,
    outPath: opts.out,
    onGame: () => {
      done++
      if (opts.games >= 100 && done % Math.max(1, Math.floor(opts.games / 10)) === 0) {
        process.stderr.write(`  … ${done}/${opts.games} games\n`)
      }
    },
  })

  const ms = Date.now() - t0
  process.stderr.write(
    `Finished ${opts.games} games in ${(ms / 1000).toFixed(2)}s (${stepsWritten} steps)` +
      (opts.out ? ` → ${opts.out}` : '') +
      '\n'
  )

  if (opts.report) {
    console.log(formatReport(buildReport(stats)))
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
