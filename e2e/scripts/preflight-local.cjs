const http = require('node:http')
const https = require('node:https')

const CLIENT_URL = process.env.BASE_URL || 'http://localhost:4200'
const SERVER_HEALTH_URL = process.env.SERVER_HEALTH_URL || 'http://localhost:3001/health'
const TIMEOUT_MS = Number(process.env.PREFLIGHT_TIMEOUT_MS || 3000)

function formatError(error) {
  if (!error) return 'Unknown error'
  if (typeof error === 'string') return error
  if (typeof AggregateError !== 'undefined' && error instanceof AggregateError) {
    const nested = Array.from(error.errors || [])
      .map((e) => {
        if (e instanceof Error && e.message) return e.message
        return String(e)
      })
      .filter(Boolean)
    return nested.length > 0 ? `AggregateError: ${nested.join(' | ')}` : 'AggregateError'
  }
  if (error instanceof Error) {
    if (error.message && error.message.trim().length > 0) return error.message
    return error.name || 'Error'
  }
  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}

function requestUrl(url) {
  return new Promise((resolve, reject) => {
    let parsed
    try {
      parsed = new URL(url)
    } catch {
      reject(new Error(`Invalid URL: ${url}`))
      return
    }

    const lib = parsed.protocol === 'https:' ? https : http
    const req = lib.request(
      {
        method: 'GET',
        hostname: parsed.hostname,
        port: parsed.port,
        path: `${parsed.pathname}${parsed.search}`,
        timeout: TIMEOUT_MS,
      },
      (res) => {
        res.resume()
        resolve({
          statusCode: res.statusCode || 0,
        })
      }
    )

    req.on('timeout', () => {
      req.destroy(new Error(`Timeout after ${TIMEOUT_MS}ms`))
    })

    req.on('error', reject)
    req.end()
  })
}

async function checkClient() {
  const result = await requestUrl(CLIENT_URL)
  if (result.statusCode >= 500 || result.statusCode === 0) {
    throw new Error(`Client responded with status ${result.statusCode}`)
  }
}

async function checkServerHealth() {
  const result = await requestUrl(SERVER_HEALTH_URL)
  if (result.statusCode !== 200) {
    throw new Error(`Server health endpoint responded with status ${result.statusCode}`)
  }
}

async function run() {
  const checks = [
    {
      name: `client (${CLIENT_URL})`,
      fn: checkClient,
      fix: 'Start frontend: `cd /Users/steve/code/euchre-app && npm run dev`',
    },
    {
      name: `server (${SERVER_HEALTH_URL})`,
      fn: checkServerHealth,
      fix: 'Start backend: `cd /Users/steve/code/euchre-app && npm run start:server`',
    },
  ]

  const failures = []

  for (const check of checks) {
    try {
      await check.fn()
      console.log(`✓ Preflight OK: ${check.name}`)
    } catch (error) {
      failures.push({
        name: check.name,
        error: formatError(error),
        fix: check.fix,
      })
      console.error(`✗ Preflight FAILED: ${check.name}`)
    }
  }

  if (failures.length > 0) {
    console.error('\nE2E local preflight failed. Tests were not started to avoid long hangs.')
    for (const f of failures) {
      console.error(`- ${f.name}: ${f.error}`)
      console.error(`  ${f.fix}`)
    }
    console.error('\nIf your frontend uses a different port, run with:')
    console.error('  BASE_URL=http://localhost:<port> npm run test:phase0')
    process.exit(1)
  }

  console.log('All preflight checks passed. Running Playwright...')
}

run().catch((error) => {
  console.error('Preflight script crashed:', error)
  process.exit(1)
})
