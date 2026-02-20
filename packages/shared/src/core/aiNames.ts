/**
 * List of AI player names
 */
export const AI_NAMES = ['Tron', 'Data', 'Neon', 'Halo', 'Pixel', 'Atlas'] as const

export type AIName = typeof AI_NAMES[number]

/**
 * AI avatar mapping: name -> avatar filename
 * Avatar images should be in /assets/avatars/ai/
 */
export const AI_AVATARS: Record<AIName, string> = {
  Tron: 'tron.png',
  Data: 'data.png',
  Neon: 'neon.png',
  Halo: 'halo.png',
  Pixel: 'pixel.png',
  Atlas: 'atlas.png',
}

/**
 * Get avatar filename for an AI name
 * @returns filename or undefined if not an AI name
 */
export function getAIAvatar(name: string): string | undefined {
  return AI_AVATARS[name as AIName]
}

/**
 * Get a random AI name from the list
 * @param usedNames - Optional set of names already in use to avoid duplicates
 * @returns A random AI name
 */
export function getRandomAIName(usedNames: Set<string> = new Set()): string {
  const availableNames = AI_NAMES.filter(name => !usedNames.has(name))
  
  if (availableNames.length === 0) {
    // If all names are used, allow duplicates by using the full list
    return AI_NAMES[Math.floor(Math.random() * AI_NAMES.length)]
  }
  
  return availableNames[Math.floor(Math.random() * availableNames.length)]
}

/**
 * Get multiple unique random AI names
 * @param count - Number of names to generate
 * @returns Array of unique AI names
 */
export function getRandomAINames(count: number): string[] {
  const names: string[] = []
  const usedNames = new Set<string>()
  
  for (let i = 0; i < count; i++) {
    const name = getRandomAIName(usedNames)
    names.push(name)
    usedNames.add(name)
  }
  
  return names
}
