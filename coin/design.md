# 設計書（design.md）

**対象:** コイン投げ（表か裏か）予想ゲーム
**フェーズ:** design（どう作るか）
**上流の根拠:** [requirements.md](./requirements.md)（AC-1..AC-17）

---

## 1. 状態モデル（State Model）

ゲームの中核状態は純粋ロジック `coin.js` が保持する。UI（`index.html`）は状態の描画に徹する。

| 状態 | 型 | 意味 | 対応 AC |
|------|----|------|---------|
| `chosen` | `'heads' \| 'tails'` | ユーザーが選んだ予想の側 | AC-1, AC-2 |
| `flipped` | `'heads' \| 'tails'` | コインを投げた結果の側 | AC-4, AC-7 |
| `correct` | `boolean` | `chosen === flipped` なら true（当たり） | AC-9, AC-10 |
| `score.correct` | `number` | 累計正解数 | AC-12, AC-14 |
| `score.incorrect` | `number` | 累計不正解数 | AC-12, AC-14 |
| `score.streak` | `number` | 現在の連勝数（当たりで+1、外れで0） | AC-13 |

- `flipped` は乱数 `rng()`（既定 `Math.random`）で決定。`rng() < 0.5 → 'heads'`、それ以外 `'tails'`。50/50 の公平抽選で両面が出得る（AC-5, AC-6）。
- 状態は明示的 `reset()` があるまで保持される（AC-16）。

---

## 2. 関数シグネチャ（Function Signatures）

### ファクトリ
```js
createGame({ rng = Math.random } = {}) -> game
```
- `rng`: 注入可能な乱数生成器（テスト用に固定可能）。`[0,1)` を返す想定。

### game オブジェクト
```js
game.guess(side)   // side: 'heads' | 'tails'
  //  → { chosen, flipped, correct }
  //  無効な side は Error を投げる（AC-3: 予想なしのラウンドを確定させない）

game.score
  //  → { correct, incorrect, streak }  読み取り可能なコピー（AC-14）

game.reset()
  //  → スコアと直近結果を初期状態（0/0/0）に戻す
```

### 内部ヘルパ
```js
flip(rng) -> 'heads' | 'tails'   // rng() < 0.5 ? 'heads' : 'tails'（AC-4, AC-5）
```

---

## 3. UI ↔ 状態 マッピング（UI-to-State Mapping）

| UI 要素 | 動作 | 呼び出し / 反映 | 対応 AC |
|---------|------|-----------------|---------|
| Heads ボタン | クリック | `game.guess('heads')` | AC-1, FR-1 |
| Tails ボタン | クリック | `game.guess('tails')` | AC-1, FR-1 |
| 選択中ハイライト | 直近 `chosen` を強調表示 | `chosen` を描画 | AC-2 |
| コインビジュアル | 投げアニメ後に `flipped` を表示 | `flipped` を描画 | AC-7, AC-8 |
| 判定テキスト | 当たり=緑 / 外れ=赤 | `correct` の真偽で色分け | AC-4, AC-9, AC-10 |
| スコアボード | correct / incorrect / streak を表示 | `game.score` を描画 | AC-12, AC-13, AC-14 |
| Reset ボタン | クリック | `game.reset()` → 画面初期化 | 明示リセット |
| 次ラウンド | いずれかのボタン再クリックだけで開始 | `guess()` 再呼び出し（リロード不要） | AC-15, AC-16 |

- クライアント完結（AC-17）: すべてローカルで動作し、サーバ・DB・ログインを持たない。
- ボタン未クリック時は `guess()` が呼ばれず、予想なしのラウンドは確定しない（AC-3）。

---

## 4. 検証方針

`coin.js` は DOM 非依存の純粋ロジックのため node で単体検証する:
- `rng=()=>0` で `flipped==='heads'`、`rng=()=>0.999` で `flipped==='tails'`（両面到達, AC-5）。
- 予想一致で `correct===true`・`score.correct++`・`streak++`（AC-9, AC-12, AC-13）。
- 予想不一致で `correct===false`・`streak===0`（AC-10, AC-13）。
