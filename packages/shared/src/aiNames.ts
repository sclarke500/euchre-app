/**
 * List of AI player names
 */
const AI_NAMES = ['Tron', 'Data', 'Neon', 'Halo', 'Pixel', 'Atlas'] as const

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
