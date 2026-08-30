# 設計書（Design）— じゃんけんゲーム（対コンピュータ）

本書は `requirements.md`（AC-1〜AC-20）を入力とし、**どう作るか**を定義する。基本設計（アーキテクチャ・状態モデル）と詳細設計（関数シグネチャ・UIマッピング）を含む。

---

## 1. 基本設計（Architecture）

### 1.1 構成方針

- **完全クライアント完結・静的**（AC-20）。ネットワーク／サーバ／外部API不要。
- **2レイヤ分離**:
  - `rps.js` … 純粋ロジック層（DOM非依存）。node/browser 両対応の UMD モジュール。テスト可能。
  - `index.html` … プレゼンテーション層。`rps.js` を `<script src="rps.js">` で読み込み、UIを状態に束ねる。自己完結CSS、外部CDN/フォントなし。
- **依存注入**: コンピュータの手の乱数源 `rng` を `createGame({rng})` で差し替え可能にし、決定性テストを実現（AC-2/AC-3 検証を容易化）。

### 1.2 ファイル一覧

| ファイル | 役割 | 依存 |
|---|---|---|
| `rps.js` | 勝敗判定・スコア累積・コンピュータ手決定 | なし（純粋） |
| `index.html` | ボタン/表示/キーボード/リセットのUI | `rps.js` |
| `design.md` | 本設計書 | `requirements.md` |

---

## 2. 状態モデル（State Model）

### 2.1 ドメイン値

- **手（choice）**: `'rock' | 'paper' | 'scissors'`（グー／パー／チョキ）。
- **結果（result）**: `'win' | 'lose' | 'draw'`（プレイヤー視点）。

### 2.2 ゲーム状態（`rps.js` が保持）

```
GameState {
  score: {
    wins:   number,  // プレイヤー勝ち累計（AC-13/14）
    losses: number,  // プレイヤー負け累計（＝コンピュータ勝ち）
    draws:  number,  // あいこ累計
  }
}
```

- `score` はラウンドをまたいで累積（AC-15）。`reset()` で全て 0（AC-16）。
- 1ラウンドの一時状態（player/computer/result）は `play()` の戻り値として返し、内部には保持しない（表示はUI層の責務）。

### 2.3 UI状態（`index.html` が保持）

```
UIState {
  lastRound: { player, computer, result } | null,  // 直近ラウンド
  score: 上記 score の参照,
}
```

---

## 3. 詳細設計（Core Functions）

### 3.1 `rps.js` — 公開API

#### `createGame(options?) → game`
- `options.rng?: () => number` … `[0,1)` を返す乱数関数。省略時 `Math.random`。
- 返り値 `game` は下記メソッド／プロパティを持つ。

#### `game.decide(player, computer) → 'win' | 'lose' | 'draw'`（純粋関数）
- 勝ちルール（AC-4〜6）: `rock>scissors`, `scissors>paper`, `paper>rock`。
- 同手なら `draw`（AC-10）。それ以外は `lose`（AC-7〜9）。
- 全9通り一意（AC-4〜10）。副作用なし・スコア不変。

実装コア:
```
BEATS = { rock:'scissors', scissors:'paper', paper:'rock' }
decide(p,c): p===c ? 'draw' : (BEATS[p]===c ? 'win' : 'lose')
```

#### `game.play(playerChoice) → { player, computer, result }`
- `computer` を `rng` から独立生成（後出ししない・AC-3）。`CHOICES[floor(rng()*3)]`。
- `result = decide(playerChoice, computer)`。
- `result` に応じ `score.wins/losses/draws` を +1（AC-14）。
- 戻り値: `{ player: playerChoice, computer, result }`（AC-11/12 の表示元）。
- 不正な `playerChoice` は `Error` を投げる。

#### `game.score → { wins, losses, draws }`
- 読み取り可能な累積スコアオブジェクト（AC-13）。

#### `game.reset() → void`
- `wins=losses=draws=0`（AC-16）。

### 3.2 UMD ガード

```
(function(root, factory){
  if (typeof module==='object' && module.exports) module.exports = factory(); // node
  else root.createGame = factory();                                          // browser (window)
})(typeof self!=='undefined'?self:this, function(){ ... return createGame; });
```

- node: `const { createGame } = require('./rps.js')` もしくは `require('./rps.js')`（関数を直接エクスポート、`createGame` プロパティも付与）。
- browser: `window.createGame`。

---

## 4. UI ↔ 状態マッピング（index.html）

| UI要素 | バインド先 / 動作 | 対応AC |
|---|---|---|
| グー/チョキ/パー ボタン ×3 | クリックで `play(choice)` 実行→再描画 | AC-1, AC-17 |
| キーボード R/P/S・1/2/3 | 同上（同じ `play` 経路） | AC-18 |
| プレイヤーの手 表示 | `lastRound.player`、選択ボタンをハイライト | AC-12, AC-17 |
| コンピュータの手 表示 | `lastRound.computer`（並べて表示） | AC-12 |
| 結果ラベル WIN/LOSE/DRAW | `lastRound.result`、色分け（win=緑/lose=赤/draw=灰） | AC-11 |
| スコアボード 勝/負/分 | `score.wins/losses/draws` を常時表示 | AC-13, AC-14 |
| Reset ボタン | `reset()`→スコア0・表示クリア | AC-16 |
| 起動時 | 追加操作なしで即プレイ可能（DOMContentLoadedで `createGame()`） | AC-19 |

### 4.1 描画フロー
1. 入力（クリック/キー）→ `game.play(choice)` 呼び出し。
2. 戻り値と `game.score` を UIState に反映。
3. `render()` が手・結果・色・スコア・ボタンハイライトを更新。

### 4.2 色設計（結果アクセント）
- win → 緑（`#2ecc71`系）、lose → 赤（`#e74c3c`系）、draw → 灰（`#95a5a6`系）。
- ダークテーマ基調（背景 `#0f1218` 系）。

---

## 5. テスト戦略

- **決定性テスト**: `createGame({rng})` に固定シーケンスを注入し、`computer` の手・`result`・`score` 累積を検証。
- **純粋性テスト**: `decide` の全9通りを表明（AC-4〜10）。
- **偏り非依存**: `computer` は `playerChoice` を参照しないことをコードレビューで保証（AC-3）。
- node 一発検証: `require('./rps.js')` で `decide` 表明＋固定rngでラウンドを回しスコア加算を確認。

---

## 6. トレーサビリティ（AC → 実装箇所）

| AC | 実装 |
|---|---|
| AC-1, AC-17, AC-18 | index.html ボタン/キーボード/ハイライト |
| AC-2, AC-3 | `play()` の rng 独立生成 |
| AC-4〜10 | `decide()` |
| AC-11, AC-12 | index.html 結果ラベル・手対比表示 |
| AC-13, AC-14 | `score` + `play()` 加算 |
| AC-15 | `score` 累積（play間で不変破棄しない） |
| AC-16 | `reset()` + Resetボタン |
| AC-19 | DOMContentLoaded 即時初期化 |
| AC-20 | 外部依存なし・静的 |
