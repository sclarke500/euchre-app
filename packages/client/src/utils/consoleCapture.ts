/**
 * Console log capture utility.
 * Intercepts console.log/warn/error and stores history for bug reports.
 */

export interface CapturedLog {
  level: 'log' | 'warn' | 'error'
  timestamp: number
  args: unknown[]
}

const MAX_LOGS = 100
const capturedLogs: CapturedLog[] = []

let isInstalled = false

// Store original methods
const originalLog = console.log
const originalWarn = console.warn
const originalError = console.error

function captureArgs(level: CapturedLog['level'], args: unknown[]): void {
  // Serialize args safely (avoid circular references)
  const safeArgs = args.map(arg => {
    if (arg === null || arg === undefined) return arg
    if (typeof arg === 'string' || typeof arg === 'number' || typeof arg === 'boolean') return arg
    try {
      // Try to stringify objects
      return JSON.parse(JSON.stringify(arg))
    } catch {
      // Fallback for circular refs or non-serializable
      return String(arg)
    }
  })

  capturedLogs.push({
    level,
    timestamp: Date.now(),
    args: safeArgs,
  })

  // Keep only last N logs
  if (capturedLogs.length > MAX_LOGS) {
    capturedLogs.shift()
  }
}

/**
 * Install console interceptors. Call once at app startup.
 */
export function installConsoleCapture(): void {
  if (isInstalled) return
  isInstalled = true

  console.log = (...args: unknown[]) => {
    captureArgs('log', args)
    originalLog.apply(console, args)
  }

  console.warn = (...args: unknown[]) => {
    captureArgs('warn', args)
    originalWarn.apply(console, args)
  }

  console.error = (...args: unknown[]) => {
    captureArgs('error', args)
    originalError.apply(console, args)
  }
}

/**
 * Get recent logs for bug reports.
 * @param count Number of recent logs to return (default 50)
 */
export function getRecentLogs(count = 50): CapturedLog[] {
  return capturedLogs.slice(-count)
}

/**
 * Get logs formatted as string for easy reading.
 */
export function getRecentLogsFormatted(count = 50): string {
  return getRecentLogs(count)
    .map(log => {
      const time = new Date(log.timestamp).toISOString().substring(11, 23)
      const level = log.level.toUpperCase().padEnd(5)
      const msg = log.args.map(a => 
        typeof a === 'object' ? JSON.stringify(a) : String(a)
      ).join(' ')
      return `[${time}] ${level} ${msg}`
    })
    .join('\n')
}

/**
 * Clear captured logs.
 */
export function clearCapturedLogs(): void {
  capturedLogs.length = 0
}
