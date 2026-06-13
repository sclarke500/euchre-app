/**
 * Chat feature flags.
 *
 * v1.0 (App Store): free-text chat is disabled so the app contains no
 * user-generated content and avoids Apple Guideline 1.2 moderation
 * requirements (report/block/filter). Players can still send the fixed preset
 * emoji reactions, which are not user-generated content.
 *
 * To re-enable open chat: ship report/block/profanity-filter moderation, then
 * set this to `true`. This is the single source of truth — both ChatInput.vue
 * and ChatPanel.vue read it.
 */
export const ENABLE_FREE_TEXT_CHAT = false
