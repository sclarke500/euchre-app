const gameCommandQueues = new Map<string, Promise<void>>()

export function enqueueGameCommand(gameId: string, action: () => void): void {
  const previous = gameCommandQueues.get(gameId) ?? Promise.resolve()
  const next = previous
    .then(() => {
      action()
    })
    .catch((error) => {
      console.error('Game command failed:', error)
    })
    .finally(() => {
      if (gameCommandQueues.get(gameId) === next) {
        gameCommandQueues.delete(gameId)
      }
    })

  gameCommandQueues.set(gameId, next)
}