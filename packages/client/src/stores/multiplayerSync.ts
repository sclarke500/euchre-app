import type { ServerMessage } from '@67cards/shared'
import type { Ref } from 'vue'

type ErrorServerMessage = Extract<ServerMessage, { type: 'error' }>

export function updateLastStateSeq(stateSeqRef: Ref<number>, stateSeq: number): void {
  stateSeqRef.value = stateSeq
}

export function getExpectedStateSeq(lastStateSeq: number, snapshotStateSeq?: number | null): number {
  return Math.max(snapshotStateSeq ?? 0, lastStateSeq)
}

export function isSyncRequiredError(message: ServerMessage): boolean {
  return message.type === 'error' && message.code === 'sync_required'
}

export function handleCommonMultiplayerError(
  message: ErrorServerMessage,
  gameLost: Ref<boolean>,
  requestStateResync: () => void
): { gameLost: boolean; syncRequired: boolean } {
  if (message.code === 'game_lost') {
    gameLost.value = true
    return { gameLost: true, syncRequired: false }
  }

  if (message.code === 'sync_required') {
    requestStateResync()
    return { gameLost: false, syncRequired: true }
  }

  return { gameLost: false, syncRequired: false }
}