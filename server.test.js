const test = require('node:test');
const assert = require('node:assert/strict');
const { BOWLER_TYPES, LEGAL_OUTCOMES, scoreBall, simulateDelivery } = require('./gameLogic');

test('all bowler types expose five deliveries', () => {
  for (const type of Object.values(BOWLER_TYPES)) assert.equal(type.deliveries.length, 5);
});

test('scoreBall returns a legal bat outcome', () => {
  const legal = new Set(LEGAL_OUTCOMES);
  for (let i = 0; i < 250; i++) assert.ok(legal.has(scoreBall('yorker', 'aggressive', 'straight')));
});

test('wide adds one run and does not consume a legal ball', () => {
  const result = simulateDelivery('wide-yorker', 'safe', 'cover', () => 0);
  assert.equal(result.extraType, 'wide');
  assert.equal(result.scoreDelta, 1);
  assert.equal(result.legalBall, false);
});

test('no-ball adds an extra and does not consume a legal ball', () => {
  const result = simulateDelivery('yorker', 'safe', 'straight', () => 0.02);
  assert.equal(result.extraType, 'no-ball');
  assert.equal(result.extras, 1);
  assert.equal(result.legalBall, false);
  assert.ok(result.scoreDelta >= 1);
});

test('wickets include a dismissal type', () => {
  let first = true;
  const result = simulateDelivery('yorker', 'aggressive', 'straight', () => {
    if (first) { first = false; return 0.99; }
    return 0;
  });
  assert.equal(result.wicket, true);
  assert.ok(['bowled', 'lbw', 'caught'].includes(result.dismissalType));
  assert.equal(result.legalBall, true);
});
