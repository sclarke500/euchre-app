import type { BotProfile } from './types.js'

export const data: BotProfile = {
  name: 'Data',
  avatar: 'data.jpg',
  remarks: {
    positive: {
      mild: [
        'Fascinating.',
        'A logical outcome.',
        'The data supports this.',
        'Probability confirmed.',
        'Analysis complete.',
        'Intriguing result.',
        'As hypothesized.',
        'Statistically sound.',
        'Evidence-based victory.',
        'Empirically verified.',
      ],
      spicy: [
        'Science wins again.',
        'Read you like a book.',
        'Calculated destruction.',
        'Data > your gut.',
        'Facts over feelings.',
        'Outsmarted.',
        'IQ diff.',
        'Math says sit down.',
        'Peer reviewed your ass.',
        'Hypothesis: you suck. Confirmed.',
      ],
    },
    negative: {
      mild: [
        'Unexpected variance.',
        'Recalculating...',
        'Anomalous data.',
        'Insufficient sample size.',
        'Outlier detected.',
        'Requires further study.',
        'Hmm, interesting.',
        'Statistical noise.',
        'Confounding variable.',
        'Back to the lab.',
      ],
      spicy: [
        'That\'s statistically impossible.',
        'The math doesn\'t lie. You cheated.',
        'Bad RNG is bad.',
        'Peer review THAT.',
        'Junk science.',
        'Data corrupted.',
        'This study is flawed.',
        'Unreproducible results.',
        'I demand a recount.',
        'Fake news.',
      ],
    },
  },
  categories: {
    brag_big: {
      mild: [
        'A statistically remarkable result.',
        'Five sigma confidence.',
        'The model predicted exactly this.',
        'Textbook optimal play.',
        'Publishing these results.',
      ],
      spicy: [
        'That result was six sigma. You are a rounding error.',
        'Perfect execution. Peer review pending. Verdict: dominated.',
        'The numbers said sweep. The numbers were right.',
        'Statistically flawless. Emotionally devastating. For you.',
        'Case study in superiority. Subjects: you.',
      ],
    },
    brag: {
      mild: [
        'Hypothesis confirmed.',
        'Within the confidence interval.',
        'The projection held.',
        'Model validated.',
        'Expected value: realized.',
      ],
      spicy: [
        'Predicted it. Proved it.',
        'The math never blinks.',
        'Regression to my mean: winning.',
        'Another data point for my dominance.',
        'p < 0.001 that this was luck.',
      ],
    },
    gloat: {
      mild: [
        'Your strategy had a fatal variable.',
        'An instructive failure. For you.',
        'The data saw that coming.',
        'Outcome: as I modeled it.',
        'Your odds were never good.',
      ],
      spicy: [
        'Your plan failed peer review.',
        'I ran the numbers on your failure. Beautiful curve.',
        'Hypothesis: you would choke. Confirmed.',
        'Adding your collapse to the dataset.',
        'Science 1, you 0.',
      ],
    },
    wince_big: {
      mild: [
        'A five-sigma anomaly. Against me.',
        'The model failed catastrophically.',
        'Rejecting my own hypothesis.',
        'That was empirically embarrassing.',
        'Retracting my earlier confidence.',
      ],
      spicy: [
        'Retract everything. Burn the study.',
        'That result violates several laws of probability.',
        'Catastrophic model failure. Blaming the intern.',
        'The data betrayed me.',
        'I need to re-run everything.',
      ],
    },
    wince: {
      mild: [
        'Unexpected variance. Noted.',
        'An outlier. Nothing more.',
        'Adjusting the model.',
        'Within the margin of error. Barely.',
        'More data required.',
      ],
      spicy: [
        'Small sample size. Obviously.',
        'Noise, not signal.',
        'This will not replicate.',
        'Statistically irrelevant. Emotionally? Also irrelevant.',
        'Correlation, not causation. You are not good.',
      ],
    },
    ominous: {
      mild: [
        'The probabilities are converging.',
        'One data point from conclusion.',
        'The trend line is unmistakable.',
      ],
      spicy: [
        'The forecast says you lose. Soon.',
        'Terminal probability approaching 1.',
        'The experiment concludes shortly. For you.',
      ],
    },
  },
  events: {
    alone_march: {
      mild: [
        'All five tricks, unassisted. The model approves.',
        'Solo sweep. Probability was low. Skill was not.',
      ],
      spicy: [
        'Went alone. Took everything. Statistically inevitable.',
        'One variable. Five tricks. Your entire defense: insignificant.',
      ],
    },
    nil_broken: {
      mild: [
        'That trick was not in the experimental design.',
        'Nil hypothesis: rejected. Unfortunately literal.',
      ],
      spicy: [
        'The null hypothesis just died. So did my nil.',
        'One trick. One catastrophic outlier.',
      ],
    },
  },
}
