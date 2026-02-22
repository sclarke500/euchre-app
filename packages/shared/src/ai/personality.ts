/**
 * AI Chat Personality System
 * 
 * Gives AI players occasional contextual chat messages.
 * Unpredictable, varied, and optionally unhinged.
 */

// Events that can trigger AI chat
export type AIChatEvent =
  | 'euchred_opponent'      // We euchred them
  | 'got_euchred'           // They euchred us
  | 'won_trick_bower'       // Won trick with right or left bower
  | 'won_trick_big'         // Won trick with ace of trump or similar
  | 'partner_clutch'        // Partner made a great play
  | 'called_trump_made'     // Called trump and made it
  | 'called_trump_euchred'  // Called trump and got euchred (self-blame)
  | 'alone_success'         // Went alone and made it
  | 'alone_failed'          // Went alone and failed
  | 'stole_deal'            // Ordered up / called when opponents dealt
  | 'game_won'              // Won the game
  | 'game_lost'             // Lost the game

// Phrase with optional weight (higher = more common)
interface WeightedPhrase {
  text: string
  weight?: number  // default 1
}

type PhrasePool = WeightedPhrase[]

// Normal phrases - clean but with personality
const normalPhrases: Record<AIChatEvent, PhrasePool> = {
  euchred_opponent: [
    { text: 'Sweet!', weight: 2 },
    { text: 'Nice.', weight: 2 },
    { text: 'Got em.' },
    { text: 'Too easy.' },
    { text: "That's what I'm talking about." },
    { text: 'Yep.' },
  ],
  got_euchred: [
    { text: 'Ugh.', weight: 2 },
    { text: 'Bummer.', weight: 2 },
    { text: 'Well played.' },
    { text: 'Ouch.' },
    { text: '...' },
    { text: 'Happens.' },
  ],
  won_trick_bower: [
    { text: 'Boom.', weight: 2 },
    { text: 'There it is.' },
    { text: 'Right on time.' },
    { text: 'Had to do it.' },
  ],
  won_trick_big: [
    { text: 'Nice.', weight: 2 },
    { text: 'Easy.' },
    { text: 'Yep.' },
  ],
  partner_clutch: [
    { text: 'Good one, partner.', weight: 2 },
    { text: 'Nice play!' },
    { text: 'Perfect.' },
    { text: 'That works.' },
    { text: 'Big brain move.' },
  ],
  called_trump_made: [
    { text: 'Called it.', weight: 2 },
    { text: 'Easy money.' },
    { text: 'Told ya.' },
    { text: 'Never in doubt.' },
  ],
  called_trump_euchred: [
    { text: 'My bad.', weight: 2 },
    { text: 'Welp.', weight: 2 },
    { text: 'That was optimistic.' },
    { text: 'Swing and a miss.' },
    { text: 'Sorry partner.' },
  ],
  alone_success: [
    { text: 'All me.', weight: 2 },
    { text: 'Solo dolo.' },
    { text: 'Too clean.' },
    { text: 'Didn\'t need ya.' },
    { text: 'Four points baby.' },
  ],
  alone_failed: [
    { text: 'Welp...', weight: 2 },
    { text: 'Maybe I did need help.' },
    { text: 'Ambitious.' },
    { text: 'Oops.' },
  ],
  stole_deal: [
    { text: 'Thanks for the deal.', weight: 2 },
    { text: 'Don\'t mind if I do.' },
    { text: 'I\'ll take that.' },
  ],
  game_won: [
    { text: 'GG!', weight: 2 },
    { text: 'Good game.', weight: 2 },
    { text: 'That was fun.' },
    { text: 'Let\'s run it back.' },
  ],
  game_lost: [
    { text: 'GG.', weight: 2 },
    { text: 'Good game.', weight: 2 },
    { text: 'You got me.' },
    { text: 'Next time.' },
    { text: 'Rematch?' },
  ],
}

// Unhinged phrases - profanity and attitude
const unhingedPhrases: Record<AIChatEvent, PhrasePool> = {
  euchred_opponent: [
    { text: 'Fuck yeah!', weight: 2 },
    { text: 'Get wrecked.', weight: 2 },
    { text: 'Sit down.' },
    { text: 'Too fucking easy.' },
    { text: 'Lmaooo' },
    { text: 'Hold that L.' },
    { text: 'You love to see it.' },
  ],
  got_euchred: [
    { text: 'Fuck.', weight: 2 },
    { text: 'Goddammit.', weight: 2 },
    { text: 'Fuck me.' },
    { text: 'Are you shitting me?' },
    { text: 'Pain.' },
    { text: 'I hate it here.' },
  ],
  won_trick_bower: [
    { text: 'Suck it.', weight: 2 },
    { text: 'Boom bitch.' },
    { text: 'Bow to the bower.' },
    { text: 'Yeah buddy.' },
  ],
  won_trick_big: [
    { text: 'Easy.', weight: 2 },
    { text: 'Get that outta here.' },
    { text: 'Mine.' },
  ],
  partner_clutch: [
    { text: 'Hell yeah partner!', weight: 2 },
    { text: 'Let\'s fucking go!' },
    { text: 'My guy!' },
    { text: 'That\'s my partner!' },
    { text: 'Big dick energy.' },
  ],
  called_trump_made: [
    { text: 'Called it bitches.', weight: 2 },
    { text: 'Never fucking doubted.' },
    { text: 'Cash money.' },
    { text: 'I do this.' },
  ],
  called_trump_euchred: [
    { text: 'Shit, my bad.', weight: 2 },
    { text: 'Fuck. Sorry partner.' },
    { text: 'That was dumb.' },
    { text: 'I got cocky.' },
    { text: 'Goddamn it.' },
  ],
  alone_success: [
    { text: 'Didn\'t need your ass.', weight: 2 },
    { text: 'All fucking me.' },
    { text: 'Solo king.' },
    { text: 'Four points, fuck you very much.' },
    { text: 'Bow down.' },
  ],
  alone_failed: [
    { text: 'Shit...', weight: 2 },
    { text: 'Should\'ve taken the help.' },
    { text: 'Fuck me sideways.' },
    { text: 'Hubris.' },
  ],
  stole_deal: [
    { text: 'Thanks for the free points.', weight: 2 },
    { text: 'Lol thanks.' },
    { text: 'Your deal, my points.' },
  ],
  game_won: [
    { text: 'GG EZ', weight: 2 },
    { text: 'Get fucked.' },
    { text: 'Too good.' },
    { text: 'That\'s game bitches.' },
    { text: 'Stay free.' },
  ],
  game_lost: [
    { text: 'GG.', weight: 2 },
    { text: 'Whatever.', weight: 2 },
    { text: 'Fuck.' },
    { text: 'Lucky.' },
    { text: 'Rematch. Now.' },
  ],
}

// Trigger probability per event (0-1)
const triggerChance: Record<AIChatEvent, number> = {
  euchred_opponent: 0.35,
  got_euchred: 0.30,
  won_trick_bower: 0.20,
  won_trick_big: 0.15,
  partner_clutch: 0.25,
  called_trump_made: 0.20,
  called_trump_euchred: 0.40,
  alone_success: 0.50,
  alone_failed: 0.45,
  stole_deal: 0.25,
  game_won: 0.60,
  game_lost: 0.50,
}

// Cooldown tracking (prevents spam)
let lastChatTime = 0
const MIN_CHAT_GAP_MS = 3000

/**
 * Pick a weighted random phrase from a pool
 */
function pickWeighted(pool: PhrasePool): string {
  const totalWeight = pool.reduce((sum, p) => sum + (p.weight ?? 1), 0)
  let random = Math.random() * totalWeight
  
  for (const phrase of pool) {
    random -= phrase.weight ?? 1
    if (random <= 0) {
      return phrase.text
    }
  }
  
  return pool[pool.length - 1]?.text ?? ''
}

/**
 * Get an AI chat comment for an event.
 * Returns null if AI decides not to comment (probability + cooldown).
 * 
 * @param event - The game event that occurred
 * @param unhinged - Use unhinged (profanity) mode
 * @param forceTrigger - Skip probability check (for testing)
 */
export function getAIComment(
  event: AIChatEvent,
  unhinged: boolean = false,
  forceTrigger: boolean = false
): string | null {
  const now = Date.now()
  
  // Cooldown check (unless forcing)
  if (!forceTrigger && now - lastChatTime < MIN_CHAT_GAP_MS) {
    return null
  }
  
  // Probability check (unless forcing)
  const chance = triggerChance[event] ?? 0.25
  if (!forceTrigger && Math.random() > chance) {
    return null
  }
  
  const pool = unhinged ? unhingedPhrases[event] : normalPhrases[event]
  if (!pool || pool.length === 0) {
    return null
  }
  
  lastChatTime = now
  return pickWeighted(pool)
}

/**
 * Reset cooldown (for testing or game restart)
 */
export function resetAIChatCooldown(): void {
  lastChatTime = 0
}
