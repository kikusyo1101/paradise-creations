# 習慣トラッカー — detail フェーズ タスク分解 (tasks.md)

- **成果物**: 単一 HTML ファイル `app.html`(依存ゼロ・ビルド不要・オフライン動作・localStorage 永続化)
- **担当**: priest (詳細設計 / 実装計画)
- **作成日**: 2026-08-31
- **唯一の根拠**: `design.md`(design フェーズ)および `requirements.md`(specify フェーズ)。本書に design.md へ根拠を持たない実装項目は書かない。
- **本書のスコープ**: 実装順序とタスク分解まで。**コード本体は書かない**。

> **ファイル名に関する注記(重要)**
> design.md 本文および AC-01/04/15/17 の検証コマンド例は成果物を `index.html` と記述しているが、本 creation の成果物ファイル名は **`app.html`** である。両者は同一の「単一 HTML ファイル」を指す。以降、AC の grep 検証はすべて対象を `creations/habit/app.html` に読み替えて実施する(T-34 で明示)。この読み替え以外に design.md からの逸脱はない。

---

## 0. 実装順序の全体像

design.md §1-2 のレイヤ依存(下位は上位を知らない)をそのままタスク順序に写す。

```
Phase A: 骨格          T-01 〜 T-02      (HTML 構造 / CSS 基盤)
Phase B: domain 層     T-03 〜 T-09      (純粋関数のみ。DOM も localStorage も触らない)
Phase C: テスト        T-10 〜 T-14      (node で domain 層を検証。以降のフェーズの前提)
Phase D: store 層      T-15 〜 T-19      (localStorage I/O・検証・永続化)
Phase E: render 層     T-20 〜 T-27      (state → DOM。domain のみに依存)
Phase F: event 層      T-28 〜 T-35      (操作 → commit → save + render)
Phase G: 仕上げ・検証  T-36 〜 T-41      (AC-01〜32 の機械検証)
```

**依存の不変条件**: どのタスクも「依存タスク」に挙げたタスクが完了していなければ着手できない。Phase B の domain 関数は Phase C で node 検証に合格するまで、Phase E/F から利用しない。

### ファイル構成(本フェーズで作られるファイル)

| パス | 役割 |
|---|---|
| `creations/habit/app.html` | 成果物本体(単一ファイル) |
| `creations/habit/test.js` | domain 層の純粋関数テスト(node で実行。**成果物には含めない**、検証用) |

`test.js` は成果物ディレクトリの「1ファイル制約」(AC-18)の対象外である。AC-18 の検証時は「配布対象 = `app.html` 単体で `file://` から動作すること」を確認し、`test.js` は開発時検証専用の副産物として扱う(T-38 で明示的に確認する)。

---

## 1. タスク一覧

### Phase A — 骨格

---

#### T-01 単一 HTML ファイルの骨格と DOM 構造

- **【対象】** `app.html`(`<head>` / `<body>` の静的構造)
- **【実装内容】**
  - design.md §1-1 の構造をそのまま静的 HTML として置く: `<header>`(タイトル / 設定 / テーマ切替)、`<main>` 配下に `#storage-warning`(既定 `hidden`)、`#today-section`、`#empty-state`、`#heatmap-section`、`#settings-section`、末尾に `<div id="tooltip" role="tooltip" hidden>`。
  - `aria-live="polite"` の通知領域(design.md §7-3)を1つ置く。
  - `<meta charset="utf-8">`、`<meta name="viewport" content="width=device-width, initial-scale=1">`、`lang="ja"`。
  - `<style>` と `<script>` はインラインのみ。外部参照(`<script src>` / `<link rel="stylesheet">` / `@import` / Web フォント)を一切書かない。
- **【依存タスク】** なし
- **【完了条件(機械検証可能)】**
  1. `creations/habit/` 配下の配布対象ファイルが `app.html` の1つ(`test.js` を除く)。
  2. `grep -nE "<script[^>]+src=|<link[^>]+stylesheet|@import|fetch\(|XMLHttpRequest" app.html` が **0件**。
  3. `document.querySelector` で `#storage-warning` / `#today-section` / `#empty-state` / `#heatmap-section` / `#settings-section` / `#tooltip` の6要素がすべて非 null。
  4. `file://` で開いてコンソールエラー 0 件。
- **【紐づく AC】** AC-17, AC-18

---

#### T-02 CSS 基盤(カスタムプロパティ・テーマ・Grid 定義)

- **【対象】** `app.html` の `<style>`
- **【実装内容】**
  - design.md §5-3 の `--level-0` 〜 `--level-4` をライト値で定義。`@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { … } }` と `:root[data-theme="dark"] { … }` の両方にダーク値を定義。
  - `--cell: 13px` / `--cell-gap: 3px` / `--focus` / `--offday-line` を定義。`--cell` の下限は 12px(メディアクエリで縮める場合も 12px を下回らせない)。
  - `.hm-grid { display: grid; grid-template-rows: repeat(7, var(--cell)); grid-auto-flow: column; grid-auto-columns: var(--cell); gap: var(--cell-gap); }`
  - `.hm-cell[data-level="0".."4"]` の背景を属性セレクタで指定。`data-level="0"` は**不透明色**。
  - `.hm-cell[data-offday="true"]`(内枠線)、`[data-state="skip"]`(ハッチング)、`[data-future="true"]`(opacity 低下)、`:focus-visible`(outline)を定義。
  - `.hm-scroll { overflow-x: auto; }` — `overflow-x` を持つ要素は**この1つだけ**。
  - フォントはシステムフォントスタックのみ。
- **【依存タスク】** T-01
- **【完了条件(機械検証可能)】**
  1. `grep -c -- "--level-" app.html` が 10 以上(ライト5 + ダーク5)。
  2. `grep -nE "overflow-x" app.html` のヒットが `.hm-scroll` 由来のみ(1セレクタ)。
  3. `grep -nE "@font-face|fonts\.googleapis|fonts\.gstatic" app.html` が 0件。
  4. `grep -n "grid-auto-flow: *column" app.html` が1件以上。
- **【紐づく AC】** AC-09(下地), AC-25(下地), AC-29, AC-17

---

### Phase B — domain 層(純粋関数のみ)

> Phase B の全関数は「引数だけで結果が決まる」こと。`getTodayKey()` を除き **`new Date()` を引数なしで呼ばない**。DOM / localStorage / `state` グローバルを参照しない。

---

#### T-03 日付ユーティリティ(基礎)

- **【対象】** domain 層: `localDateKey(d)` / `getTodayKey()` / `parseKey(key)` / `addDays(key, n)` / `dayOfWeek(key)` / `diffDays(a, b)`
- **【実装内容】**
  - `localDateKey`: `getFullYear()` / `getMonth()+1` / `getDate()` をゼロ埋め連結。**`toISOString` / `toJSON` を使わない**。日付キー生成はこの関数のみ。
  - `getTodayKey`: `localDateKey(new Date())`。アプリ内で `new Date()` を引数なしで呼ぶ**唯一の場所**。
  - `addDays`: `parseKey` → `new Date(y, m-1, d+n)` → `localDateKey`。**ミリ秒定数を使わない**。
  - `diffDays`: 両端を `new Date(y, m-1, d, 12, 0, 0)` の正午基準で構築して日数差を算出(DST 対策)。
- **【依存タスク】** なし(T-01 と並行可)
- **【完了条件(機械検証可能)】**
  1. `grep -nE "toISOString|toJSON" app.html` が **0件**。
  2. `grep -nE "86400000|864e5|24 ?\* ?60 ?\* ?60 ?\* ?1000" app.html` が **0件**。
  3. `grep -c "new Date()" app.html` が **1**(= `getTodayKey` 内のみ)。
  4. `grep -n "getFullYear" app.html` が `localDateKey` 内にヒット。
  5. T-11 のテストが全件 pass。
- **【紐づく AC】** AC-01, AC-02, AC-03, AC-04, AC-31(下地)

---

#### T-04 日付の表示用フォーマッタ

- **【対象】** domain 層: `weekdayLabel(key, weekStart)` / `formatJa(key)`
- **【実装内容】**
  - `formatJa("2026-01-15")` → `"2026年1月15日"`(月日はゼロ埋めしない)。
  - `weekdayLabel` → `"木曜日"` 等の日本語曜日名。曜日名配列は定数として1箇所に置き、T-05 の曜日ラベル回転と共有する。
- **【依存タスク】** T-03
- **【完了条件(機械検証可能)】**
  1. `formatJa("2026-01-15") === "2026年1月15日"`、`weekdayLabel("2026-01-15") === "木曜日"` が T-11 のテストで pass。
  2. 曜日名配列の定義箇所が `grep` で1箇所のみ。
- **【紐づく AC】** AC-11(下地)

---

#### T-05 週配置ユーティリティ(週開始曜日の吸収)

- **【対象】** domain 層: `rowIndexOf(key, weekStart)` / `rollbackToWeekStart(key, weekStart)` / `buildDateRange(endKey, weekStart, days=364)`
- **【実装内容】**
  - `rowIndexOf = (dayOfWeek(key) - weekStart + 7) % 7`。
  - `rollbackToWeekStart = addDays(key, -rowIndexOf(key, weekStart))`。
  - `buildDateRange`: design.md §4-4 の擬似コード通り。先頭を巻き戻し、末尾を `addDays(endKey, 6 - rowIndexOf(endKey, weekStart))` まで伸ばす。返り値長は**必ず7の倍数**。
  - 曜日ラベル配列を `weekStart` 分だけ回転して返すヘルパもここに置く(render が同じ式を使うため)。
- **【依存タスク】** T-03, T-04
- **【完了条件(機械検証可能)】**
  1. T-11 のテストで、`weekStart ∈ {0,1}` の両方について `buildDateRange(...).length % 7 === 0` が成立。
  2. `rowIndexOf(buildDateRange(end, ws)[0], ws) === 0` が両 `weekStart` で成立。
  3. `rollbackToWeekStart("2026-01-15", 1) === "2026-01-12"`(月曜)、`rollbackToWeekStart("2026-01-15", 0) === "2026-01-11"`(日曜)が pass。
- **【紐づく AC】** AC-05, AC-06

---

#### T-06 頻度判定と状態正規化

- **【対象】** domain 層: `isTargetDay(habit, dateKey)` / `getState(logs, habitId, dateKey)`
- **【実装内容】**
  - `isTargetDay`: `daily` → 常に true / `weekdays` → `freq.days.includes(dayOfWeek(dateKey))` / `weekly` → 常に true。
  - `getState`: `logs[habitId]?.[dateKey]` の欠損を `"not-done"` に正規化。返り値は `"done" | "skip" | "not-done"` の3値に閉じる。
- **【依存タスク】** T-03
- **【完了条件(機械検証可能)】**
  1. T-12 のテストで、`weekdays` 習慣(days=[1,3,5])に対し月/水/金が true、火/木/土/日が false。
  2. `getState({}, "h1", "2026-01-15") === "not-done"`。
- **【紐づく AC】** AC-19(下地), AC-23(下地)

---

#### T-07 ストリーク算出

- **【対象】** domain 層: `computeStreak(habit, logs, todayKey)` / `computeWeeklyStreak(habit, logs, todayKey, weekStart)`
- **【実装内容】**
  - design.md §4-1 の擬似コード通り。`createdAt` 起点、上限10年、昇順1パス走査で `{current, longest}` を返す。
  - 境界条件 A〜G をすべて実装する:
    - A: `todayKey` が対象日かつ未達 → `run` を 0 にしない。
    - B: 途中の `skip` → 断絶させずカウントもしない。
    - C: 非対象日 → 断絶させずカウントもしない。
    - D: `createdAt` より前は走査しない。
    - E: 記録皆無 → `{0, 0}`。
    - F: 全日 skip → `{0, 0}`。
    - G: 不変条件 `longest >= current`。
  - `freq.type === "weekly"` は `computeWeeklyStreak` に委譲。週単位で `doneCount >= max(0, times - skipCount)`、進行中の今週は未達でも断絶させない(境界H)。`weekStart` は**引数で受け取る**(純粋性維持のため settings をグローバル参照しない)。
- **【依存タスク】** T-05, T-06
- **【完了条件(機械検証可能)】**
  1. T-12 のテストで境界 A〜H の 8 ケースすべて pass。
  2. すべてのテストケースで `longest >= current` が成立(不変条件アサート)。
- **【紐づく AC】** AC-19, AC-20, AC-21

---

#### T-08 密度(直近30日達成率)

- **【対象】** domain 層: `computeDensity(habit, logs, todayKey, window=30)`
- **【実装内容】**
  - design.md §4-2 通り。境界 I(`createdAt` 前を分母から除外)、J(非対象日を分母から除外)、K(`skip` を分母から除外)を実装。
  - `denom === 0` のとき `pct` は `null` を返す(0 を返さない)。
- **【依存タスク】** T-06
- **【完了条件(機械検証可能)】**
  1. T-12 のテストで、連続 done の途中1日を `skip` にすると `denom` が 1 減り、`done` は変わらないこと。
  2. `createdAt === todayKey` かつ記録なしのとき `denom === 0 && pct === null`。
- **【紐づく AC】** AC-20, AC-21

---

#### T-09 集計と heatmap level 算出

- **【対象】** domain 層: `dailyCount(habits, logs, dateKey)` / `quantileThresholds(counts)` / `levelOf(count, t)` / `heatmapLevels(cells, mode, thresholds)`
- **【実装内容】**
  - `dailyCount`: その日 `done` の習慣数。
  - `quantileThresholds`: design.md §4-3 通り。非ゼロカウントのみを入力とし、`[q(.25), q(.50), q(.75), q(1.0)]`。境界 L(空 → 固定配列 `[1,2,3,4]`)、境界 M(単調増加を強制)、`t[0] = max(1, t[0])`。フォールバック配列 `[1,2,3,4]` は **grep 可能な定数**として書く。
  - `levelOf`: 境界 N(`count <= 0` → 必ず 0)。返り値は整数 0〜4 に閉じる。
  - `heatmapLevels`: モード1(全体)は分位点、モード2(個別)は固定マッピング(`done`→4 / `skip`→2 / `not-done`→0 / 非対象日→0 + `off`)。
  - **線形正規化式(`Math.round(count / max * 4)` 等)をソース中に一切書かない。**
- **【依存タスク】** T-06
- **【完了条件(機械検証可能)】**
  1. T-13 のテストで `quantileThresholds([])` が `[1,2,3,4]`、全同値入力 `[3,3,3,3]` が厳密単調増加を返す。
  2. ランダム 1000 ケースで `levelOf` の返り値集合が `{0,1,2,3,4}` の部分集合。
  3. `levelOf(0, t) === 0` が常に成立。
  4. `grep -nE "/ *max *\* *4|Math\.round\([^)]*max" app.html` が 0件。
  5. `grep -n "\[1, *2, *3, *4\]" app.html` が1件以上ヒット(フォールバック閾値の明示)。
- **【紐づく AC】** AC-07, AC-08, AC-09, AC-32(下地)

---

### Phase C — テスト(domain 層の node 検証)

> **方針**: domain 層は純粋関数のみなのでブラウザ無しで検証できる(design.md §1-2 設計原則2)。`app.html` の `<script>` 内 domain 層と**同一のロジック**を `creations/habit/test.js` に持ち込み、`node test.js` で実行する。

---

#### T-10 テストハーネスの構築(domain 層の切り出し方式を確定)

- **【対象】** `creations/habit/test.js`
- **【実装内容】**
  - `app.html` から domain 層のソーステキストを抽出して評価する方式を採る:
    `fs.readFileSync("app.html", "utf8")` → `/\/\* *DOMAIN:START *\*\/([\s\S]*?)\/\* *DOMAIN:END *\*\//` で切り出し → `new Function(src + "; return {localDateKey, getTodayKey, ...};")()` で関数群を取得。
  - これにより `app.html` と `test.js` の**二重管理を避ける**(コードのコピーを持たない)。
  - `app.html` の domain 層の前後に `/* DOMAIN:START */` / `/* DOMAIN:END */` マーカーコメントを置く(T-03〜T-09 のコードがこの範囲に収まること)。
  - 最小アサーションヘルパ(`eq(actual, expected, label)` / 集計 / 失敗時 `process.exitCode = 1`)を実装。外部テストフレームワークは使わない(依存ゼロ方針の一貫性)。
- **【依存タスク】** T-03 〜 T-09
- **【完了条件(機械検証可能)】**
  1. `node creations/habit/test.js` が exit code 0 で終了し、`0 failed` を出力する。
  2. 切り出した domain ソースに `document` / `window` / `localStorage` の参照が含まれない(`test.js` 内で正規表現チェックし、含まれていたら fail)。
  3. `grep -c "DOMAIN:START" app.html` が 1、`DOMAIN:END` が 1。
- **【紐づく AC】** AC-01(検証手段), AC-04(検証手段), AC-19〜AC-21(検証手段)

---

#### T-11 テスト: 日付ユーティリティ・週配置

- **【対象】** `test.js`(日付ブロック)
- **【実装内容】** 以下を最低限含む:
  - `localDateKey(new Date(2026, 0, 15, 23, 50))` → `"2026-01-15"`(23:50 でも当日。AC-03 の机上等価検証)。
  - `addDays("2026-02-28", 1) === "2026-03-01"`(2026 は平年)/ `addDays("2024-02-28", 1) === "2024-02-29"`(閏年)。
  - 月末・年末跨ぎ: `addDays("2025-12-31", 1) === "2026-01-01"`、`addDays("2026-01-01", -1) === "2025-12-31"`。
  - DST 想定: `addDays` を 400 日連続で回して1日も重複・欠落が無い(生成キーの `Set.size === 400`、隣接 `diffDays === 1`)。
  - `dayOfWeek("2026-01-15") === 4`(木)。
  - `formatJa` / `weekdayLabel` の期待値一致(T-04)。
  - `rowIndexOf` / `rollbackToWeekStart` / `buildDateRange` を `weekStart ∈ {0,1}` の両方で検証(T-05 の完了条件1〜3)。
- **【依存タスク】** T-10
- **【完了条件(機械検証可能)】** `node test.js` の日付ブロックが全件 pass(failed 0)。
- **【紐づく AC】** AC-01, AC-02, AC-03, AC-04, AC-05, AC-06, AC-11

---

#### T-12 テスト: ストリーク・密度

- **【対象】** `test.js`(ストリーク / 密度ブロック)
- **【実装内容】**
  - 境界 A: 今日が対象日で `not-done` → `current` が前日までの値を保つ。
  - 境界 B: 連続 done の途中1日を `skip` → 前後が連結される(AC-20)。
  - 境界 C: `weekdays`(月水金)習慣で対象日のみ done、火木土日は未記録 → 3週間で `current === 対象日数`、途中で 0 にならない(AC-19)。
  - 境界 D: `createdAt` より前の日を走査しない(logs に古い日付を入れても結果が変わらない)。
  - 境界 E: 記録皆無 → `{0,0}`。
  - 境界 F: 全日 skip → `{0,0}`。
  - 境界 G: 全ケースで `longest >= current`。
  - 境界 H: `weekly`(times=3)で今週 1 件のみ done → `current` が前週までの値を保つ。`skipCount` による `required` 減免も検証。
  - AC-21 シナリオ: 連続 done → 1日空ける → `current === 0 && longest > 0 && pct > 0`。
  - 密度: 境界 I / J / K(T-08 の完了条件)。
- **【依存タスク】** T-10
- **【完了条件(機械検証可能)】** `node test.js` のストリーク / 密度ブロックが全件 pass(failed 0)。境界 A〜K + AC-21 シナリオの計12ケース以上。
- **【紐づく AC】** AC-19, AC-20, AC-21

---

#### T-13 テスト: level / 分位点 / 描画範囲

- **【対象】** `test.js`(level ブロック)
- **【実装内容】**
  - `quantileThresholds([])` → `[1,2,3,4]`(境界 L)。
  - `quantileThresholds([3,3,3,3])` → 厳密単調増加(境界 M)。
  - `quantileThresholds([1,1,2,5,9])` の各要素が整数かつ単調増加、`t[0] >= 1`。
  - `levelOf(0, t) === 0` を全 `t` パターンで検証(境界 N)。
  - ランダム 1000 件で `levelOf` 返り値 ∈ `{0,1,2,3,4}`。
  - 個別モードの固定マッピング: `done→4` / `skip→2` / `not-done→0` / 非対象日→`0` かつ `data-state="off"` 相当のフラグが立つ。
  - `buildDateRange` の長さが 364〜371 かつ7の倍数(`weekStart` 両方 × 任意の `endKey` 100 パターン)。
- **【依存タスク】** T-10
- **【完了条件(機械検証可能)】** `node test.js` の level ブロックが全件 pass(failed 0)。
- **【紐づく AC】** AC-06, AC-07, AC-08, AC-09

---

#### T-14 テスト: エンベロープ検証・マイグレーション(store の純粋部分)

- **【対象】** `test.js`(検証ブロック)。`validateEnvelope` / `migrate` は I/O を持たない純粋関数なので domain と同じ手法で検証する。
- **【実装内容】**
  - `/* DOMAIN:START..END */` 範囲に `validateEnvelope` / `migrate` も含める(I/O を伴う `safeGet` 等は含めない)。
  - 正常エンベロープ → `true`。
  - 異常系: `v` が文字列 / `habits` が非配列 / `name` が0文字・41文字 / `color` が `"red"` / `freq.type` が未知 / 日付キーが `"2026-1-5"` / logs の値が `"DONE"` / `logs` のキーが未知 habitId → すべて `false`。
  - `settings` 欠損時に既定値で補完されること。
  - `migrate({v: 1, ...})` は素通し、`migrate({v: 2, ...})` は throw(未来バージョン拒否)、`migrate({})` は throw。
- **【依存タスク】** T-10, T-16
- **【完了条件(機械検証可能)】** `node test.js` の検証ブロックが全件 pass。異常系10ケース以上がすべて `false`/throw。
- **【紐づく AC】** AC-02, AC-16, AC-24

---

### Phase D — store 層

---

#### T-15 定数と localStorage 安全ラッパ

- **【対象】** store 層: `STORAGE_KEY` / `BACKUP_KEY_PREFIX` / `CURRENT_VERSION` / `SAVE_DEBOUNCE_MS` / `storageAvailable()` / `safeGet()` / `safeSet()` / `safeRemove()`
- **【実装内容】**
  - `STORAGE_KEY = "paradise.habit.v1"`、`BACKUP_KEY_PREFIX = "paradise.habit.backup."` を定数として1箇所に定義。
  - `storageAvailable`: MDN パターン(テストキーの `setItem` → `removeItem` を try/catch、quota 0 の空ストレージも false 判定)。
  - `safeGet` / `safeSet` / `safeRemove`: すべて try/catch。**`setItem` / `getItem` / `removeItem` のみを使い、`localStorage.foo = x` 形式のプロパティアクセスを一切書かない**。
  - `safeSet` は `{ok, error}` を返し、quota 判定は `e.name === "QuotaExceededError"` / `"NS_ERROR_DOM_QUOTA_REACHED"` / `e.code === 22 || e.code === 1014` の**名前とコードの両方**で行う。
  - localStorage に触れる関数はこの4つ**のみ**。
- **【依存タスク】** T-01
- **【完了条件(機械検証可能)】**
  1. `grep -nE "localStorage\.[A-Za-z_$][A-Za-z0-9_$]* *=" app.html` が `setItem/getItem/removeItem` 以外で **0件**。
  2. `grep -c "localStorage" app.html` のヒット行がすべて上記4関数の定義内に収まる(行番号を目視ではなく、関数開始/終了行の範囲比較スクリプトで判定)。
  3. `grep -n "QuotaExceededError" app.html` と `grep -n "NS_ERROR_DOM_QUOTA_REACHED" app.html` がそれぞれ1件以上。
- **【紐づく AC】** AC-13, AC-15

---

#### T-16 エンベロープ検証とマイグレーション

- **【対象】** store 層(純粋部): `validateEnvelope(obj)` / `migrate(obj)`
- **【実装内容】**
  - design.md §2-5 の4条件を実装。日付キーは `/^\d{4}-\d{2}-\d{2}$/`、色は `/^#[0-9a-fA-F]{6}$/`、name は 1〜40 文字、`freq.type ∈ {daily, weekdays, weekly}`、logs の値は `"done" | "skip"`、logs のキーは `habits[].id` のいずれかに一致。
  - **全か無か**: 1つでも不正なら `false`(部分的な救済をしない)。
  - `migrate`: `CURRENT_VERSION = 1`、空の `MIGRATIONS` テーブルを**初版から**置く。`typeof obj.v !== "number"` は throw、`obj.v > CURRENT_VERSION` も throw。
  - I/O を持たないこと(T-14 で node から呼べるようにするため `DOMAIN:START..END` 範囲内に置く)。
- **【依存タスク】** T-15
- **【完了条件(機械検証可能)】**
  1. T-14 のテストが全件 pass。
  2. `grep -n "MIGRATIONS" app.html` が1件以上(骨格が存在する)。
- **【紐づく AC】** AC-02, AC-16, AC-24

---

#### T-17 起動シーケンス `loadState()`

- **【対象】** store 層: `loadState()`
- **【実装内容】**
  - design.md §6-1 の手順1〜8 をそのまま実装。
  - 手順4: `JSON.parse` の `SyntaxError` を捕捉 → `safeSet(BACKUP_KEY_PREFIX + Date.now(), raw)` で **生文字列のまま退避してから** `safeRemove(STORAGE_KEY)` → 既定 state で起動 → 通知表示。
  - 手順5/6: `migrate` の throw、`validateEnvelope` の false も同じ退避経路へ。
  - 手順2〜6 全体を try/catch で包み、**最終フォールバックとして既定 state で必ず起動する**(未捕捉例外を出さない)。
  - `storageAvailable()` が false なら `state.ui.storageMode = "memory"`。
- **【依存タスク】** T-15, T-16
- **【完了条件(機械検証可能)】**
  1. `localStorage.setItem("paradise.habit.v1", "{broken")` → リロード → 未捕捉例外0件、アプリが起動、`paradise.habit.backup.` で始まるキーが存在しその値が `"{broken"` と一致(T-39 で実施)。
  2. `Storage.prototype.setItem` を throw に差し替えてリロード → 未捕捉例外0件、`storageMode === "memory"`(T-39 で実施)。
  3. アプリ由来キーが `paradise.habit.v1` の1つのみ(バックアップキーを除く)。
- **【紐づく AC】** AC-13, AC-14, AC-16

---

#### T-18 デバウンス保存 `scheduleSave()` / `flushSave()`

- **【対象】** store 層: `scheduleSave(data)` / `flushSave()` / `notify()`
- **【実装内容】**
  - `SAVE_DEBOUNCE_MS = 400`。`clearTimeout` → `setTimeout(flushSave, 400)`。
  - `storageMode === "memory"` のときは no-op。
  - `flushSave` は `safeSet(STORAGE_KEY, JSON.stringify(state.data))`。失敗時: quota なら通知(「保存容量の上限に達しました。エクスポートしてから古いデータを整理してください」)、それ以外は `storageMode = "memory"` に落として警告バナー再描画。**いずれの場合も `state.data` を壊さない**。
  - `safeSet` が3回連続で失敗したら `storageMode = "memory"` に落とす(失敗カウンタ)。
  - `visibilitychange`(hidden)と `pagehide` で `flushSave()`。`beforeunload` は使わない。
- **【依存タスク】** T-15, T-17
- **【完了条件(機械検証可能)】**
  1. `Storage.prototype.setItem` をスパイ化 → 100ms 以内に10回トグル → 呼び出し回数が10回未満(理想1回)(T-39 で実施)。
  2. `grep -n "beforeunload" app.html` が **0件**、`grep -n "pagehide" app.html` が1件以上。
- **【紐づく AC】** AC-30

---

#### T-19 JSON エクスポート / インポート

- **【対象】** store 層: `exportJson(data)` / `importJson(file, onOk, onErr)` / 安定ソートヘルパ
- **【実装内容】**
  - エクスポート: `JSON.stringify(data, null, 2)` → `Blob({type:"application/json"})` → `URL.createObjectURL` → 動的 `<a download="habit-<todayKey>.json">` を click → `URL.revokeObjectURL`。ファイル名の日付は `getTodayKey()`(ISO datetime を混入させない)。
  - **安定ソート**: 保存/出力前に `habits` を `order` 昇順、`logs` を habitId 辞書順・日付キー辞書順で並べ替える(ラウンドトリップで JSON が一致するため)。
  - インポート: `<input type="file" accept="application/json">` → `FileReader.readAsText` → `JSON.parse`(try/catch)→ `validateEnvelope` → `migrate`。**すべて成功して初めて** `state.data` を差し替えて `flushSave()`。
  - 途中失敗時は `state.data` に一切触れず `onErr` のみ呼ぶ。
- **【依存タスク】** T-16, T-18
- **【完了条件(機械検証可能)】**
  1. エクスポート → localStorage 全消去 → インポート → 再エクスポート、の2つの JSON 文字列が**完全一致**(T-40 で実施)。
  2. `"{broken"` を含むファイルをインポート → エラー表示のみ、エクスポート JSON が不変(T-40 で実施)。
  3. エクスポート JSON 中に `/T\d{2}:/` および `/Z"/` にマッチする文字列が0件。
- **【紐づく AC】** AC-02, AC-24

---

### Phase E — render 層

> render 層は `state` を読み `DOM` を書くのみ。`store` を呼ばない(design.md §1-2 の依存方向)。DOM 生成は `document.createElement` + `textContent`。動的文字列を `innerHTML` に渡さない。

---

#### T-20 state 定義と `render()` エントリポイント

- **【対象】** `state` オブジェクト / `render(state)`
- **【実装内容】**
  - design.md §1-3 の `state = { data, ui: { todayKey, selectedHabit, focusedCell, storageMode, notice } }` を定義。
  - `render(state)` は `renderStorageWarning` / `renderEmptyState` / `renderTodayList` / `renderHabitLimitHint` / `renderHeatmap` / `applyTheme` / 通知領域更新をすべて呼ぶ**単一のエントリポイント**。部分更新の最適化を持たない。
  - 再描画のたびに `state.ui.focusedCell` からフォーカスを復元する。
- **【依存タスク】** T-02, T-03, T-17
- **【完了条件(機械検証可能)】**
  1. `grep -c "function render(" app.html` が 1。
  2. `render` を2回連続で呼んでも DOM のセル数・`tabindex="0"` 数が変わらない(冪等性)。
- **【紐づく AC】** AC-30(下地: 単一経路)

---

#### T-21 ストレージ警告バナーと通知領域

- **【対象】** `renderStorageWarning(state)` / 通知領域(`aria-live="polite"`)
- **【実装内容】**
  - `storageMode === "memory"` のとき `#storage-warning` を表示し、**「このセッションでのみ保持されます」という語を必ず含む**文言を `textContent` で設定。
  - `state.ui.notice` があれば `aria-live="polite"` 領域に表示。
- **【依存タスク】** T-20
- **【完了条件(機械検証可能)】**
  1. `storageMode = "memory"` で `render()` → `document.body.textContent.includes("このセッションでのみ保持されます")` が true。
  2. `grep -n "このセッションでのみ保持されます" app.html` が1件以上。
- **【紐づく AC】** AC-13

---

#### T-22 空状態

- **【対象】** `renderEmptyState(state)`
- **【実装内容】**
  - `data.habits.length === 0` のとき `#empty-state` を表示し、アプリの目的説明と「まずは1〜3個から」の案内を出す。同時に `#heatmap-section` を隠す(真っ白なグリッドを見せない)。
  - 習慣が1件以上あれば `#empty-state` を隠す。
- **【依存タスク】** T-20
- **【完了条件(機械検証可能)】**
  1. localStorage 空でリロード → `#empty-state` が可視、`#heatmap-section` が非表示、`document.body.textContent` に「1〜3個」を含む。
  2. 習慣を1件追加 → `#empty-state` が非表示、`#heatmap-section` が可視。
- **【紐づく AC】** AC-27

---

#### T-23 今日の一覧(ストリーク・密度の併置)

- **【対象】** `renderTodayList(state)` / `renderHabitLimitHint(state)`
- **【実装内容】**
  - `state.ui.todayKey` に対して `isTargetDay` が true の習慣を行として描画。**行全体が1つの `<button aria-pressed="true|false">`**。行内に習慣色のアクセントを置く。
  - 同一行に `computeStreak` の `current` と `longest`、`computeDensity` の `"12/28 (43%)"` を**テキストで併置**。`denom === 0` のときは `"—"` と表示し 0% とは書かない。
  - `renderHabitLimitHint`: `habits.length > 6` で控えめな注意ヒントを表示。
  - 名前は `textContent` で設定(`innerHTML` を使わない)。
- **【依存タスク】** T-07, T-08, T-20
- **【完了条件(機械検証可能)】**
  1. 連続 done → 1日空ける状態で、同一行の `textContent` に「現在 0」「最長 >0」「達成率 >0%」の3値が同時に含まれる。
  2. 習慣を7個作る → ヒント要素が DOM に出現。6個以下では出現しない。
  3. 習慣名に `<img src=x onerror=alert(1)>` を入れても DOM に `img` 要素が生成されない。
- **【紐づく AC】** AC-21, AC-28

---

#### T-24 ヒートマップ描画

- **【対象】** `renderHeatmap(state)` / `cellAriaLabel(dateKey, mode, info)`
- **【実装内容】**
  - `buildDateRange(state.ui.todayKey, weekStart)` → モード判定(`selectedHabit === null` なら全体 / それ以外は個別)→ 全体モードは `dailyCount` の非ゼロ値から `quantileThresholds` を算出 → `heatmapLevels` → セル生成。
  - セルは `<button class="hm-cell" role="gridcell" data-date data-level data-state tabindex="-1">`。日付昇順に append するだけ(**JS で行/列を計算しない**)。
  - `data-level` は必ず整数 0〜4。**`style.backgroundColor` を JS から設定しない**。
  - 非対象日: `data-state="off"` + `data-offday="true"`。未来日(`dateKey > todayKey`): `data-future="true"` + `disabled`。
  - `cellAriaLabel`: `"{年}年{月}月{日}日{曜日名}、{状態文}"`。状態文は全体モード「N件達成」/「記録なし」、個別モード「達成」「スキップ」「未達成」「対象外」。**空 label のセルを作らない**。
  - 曜日ラベル列(`aria-hidden="true"`)は T-05 の回転ヘルパで生成し、グリッドと同じ `grid-template-rows` を使う。月ラベル行も `aria-hidden="true"`。
  - `#hm-target` セレクタの `<option>` を `habits` から生成(先頭は「全習慣まとめ」= 値空文字)。
  - 凡例 `<i data-level="0..4">` を描画。
- **【依存タスク】** T-05, T-09, T-20
- **【完了条件(機械検証可能)】**
  1. 全セルの `data-level` 値の集合が `{"0","1","2","3","4"}` の部分集合。
  2. セル総数が7の倍数、かつ 364〜371 の範囲。
  3. 全セルの `aria-label` が非空で `/\d{4}年\d{1,2}月\d{1,2}日/` と曜日名と状態語をすべて含む(空 label 0件)。
  4. 先頭セルの `aria-label` の曜日名が設定中の週開始曜日と一致(`weekStart` 0/1 の両方)。
  5. 既知日付(2026-01-15 = 木曜)のセルの行位置に対応する曜日ラベルが「木」であることが `weekStart` 0/1 の両方で成立。
  6. `data-level="0"` のセルの `getComputedStyle(cell).backgroundColor` が `transparent` / `rgba(...,0)` **ではない**。
  7. 未来日セルが `data-future="true"` を持つ。
  8. `grep -nE "style\.backgroundColor|style\.background *=" app.html` がセル描画部で0件。
- **【紐づく AC】** AC-05, AC-06, AC-07, AC-09, AC-10, AC-11, AC-32

---

#### T-25 roving tabindex の適用

- **【対象】** `applyRovingTabindex(gridEl, focusedKey)`
- **【実装内容】**
  - グリッド内の `tabindex="0"` を**ちょうど1つ**にする。他は `tabindex="-1"`。
  - 初期フォーカス位置は「今日」のセル(存在しなければ未来日を除く最終セル)。
  - 変更前のセルを `-1` に落とし、新しいセルを `0` にしてから `.focus()`。
  - 再描画のたびに `state.ui.focusedCell` から復元。未来日は対象にしない。
- **【依存タスク】** T-24
- **【完了条件(機械検証可能)】**
  1. 初期描画直後: `grid.querySelectorAll('[tabindex="0"]').length === 1`。
  2. `render()` を10回呼んでも常に 1。
  3. 矢印キー dispatch 後も常に 1(T-32 と合わせて検証)。
- **【紐づく AC】** AC-12

---

#### T-26 ツールチップ

- **【対象】** `showTooltip(cellEl, text)` / `hideTooltip()`
- **【実装内容】**
  - `#tooltip` を**1つだけ**使い回す。`role="tooltip"`、既定は `hidden`。位置は `getBoundingClientRect()` で決定。
  - 表示テキストは当該セルの `aria-label` と**同じ文字列**を使う(二重管理を避ける)。
  - 表示トリガは3経路すべて登録: (1) `mouseenter`/`mouseleave`、(2) `click`、(3) `focus`/`blur`。タッチでは `click` でトグル、グリッド外 `click` で閉じる。**hover 単独実装にしない**。
- **【依存タスク】** T-24
- **【完了条件(機械検証可能)】**
  1. セルに `mouseenter` を dispatch → `#tooltip` の `hidden` が外れテキストが非空。
  2. 別セルに `click` を dispatch → 同様に表示。
  3. `document.querySelectorAll('[role="tooltip"]').length === 1`。
- **【紐づく AC】** AC-26

---

#### T-27 テーマ適用

- **【対象】** `applyTheme(theme)`
- **【実装内容】**
  - `theme === "system"` のとき `<html>` から `data-theme` 属性を**外す**(`prefers-color-scheme` に委ねる)。`"light"` / `"dark"` のときは属性をセット。
  - 起動時と `settings.theme` 変更時に呼ぶ。
- **【依存タスク】** T-02, T-20
- **【完了条件(機械検証可能)】**
  1. DevTools で `prefers-color-scheme: dark` をエミュレート → `getComputedStyle(document.documentElement).getPropertyValue('--level-4')` がライト時と異なる値。
  2. `applyTheme("dark")` → `document.documentElement.dataset.theme === "dark"`、`applyTheme("system")` → `dataset.theme === undefined`。
- **【紐づく AC】** AC-29

---

### Phase F — event 層

---

#### T-28 `commit()` — 唯一の状態変更経路

- **【対象】** `commit(mutator)`
- **【実装内容】**
  - `mutator(state.data)` を実行 → `scheduleSave(state.data)` → `render(state)` の順に呼ぶ。
  - **すべての状態変更はこの1関数を通す**(他の場所から `scheduleSave` / `render` を直接呼ばない)。
- **【依存タスク】** T-18, T-20
- **【完了条件(機械検証可能)】**
  1. `grep -c "scheduleSave(" app.html` のヒットが「定義1件 + `commit` 内の呼び出し1件」の計2件のみ。
  2. `grep -c "render(state)" app.html` の呼び出しが `commit` 内・起動時・`onVisibilityChange` の3経路以内。
- **【紐づく AC】** AC-30

---

#### T-29 今日の一覧のワンタップ記録

- **【対象】** `onTodayRowClick(habitId)`
- **【実装内容】**
  - 行 `<button>` の `click` で `logs[habitId][todayKey]` を `done ⇄ not-done`(削除)でトグル。
  - **モーダル・確認ダイアログ・保存ボタンを一切挟まない。** `commit()` へ直行。
  - `aria-pressed` を更新(再描画で反映)。
- **【依存タスク】** T-23, T-28
- **【完了条件(機械検証可能)】**
  1. 行を1回クリック → 直後にエクスポートした JSON の `logs[habitId][todayKey] === "done"`。
  2. クリック後に `document.querySelectorAll('dialog, [role="dialog"]').length === 0`。
  3. クリックから保存反映までのユーザー操作回数が 1。
- **【紐づく AC】** AC-22

---

#### T-30 ヒートマップセルの巡回トグル

- **【対象】** `onCellClick(habitId, dateKey)`
- **【実装内容】**
  - 冒頭で `if (dateKey > state.ui.todayKey) return;`(`"YYYY-MM-DD"` の文字列比較で日付比較が成立)。
  - `done → skip → not-done` の順に巡回。`not-done` は `delete logs[habitId][dateKey]` で表現する(3回で完全に初期状態へ戻る)。
  - 全体モード(`selectedHabit === null`)ではセルクリックの対象習慣が定まらないため、トグルは**個別モードのみ**で有効にする(全体モードのセルはツールチップ表示のみ)。
  - `commit()` 経由。
- **【依存タスク】** T-24, T-28
- **【完了条件(機械検証可能)】**
  1. 過去日セルを3回クリック → `data-state` が `done` → `skip` → 属性消失(`not-done`)と遷移し、3回目でエクスポート JSON に当該日付キーが**存在しない**。
  2. 未来日セルをクリック後、エクスポート JSON に当該日付キーが追加されていない。
- **【紐づく AC】** AC-10, AC-23

---

#### T-31 グリッドのキーボード操作

- **【対象】** `onGridKeydown(e)`
- **【実装内容】**
  - `←`/`→` = −1日/+1日、`↑`/`↓` = −1日/+1日(Grid の縦充填のため同義)、`PageUp`/`PageDown` = −7日/+7日、`Home`/`End` = 範囲先頭 / 未来日を除く最終日。
  - `Enter`/`Space` は `<button>` のネイティブ挙動で `onCellClick` に落ちる(独自ハンドリングを追加しない)。
  - 移動先が範囲外または未来日なら**移動しない**。
  - 移動時に `state.ui.focusedCell` を更新し `applyRovingTabindex` を呼ぶ。
- **【依存タスク】** T-25, T-30
- **【完了条件(機械検証可能)】**
  1. `ArrowRight` を dispatch → フォーカスセルの `data-date` が +1日、`[tabindex="0"]` の個数が 1 のまま。
  2. 最終セル(今日)で `ArrowRight` を dispatch → `data-date` が変わらない(未来日へ移動しない)。
  3. `PageUp` で `data-date` が −7日。
- **【紐づく AC】** AC-10, AC-12

---

#### T-32 習慣の CRUD

- **【対象】** `onAddHabit(name, color, freq)` / `onEditHabit(id, patch)` / `onDeleteHabit(id)`
- **【実装内容】**
  - 追加フォーム: 名前(1〜40文字必須)、色(`<input type="color">`)、頻度(`daily` / `weekdays` + 曜日複数選択 / `weekly` + `times` 1〜7)。
  - `id = "h_" + Date.now() + "_" + 4桁ランダム`、`createdAt = state.ui.todayKey`、`order = habits.length`。
  - `habits.length >= 24` のときは追加を拒否して警告を表示(`commit` しない)。
  - 削除は確認を挟み、`logs[id]` も併せて削除。
  - すべて `commit()` 経由。名前は `textContent` 描画のみ(T-23)。
- **【依存タスク】** T-23, T-28
- **【完了条件(機械検証可能)】**
  1. 7個目を追加 → 上限ヒント要素が DOM に出現。
  2. 25個目の追加操作後、`habits.length === 24` のまま。
  3. 削除後、エクスポート JSON に当該 `habitId` の `habits` エントリと `logs` エントリが**両方とも**存在しない。
- **【紐づく AC】** AC-28, AC-24(データ整合)

---

#### T-33 設定(週開始曜日 / テーマ / エクスポート / インポート)の配線

- **【対象】** `onWeekStartChange(v)` / テーマ切替ハンドラ / エクスポートボタン / インポート `<input type="file">`
- **【実装内容】**
  - `onWeekStartChange`: `settings.weekStart` を 0/1 で更新 → `commit()`(ヒートマップの行順と巻き戻しの両方が同じ値から再計算される)。
  - テーマ切替: `settings.theme` を `system|light|dark` で更新 → `applyTheme` → `commit()`。
  - エクスポートボタン → `exportJson(state.data)`。
  - インポート `<input type="file">` の `change` → `importJson(file, onOk, onErr)`。`onOk` で `state.data` 差し替え + `flushSave()` + `render()`、`onErr` は通知のみ。
  - すべてキーボードのみで操作可能(`<button>` / `<select>` / `<input>` のネイティブ要素を使う)。
- **【依存タスク】** T-19, T-24, T-27, T-28
- **【完了条件(機械検証可能)】**
  1. 週開始曜日を日曜→月曜に変更 → 曜日ラベル順が `日月火水木金土` → `月火水木金土日` に変化し、既知日付セルの曜日行が**ずれない**(T-24 完了条件5 を両設定で再確認)。
  2. キーボードのみ(Tab + Enter)でエクスポートが実行できる。
  3. インポート成功後の `render()` で習慣数・記録数が復元される。
- **【紐づく AC】** AC-05, AC-06, AC-24, AC-29

---

#### T-34 ヒートマップ対象セレクタ

- **【対象】** `onHabitSelectChange(id | null)`
- **【実装内容】**
  - `#hm-target` の `change` で `state.ui.selectedHabit` を更新(空文字 → `null` = 全習慣まとめ)。
  - `state.ui` の変更なので保存はせず、`render(state)` のみを呼ぶ(`commit` は `data` 変更用)。
  - モード切替に応じて `heatmapLevels` の算出方式と `cellAriaLabel` の状態文が切り替わる。
- **【依存タスク】** T-24
- **【完了条件(機械検証可能)】**
  1. 全体表示時の 2026-01-15 セルの `aria-label` と、個別習慣選択後の同日セルの `aria-label` が**異なる**(前者は「N件達成」/「記録なし」、後者は「達成」「スキップ」「未達成」「対象外」のいずれか)。
  2. 切替後も `data-level` 値の集合が `{0,1,2,3,4}` の部分集合。
- **【紐づく AC】** AC-32

---

#### T-35 日付境界の再評価と保存フラッシュ

- **【対象】** `onVisibilityChange()` / `pagehide` リスナ
- **【実装内容】**
  - `visibilitychange` リスナを登録。`document.visibilityState === "visible"` のとき `getTodayKey()` を再評価し、`state.ui.todayKey` と異なれば更新して `render(state)`。
  - `hidden` のときは `flushSave()`。
  - `pagehide` でも `flushSave()`。
- **【依存タスク】** T-18, T-20
- **【完了条件(機械検証可能)】**
  1. `grep -n "visibilitychange" app.html` が1件以上。
  2. システム日付を翌日に進めて `document.dispatchEvent(new Event("visibilitychange"))` → 今日の一覧の対象日付が翌日のものに更新される。
  3. `grep -n "beforeunload" app.html` が0件。
- **【紐づく AC】** AC-31, AC-30

---

### Phase G — 仕上げ・検証

---

#### T-36 静的検査(grep ベースの AC 検証)

- **【対象】** `creations/habit/app.html`(検証のみ。コード変更は違反があった場合のみ)
- **【実装内容】** 以下の grep をすべて実行し、結果を記録する(design.md の AC 検証コマンドの `index.html` を `app.html` に読み替え)。
  | # | コマンド | 期待 |
  |---|---|---|
  | 1 | `grep -nE "toISOString\|toJSON" app.html` | 0件 |
  | 2 | `grep -n "getFullYear" app.html` | `localDateKey` 内に1件以上 |
  | 3 | `grep -nE "86400000\|864e5\|24 ?\* ?60 ?\* ?60 ?\* ?1000" app.html` | 0件 |
  | 4 | `grep -nE "localStorage\.[A-Za-z_$][A-Za-z0-9_$]* *=" app.html` | `setItem/getItem/removeItem` 以外0件 |
  | 5 | `grep -nE "<script[^>]+src=\|<link[^>]+stylesheet\|@import\|fetch\(\|XMLHttpRequest" app.html` | 0件 |
  | 6 | `grep -nE "style\.backgroundColor\|style\.background *=" app.html` | セル描画部で0件 |
  | 7 | `grep -nE "Math\.round\([^)]*max\|/ *max *\* *4" app.html` | 0件 |
  | 8 | `grep -n "\[1, *2, *3, *4\]" app.html` | 1件以上(分位点フォールバック) |
  | 9 | `grep -n "quantileThresholds" app.html` | 定義1件 + 呼び出し1件以上 |
  | 10 | `grep -n "visibilitychange" app.html` | 1件以上 |
  | 11 | `grep -c "new Date()" app.html` | 1(= `getTodayKey`) |
  | 12 | `grep -n "innerHTML" app.html` | 動的文字列を渡す箇所が0件 |
- **【依存タスク】** T-01 〜 T-35
- **【完了条件(機械検証可能)】** 上記12項目すべてが期待通り。1件でも外れたら該当タスクへ差し戻す。
- **【紐づく AC】** AC-01, AC-02, AC-04, AC-07, AC-08, AC-15, AC-17, AC-31

---

#### T-37 domain テストの全件実行

- **【対象】** `creations/habit/test.js`
- **【実装内容】** `node creations/habit/test.js` を実行し、全ブロック(日付 / 週配置 / ストリーク / 密度 / level / エンベロープ検証)を通す。失敗があれば該当 domain タスクへ差し戻す。
- **【依存タスク】** T-10 〜 T-14, T-36
- **【完了条件(機械検証可能)】**
  1. exit code 0。
  2. 出力に `failed: 0` を含む。
  3. 総アサーション数が 40 以上(AC-01/02/03/04/05/06/07/08/09/16/19/20/21/24 の机上検証を網羅)。
- **【紐づく AC】** AC-01, AC-02, AC-03, AC-04, AC-05, AC-06, AC-07, AC-08, AC-09, AC-16, AC-19, AC-20, AC-21, AC-24

---

#### T-38 単一ファイル / オフライン / `file://` 動作検証

- **【対象】** `app.html`(配布形態)
- **【実装内容】**
  - `file:///.../app.html` で開き、(a) 習慣追加、(b) 今日の一覧でチェック、(c) ヒートマップ描画、(d) エクスポートの4操作を実施。
  - ブラウザの Network タブでドキュメント本体以外のリクエストが 0 件であることを確認。
  - `test.js` が配布物に含まれないこと(成果物 = `app.html` 単体)を明記して確認。
- **【依存タスク】** T-36
- **【完了条件(機械検証可能)】**
  1. 4操作すべて成功、コンソールエラー0件。
  2. Network タブのリクエスト数が1(ドキュメント本体のみ)。
  3. `app.html` を単体で別ディレクトリにコピーしても同じ4操作が動作する。
- **【紐づく AC】** AC-17, AC-18

---

#### T-39 障害系検証(ストレージ不可 / 破損 / デバウンス)

- **【対象】** ブラウザ上での store 層検証
- **【実装内容】**
  - **AC-13**: `Storage.prototype.setItem` を throw するよう差し替えてリロード → 未捕捉例外0件、警告文言が DOM に存在、習慣追加とチェックが UI に反映される。
  - **AC-14**: `localStorage.setItem("paradise.habit.v1", "{broken")` → リロード → 未捕捉例外0件、アプリ起動、`paradise.habit.backup.*` キーが存在しその値が `"{broken"`。
  - **AC-16**: `Object.keys(localStorage)` のうちアプリ由来キーが `paradise.habit.v1` の1つのみ(バックアップキーを除く)。エクスポート JSON のルートに `v`(数値)/`habits`/`logs` が存在。
  - **AC-30**: `Storage.prototype.setItem` をスパイ化 → 100ms 以内に10回チェック操作 → 呼び出し回数が10回未満。
- **【依存タスク】** T-38
- **【完了条件(機械検証可能)】** 上記4項目すべて期待通り。未捕捉例外は全ケースで0件。
- **【紐づく AC】** AC-13, AC-14, AC-16, AC-30

---

#### T-40 操作系・DOM 検証(ヒートマップ / 一覧 / エクスポート往復)

- **【対象】** ブラウザ上での render / event 層検証
- **【実装内容】**
  - **AC-03**: OS 時刻を 23:50 (JST) に設定 → チェック → エクスポート JSON の日付キーが当日と一致。
  - **AC-05 / AC-06**: 週開始曜日 日曜 / 月曜の両方で、曜日ラベル順・先頭セル曜日・全セル数が7の倍数・既知日付セルの行位置を検証。
  - **AC-07 / AC-09**: 全セルの `data-level` 集合が `{0..4}` の部分集合。`data-level="0"` の `getComputedStyle().backgroundColor` が非透明。
  - **AC-10**: 未来日セルをクリック → エクスポート JSON に当該キーが追加されない。
  - **AC-11**: 全セルの `aria-label` が非空で3要素を含む。
  - **AC-12**: 初期 / 矢印キー押下後の各時点で `[tabindex="0"]` が常に1個。
  - **AC-19 / AC-20 / AC-21**: 月水金習慣3週分、途中 skip、連続 done → 1日空け のシナリオを UI 上で再現し、画面表示値が T-12 の期待値と一致することを確認。
  - **AC-22**: 行を1回クリック → JSON 反映、`[role=dialog]` 非出現。
  - **AC-23**: 過去日セル3クリックで初期状態へ復帰。
  - **AC-24**: エクスポート → 全消去 → インポート → 再エクスポートの JSON 完全一致。次に `"{broken"` をインポートし既存データ不変。
  - **AC-25**: ビューポート 375px で `document.documentElement.scrollWidth <= clientWidth`、セルの `getBoundingClientRect()` の幅・高さが 12 以上。
  - **AC-26**: `mouseenter` dispatch と別セルへの `click` dispatch の両方でツールチップ出現。
  - **AC-27**: localStorage 空でリロード → 空状態テキスト存在。
  - **AC-28**: 7個目でヒント出現、25個目の追加が拒否され24個のまま。
  - **AC-29**: dark エミュレート → `--level-4` の値がライト時と異なる。
  - **AC-31**: システム日付を翌日へ → `visibilitychange` dispatch → 今日の一覧が更新される。
  - **AC-32**: 全体 / 個別で同日セルの `aria-label` が異なる。
- **【依存タスク】** T-39
- **【完了条件(機械検証可能)】** 上記18項目すべて期待通り。1件でも失敗したら該当実装タスクへ差し戻す。
- **【紐づく AC】** AC-03, AC-05, AC-06, AC-07, AC-09, AC-10, AC-11, AC-12, AC-19, AC-20, AC-21, AC-22, AC-23, AC-24, AC-25, AC-26, AC-27, AC-28, AC-29, AC-31, AC-32

---

#### T-41 AC-01〜32 の合否表を作成し完了判定

- **【対象】** 検証レポート(`creations/habit/` 配下、実装フェーズで作成)
- **【実装内容】**
  - T-36(grep)/ T-37(node テスト)/ T-38 / T-39 / T-40 の結果を AC 番号ごとに1行にまとめ、32行の合否表を作る。
  - 「未検証」「保留」の行が1件でもあれば完了としない。
  - design.md §11 / requirements.md §6 の Definition of Done と照合する。
- **【依存タスク】** T-36, T-37, T-38, T-39, T-40
- **【完了条件(機械検証可能)】**
  1. 合否表の行数が 32。
  2. 全行が `PASS`。`FAIL` / `未検証` が 0 行。
  3. `test.js` が exit 0、`app.html` が単一ファイルで `file://` 動作。
- **【紐づく AC】** AC-01 〜 AC-32(全件)

---

## 2. AC-01 〜 AC-32 → 担当タスク 対応表

**未割当ゼロ。** 32件すべてに「実装タスク」と「検証タスク」の両方を割り当てる。

| AC | 概要 | 実装タスク | 検証タスク |
|---|---|---|---|
| **AC-01** | `toISOString` 0件 / 日付キーは `getFullYear` 系で生成 | T-03 | T-11, T-36, T-37 |
| **AC-02** | 全日付キーが `^\d{4}-\d{2}-\d{2}$` / ISO datetime 0件 | T-03, T-16, T-19 | T-11, T-14, T-36, T-37 |
| **AC-03** | 23:50 JST でも当日キーになる | T-03 | T-11, T-40 |
| **AC-04** | ミリ秒定数を使わない加算 | T-03 | T-11, T-36, T-37 |
| **AC-05** | 週開始曜日切替で曜日行がずれない | T-05, T-24, T-33 | T-11, T-37, T-40 |
| **AC-06** | 開始日巻き戻し / セル総数が7の倍数 | T-05, T-24 | T-11, T-13, T-37, T-40 |
| **AC-07** | `data-level` は 0〜4 のみ / インライン色計算なし | T-09, T-24 | T-13, T-36, T-37, T-40 |
| **AC-08** | 線形スケール不使用 / 閾値が明示的に存在 | T-09 | T-13, T-36, T-37 |
| **AC-09** | count 0 セルも描画され不透明色 | T-02, T-09, T-24 | T-13, T-37, T-40 |
| **AC-10** | 未来日セルは操作不可 | T-24, T-30, T-31 | T-40 |
| **AC-11** | 全セルに年月日+曜日+状態の `aria-label` | T-04, T-24 | T-11, T-40 |
| **AC-12** | roving tabindex が常にちょうど1つ | T-25, T-31 | T-40 |
| **AC-13** | ストレージ不可でも起動 + 警告表示 | T-15, T-17, T-18, T-21 | T-39 |
| **AC-14** | 破損データを退避してから既定起動 | T-17 | T-39 |
| **AC-15** | localStorage は `setItem/getItem/removeItem` のみ | T-15 | T-36 |
| **AC-16** | バージョン付きエンベロープ / 単一キー | T-15, T-16, T-17 | T-14, T-37, T-39 |
| **AC-17** | 外部リソース参照0件 | T-01, T-02 | T-36, T-38 |
| **AC-18** | 単一 `.html` で `file://` 動作 | T-01 | T-38 |
| **AC-19** | 非対象曜日でストリークが 0 にならない | T-06, T-07 | T-12, T-37, T-40 |
| **AC-20** | skip が断絶させず分母から除外される | T-07, T-08 | T-12, T-37, T-40 |
| **AC-21** | 現在/最長ストリーク + 密度の同時表示 | T-07, T-08, T-23 | T-12, T-37, T-40 |
| **AC-22** | 1クリックで done 記録(モーダルなし) | T-29 | T-40 |
| **AC-23** | セル3クリックで done→skip→not-done 巡回 | T-06, T-30 | T-40 |
| **AC-24** | エクスポート/インポート往復一致・不正時不変 | T-16, T-19, T-32, T-33 | T-14, T-37, T-40 |
| **AC-25** | コンテナ内横スクロール / セル 12px 以上 | T-02, T-24 | T-40 |
| **AC-26** | ツールチップが hover と tap の両経路で出る | T-26 | T-40 |
| **AC-27** | 習慣0件で空状態を表示 | T-22 | T-40 |
| **AC-28** | 6個超でヒント / 24個超で追加拒否 | T-23, T-32 | T-40 |
| **AC-29** | ダークモードで `--level-*` が切り替わる | T-02, T-27, T-33 | T-40 |
| **AC-30** | 書き込みのデバウンス | T-18, T-28, T-35 | T-39 |
| **AC-31** | `visibilitychange` で「今日」を再評価 | T-03, T-35 | T-36, T-40 |
| **AC-32** | 全体 / 個別ヒートマップの切替 | T-09, T-24, T-34 | T-40 |

### カバレッジ確認

- **AC 総数**: 32(AC-01 〜 AC-32)
- **実装タスクが割り当てられた AC**: 32 / 32
- **検証タスクが割り当てられた AC**: 32 / 32
- **未割当の AC**: **0 件**
- 最終合否判定は T-41 で 32 行の合否表として確定する。

### タスク側から見た AC カバレッジ(逆引き健全性)

| Phase | タスク | 主に担保する AC |
|---|---|---|
| A | T-01, T-02 | AC-09, AC-17, AC-18, AC-25, AC-29 |
| B | T-03 〜 T-09 | AC-01〜AC-09, AC-11, AC-19〜AC-21, AC-32 |
| C | T-10 〜 T-14 | (検証)AC-01〜AC-09, AC-16, AC-19〜AC-21, AC-24 |
| D | T-15 〜 T-19 | AC-02, AC-13〜AC-16, AC-24, AC-30 |
| E | T-20 〜 T-27 | AC-05〜AC-07, AC-09〜AC-13, AC-21, AC-26〜AC-29, AC-32 |
| F | T-28 〜 T-35 | AC-05, AC-06, AC-10, AC-12, AC-22〜AC-24, AC-28〜AC-32 |
| G | T-36 〜 T-41 | (検証)AC-01 〜 AC-32 全件 |

**AC-01〜32 のうち、いずれのタスクにも現れない AC は存在しない(未割当ゼロ)。**

---

## 3. 依存関係の健全性チェック

- Phase B(domain)は Phase A の CSS / DOM に依存しない(T-03 は依存なしで着手可能)。
- Phase C(テスト)は Phase B の完了を前提とし、Phase D 以降の着手条件になる。
- Phase E(render)は domain(B)にのみ依存し、store(D)には `loadState` の初期 state 供給のみで依存する(design.md §1-2 の依存方向に一致: render → domain)。
- Phase F(event)は store・domain・render のすべてに依存する(最上位層)。
- T-14 のみ Phase C 内から Phase D の T-16 に依存する。これは `validateEnvelope` / `migrate` が **I/O を持たない純粋関数**であり、domain と同じ手法で検証できるためである。この1点を除き、依存は常に「下位フェーズ → 上位フェーズ」の一方向に閉じている。
- 循環依存: **なし**(各タスクの依存タスク番号が自身より小さい。例外は T-14 → T-16 の1件のみで、これは Phase C/D 間の意図的な前後関係であり循環ではない)。

---

## 4. 完了の定義(detail フェーズ)

- [x] T-01 〜 T-41 の全タスクに【対象】【実装内容】【依存タスク】【完了条件(機械検証可能)】【紐づく AC】を記載した
- [x] 実装順序が依存関係と矛盾しない(store層/domain層 → render層 → event層 → 仕上げ)ことを §3 で確認した
- [x] node で走る純粋関数テスト(`creations/habit/test.js`)のタスクを T-10 〜 T-14 として含めた
- [x] AC-01 〜 AC-32 の全32件に実装タスクと検証タスクを割り当てた(未割当 0 件)
- [x] 実装コード本体は書いていない(タスク記述と完了条件のみ)
