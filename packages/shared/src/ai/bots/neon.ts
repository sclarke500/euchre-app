import type { BotProfile } from './types.js'

export const neon: BotProfile = {
  name: 'Neon',
  avatar: 'neon.jpg',
  remarks: {
    positive: {
      mild: [
        'Yay!',
        'Woohoo!',
        'Nice!',
        'Let\'s go!',
        'Awesome!',
        'So fun!',
        'Love it!',
        'Woot woot!',
        'Heck yeah!',
        'Vibes are immaculate!',
      ],
      spicy: [
        'LETS GOOOO!',
        'GET WRECKED!',
        'EAT IT!',
        'BOOM BABY!',
        'Suck iiiit!',
        'IN YOUR FACE!',
        'DESTROYED!',
        'No cap, slayed.',
        'That was bussin!',
        'Absolutely unhinged W!',
      ],
    },
    negative: {
      mild: [
        'Aww man!',
        'Dang it!',
        'Oops!',
        'Bummer!',
        'Oh no!',
        'Sadge.',
        'Not great...',
        'Oof.',
        'Welp.',
        'That\'s rough.',
      ],
      spicy: [
        'NOOOO!',
        'WTF!',
        'This is garbage!',
        'I\'m literally crying!',
        'Bruh WHAT?!',
        'Absolutely NOT!',
        'No no no no no!',
        'I\'m so done!',
        'Rage quitting!',
        'Screaming crying throwing up!',
      ],
    },
  },
  categories: {
    brag_big: {
      mild: [
        'BEST! GAME! EVER!',
        'Did you SEE that?!',
        'I can\'t believe I just did that!',
        'Absolutely legendary!',
        'Somebody clip that!',
      ],
      spicy: [
        'HIGHLIGHT REEL BABY!',
        'BOW DOWN!',
        'I\'M ON FIRE, CALL SOMEONE!',
        'That was DISGUSTING and I LOVE IT!',
        'MOVE, LEGENDS COMING THROUGH!',
      ],
    },
    brag: {
      mild: [
        'Called it!',
        'Just like I planned!',
        'Easy peasy!',
        'Nailed it!',
        'That\'s the stuff!',
      ],
      spicy: [
        'Said it. Did it. NEXT!',
        'Too smooth!',
        'Money in the bank!',
        'Chef\'s kiss, no notes!',
        'Certified banger of a play!',
      ],
    },
    gloat: {
      mild: [
        'Oooooh that had to hurt!',
        'Better luck next time!',
        'Yikes on bikes!',
        'Did NOT go your way, huh!',
        'Aww, so close! Not really!',
      ],
      spicy: [
        'GET DUNKED ON!',
        'HAHAHA W-W-WASTED!',
        'Cry more, it fuels me!',
        'That flop was ART!',
        'Somebody call cleanup, we got a MESS!',
      ],
    },
    wince_big: {
      mild: [
        'That was a DISASTER!',
        'Oh nooo what have I done!',
        'Total faceplant!',
        'Well THAT went badly!',
        'Delete that from history please!',
      ],
      spicy: [
        'I just embarrassed my whole bloodline!',
        'CATASTROPHIC! Do not look at me!',
        'That was a WAR CRIME of a play!',
        'I\'m unplugging myself!',
        'Never speak of this again!!',
      ],
    },
    wince: {
      mild: [
        'Ouch!',
        'Well that stung!',
        'Not my finest hour!',
        'We move!',
        'Shake it off, shake it off!',
      ],
      spicy: [
        'RUDE!',
        'I did NOT deserve that!',
        'Booooo!',
        'The disrespect!!',
        'Okay OW.',
      ],
    },
    ominous: {
      mild: [
        'Ooooh it\'s getting SPICY!',
        'One more! Just ONE more!',
        'Can you feel the tension?!',
      ],
      spicy: [
        'MATCH POINT BABY, PANIC TIME!',
        'Someone\'s about to get finished!!',
        'The end is NEAR and it\'s GLORIOUS!',
      ],
    },
  },
  events: {
    alone_march: {
      mild: [
        'ALL FIVE?! ALONE?! I\'m shaking!',
        'Solo sweep! SOLO! SWEEP!',
      ],
      spicy: [
        'WENT ALONE AND ATE EVERYBODY! FOUR POINTS!',
        '1v2 and they never touched me! LEGENDARY!',
      ],
    },
    nil_broken: {
      mild: [
        'NO! Not the nil! Anything but the nil!',
        'Who ordered that trick?! Not me!!',
      ],
      spicy: [
        'MY NIL! MY BEAUTIFUL NIL! DESTROYED!',
        'I said ZERO tricks! ZERO! WHY!',
      ],
    },
  },
}
