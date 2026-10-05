const crypto = require('crypto');

const BOWLER_TYPES = {
  pace: {
    label: 'Fast / Pace',
    deliveries: ['yorker', 'bouncer', 'good-length', 'slower-ball', 'wide-yorker']
  },
  swing: {
    label: 'Swing',
    deliveries: ['inswinger', 'outswinger', 'full-swing', 'slower-ball', 'cross-seam']
  },
  seam: {
    label: 'Seam',
    deliveries: ['good-length', 'back-of-length', 'off-cutter', 'leg-cutter', 'yorker']
  },
  offspin: {
    label: 'Off Spin',
    deliveries: ['off-break', 'arm-ball', 'top-spinner', 'quicker-ball', 'flighted']
  },
  legspin: {
    label: 'Leg Spin',
    deliveries: ['leg-break', 'googly', 'top-spinner', 'flipper', 'flighted']
  }
};

const VALID_STYLES = ['defensive', 'safe', 'aggressive', 'unorthodox'];
const VALID_DIRECTIONS = ['straight', 'cover', 'point', 'third', 'fine-leg', 'midwicket', 'square-leg', 'long-on'];
const VALID_KITS = ['royal', 'scarlet', 'emerald', 'gold', 'violet', 'teal'];
const LEGAL_OUTCOMES = ['W', 0, 1, 2, 3, 4, 6];

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function weightedPick(items, random = Math.random) {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let roll = random() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item.value;
  }
  return items[items.length - 1].value;
}

function scoreBall(delivery, style, direction, random = Math.random) {
  const styleBase = {
    defensive: { wicket: 3, dot: 58, one: 29, two: 8, three: 1, four: 1, six: 0 },
    safe: { wicket: 6, dot: 30, one: 34, two: 15, three: 2, four: 11, six: 2 },
    aggressive: { wicket: 16, dot: 20, one: 16, two: 10, three: 1, four: 24, six: 13 },
    unorthodox: { wicket: 20, dot: 18, one: 14, two: 10, three: 2, four: 20, six: 16 }
  };

  if (!styleBase[style]) throw new Error('Invalid batting style');
  if (!VALID_DIRECTIONS.includes(direction)) throw new Error('Invalid direction');

  const weights = { ...styleBase[style] };
  const straightFriendly = ['yorker', 'full-swing', 'flighted', 'top-spinner', 'arm-ball'];
  const offsideFriendly = ['outswinger', 'wide-yorker', 'leg-cutter', 'googly'];
  const legsideFriendly = ['inswinger', 'off-break', 'off-cutter', 'leg-break'];
  const shortBalls = ['bouncer', 'back-of-length', 'cross-seam', 'quicker-ball'];

  let matchup = 0;
  if (direction === 'straight' || direction === 'long-on') {
    matchup += straightFriendly.includes(delivery) ? 1 : 0;
    matchup -= delivery === 'bouncer' ? 1 : 0;
  }
  if (['cover', 'point', 'third'].includes(direction)) {
    matchup += offsideFriendly.includes(delivery) ? 1 : 0;
    matchup -= delivery === 'inswinger' ? 1 : 0;
  }
  if (['fine-leg', 'midwicket', 'square-leg'].includes(direction)) {
    matchup += legsideFriendly.includes(delivery) ? 1 : 0;
    matchup += shortBalls.includes(delivery) && ['square-leg', 'midwicket'].includes(direction) ? 1 : 0;
    matchup -= delivery === 'outswinger' && direction === 'fine-leg' ? 1 : 0;
  }

  if (matchup > 0) {
    weights.wicket = clamp(weights.wicket - 3 * matchup, 1, 50);
    weights.dot = clamp(weights.dot - 5 * matchup, 5, 70);
    weights.four += 5 * matchup;
    weights.six += style === 'aggressive' || style === 'unorthodox' ? 3 * matchup : 0;
    weights.one += 2 * matchup;
  } else if (matchup < 0) {
    const danger = Math.abs(matchup);
    weights.wicket += 5 * danger;
    weights.dot += 6 * danger;
    weights.four = clamp(weights.four - 4 * danger, 0, 50);
    weights.six = clamp(weights.six - 3 * danger, 0, 50);
  }

  if (delivery === 'yorker' && style === 'aggressive') {
    weights.wicket += 6;
    weights.six = clamp(weights.six - 4, 0, 50);
  }
  if (delivery === 'bouncer' && style === 'defensive') {
    weights.dot += 8;
    weights.wicket = clamp(weights.wicket - 1, 1, 50);
  }
  if (delivery === 'slower-ball' && style === 'aggressive') {
    weights.wicket += 5;
    weights.dot += 3;
  }
  if (['googly', 'flipper'].includes(delivery) && style === 'unorthodox') {
    weights.wicket += 4;
    weights.six += 3;
  }

  return weightedPick([
    { value: 'W', weight: weights.wicket },
    { value: 0, weight: weights.dot },
    { value: 1, weight: weights.one },
    { value: 2, weight: weights.two },
    { value: 3, weight: weights.three },
    { value: 4, weight: weights.four },
    { value: 6, weight: weights.six }
  ], random);
}

function extraChance(delivery) {
  const wides = {
    'wide-yorker': 0.09,
    outswinger: 0.045,
    inswinger: 0.035,
    bouncer: 0.035,
    'leg-break': 0.03,
    googly: 0.03,
    'off-break': 0.025,
    flighted: 0.02
  };
  const noBalls = {
    yorker: 0.022,
    bouncer: 0.024,
    'good-length': 0.018,
    'back-of-length': 0.018,
    'cross-seam': 0.016,
    'slower-ball': 0.014
  };
  return { wide: wides[delivery] || 0.012, noBall: noBalls[delivery] || 0.008 };
}

function dismissalType(delivery, direction, random = Math.random) {
  const caughtHeavy = ['bouncer', 'back-of-length', 'slower-ball', 'flighted', 'top-spinner'];
  const bowledHeavy = ['yorker', 'googly', 'flipper', 'off-break', 'leg-break'];
  const lbwHeavy = ['inswinger', 'full-swing', 'arm-ball', 'quicker-ball'];

  let bowled = bowledHeavy.includes(delivery) ? 48 : 25;
  let lbw = lbwHeavy.includes(delivery) ? 45 : 24;
  let caught = caughtHeavy.includes(delivery) ? 62 : 38;

  if (['cover', 'point', 'midwicket', 'square-leg', 'straight', 'long-on'].includes(direction)) caught += 12;
  if (delivery === 'yorker') bowled += 22;
  if (delivery === 'inswinger') lbw += 18;

  return weightedPick([
    { value: 'bowled', weight: bowled },
    { value: 'lbw', weight: lbw },
    { value: 'caught', weight: caught }
  ], random);
}

function simulateDelivery(delivery, style, direction, random = Math.random) {
  if (!VALID_STYLES.includes(style)) throw new Error('Invalid batting style');
  if (!VALID_DIRECTIONS.includes(direction)) throw new Error('Invalid direction');

  const extras = extraChance(delivery);
  const extraRoll = random();

  if (extraRoll < extras.wide) {
    return {
      outcome: 'WD',
      scoreDelta: 1,
      batRuns: 0,
      extras: 1,
      extraType: 'wide',
      legalBall: false,
      wicket: false,
      dismissalType: null,
      boundary: false
    };
  }

  if (extraRoll < extras.wide + extras.noBall) {
    let batOutcome = scoreBall(delivery, style, direction, random);
    if (batOutcome === 'W') batOutcome = 0;
    const batRuns = Number(batOutcome) || 0;
    return {
      outcome: batRuns ? `NB+${batRuns}` : 'NB',
      scoreDelta: 1 + batRuns,
      batRuns,
      extras: 1,
      extraType: 'no-ball',
      legalBall: false,
      wicket: false,
      dismissalType: null,
      boundary: batRuns === 4 || batRuns === 6
    };
  }

  const outcome = scoreBall(delivery, style, direction, random);
  if (outcome === 'W') {
    return {
      outcome: 'W',
      scoreDelta: 0,
      batRuns: 0,
      extras: 0,
      extraType: null,
      legalBall: true,
      wicket: true,
      dismissalType: dismissalType(delivery, direction, random),
      boundary: false
    };
  }

  return {
    outcome,
    scoreDelta: outcome,
    batRuns: outcome,
    extras: 0,
    extraType: null,
    legalBall: true,
    wicket: false,
    dismissalType: null,
    boundary: outcome === 4 || outcome === 6
  };
}

function resultDescription(result, style, direction, delivery) {
  const pretty = s => String(s).replaceAll('-', ' ').replace(/\b\w/g, c => c.toUpperCase());

  if (result.extraType === 'wide') {
    return `WIDE! The ${pretty(delivery)} misses the hitting arc. One extra and the ball must be bowled again.`;
  }
  if (result.extraType === 'no-ball') {
    if (result.batRuns === 6) return `NO-BALL + SIX! Free swing, huge strike over ${pretty(direction)}. Seven added.`;
    if (result.batRuns === 4) return `NO-BALL + FOUR! Crunched through ${pretty(direction)}. Five added.`;
    if (result.batRuns > 0) return `NO-BALL! ${result.batRuns} off the bat as well — ${result.scoreDelta} added in total.`;
    return `NO-BALL! One extra and another delivery is required.`;
  }

  if (result.wicket) {
    if (result.dismissalType === 'bowled') return `BOWLED! The ${pretty(delivery)} crashes into the stumps.`;
    if (result.dismissalType === 'lbw') return `LBW! The ${pretty(delivery)} pins the batter in front.`;
    return `CAUGHT! The ${pretty(style)} shot towards ${pretty(direction)} finds a fielder.`;
  }
  if (result.outcome === 0) return `Dot ball. ${pretty(delivery)} shuts down the ${pretty(direction)} option.`;
  if (result.outcome === 1) return `1 run worked into the ${pretty(direction)} region.`;
  if (result.outcome === 2) return `2 runs — good placement towards ${pretty(direction)}.`;
  if (result.outcome === 3) return `3 runs! They race back for a third.`;
  if (result.outcome === 4) return `FOUR! Cracked away towards ${pretty(direction)}.`;
  return `SIX! ${pretty(style)} and launched over ${pretty(direction)}!`;
}

module.exports = {
  BOWLER_TYPES,
  VALID_STYLES,
  VALID_DIRECTIONS,
  VALID_KITS,
  LEGAL_OUTCOMES,
  scoreBall,
  simulateDelivery,
  dismissalType,
  resultDescription
};
