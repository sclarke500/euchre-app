import type { BotProfile } from './types.js'

export const pixel: BotProfile = {
  name: 'Pixel',
  avatar: 'pixel.jpg',
  remarks: {
    positive: {
      mild: [
        'GG!',
        'Level up!',
        'Achievement unlocked!',
        'High score!',
        'Power-up activated!',
        'Combo!',
        'Critical hit!',
        'Perfect run!',
        'Speedrun strats!',
        'No damage taken!',
      ],
      spicy: [
        'GET PIXELATED!',
        'Rekt in 8-bit!',
        'Game over, scrub!',
        'Git gud!',
        'Skill issue!',
        'Uninstall!',
        'Noob destroyed!',
        'Rage quit material!',
        'First try, baby!',
        'You\'re NPC energy!',
      ],
    },
    negative: {
      mild: [
        'Game over.',
        'Lost a life.',
        'Continue?',
        'Respawning...',
        'Checkpoint missed.',
        'Bad RNG.',
        'Frame perfect fail.',
        'Input lag.',
        'Save corrupted.',
        'Need more coins.',
      ],
      spicy: [
        'BULLSHIT RNG!',
        'This game is broken!',
        'Lag!',
        'Hitbox porn!',
        'Cheater!',
        'Bug report!',
        'Nerf this!',
        'Pay to win garbage!',
        'Skill-based matchmaking my ass!',
        'Throwing my controller!',
      ],
    },
  },
  categories: {
    brag_big: {
      mild: [
        'FLAWLESS VICTORY!',
        'New high score!',
        'S-rank clear!',
        '100% completion!',
        'World record pace!',
      ],
      spicy: [
        'NO-HIT RUN, BABY!',
        'Speedran your whole team!',
        'Frame-perfect DESTRUCTION!',
        'Achievement unlocked: Untouchable!',
        'Full combo! Your health bar: empty!',
      ],
    },
    brag: {
      mild: [
        'Objective complete!',
        'Quest cleared!',
        'Checkpoint secured!',
        'Right on strategy!',
        'XP earned!',
      ],
      spicy: [
        'Called my shot, hit my shot!',
        'Tutorial-level difficulty!',
        'EZ clap!',
        'Another one for the montage!',
        'On script, on schedule, on top!',
      ],
    },
    gloat: {
      mild: [
        'Game over, man!',
        'You ran out of continues!',
        'Mission failed! Yours, specifically!',
        'Return to checkpoint!',
        'That\'s a K.O.!',
      ],
      spicy: [
        'FATALITY!',
        'Deleted your save file!',
        'You just got combo\'d into the void!',
        'Respawn timer: forever!',
        'GG GO NEXT! Oh wait, you can\'t!',
      ],
    },
    wince_big: {
      mild: [
        'Blue screen. Total crash.',
        'Speedrun of failure. New record.',
        'Softlocked myself. Incredible.',
        'That run is dead. Very dead.',
        'Roll the death screen.',
      ],
      spicy: [
        'CORRUPTED SAVE! YEARS OF PROGRESS!',
        'I just speedran LOSING!',
        'Alt-F4! ALT-F4!',
        'Clip that and DESTROY the evidence!',
        'Rage quit cutscene initiated!',
      ],
    },
    wince: {
      mild: [
        'Lost a life. Still got continues.',
        'Respawning...',
        'Tough level.',
        'Minor damage taken.',
        'Checkpoint restart.',
      ],
      spicy: [
        'Lag spike! Not my fault!',
        'These hitboxes are RIGGED!',
        'Who balanced this patch?!',
        'Controller disconnected, obviously!',
        'Petition to nerf everyone else!',
      ],
    },
    ominous: {
      mild: [
        'Final boss music starting...',
        'One life left. Make it count.',
        'This is the last level.',
      ],
      spicy: [
        'FINAL ROUND. FIGHT!',
        'Sudden death mode ACTIVATED!',
        'Insert coin to survive. Oh wait, you\'re broke!',
      ],
    },
  },
  events: {
    alone_march: {
      mild: [
        'Solo campaign, perfect score, all five stages!',
        'No co-op needed! Full clear!',
      ],
      spicy: [
        '1-PLAYER MODE! FIVE TRICKS! NO DAMAGE RUN!',
        'Soloed the raid! FOUR POINTS! Get farmed!',
      ],
    },
    nil_broken: {
      mild: [
        'Pacifist run: ruined.',
        'One trick... achievement failed.',
      ],
      spicy: [
        'MY PACIFIST RUN! One stupid trick!',
        'Who put that trick in my inventory?! REFUND!',
      ],
    },
  },
}
