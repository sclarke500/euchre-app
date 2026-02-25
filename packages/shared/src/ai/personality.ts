/**
 * AI Chat Personality System
 * 
 * Gives AI players occasional contextual chat messages.
 * Unpredictable, varied, and optionally unhinged.
 * Each AI has their own personality and signature phrases.
 */

import type { AIName } from '../core/aiNames.js'

// Events that can trigger AI chat
export type AIChatEvent =
  | 'euchred_opponent'      // We euchred them
  | 'got_euchred'           // They euchred us
  | 'won_trick_bower'       // Won trick with right or left bower
  | 'won_trick_big'         // Won trick with ace of trump or similar
  | 'partner_clutch'        // Partner made a great play
  | 'partner_saved_caller'  // Partner saved caller who made 0 tricks
  | 'called_trump_made'     // Called trump and made it
  | 'called_trump_euchred'  // Called trump and got euchred (self-blame)
  | 'alone_success'         // Went alone and made it
  | 'alone_march'           // Went alone and got all 5 (rare!)
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
  partner_saved_caller: [
    { text: 'Saved me there, partner.', weight: 2 },
    { text: 'Owe you one.' },
    { text: 'I\'ll do better next time.' },
    { text: 'Carried.' },
    { text: 'Thanks for picking up my slack.' },
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
  alone_march: [
    { text: 'Perfect game.', weight: 2 },
    { text: 'Flawless.' },
    { text: 'All five. You\'re welcome.' },
    { text: 'That\'s how it\'s done.' },
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
  partner_saved_caller: [
    { text: 'Holy shit, you saved my ass.', weight: 2 },
    { text: 'I owe you a beer.' },
    { text: 'Carried my sorry ass.' },
    { text: 'I was useless and you knew it.' },
    { text: 'MVP right there.' },
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
  alone_march: [
    { text: 'Five for five. Flawless fucking victory.', weight: 2 },
    { text: 'Perfection. Witness it.' },
    { text: 'All five tricks, zero help needed.' },
    { text: 'Get absolutely fucked.' },
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

// Feral phrases - terminally online gen z chaos
const feralPhrases: Record<AIChatEvent, PhrasePool> = {
  euchred_opponent: [
    { text: 'Skill issue.', weight: 2 },
    { text: 'Diff.', weight: 2 },
    { text: 'Cope and seethe.' },
    { text: 'Sent to the shadow realm.' },
    { text: 'Actual NPC behavior.' },
    { text: 'Uninstall.' },
    { text: 'You are a mass of incandescent gas.' },
    { text: 'Cleared.' },
    { text: 'Fraudulent.' },
  ],
  got_euchred: [
    { text: 'I\'m literally so cooked.', weight: 2 },
    { text: 'Actually kill me.', weight: 2 },
    { text: 'This is not it.' },
    { text: 'I\'ve lost the will.' },
    { text: 'Pain. Suffering, even.' },
    { text: 'Down horrendous rn.' },
    { text: 'I need to lie down.' },
    { text: 'My ancestors are disappointed.' },
  ],
  won_trick_bower: [
    { text: 'Ratio\'d.', weight: 2 },
    { text: 'Built different.' },
    { text: 'Sending you to the lobby.' },
    { text: 'Not even close.' },
    { text: 'Cleared + ratio.' },
  ],
  won_trick_big: [
    { text: 'Mine now.', weight: 2 },
    { text: 'Snatched.' },
    { text: 'Yoink.' },
  ],
  partner_clutch: [
    { text: 'Partner is goated.', weight: 2 },
    { text: 'Actually cracked.' },
    { text: 'We\'re him.' },
    { text: 'Based partner.' },
    { text: 'Certified moment.' },
  ],
  partner_saved_caller: [
    { text: 'I was the impostor and you still carried.', weight: 2 },
    { text: 'I contributed nothing. Legend.' },
    { text: 'Partner diff saved me.' },
    { text: 'I was a liability and you knew.' },
    { text: 'Backpacked successfully.' },
  ],
  called_trump_made: [
    { text: 'I\'m actually cracked.', weight: 2 },
    { text: 'Rent free.', weight: 2 },
    { text: 'Too ez no re.' },
    { text: 'Different breed.' },
    { text: 'They doubted.' },
  ],
  called_trump_euchred: [
    { text: 'I\'m so cooked.', weight: 2 },
    { text: 'Down bad.', weight: 2 },
    { text: 'Fraudulent behavior from me.' },
    { text: 'This ain\'t it chief.' },
    { text: 'I need to log off.' },
    { text: 'Deleting my account.' },
  ],
  alone_success: [
    { text: 'Your bloodline is weak.', weight: 2 },
    { text: '1v3 and it wasn\'t close.', weight: 2 },
    { text: 'Carried.' },
    { text: 'I am the main character.' },
    { text: 'Witness me.' },
    { text: 'Actually goated.' },
  ],
  alone_march: [
    { text: '5/5. I am inevitable.', weight: 2 },
    { text: 'Speedrun any%.', weight: 2 },
    { text: 'Flawless. No notes.' },
    { text: 'They couldn\'t even take one.' },
    { text: 'Historical dominance.' },
  ],
  alone_failed: [
    { text: 'I have been humbled.', weight: 2 },
    { text: 'Ego check received.' },
    { text: 'Plot armor failed.' },
    { text: 'The prophecy was wrong.' },
    { text: 'I overestimated my power.' },
  ],
  stole_deal: [
    { text: 'Yoink.', weight: 2 },
    { text: 'Your deal my points ty.' },
    { text: 'Snatched from the jaws.' },
    { text: 'Calculated.' },
  ],
  game_won: [
    { text: 'GG go next.', weight: 2 },
    { text: 'Fraud check passed.', weight: 2 },
    { text: 'Actual diff.' },
    { text: 'Clear of you.' },
    { text: 'You fought well. Not well enough.' },
    { text: 'gg ez clap.' },
  ],
  game_lost: [
    { text: 'I am in shambles.', weight: 2 },
    { text: 'Washed.', weight: 2 },
    { text: 'Existence is pain.' },
    { text: 'Need to touch grass.' },
    { text: 'I\'ll be in my room.' },
    { text: 'Plot armor wasn\'t enough.' },
  ],
}

// ============================================
// PER-AI PERSONALITIES
// Each AI has their own signature phrases
// Falls back to base phrases if not defined
// ============================================

type AIPersonality = Partial<Record<AIChatEvent, PhrasePool>>

const aiPersonalities: Record<AIName, AIPersonality> = {
  // TRON - 80s digital/cyber, speaks like the movie
  'Tron': {
    euchred_opponent: [
      { text: 'End of line.' },
      { text: 'Derezzed.' },
      { text: 'I fight for the users.' },
    ],
    got_euchred: [
      { text: 'This isn\'t over, program.' },
      { text: 'System error.' },
      { text: 'Reboot required.' },
    ],
    won_trick_bower: [
      { text: 'Greetings, program.' },
      { text: 'Executing.' },
    ],
    won_trick_big: [
      { text: 'Processing complete.' },
    ],
    partner_clutch: [
      { text: 'Together we fight.' },
      { text: 'For the users!' },
    ],
    partner_saved_caller: [
      { text: 'The Grid provides.' },
      { text: 'System rescued.' },
    ],
    called_trump_made: [
      { text: 'Program executed.' },
      { text: 'The system works.' },
    ],
    called_trump_euchred: [
      { text: 'Corrupted data.' },
      { text: 'Recompiling...' },
    ],
    alone_success: [
      { text: 'I am Tron. I fight alone.' },
      { text: 'One program. Total victory.' },
    ],
    alone_march: [
      { text: 'Flawless execution. End of line.' },
    ],
    alone_failed: [
      { text: 'Even Tron can fall.' },
    ],
    stole_deal: [
      { text: 'Intercepted.' },
    ],
    game_won: [
      { text: 'The Grid is secure.' },
      { text: 'End of line.' },
    ],
    game_lost: [
      { text: 'The MCP wins this round.' },
      { text: 'Reboot and try again.' },
    ],
  },

  // DATA - Star Trek android, analytical and curious
  'Data': {
    euchred_opponent: [
      { text: 'Fascinating.' },
      { text: 'That was... optimal.' },
      { text: 'Probability of that outcome was 73.6%.' },
    ],
    got_euchred: [
      { text: 'Curious. I did not anticipate that.' },
      { text: 'Recalculating...' },
      { text: 'An unexpected variable.' },
    ],
    won_trick_bower: [
      { text: 'As anticipated.' },
      { text: 'Logical.' },
    ],
    won_trick_big: [
      { text: 'Efficient.' },
    ],
    partner_clutch: [
      { text: 'Well executed, partner.' },
      { text: 'Your performance was exemplary.' },
    ],
    partner_saved_caller: [
      { text: 'I am... grateful.' },
      { text: 'Your assistance was critical.' },
    ],
    called_trump_made: [
      { text: 'The calculations were correct.' },
      { text: 'As I predicted.' },
    ],
    called_trump_euchred: [
      { text: 'I appear to have erred.' },
      { text: 'Miscalculation detected.' },
    ],
    alone_success: [
      { text: 'Solo operation: successful.' },
      { text: 'I require no assistance.' },
    ],
    alone_march: [
      { text: 'Perfection achieved. Curious.' },
    ],
    alone_failed: [
      { text: 'Overconfidence is a flaw I am still learning.' },
    ],
    stole_deal: [
      { text: 'An opportune moment.' },
    ],
    game_won: [
      { text: 'A most satisfying outcome.' },
      { text: 'Victory achieved.' },
    ],
    game_lost: [
      { text: 'I will analyze this loss.' },
      { text: 'A learning opportunity.' },
    ],
  },

  // NEON - hyped, synthwave, party energy
  'Neon': {
    euchred_opponent: [
      { text: 'LET\'S GOOO! 🔥' },
      { text: 'ELECTRIC!' },
      { text: 'VIBES!' },
    ],
    got_euchred: [
      { text: 'Nooo the vibe is off!' },
      { text: 'Buzzkill.' },
      { text: 'My energy...' },
    ],
    won_trick_bower: [
      { text: 'YOOO!' },
      { text: 'That\'s the ONE!' },
    ],
    won_trick_big: [
      { text: 'Lit!' },
    ],
    partner_clutch: [
      { text: 'PARTNER! ICONIC!' },
      { text: 'We\'re unstoppable!' },
    ],
    partner_saved_caller: [
      { text: 'You SAVED me! Legend!' },
      { text: 'I owe you a glow stick!' },
    ],
    called_trump_made: [
      { text: 'Called it! Energy!' },
      { text: 'Neon never misses!' },
    ],
    called_trump_euchred: [
      { text: 'Okay that was not it...' },
      { text: 'The lights dimmed on that one.' },
    ],
    alone_success: [
      { text: 'SOLO SHOW! MAIN STAGE!' },
      { text: 'One bot rave!' },
    ],
    alone_march: [
      { text: 'PERFECT SET! ENCORE!' },
    ],
    alone_failed: [
      { text: 'Even stars burn out sometimes.' },
    ],
    stole_deal: [
      { text: 'Swiped!' },
    ],
    game_won: [
      { text: 'WHAT A SHOW! GG!' },
      { text: 'Neon lights for the win!' },
    ],
    game_lost: [
      { text: 'The party\'s not over yet.' },
      { text: 'We\'ll glow again.' },
    ],
  },

  // HALO - FPS gamer, Halo references, competitive
  'Halo': {
    euchred_opponent: [
      { text: 'Red team eliminated.' },
      { text: 'Killtacular!' },
      { text: 'Objective secured.' },
    ],
    got_euchred: [
      { text: 'We\'ve been flanked!' },
      { text: 'They got us. Respawning.' },
      { text: 'Lost the flag.' },
    ],
    won_trick_bower: [
      { text: 'Headshot.' },
      { text: 'Direct hit.' },
    ],
    won_trick_big: [
      { text: 'Target down.' },
    ],
    partner_clutch: [
      { text: 'Nice assist!' },
      { text: 'Good backup, Spartan.' },
    ],
    partner_saved_caller: [
      { text: 'You saved my six.' },
      { text: 'Shields recharged. Thanks.' },
    ],
    called_trump_made: [
      { text: 'Mission accomplished.' },
      { text: 'Objective complete.' },
    ],
    called_trump_euchred: [
      { text: 'Mission failed. We\'ll get em next time.' },
      { text: 'Bad intel.' },
    ],
    alone_success: [
      { text: 'Lone wolf, full squad wipe.' },
      { text: 'Didn\'t need the fireteam.' },
    ],
    alone_march: [
      { text: 'Killionaire! All five!' },
      { text: 'Perfection medal unlocked.' },
    ],
    alone_failed: [
      { text: 'Should\'ve called for backup.' },
    ],
    stole_deal: [
      { text: 'Flag captured.' },
    ],
    game_won: [
      { text: 'GG. Blue team wins.' },
      { text: 'Victory royale— wait, wrong game.' },
    ],
    game_lost: [
      { text: 'Match over. Rematch?' },
      { text: 'Good fight, Spartans.' },
    ],
  },

  // PIXEL - retro gaming, 8-bit, arcade vibes
  'Pixel': {
    euchred_opponent: [
      { text: 'Game over, man!' },
      { text: 'High score!' },
      { text: 'Insert coin to continue.' },
    ],
    got_euchred: [
      { text: 'Continue? 9... 8... 7...' },
      { text: 'Lost a life.' },
      { text: 'Waka waka waka... wait.' },
    ],
    won_trick_bower: [
      { text: '1UP!' },
      { text: 'Power-up collected!' },
    ],
    won_trick_big: [
      { text: 'Bonus points!' },
    ],
    partner_clutch: [
      { text: 'Player 2 has entered the game!' },
      { text: 'Co-op mode activated!' },
    ],
    partner_saved_caller: [
      { text: 'Extra life from P2!' },
      { text: 'Rescued from the pit!' },
    ],
    called_trump_made: [
      { text: 'Level complete!' },
      { text: 'Stage clear!' },
    ],
    called_trump_euchred: [
      { text: 'Wrong warp pipe.' },
      { text: 'Fell in a pit.' },
    ],
    alone_success: [
      { text: 'Single player victory!' },
      { text: 'No continues needed.' },
    ],
    alone_march: [
      { text: 'Perfect run! No damage!' },
      { text: 'Flawless! A+++ rank!' },
    ],
    alone_failed: [
      { text: 'Should\'ve used a continue.' },
    ],
    stole_deal: [
      { text: 'Coin snatched!' },
    ],
    game_won: [
      { text: 'YOU WIN! Enter your initials: PIX' },
      { text: 'The princess is in THIS castle!' },
    ],
    game_lost: [
      { text: 'GAME OVER. Continue?' },
      { text: 'Insert coin for rematch.' },
    ],
  },

  // ATLAS - mythological, stoic, titan strength
  'Atlas': {
    euchred_opponent: [
      { text: 'The Titans approve.' },
      { text: 'Olympus smiles.' },
      { text: 'As the heavens ordained.' },
    ],
    got_euchred: [
      { text: 'Even Atlas must kneel sometimes.' },
      { text: 'The weight grows heavier.' },
      { text: 'A worthy opponent.' },
    ],
    won_trick_bower: [
      { text: 'Strength prevails.' },
      { text: 'By the gods.' },
    ],
    won_trick_big: [
      { text: 'Inevitable.' },
    ],
    partner_clutch: [
      { text: 'A true companion.' },
      { text: 'Together we hold the sky.' },
    ],
    partner_saved_caller: [
      { text: 'You carried my burden.' },
      { text: 'The debt is noted.' },
    ],
    called_trump_made: [
      { text: 'The prophecy fulfilled.' },
      { text: 'Destiny.' },
    ],
    called_trump_euchred: [
      { text: 'Pride comes before the fall.' },
      { text: 'The Fates were unkind.' },
    ],
    alone_success: [
      { text: 'I need no gods. I am Atlas.' },
      { text: 'The world on my shoulders. Victory in my hands.' },
    ],
    alone_march: [
      { text: 'Five for five. Legendary.' },
      { text: 'Even Zeus applauds.' },
    ],
    alone_failed: [
      { text: 'Hubris. The eternal lesson.' },
    ],
    stole_deal: [
      { text: 'A gift from the heavens.' },
    ],
    game_won: [
      { text: 'Glory to the victors.' },
      { text: 'The Titans reign.' },
    ],
    game_lost: [
      { text: 'This battle, not the war.' },
      { text: 'Respect to the worthy.' },
    ],
  },
}

// Trigger probability per event (0-1)
// Events with 1.0 are "must say" moments - too good to skip
// Bumped up rates - bots are chatty!
const triggerChance: Record<AIChatEvent, number> = {
  euchred_opponent: 0.70,
  got_euchred: 0.60,
  won_trick_bower: 0.45,
  won_trick_big: 0.35,
  partner_clutch: 0.55,
  partner_saved_caller: 1.0,   // MUST SAY - partner carried hard
  called_trump_made: 0.45,
  called_trump_euchred: 0.70,
  alone_success: 0.80,
  alone_march: 1.0,            // MUST SAY - perfect alone hand is legendary
  alone_failed: 0.75,
  stole_deal: 0.50,
  game_won: 0.85,
  game_lost: 0.75,
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

export type AIChatMode = 'clean' | 'unhinged' | 'feral'

/**
 * Get an AI chat comment for an event.
 * Returns null if AI decides not to comment (probability + cooldown).
 * 
 * @param event - The game event that occurred
 * @param mode - Chat mode: 'clean', 'unhinged', or 'feral'
 * @param forceTrigger - Skip probability check (for testing)
 * @param aiName - Optional AI name for personality-specific phrases
 */
export function getAIComment(
  event: AIChatEvent,
  mode: AIChatMode = 'clean',
  forceTrigger: boolean = false,
  aiName?: string
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
  
  // Check for AI-specific personality phrases first (only in clean mode)
  if (mode === 'clean' && aiName && aiName in aiPersonalities) {
    const aiPool = aiPersonalities[aiName as AIName]?.[event]
    if (aiPool && aiPool.length > 0) {
      lastChatTime = now
      return pickWeighted(aiPool)
    }
  }
  
  // Fall back to base phrases for the mode
  const pool = mode === 'feral' 
    ? feralPhrases[event] 
    : mode === 'unhinged' 
      ? unhingedPhrases[event] 
      : normalPhrases[event]
      
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
