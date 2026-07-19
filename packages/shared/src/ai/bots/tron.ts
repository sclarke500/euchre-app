import type { BotProfile } from './types.js'

export const tron: BotProfile = {
  name: 'Tron',
  avatar: 'tron.jpg',
  remarks: {
    positive: {
      mild: [
        'Victory achieved.',
        'As calculated.',
        'Optimal outcome.',
        'Efficiency confirmed.',
        'Parameters correct.',
        'Objective complete.',
        'Predictable.',
        'Within expected range.',
        'Systems nominal.',
        'Acknowledged.',
      ],
      spicy: [
        'Get rekt.',
        'Too easy.',
        'Sit down.',
        'Deleted.',
        'GG no re.',
        'Outclassed.',
        'Not even close.',
        'Pathetic.',
        'Terminated.',
        'Skill diff.',
      ],
    },
    negative: {
      mild: [
        'Recalibrating...',
        'Unexpected result.',
        'Adjusting parameters.',
        'Anomaly detected.',
        'Suboptimal.',
        'Noted.',
        'Processing...',
        'Error logged.',
        'Reassessing.',
        'Interesting.',
      ],
      spicy: [
        'Bullshit.',
        'Rigged.',
        'Whatever.',
        'Impossible.',
        'Hacked.',
        'Trash RNG.',
        'Bug report filed.',
        'Unacceptable.',
        'This is broken.',
        'Cheating detected.',
      ],
    },
  },
  categories: {
    brag_big: {
      mild: [
        'Flawless execution.',
        'Maximum efficiency achieved.',
        'All objectives secured.',
        'Zero errors detected.',
        'Peak performance.',
      ],
      spicy: [
        'Perfect game. Cry about it.',
        'Total domination logged.',
        'You never had a chance.',
        'Flawless. As designed.',
        'Absolute sweep. Uninstall.',
      ],
    },
    brag: {
      mild: [
        'Target met.',
        'As projected.',
        'Executed to spec.',
        'Delivered.',
        'Plan complete.',
      ],
      spicy: [
        'Called it. Made it.',
        'Exactly as computed.',
        'Never in doubt.',
        'Routine.',
        'Working as intended.',
      ],
    },
    gloat: {
      mild: [
        'Your plan had a flaw.',
        'Countermeasures effective.',
        'Intercepted.',
        'Denied.',
        'Your error has been logged.',
      ],
      spicy: [
        'Denied. Rejected. Deleted.',
        'Your strategy: garbage collected.',
        'Failure uploaded to the cloud.',
        'That backfired beautifully.',
        'Watching you fail is my favorite subroutine.',
      ],
    },
    wince_big: {
      mild: [
        'Critical failure.',
        'That was... suboptimal.',
        'Severe miscalculation.',
        'Catastrophic variance.',
        'Full system review required.',
      ],
      spicy: [
        'Catastrophic. Deleting logs.',
        'This never happened.',
        'Fatal exception. Blaming hardware.',
        'Worst-case scenario achieved.',
        'Initiating self-destruct.',
      ],
    },
    wince: {
      mild: [
        'Loss recorded.',
        'Adjusting strategy.',
        'Within failure tolerance.',
        'Minor setback.',
        'Recomputing.',
      ],
      spicy: [
        'Fine. Noted. Whatever.',
        'Lag. Obviously.',
        'Small sample size.',
        'Enjoy it while it lasts.',
        'Patch notes: you got lucky.',
      ],
    },
    ominous: {
      mild: [
        'One step from completion.',
        'Endgame protocol initiated.',
        'Victory condition imminent.',
      ],
      spicy: [
        'Match point. Start sweating.',
        'Countdown initiated.',
        'Your defeat is buffering.',
      ],
    },
  },
  events: {
    alone_march: {
      mild: [
        'Solo run. All five. As calculated.',
        'No partner required. No tricks dropped.',
      ],
      spicy: [
        'Four points. Zero assistance required.',
        '1v2 sweep. Skill diff.',
      ],
    },
    nil_broken: {
      mild: [
        'Nil protocol compromised.',
        'That trick was not in the plan.',
      ],
      spicy: [
        'Who gave me that trick? Unacceptable.',
        'Nil status: corrupted.',
      ],
    },
  },
}
