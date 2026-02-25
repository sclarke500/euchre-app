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
  
  // President-specific
  president_first_out: [
    { text: 'Built for this.', weight: 2 },
    { text: 'President era.', weight: 2 },
    { text: 'The throne is mine.' },
    { text: 'Speedrun any%.' },
    { text: 'First one out. As intended.' },
    { text: 'Your taxes? Mine now.' },
  ],
  president_second_out: [
    { text: 'VP secured.', weight: 2 },
    { text: 'Not first but not scum.' },
    { text: 'Middle management vibes.' },
    { text: 'Close enough.' },
  ],
  president_last_out: [
    { text: 'Down astronomically.', weight: 2 },
    { text: 'The economy is in shambles.' },
    { text: "It's giving poverty.", weight: 2 },
    { text: 'From riches to rags.' },
    { text: 'This is my villain origin story.' },
    { text: 'Touch grass? I AM the grass.' },
  ],
  president_pile_cleared: [
    { text: 'CLEARED.', weight: 2 },
    { text: 'Bomb dropped.', weight: 2 },
    { text: 'Reset the simulation.' },
    { text: 'Start over nerds.' },
    { text: 'New meta just dropped.' },
  ],
  round_won: [
    { text: 'Top of the food chain.', weight: 2 },
    { text: 'Rank diff.', weight: 2 },
    { text: 'The system works.' },
  ],
  round_lost: [
    { text: "I've been humbled.", weight: 2 },
    { text: 'Scum behavior from me.', weight: 2 },
    { text: 'The cards were not carding.' },
    { text: 'Economic collapse.' },
  ],
  
  // Spades-specific
  spades_nil_made: [
    { text: 'Zero tricks. As planned.', weight: 2 },
    { text: 'Nil secured.', weight: 2 },
    { text: 'The prophecy fulfilled.' },
    { text: "Couldn't take a trick if I tried. (I didn't.)" },
  ],
  spades_nil_failed: [
    { text: 'The nil dream... dead.', weight: 2 },
    { text: 'Why did I bid nil.', weight: 2 },
    { text: 'Tragic.' },
    { text: 'The cards betrayed me.' },
  ],
  spades_blind_nil_made: [
    { text: 'BLIND NIL. MADE. WITNESS.', weight: 2 },
    { text: 'Actually insane.', weight: 2 },
    { text: 'The universe aligned.' },
    { text: 'Calculated. (Not really.)' },
  ],
  spades_blind_nil_failed: [
    { text: 'The hubris was astronomical.', weight: 2 },
    { text: 'Blind nil was a choice.', weight: 2 },
    { text: 'I blame myself.' },
    { text: 'Never again.' },
  ],
  spades_opponent_nil_failed: [
    { text: 'Shoulda bid safer.', weight: 2 },
    { text: 'That nil aged poorly.' },
    { text: 'Nil diff.' },
  ],
  spades_got_set: [
    { text: 'Set. Pain.', weight: 2 },
    { text: "Didn't make it.", weight: 2 },
    { text: 'Overambitious.' },
    { text: 'The bid was a lie.' },
  ],
  spades_set_opponent: [
    { text: 'Set them. Love to see it.', weight: 2 },
    { text: 'Bid too high.', weight: 2 },
    { text: 'Should have gone lower.' },
    { text: 'The math wasn\'t mathing for them.' },
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
  
  // President-specific
  president_first_out: [
    { text: 'Later losers.', weight: 2 },
    { text: 'President shit only.', weight: 2 },
    { text: 'Bow down peasants.' },
    { text: 'First out, as fucking intended.' },
    { text: 'Your cards? Trash.' },
  ],
  president_second_out: [
    { text: 'VP is fine whatever.', weight: 2 },
    { text: 'Not scum, not mad.' },
    { text: 'Could be worse.' },
  ],
  president_last_out: [
    { text: 'Fuck.', weight: 2 },
    { text: 'This game is rigged.', weight: 2 },
    { text: 'Scum life chose me.' },
    { text: "I'm literally broke." },
    { text: 'Poverty simulator.' },
    { text: 'Give me your worst cards, I dare you.' },
  ],
  president_pile_cleared: [
    { text: 'GET FUCKED.', weight: 2 },
    { text: 'Bomb bitch!', weight: 2 },
    { text: 'Start the fuck over.' },
    { text: 'Reset.' },
    { text: 'Cleared your whole shit.' },
  ],
  round_won: [
    { text: 'Eat the rich? I AM the rich.', weight: 2 },
    { text: 'Give me your best cards.', weight: 2 },
    { text: 'Taxation time.' },
  ],
  round_lost: [
    { text: 'Fuck this economy.', weight: 2 },
    { text: 'I hate it here.', weight: 2 },
    { text: 'Scum again. Great.' },
    { text: 'Pain.' },
  ],
  
  // Spades-specific
  spades_nil_made: [
    { text: 'Nil made bitches.', weight: 2 },
    { text: 'Zero tricks. Skill.', weight: 2 },
    { text: "Couldn't lose if I tried." },
    { text: '+100 thank you.' },
  ],
  spades_nil_failed: [
    { text: 'Fuck.', weight: 2 },
    { text: 'Why the fuck did I bid nil.', weight: 2 },
    { text: '-100. Great.' },
    { text: 'I hate spades.' },
  ],
  spades_blind_nil_made: [
    { text: 'BLIND NIL MADE. GET FUCKED.', weight: 2 },
    { text: 'Actually insane. +200.', weight: 2 },
    { text: 'Godlike.' },
  ],
  spades_blind_nil_failed: [
    { text: 'Fuck me. -200.', weight: 2 },
    { text: 'Blind nil was stupid.', weight: 2 },
    { text: 'Never doing that shit again.' },
  ],
  spades_opponent_nil_failed: [
    { text: 'Lol get fucked.', weight: 2 },
    { text: 'That nil was doomed.' },
    { text: 'Shoulda bid safe bitch.' },
  ],
  spades_got_set: [
    { text: 'Set. Fuck.', weight: 2 },
    { text: "Didn't make shit.", weight: 2 },
    { text: 'Pain.' },
  ],
  spades_set_opponent: [
    { text: 'SET THEM. EAT SHIT.', weight: 2 },
    { text: 'Bid too high dumbass.', weight: 2 },
    { text: 'Get set.' },
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
