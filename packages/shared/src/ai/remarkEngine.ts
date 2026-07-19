/**
 * Generic Bot Remark Engine
 *
 * Shared machinery for all games: holds the previous state snapshot and a
 * per-instance cooldown, rolls event probabilities, and resolves remark text
 * through the bot-profile chain (event override → category pool → sentiment
 * fallback). Games supply only a detectEvents function.
 */

import { getRemarkForEvent } from './bots/index.js'
import type { RemarkCategory, RemarkMode, Sentiment } from './bots/types.js'

export interface RemarkEvent {
  type: string
  category: RemarkCategory
  playerId: number
  playerName: string
  sentiment: Sentiment
  /** Percentage chance this event produces a remark (default 50) */
  probability?: number
}

export interface BotRemark {
  playerId: number
  playerName: string
  text: string
  sentiment: Sentiment
}

export interface GameRemarkEngine<TState, TPlayer> {
  /** Set the baseline snapshot without generating remarks */
  capture(state: TState): void
  /** Diff against the previous snapshot, maybe produce a remark, advance the snapshot */
  process(newState: TState, players: TPlayer[], mode: RemarkMode): BotRemark | null
}

const DEFAULT_COOLDOWN_MS = 3000

export function createGameRemarkEngine<TState, TPlayer>(
  detectEvents: (oldState: TState | null, newState: TState, players: TPlayer[]) => RemarkEvent[],
  cooldownMs: number = DEFAULT_COOLDOWN_MS
): GameRemarkEngine<TState, TPlayer> {
  let previousState: TState | null = null
  let lastRemarkTime = 0

  return {
    capture(state: TState): void {
      previousState = state
    },

    process(newState: TState, players: TPlayer[], mode: RemarkMode): BotRemark | null {
      const events = detectEvents(previousState, newState, players)
      previousState = newState

      if (events.length === 0) return null

      const now = Date.now()
      if (now - lastRemarkTime < cooldownMs) return null

      for (const event of events) {
        const prob = event.probability ?? 50
        if (Math.random() * 100 > prob) continue

        const text = getRemarkForEvent(event.playerName, event.type, event.category, event.sentiment, mode)
        if (!text) continue

        lastRemarkTime = now
        return {
          playerId: event.playerId,
          playerName: event.playerName,
          text,
          sentiment: event.sentiment,
        }
      }

      return null
    },
  }
}
