/**
 * AI chat mode setting.
 *
 * NOTE: This file previously contained a full AI chat-phrase system
 * (getAIComment + normal/unhinged/feral phrase pools). That system was dead
 * code — nothing called it at runtime — and its "unhinged" pool contained
 * profanity, so it has been removed to avoid accidentally shipping that
 * content. Live in-game bot remarks come from ./bots (getRemark), which is a
 * separate, clean system.
 *
 * Only the AIChatMode type remains, as it's still referenced by client
 * settings and the multiplayer lobby.
 */

export type AIChatMode = 'clean' | 'unhinged' | 'feral'
