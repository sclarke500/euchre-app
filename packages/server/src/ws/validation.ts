import { z } from 'zod'
import { BidAction, Suit } from '@euchre/shared'
import type { ClientMessage } from '@euchre/shared'

const gameTypeSchema = z.enum(['euchre', 'president', 'spades'])

const tableSettingsSchema = z.object({
  superTwosMode: z.boolean().optional(),
  maxRounds: z.number().int().min(1).optional(),
  aiDifficulty: z.enum(['easy', 'hard']).optional(),
}).strict()

const clientMetaShape = {
  clientSeq: z.number().int().nonnegative().optional(),
  commandId: z.string().min(1).optional(),
  expectedStateSeq: z.number().int().nonnegative().optional(),
}

const joinLobbySchema = z.object({
  type: z.literal('join_lobby'),
  nickname: z.string().min(1).max(32),
  odusId: z.string().optional(),
  ...clientMetaShape,
}).strict()

const createTableSchema = z.object({
  type: z.literal('create_table'),
  tableName: z.string().min(1).max(64).optional(),
  gameType: gameTypeSchema.optional(),
  maxPlayers: z.number().int().min(2).max(8).optional(),
  settings: tableSettingsSchema.optional(),
  ...clientMetaShape,
}).strict()

const joinTableSchema = z.object({
  type: z.literal('join_table'),
  tableId: z.string().min(1),
  seatIndex: z.number().int().min(0).max(7),
  ...clientMetaShape,
}).strict()

const leaveTableSchema = z.object({
  type: z.literal('leave_table'),
  ...clientMetaShape,
}).strict()

const leaveGameSchema = z.object({
  type: z.literal('leave_game'),
  ...clientMetaShape,
}).strict()

const startGameSchema = z.object({
  type: z.literal('start_game'),
  ...clientMetaShape,
}).strict()

const restartGameSchema = z.object({
  type: z.literal('restart_game'),
  ...clientMetaShape,
}).strict()

const makeBidSchema = z.object({
  type: z.literal('make_bid'),
  action: z.nativeEnum(BidAction),
  suit: z.nativeEnum(Suit).optional(),
  goingAlone: z.boolean().optional(),
  ...clientMetaShape,
}).strict()

const playCardSchema = z.object({
  type: z.literal('play_card'),
  cardId: z.string().min(1),
  ...clientMetaShape,
}).strict()

const discardCardSchema = z.object({
  type: z.literal('discard_card'),
  cardId: z.string().min(1),
  ...clientMetaShape,
}).strict()

const requestStateSchema = z.object({
  type: z.literal('request_state'),
  ...clientMetaShape,
}).strict()

const bootPlayerSchema = z.object({
  type: z.literal('boot_player'),
  playerId: z.number().int().min(0).max(7),
  ...clientMetaShape,
}).strict()

const presidentPlayCardsSchema = z.object({
  type: z.literal('president_play_cards'),
  cardIds: z.array(z.string().min(1)).min(1),
  ...clientMetaShape,
}).strict()

const presidentPassSchema = z.object({
  type: z.literal('president_pass'),
  ...clientMetaShape,
}).strict()

const presidentGiveCardsSchema = z.object({
  type: z.literal('president_give_cards'),
  cardIds: z.array(z.string().min(1)).min(1),
  ...clientMetaShape,
}).strict()

const spadesMakeBidSchema = z.object({
  type: z.literal('spades_make_bid'),
  bidType: z.enum(['normal', 'nil', 'blind_nil']),
  count: z.number().int().min(0).max(13),
  ...clientMetaShape,
}).strict()

const bugReportSchema = z.object({
  type: z.literal('bug_report'),
  payload: z.string().max(500_000),
  ...clientMetaShape,
}).strict()

const clientMessageSchema = z.discriminatedUnion('type', [
  joinLobbySchema,
  createTableSchema,
  joinTableSchema,
  leaveTableSchema,
  leaveGameSchema,
  startGameSchema,
  restartGameSchema,
  makeBidSchema,
  playCardSchema,
  discardCardSchema,
  requestStateSchema,
  bootPlayerSchema,
  presidentPlayCardsSchema,
  presidentPassSchema,
  presidentGiveCardsSchema,
  spadesMakeBidSchema,
  bugReportSchema,
])

export function parseClientMessage(data: unknown): {
  success: true
  message: ClientMessage
} | {
  success: false
  error: string
} {
  const result = clientMessageSchema.safeParse(data)
  if (!result.success) {
    return { success: false, error: result.error.errors.map((e: { message: string }) => e.message).join('; ') }
  }
  return { success: true, message: result.data as ClientMessage }
}