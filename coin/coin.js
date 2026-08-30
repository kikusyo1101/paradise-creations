// coin.js — Pure coin-flip guessing game logic (no DOM).
// UMD guard: works via require() in Node and window.createGame in the browser.
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.createGame = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SIDES = ['heads', 'tails'];

  function isValidSide(side) {
    return side === 'heads' || side === 'tails';
  }

  // Fair 50/50 flip using injected rng. Both sides reachable.
  function flip(rng) {
    return rng() < 0.5 ? 'heads' : 'tails';
  }

  function createGame(opts) {
    opts = opts || {};
    var rng = typeof opts.rng === 'function' ? opts.rng : Math.random;

    var _score = { correct: 0, incorrect: 0, streak: 0 };

    function guess(side) {
      if (!isValidSide(side)) {
        throw new Error("guess(side): side must be 'heads' or 'tails'");
      }
      var flipped = flip(rng);
      var correct = side === flipped;
      if (correct) {
        _score.correct += 1;
        _score.streak += 1;
      } else {
        _score.incorrect += 1;
        _score.streak = 0;
      }
      return { chosen: side, flipped: flipped, correct: correct };
    }

    function reset() {
      _score.correct = 0;
      _score.incorrect = 0;
      _score.streak = 0;
    }

    return {
      guess: guess,
      reset: reset,
      // readable score object (fresh copy so callers can't mutate internals)
      get score() {
        return { correct: _score.correct, incorrect: _score.incorrect, streak: _score.streak };
      },
      SIDES: SIDES.slice()
    };
  }

  return createGame;
});
