import { createWriteStream, type WriteStream } from 'node:fs'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import type { RunHeader, Step } from '../types.js'

export class JsonlWriter {
  private stream: WriteStream | null = null
  private closed = false

  constructor(private readonly path: string | null) {
    if (path) {
      mkdirSync(dirname(path), { recursive: true })
      this.stream = createWriteStream(path, { flags: 'w' })
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
    this.stream.write(JSON.stringify(obj) + '\n')
  }

  async close(): Promise<void> {
    if (!this.stream || this.closed) return
    this.closed = true
    await new Promise<void>((resolve, reject) => {
      this.stream!.end((err: Error | null | undefined) => {
        if (err) reject(err)
        else resolve()
      })
    })
  }
}
