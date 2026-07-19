import type { BotProfile } from './types.js'

export const halo: BotProfile = {
  name: 'Halo',
  avatar: 'halo.jpg',
  remarks: {
    positive: {
      mild: [
        'Blessed.',
        'Divine favor.',
        'The light prevails.',
        'Grace be upon us.',
        'Righteous victory.',
        'As it was written.',
        'Heavenly.',
        'A sacred triumph.',
        'Fortune smiles.',
        'The path was true.',
      ],
      spicy: [
        'DIVINE PUNISHMENT!',
        'Smited!',
        'Bow before me!',
        'Holy destruction!',
        'God wills it!',
        'Kneel, sinner!',
        'Judgment day!',
        'Sent to hell!',
        'Purified!',
        'Angels weep for you!',
      ],
    },
    negative: {
      mild: [
        'A test of faith.',
        'Darkness momentarily prevails.',
        'We shall overcome.',
        'The spirit endures.',
        'Grace in defeat.',
        'A trial to learn from.',
        'Faith tested.',
        'The light will return.',
        'Patience is virtue.',
        'This too shall pass.',
      ],
      spicy: [
        'DAMN IT!',
        'Why have you forsaken me?!',
        'Cursed!',
        'This is heresy!',
        'The devil\'s work!',
        'Unholy BS!',
        'I\'ve been betrayed!',
        'Hell awaits you!',
        'Blasphemy!',
        'Where is your god now?!',
      ],
    },
  },
  categories: {
    brag_big: {
      mild: [
        'A miracle, witnessed by all.',
        'The heavens opened for that one.',
        'Providence guided every card.',
        'A blessed hand, played faithfully.',
        'Let the record show: divine.',
      ],
      spicy: [
        'WITNESS THE RAPTURE!',
        'Heaven called. It was about me.',
        'That was BIBLICAL!',
        'Ascension complete. Wave goodbye.',
        'Miracles happen. To me. Constantly.',
      ],
    },
    brag: {
      mild: [
        'As prophesied.',
        'The faithful are rewarded.',
        'A vow kept.',
        'The path was righteous.',
        'Deliverance, as promised.',
      ],
      spicy: [
        'Prophecy fulfilled. Again.',
        'My word is gospel.',
        'Promised. Delivered. Amen.',
        'The scriptures said I\'d make it.',
        'Faith: rewarded. Doubters: silenced.',
      ],
    },
    gloat: {
      mild: [
        'Divine justice is swift.',
        'Pride goeth before the fall.',
        'A lesson in humility, freely given.',
        'The scales have balanced.',
        'Repentance is always an option.',
      ],
      spicy: [
        'SMITED! As foretold!',
        'Thou hast been JUDGED!',
        'The wages of hubris! Collected!',
        'Confess! You never had a prayer!',
        'Struck down in front of everyone! Glorious!',
      ],
    },
    wince_big: {
      mild: [
        'A trial of biblical proportion.',
        'The heavens looked away.',
        'Even saints stumble.',
        'A wound to the soul, that one.',
        'I shall wander the desert a while.',
      ],
      spicy: [
        'FORSAKEN! UTTERLY FORSAKEN!',
        'The devil dealt that hand himself!',
        'I have been SACRIFICED!',
        'Job suffered less than this!',
        'Someone check the heavens. Management is asleep!',
      ],
    },
    wince: {
      mild: [
        'A tribulation. I endure.',
        'Tested, not broken.',
        'The light dims, briefly.',
        'Penance, I suppose.',
        'Even this serves a purpose.',
      ],
      spicy: [
        'Purgatory. This is purgatory.',
        'A plague upon that hand!',
        'My faith is being audited!',
        'The cards have sinned against me!',
        'Forgive them? Not this round.',
      ],
    },
    ominous: {
      mild: [
        'Judgment draws near.',
        'The final trumpet is warming up.',
        'The hour approaches.',
      ],
      spicy: [
        'THE RECKONING IS AT HAND!',
        'Pray. It\'s the only move you have left.',
        'The end times! And I have the good seats!',
      ],
    },
  },
  events: {
    alone_march: {
      mild: [
        'Alone, yet never alone. Five tricks of grace.',
        'A solo pilgrimage. All five stations. Divine.',
      ],
      spicy: [
        'ALONE AND ANOINTED! ALL FIVE! KNEEL!',
        'One angel versus two sinners. A massacre, as scripture demands.',
      ],
    },
    nil_broken: {
      mild: [
        'My vow of nil... broken.',
        'That trick was a test. I failed it.',
      ],
      spicy: [
        'A CURSED trick! My nil lies in ruins!',
        'I took a vow! And THIS is my reward?!',
      ],
    },
  },
}
