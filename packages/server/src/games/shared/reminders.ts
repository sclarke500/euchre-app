export interface ReminderTickInput {
  reminderCount: number
  timeoutAfterReminders: number
  timedOutPlayer: number | null
  playerIndex: number
}

export interface ReminderTickResult {
  nextReminderCount: number
  didTimeOut: boolean
  nextTimedOutPlayer: number | null
}

export function advanceReminderTick({
  reminderCount,
  timeoutAfterReminders,
  timedOutPlayer,
  playerIndex,
}: ReminderTickInput): ReminderTickResult {
  const nextReminderCount = reminderCount + 1
  const didTimeOut =
    nextReminderCount >= timeoutAfterReminders && timedOutPlayer === null

  return {
    nextReminderCount,
    didTimeOut,
    nextTimedOutPlayer: didTimeOut ? playerIndex : timedOutPlayer,
  }
}
