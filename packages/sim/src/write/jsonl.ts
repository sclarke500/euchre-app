import { createWriteStream, type WriteStream } from 'node:fs'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import type { RunHeader, Step } from '../types.js'

/**
 * Streaming JSONL writer with backpressure.
 * (Buffered WriteStream without drain OOMs on multi-GB dumps.)
 */
export class JsonlWriter {
  private stream: WriteStream | null = null
  private closed = false
  private chain: Promise<void> = Promise.resolve()

  constructor(private readonly path: string | null) {
    if (path) {
      mkdirSync(dirname(path), { recursive: true })
      this.stream = createWriteStream(path, { flags: 'w', highWaterMark: 1024 * 1024 })
      this.stream.setMaxListeners(50)
    }
  }

  writeHeader(header: RunHeader): void {
    this.writeLine({ ...header, recordType: 'header' })
  }

  writeStep(step: Step): void {
    this.writeLine(step)
  }

  writeSteps(steps: Step[]): void {
    for (const s of steps) this.writeStep(s)
  }

  private writeLine(obj: unknown): void {
    if (!this.stream || this.closed) return
    const line = JSON.stringify(obj) + '\n'
    const stream = this.stream
    this.chain = this.chain.then(() => writeWithBackpressure(stream, line))
  }

  async close(): Promise<void> {
    if (!this.stream || this.closed) return
    this.closed = true
    await this.chain
    const stream = this.stream
    await new Promise<void>((resolve, reject) => {
      stream.end((err: Error | null | undefined) => {
        if (err) reject(err)
        else resolve()
      })
    })
  }
}

function writeWithBackpressure(stream: WriteStream, line: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ok = stream.write(line, err => {
      if (err) reject(err)
    })
    if (ok) {
      resolve()
    } else {
      stream.once('drain', () => resolve())
    }
  })
}
