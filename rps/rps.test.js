#!/usr/bin/env node
/**
 * rps.js — Self-test (じゃんけん純粋ロジック)
 * Pure Node, no test framework. Exit 0 = healthy.
 */
'use strict';
const assert = require('assert');
const path = require('path');

const createGame = require(path.join(__dirname, 'rps.js'));

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log('  \u2713 ' + name); pass++; }
  catch (e) { console.log('  \u2717 ' + name + '\n      ' + e.message); fail++; }
}

// rng マッピング: Math.floor(rng()*3) => 0=rock, 1=paper, 2=scissors
const MOVES = ['rock', 'paper', 'scissors'];
// 各手を確実に返す rng 値 (index/3 の中央)
const RNG_FOR = { rock: 1 / 6, paper: 3 / 6, scissors: 5 / 6 };
function fixedRng(move) { return function () { return RNG_FOR[move]; }; }

console.log('rps decide() — all 9 combinations (player perspective):');

// 期待値テーブル: [player][computer] => result
const EXPECT = {
  rock:     { rock: 'draw', paper: 'lose', scissors: 'win'  },
  paper:    { rock: 'win',  paper: 'draw', scissors: 'lose' },
  scissors: { rock: 'lose', paper: 'win',  scissors: 'draw' },
};

const g = createGame();
for (const p of MOVES) {
  for (const c of MOVES) {
    test(`decide(${p}, ${c}) === ${EXPECT[p][c]}`, () => {
      assert.strictEqual(g.decide(p, c), EXPECT[p][c]);
    });
  }
}

console.log('play() with injected deterministic rng:');

test('rng->rock: play(scissors) => computer rock, player loses', () => {
  const game = createGame({ rng: fixedRng('rock') });
  const r = game.play('scissors');
  assert.strictEqual(r.computer, 'rock');
  assert.strictEqual(r.player, 'scissors');
  assert.strictEqual(r.result, 'lose');
});

test('rng->paper: play(scissors) => computer paper, player wins', () => {
  const game = createGame({ rng: fixedRng('paper') });
  const r = game.play('scissors');
  assert.strictEqual(r.computer, 'paper');
  assert.strictEqual(r.result, 'win');
});

test('rng->scissors: play(scissors) => computer scissors, draw', () => {
  const game = createGame({ rng: fixedRng('scissors') });
  const r = game.play('scissors');
  assert.strictEqual(r.computer, 'scissors');
  assert.strictEqual(r.result, 'draw');
});

test('injected rng maps each value to the expected computer move', () => {
  for (const m of MOVES) {
    const game = createGame({ rng: fixedRng(m) });
    // play with a fixed player move; only check computer choice determinism
    assert.strictEqual(game.play('rock').computer, m, 'expected computer=' + m);
  }
});

console.log('score accumulates across several plays:');

test('wins/losses/draws accumulate correctly', () => {
  // computer は常に rock。 プレイヤー paper=win, scissors=lose, rock=draw
  const game = createGame({ rng: fixedRng('rock') });
  game.play('paper');    // win
  game.play('paper');    // win
  game.play('scissors'); // lose
  game.play('rock');     // draw
  game.play('rock');     // draw
  game.play('rock');     // draw
  assert.strictEqual(game.score.wins, 2, 'wins');
  assert.strictEqual(game.score.losses, 1, 'losses');
  assert.strictEqual(game.score.draws, 3, 'draws');
});

test('separate game instances keep independent scores', () => {
  const a = createGame({ rng: fixedRng('rock') });
  const b = createGame({ rng: fixedRng('rock') });
  a.play('paper'); // a wins
  assert.strictEqual(a.score.wins, 1);
  assert.strictEqual(b.score.wins, 0, 'b untouched');
});

console.log('reset() zeroes the score:');

test('reset() clears wins/losses/draws to zero', () => {
  const game = createGame({ rng: fixedRng('rock') });
  game.play('paper');    // win
  game.play('scissors'); // lose
  game.play('rock');     // draw
  assert.ok(game.score.wins + game.score.losses + game.score.draws === 3, 'precondition: 3 plays counted');
  game.reset();
  assert.strictEqual(game.score.wins, 0);
  assert.strictEqual(game.score.losses, 0);
  assert.strictEqual(game.score.draws, 0);
});

console.log('computer choice is always a valid move (invariant):');

test('over 300 random plays, computer choice ∈ {rock,paper,scissors}', () => {
  const game = createGame(); // real Math.random
  for (let i = 0; i < 300; i++) {
    const r = game.play(MOVES[i % 3]);
    assert.ok(MOVES.includes(r.computer), 'invalid computer move: ' + r.computer);
    assert.ok(['win', 'lose', 'draw'].includes(r.result), 'invalid result: ' + r.result);
  }
});

test('boundary rng values (0 and ~1) still yield valid moves', () => {
  const gLow = createGame({ rng: () => 0 });
  const gHigh = createGame({ rng: () => 0.9999999999 });
  assert.strictEqual(gLow.play('rock').computer, 'rock', 'rng=0 => rock');
  assert.ok(MOVES.includes(gHigh.play('rock').computer), 'rng~1 clamps to a valid move');
});

// --- report ---
console.log(`\nrps self-test: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
