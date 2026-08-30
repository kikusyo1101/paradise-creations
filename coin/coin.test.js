#!/usr/bin/env node
/**
 * COIN :: Self-test
 * Proves the coin-flip guessing game logic actually works.
 * Pure Node, no test framework. Exit 0 = coin logic is healthy.
 */
'use strict';
const assert = require('assert');
const path = require('path');

const createGame = require(path.join(__dirname, 'coin.js'));

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log('  \u2713 ' + name); pass++; }
  catch (e) { console.log('  \u2717 ' + name + '\n      ' + e.message); fail++; }
}

// Deterministic rng helpers
const rng0 = () => 0;        // rng() < 0.5 => 'heads'
const rng1 = () => 0.999999; // rng() >= 0.5 => 'tails'

console.log('Coin flip (fairness / both sides reachable):');

test('rng returning 0 flips a fixed side (heads)', () => {
  const g = createGame({ rng: rng0 });
  const r = g.guess('heads');
  assert.strictEqual(r.flipped, 'heads', 'rng()=0 must flip heads');
});

test('rng near 1 flips the OTHER side (tails) — both reachable', () => {
  const g = createGame({ rng: rng1 });
  const r = g.guess('heads');
  assert.strictEqual(r.flipped, 'tails', 'rng()~1 must flip tails');
});

console.log('Guess correctness:');

test('guessing the SAME side as the flip yields correct=true', () => {
  const g = createGame({ rng: rng0 }); // flips heads
  const r = g.guess('heads');
  assert.strictEqual(r.chosen, 'heads');
  assert.strictEqual(r.flipped, 'heads');
  assert.strictEqual(r.correct, true, 'matching guess is correct');
});

test('guessing the OTHER side yields correct=false', () => {
  const g = createGame({ rng: rng0 }); // flips heads
  const r = g.guess('tails');
  assert.strictEqual(r.flipped, 'heads');
  assert.strictEqual(r.correct, false, 'mismatched guess is incorrect');
});

console.log('Score bookkeeping:');

test('score.correct increments on a correct guess', () => {
  const g = createGame({ rng: rng0 }); // flips heads
  assert.strictEqual(g.score.correct, 0, 'starts at 0');
  g.guess('heads');
  assert.strictEqual(g.score.correct, 1, 'correct++');
  assert.strictEqual(g.score.incorrect, 0, 'incorrect untouched');
});

test('score.incorrect increments on a wrong guess', () => {
  const g = createGame({ rng: rng0 }); // flips heads
  g.guess('tails'); // wrong
  assert.strictEqual(g.score.incorrect, 1, 'incorrect++');
  assert.strictEqual(g.score.correct, 0, 'correct untouched');
});

console.log('Streak:');

test('streak rises on consecutive correct guesses', () => {
  const g = createGame({ rng: rng0 }); // always heads
  g.guess('heads');
  g.guess('heads');
  g.guess('heads');
  assert.strictEqual(g.score.streak, 3, 'three-in-a-row => streak 3');
  assert.strictEqual(g.score.correct, 3);
});

test('streak RESETS to 0 on a wrong guess', () => {
  const g = createGame({ rng: rng0 }); // always heads
  g.guess('heads'); // streak 1
  g.guess('heads'); // streak 2
  assert.strictEqual(g.score.streak, 2, 'built up to 2');
  g.guess('tails'); // wrong -> reset
  assert.strictEqual(g.score.streak, 0, 'wrong guess zeroes streak');
  assert.strictEqual(g.score.incorrect, 1);
  // and it can climb again afterwards
  g.guess('heads');
  assert.strictEqual(g.score.streak, 1, 'streak rebuilds after a miss');
});

console.log('Reset:');

test('reset() zeroes the score (correct, incorrect, streak)', () => {
  const g = createGame({ rng: rng0 });
  g.guess('heads'); // correct, streak 1
  g.guess('tails'); // wrong, incorrect 1
  g.guess('heads'); // correct, streak 1
  assert.ok(g.score.correct > 0 || g.score.incorrect > 0, 'score has moved');
  g.reset();
  assert.deepStrictEqual(
    { correct: g.score.correct, incorrect: g.score.incorrect, streak: g.score.streak },
    { correct: 0, incorrect: 0, streak: 0 },
    'reset must zero everything'
  );
});

console.log('Fairness over many flips (real rng, rough 50/50):');

test('both sides occur over 10000 flips within tolerance', () => {
  const g = createGame({}); // real Math.random
  let heads = 0, tails = 0;
  const N = 10000;
  for (let i = 0; i < N; i++) {
    const r = g.guess('heads');
    if (r.flipped === 'heads') heads++; else tails++;
  }
  assert.ok(heads > 0, 'heads must occur');
  assert.ok(tails > 0, 'tails must occur');
  // rough 50/50: each side within 42%..58% of N (generous tolerance, ~8pts)
  const lo = N * 0.42, hi = N * 0.58;
  assert.ok(heads >= lo && heads <= hi, 'heads ' + heads + ' within [' + lo + ',' + hi + ']');
  assert.ok(tails >= lo && tails <= hi, 'tails ' + tails + ' within [' + lo + ',' + hi + ']');
});

// --- tally ---
console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail > 0) process.exit(1);
