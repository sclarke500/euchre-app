/**
 * Chat Phrase Pools
 * 
 * Organized by mode (feral/unhinged) and trigger type.
 * Generic phrases can be used across games.
 * Game-specific phrases are in separate sections.
 */

import type { ChatTrigger, PhrasePool } from './types.js'

// ============================================================================
// FERAL PHRASES - Gen Z chaos, no profanity (mild mode)
// ============================================================================

export const feralPhrases: Partial<Record<ChatTrigger, PhrasePool>> = {
  // Euchre-specific
  euchred_opponent: [
    { text: 'Skill issue.', weight: 2 },
    { text: 'Diff.', weight: 2 },
    { text: 'Cope and seethe.' },
    { text: 'Sent to the shadow realm.' },
    { text: 'Actual NPC behavior.' },
    { text: 'Uninstall.' },
    { text: 'Cleared.' },
    { text: 'Fraudulent.' },
  ],
  got_euchred: [
    { text: "I'm literally so cooked.", weight: 2 },
    { text: 'Actually kill me.', weight: 2 },
    { text: 'This is not it.' },
    { text: "I've lost the will." },
    { text: 'Pain. Suffering, even.' },
    { text: 'Down horrendous rn.' },
    { text: 'I need to lie down.' },
    { text: 'My ancestors are disappointed.' },
  ],
  won_trick_bower: [
    { text: 'Absolutely computed.', weight: 2 },
    { text: 'Calculated.' },
    { text: "Knew that was coming, didn't you?" },
    { text: 'The prophecy.' },
    { text: 'Built different.' },
    { text: 'Main character moment.' },
  ],
  won_trick_big: [
    { text: 'Mine now.', weight: 2 },
    { text: 'Collected.' },
    { text: "And I'll do it again." },
    { text: 'Simply built different.' },
  ],
  partner_clutch: [
    { text: 'Partner is HIM.', weight: 2 },
    { text: 'We are so back.' },
    { text: 'The team diff is crazy.' },
    { text: 'Bestie came through.' },
    { text: 'Rent free in their heads.' },
  ],
  partner_saved_caller: [
    { text: 'Carried so hard rn.', weight: 2 },
    { text: 'I owe you my life.' },
    { text: 'Partner diff is actually insane.' },
    { text: 'Bailed out by the goat.' },
  ],
  called_trump_made: [
    { text: 'Called it. (literally)', weight: 2 },
    { text: 'The vision was clear.' },
    { text: 'Trust the process.' },
    { text: 'Never in doubt.' },
  ],
  called_trump_euchred: [
    { text: 'I am in shambles.', weight: 2 },
    { text: 'The hubris...', weight: 2 },
    { text: 'Tragic backstory unlocked.' },
    { text: 'This will haunt me.' },
    { text: "I'll be thinking about this at 3am." },
  ],
  alone_success: [
    { text: 'Solo carry activated.', weight: 2 },
    { text: "Didn't need you nerds." },
    { text: 'One versus all. One wins.' },
    { text: 'Built. Different.' },
    { text: 'Main character syndrome but make it valid.' },
  ],
  alone_march: [
    { text: 'Five for five. Immaculate.', weight: 2 },
    { text: 'Perfection is achievable. I achieved it.' },
    { text: 'Witness greatness.' },
    { text: 'This will be studied.' },
  ],
  alone_failed: [
    { text: 'The ego... humbled.', weight: 2 },
    { text: 'Pride comes before the fall.' },
    { text: 'Should have stayed humble.' },
    { text: 'This is my villain origin story.' },
  ],
  stole_deal: [
    { text: 'Thanks for the free real estate.', weight: 2 },
    { text: 'Simply took it.' },
    { text: 'Rent is due.' },
  ],
  
  // Generic
  game_won: [
    { text: 'GG EZ no re', weight: 2 },
    { text: 'Another day another dub.' },
    { text: 'The script was written.' },
    { text: 'Stay free.' },
    { text: "It's giving winner." },
  ],
  game_lost: [
    { text: 'GG. Unfortunate.', weight: 2 },
    { text: 'We go next.', weight: 2 },
    { text: "I'll remember this." },
    { text: 'Plot armor ran out.' },
    { text: 'Not canon.' },
  ],
}

// ============================================================================
// UNHINGED PHRASES - Profanity and attitude (spicy mode)
// ============================================================================

export const unhingedPhrases: Partial<Record<ChatTrigger, PhrasePool>> = {
  // Euchre-specific
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
    { text: "Let's fucking go!" },
    { text: 'My guy!' },
    { text: "That's my partner!" },
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
    { text: "Didn't need your ass.", weight: 2 },
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
    { text: "Should've taken the help." },
    { text: 'Fuck me sideways.' },
    { text: 'Hubris.' },
  ],
  stole_deal: [
    { text: 'Thanks for the free points.', weight: 2 },
    { text: 'Lol thanks.' },
    { text: 'Your deal, my points.' },
  ],
  
  // Generic
  game_won: [
    { text: 'GG EZ', weight: 2 },
    { text: 'Get fucked.' },
    { text: 'Too good.' },
    { text: "That's game bitches." },
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

/**
 * Get phrase pool for a trigger and mode
 */
export function getPhrasePool(trigger: ChatTrigger, mode: 'clean' | 'unhinged'): PhrasePool {
  const pool = mode === 'unhinged' 
    ? unhingedPhrases[trigger] 
    : feralPhrases[trigger]
  return pool ?? []
}
