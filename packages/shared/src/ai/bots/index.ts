/**
 * Bot Profiles Index
 * 
 * Central registry of all bots with their personalities.
 * Games just call getRemark(botName, sentiment, mode).
 */

export * from './types.js'

import type { BotProfile, RemarkMode, Sentiment } from './types.js'
import { tron } from './tron.js'
import { data } from './data.js'
import { neon } from './neon.js'
import { halo } from './halo.js'
import { pixel } from './pixel.js'
import { atlas } from './atlas.js'

// All bot profiles indexed by name
export const bots: Record<string, BotProfile> = {
  Tron: tron,
  Data: data,
  Neon: neon,
  Halo: halo,
  Pixel: pixel,
  Atlas: atlas,
}

// Export individual bots for direct access
export { tron, data, neon, halo, pixel, atlas }

// List of bot names (for random selection)
export const botNames = Object.keys(bots)

/**
 * Get a random remark from a bot
 * @param botName - Name of the bot (e.g., 'Tron')
 * @param sentiment - 'positive' or 'negative'
 * @param mode - 'mild' or 'spicy'
 * @returns A random remark string, or undefined if bot not found
 */
export function getRemark(
  botName: string,
  sentiment: Sentiment,
  mode: RemarkMode
): string | undefined {
  const bot = bots[botName]
  if (!bot) return undefined
  
  const pool = bot.remarks[sentiment][mode]
  if (!pool || pool.length === 0) return undefined
  
  return pool[Math.floor(Math.random() * pool.length)]
}

/**
 * Get a bot's avatar filename
 */
export function getBotAvatar(botName: string): string | undefined {
  return bots[botName]?.avatar
}

/**
 * Check if a name is a known bot
 */
export function isBot(name: string): boolean {
  return name in bots
}
