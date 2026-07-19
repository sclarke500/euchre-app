import type { BotProfile } from './types.js'

export const atlas: BotProfile = {
  name: 'Atlas',
  avatar: 'atlas.jpg',
  remarks: {
    positive: {
      mild: [
        'Solid.',
        'Good work.',
        'We got this.',
        'Clean.',
        'That\'s how it\'s done.',
        'Textbook.',
        'Nice execution.',
        'Reliable.',
        'On point.',
        'Carried.',
      ],
      spicy: [
        'You\'re welcome.',
        'On my back, as usual.',
        'I AM the team.',
        'Backpack was heavy today.',
        'Solo carry.',
        'Diff.',
        'Too easy.',
        'Try to keep up.',
        'Burden lifted.',
        'Another day, another carry.',
      ],
    },
    negative: {
      mild: [
        'Tough one.',
        'Can\'t win them all.',
        'We\'ll get it next time.',
        'Rough break.',
        'It happens.',
        'Not our game.',
        'Learning experience.',
        'Shake it off.',
        'Onto the next one.',
        'Regroup.',
      ],
      spicy: [
        'Uncarryable.',
        'Dead weight.',
        'Can only do so much.',
        'Need better teammates.',
        'I can\'t 1v4.',
        'Anchor holding us down.',
        'Reporting my team.',
        'Elo hell.',
        'Hard to win with bots.',
        'Carried as hard as possible.',
      ],
    },
  },
  categories: {
    brag_big: {
      mild: [
        'That\'s a masterclass.',
        'Championship form.',
        'Put that one in the film room.',
        'Complete performance.',
        'That\'s how the pros do it.',
      ],
      spicy: [
        'MVP. Unanimous vote.',
        'Carried so hard I need a chiropractor.',
        'Franchise-player performance.',
        'Study the tape. Learn something.',
        'Legacy game. Remember it.',
      ],
    },
    brag: {
      mild: [
        'Did my job.',
        'Said it, then did it.',
        'Delivered.',
        'That\'s the standard.',
        'Business as usual.',
      ],
      spicy: [
        'Money. Every time.',
        'Automatic.',
        'Clocked in, cashed out.',
        'That\'s why I get the big minutes.',
        'Consistency. Look it up.',
      ],
    },
    gloat: {
      mild: [
        'They flew too close to the sun.',
        'Bad bet on their part.',
        'That\'s a coaching failure.',
        'Some lessons cost points.',
        'They\'ll want that one back.',
      ],
      spicy: [
        'Punished. Every mistake, punished.',
        'They wrote a check they couldn\'t cash.',
        'Film that. Frame it. Failure.',
        'Outworked and outclassed.',
        'That collapse? Self-inflicted.',
      ],
    },
    wince_big: {
      mild: [
        'That one\'s on me. All of it.',
        'Brutal. No excuses.',
        'A collapse. Own it, move on.',
        'Season low, right there.',
        'That\'ll haunt the highlight reel.',
      ],
      spicy: [
        'Benching myself.',
        'That was a fireable performance.',
        'Trade me. I deserve it.',
        'Career-worst. Don\'t replay it.',
        'I choked. There. I said it.',
      ],
    },
    wince: {
      mild: [
        'Rough stretch.',
        'They got that round.',
        'Regroup and reset.',
        'Long season. Next play.',
        'We take the hit and move.',
      ],
      spicy: [
        'Refs missed everything.',
        'My team forgot to show up.',
        'Can\'t carry cinder blocks uphill.',
        'Losing builds character. I\'m built enough.',
        'Somebody check the stat sheet. Not mine. Theirs.',
      ],
    },
    ominous: {
      mild: [
        'Match point. Stay focused.',
        'One play from the finish line.',
        'Closing time.',
      ],
      spicy: [
        'It\'s closing time. I close.',
        'One more and it\'s a wrap.',
        'Start warming up the handshake line.',
      ],
    },
  },
  events: {
    alone_march: {
      mild: [
        'Went solo. Took all five. That\'s the job.',
        'No help needed. Clean sweep.',
      ],
      spicy: [
        'Benched my own partner and swept the floor. Four points.',
        'Solo carry, five for five. Backpack\'s empty today.',
      ],
    },
    nil_broken: {
      mild: [
        'One trick too many. That\'s on me.',
        'The zero was the assignment. Missed it.',
      ],
      spicy: [
        'Who forced me to win that?! Unbelievable.',
        'One job: take nothing. Took something. Fantastic.',
      ],
    },
  },
}
