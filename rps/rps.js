/*!
 * rps.js — じゃんけん（対コンピュータ）純粋ロジック
 * DOM非依存。node(require) と browser(window.createGame) の両方で動作する UMD モジュール。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    // Node / CommonJS
    module.exports = factory();
  } else {
    // Browser: window.createGame
    root.createGame = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var CHOICES = ['rock', 'paper', 'scissors'];

  // 何が何に勝つか（key が value に勝つ）
  var BEATS = {
    rock: 'scissors',   // グーはチョキに勝つ
    scissors: 'paper',  // チョキはパーに勝つ
    paper: 'rock'       // パーはグーに勝つ
  };

  // 純粋関数: プレイヤー視点の勝敗を返す ('win' | 'lose' | 'draw')
  function decide(player, computer) {
    if (BEATS[player] === undefined) {
      throw new Error('Invalid player choice: ' + player);
    }
    if (BEATS[computer] === undefined) {
      throw new Error('Invalid computer choice: ' + computer);
    }
    if (player === computer) return 'draw';
    return BEATS[player] === computer ? 'win' : 'lose';
  }

  // ファクトリ: 独立したゲームインスタンスを生成
  // options.rng: () => number in [0,1)  （テスト用に注入可能。既定は Math.random）
  function createGame(options) {
    options = options || {};
    var rng = typeof options.rng === 'function' ? options.rng : Math.random;

    var score = { wins: 0, losses: 0, draws: 0 };

    // コンピュータの手を乱数で独立に決定（プレイヤーの手に依存しない = 後出ししない）
    function computerChoice() {
      var idx = Math.floor(rng() * CHOICES.length);
      // rng() が 1 を返す等の境界に備えクランプ
      if (idx < 0) idx = 0;
      if (idx >= CHOICES.length) idx = CHOICES.length - 1;
      return CHOICES[idx];
    }

    // 1ラウンド実行し、結果を返す。スコアを累積更新する。
    function play(playerChoice) {
      if (BEATS[playerChoice] === undefined) {
        throw new Error('Invalid player choice: ' + playerChoice);
      }
      var computer = computerChoice();
      var result = decide(playerChoice, computer);
      if (result === 'win') score.wins += 1;
      else if (result === 'lose') score.losses += 1;
      else score.draws += 1;
      return { player: playerChoice, computer: computer, result: result };
    }

    function reset() {
      score.wins = 0;
      score.losses = 0;
      score.draws = 0;
    }

    return {
      choices: CHOICES.slice(),
      decide: decide,
      play: play,
      reset: reset,
      score: score
    };
  }

  // decide も直接使えるように付与
  createGame.decide = decide;
  createGame.CHOICES = CHOICES.slice();

  return createGame;
});
