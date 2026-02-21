/**
 * Shared composable for player disconnection handling.
 * 
 * Provides reactive state and actions for:
 * - Tracking which players are disconnected
 * - Showing disconnection UI
 * - Booting disconnected players
 */

import { computed, type ComputedRef, type Ref } from 'vue'

export interface Player {
  id: number
  name: string
  isHuman: boolean
  disconnected?: boolean
}

export interface DisconnectionConfig {
  /** Reactive array of players with disconnected status */
  players: ComputedRef<Player[]> | Ref<Player[]>
  /** The local player's ID (seat index) */
  myPlayerId: ComputedRef<number> | Ref<number>
  /** Function to boot a disconnected player */
  bootPlayer: (playerId: number) => void
}

export function useDisconnection(config: DisconnectionConfig) {
  const { players, myPlayerId, bootPlayer } = config

  /** List of disconnected players (excluding self) */
  const disconnectedPlayers = computed(() => {
    return players.value.filter(p => 
      p.disconnected && 
      p.isHuman && 
      p.id !== myPlayerId.value
    )
  })

  /** First disconnected player (for single-notification UI) */
  const firstDisconnected = computed(() => disconnectedPlayers.value[0] ?? null)

  /** Whether any player is disconnected */
  const hasDisconnectedPlayer = computed(() => disconnectedPlayers.value.length > 0)

  /** Boot the first disconnected player */
  function bootFirstDisconnected() {
    const player = firstDisconnected.value
    if (player) {
      bootPlayer(player.id)
    }
  }

  return {
    disconnectedPlayers,
    firstDisconnected,
    hasDisconnectedPlayer,
    bootFirstDisconnected,
    bootPlayer,
  }
}
