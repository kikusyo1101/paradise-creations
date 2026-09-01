# 天秤 — システム設計

> 位相: architecture / 創造物 slug: `tenbin`
> 正典: `prd.md`(643行、FR-01〜FR-26 / AC-01〜AC-26)、`analysis.md`(485行、§3 の全数式と付録の計算サマリ)
> 本文書で「FR-xx」「AC-xx」と書いた箇所は prd.md の該当項、「analysis §X」は analysis.md の該当節を指す。
> **本文書は設計のみを定める。実装コード(`index.html`)は含まない。**
> **analysis 付録の式を一切変更しない。** 逆転閾値 `x*_k = (D₀ − w_k·d_k)/(D₀ − d_k)`、`Δw_k = D₀(1−w_k)/(D₀−d_k)` は教主が有理数300試行で独立検証済み(反例0)であり、本設計はこれを実装可能な形に写すだけである。

---

## 0. この設計が守る境界条件(前提の再掲)

| 制約 | 内容 | 由来 |
|---|---|---|
| 単一HTMLファイル | `index.html` 1個に HTML/CSS/JS を内包。ビルド工程なし | FR-23 / AC-24 |
| 外部CDN禁止 | `<script src>` / `<link rel=stylesheet>` / `@import` の出現回数 = 0 | FR-23 / AC-24 |
| ネットワーク送信ゼロ | `fetch` / `XMLHttpRequest` / `sendBeacon` / `WebSocket` / `EventSource` / `<form action>` の出現回数 = 0 | FR-24 / AC-25 |
| 永続化は localStorage のみ | キーは `tenbin.v1.` 名前空間に閉じる | FR-16 / AC-22 |
| 数値許容差 | 厳密分数値との差が `1e-9` 以内 | prd §7-2-4 |

この5つは設計の全ての節に優先する。以下で「不可」と書いた選択肢は、ほぼ全てこの表のいずれかに抵触したものである。

---

## 1. 全体構造

### 1-1. 4層への分割

単一HTMLファイルという制約は「全部を1つの `<script>` に流し込め」という意味ではない。**1ファイルの中に、依存の向きが一方向に揃った4つの層を作る。** 層の境界は物理的なファイル境界ではなく、`<script>` ブロックの境界と、後述する抽出マーカで表現する。

```
┌──────────────────────────────────────────────────────────────┐
│                        index.html                            │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  L4  永続化層   (persistence)                          │  │
│  │      localStorage への load / save / quarantine        │  │
│  │      <script id="tenbin-persist">                      │  │
│  └───────────────────────┬────────────────────────────────┘  │
│                          │ 状態を渡す / 受け取る                 │
│                          ▼                                   │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  L3  状態管理層 (store)                                 │  │
│  │      AppState の単一保持・変更コマンド・購読通知             │  │
│  │      <script id="tenbin-store">                        │  │
│  └───────┬────────────────────────────────┬───────────────┘  │
│          │ AppState を渡す                  │ ViewModel を渡す    │
│          ▼                                ▼                  │
│  ┌──────────────────────┐   ┌───────────────────────────┐    │
│  │  L1  計算コア          │   │  L2  レンダリング層          │    │
│  │      (core) ★純粋     │   │      (render)             │    │
│  │  DOM 参照ゼロ          │   │  DOM 書き込みのみ            │    │
│  │  副作用ゼロ            │   │  計算ロジックを持たない        │    │
│  │  <script id=          │   │  <script id=              │    │
│  │   "tenbin-core">      │   │   "tenbin-render">        │    │
│  └──────────────────────┘   └───────────────────────────┘    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 1-2. 依存の向き(厳格)

```
   L4 永続化  ──depends on──▶  L1 計算コア   (型定義とバリデータのみ)
   L3 状態管理 ──depends on──▶  L1 計算コア
   L3 状態管理 ──depends on──▶  L4 永続化
   L2 描画    ──depends on──▶  L1 計算コア   (フォーマッタのみ)
   L3 状態管理 ──notifies───▶  L2 描画

   L1 計算コア ──depends on──▶  (なし)
```

**不変条件 INV-1: L1 は何にも依存しない。** `document` / `window` / `localStorage` / `navigator` / `Date` / `Math.random` のいずれも参照しない。これは §2 の自動テストで機械的に検査する。

**不変条件 INV-2: L2 は計算しない。** 描画層に現れてよい算術は「バーの幅 = 値 ÷ 最大値 × 100」のような**幾何量のみ**で、FR-01〜FR-22 に現れる量(スコア・重み・閾値・貢献度・ラベル)は一切計算しない。それらは全て L1 が計算し、**表示文字列まで L1 が確定させて** ViewModel に載せる(§1-4)。

**不変条件 INV-3: 状態は L3 が単独で保持する。** DOM は状態を持たない。`<input>` の `.value` は状態の写しであって状態そのものではない(唯一の例外は §6-3 のフォーカス中セル)。

### 1-3. `<script>` ブロックの並び順

classic script は上から順に評価されるので、依存の逆順に置く。

```
1. <script id="tenbin-core">      L1  … globalThis.TenbinCore を公開
2. <script id="tenbin-persist">   L4  … TenbinCore を参照
3. <script id="tenbin-render">    L2  … TenbinCore を参照
4. <script id="tenbin-store">     L3  … 上3つを参照し、起動する
```

`type="module"` は使わない。`file://` から開いたとき module script は CORS で失敗するブラウザがあり、「ダブルクリックで動く」(FR-23)を壊すためである。classic script なら `file://` でも確実に動く。

### 1-4. ViewModel をなぜ L1 が作るか

素朴には「L1 が数値を返し、L2 が `toFixed(1)` する」と分けたくなる。**これは採らない。** 理由は AC-01 / AC-05 / AC-11 / AC-13 / AC-15 / AC-21 が検証しているのが **`63.5` `+6.8` `−171.4` `30.882353` といった表示文字列そのもの**だからである。丸めを L2 に置くと、AC の過半がブラウザを起動しないと検証できなくなる。

したがって:

> **設計判断 D-1: 丸めと文言テンプレート適用は L1(純粋関数)の責務とする。** L1 は数値と表示文字列の両方を持つ ViewModel を返す。L2 はその文字列を DOM に置くだけで、`toFixed` を1回も呼ばない。

これにより AC-01〜AC-23 の全てが Node 上の純粋関数呼び出しだけで検証可能になる(§2)。§5-3 で実測した通り、AC が要求する29個の表示文字列は `toFixed` 相当の丸めで全て一致する。

---

## 2. テスト可能性の設計 ★本設計の関門

### 2-1. 何を解こうとしているのか

単一HTMLファイルには「モジュールが無い」。`export` も `require` も使えず、テストランナーは `index.html` を `import` できない。一方で AC-01〜AC-23 は数値と文字列の検証であり、**ブラウザを起動せずに Node で回せなければテストは重く遅くなり、結局書かれなくなる。**

素朴な選択肢と、それを採らない理由:

| 案 | 却下理由 |
|---|---|
| 計算コアを `core.js` に分離し、HTML から `<script src>` | **FR-23 / AC-24 に正面から違反**(`<script src=` の出現回数 = 0 が要求) |
| ビルド時に `core.js` を HTML へインライン化 | ビルド工程なしの制約に違反。配布物と検証物が別になり AC-24 の意味が失われる |
| テストを全てブラウザ(Playwright 等)で回す | 外部依存が重く、AC-01〜AC-23 のような純関数検証に DOM 起動を強いる。数式の反例探索(数千試行)が現実的に回らない |
| `index.html` を Node で丸ごと `eval` | DOM API が無いため即座に落ちる。L2/L3/L4 が混入する |

採る案は **「1つの成果物、2つの入口」** である。

> ### 設計判断 D-2 — 抽出可能コアブロック(Extractable Core Block)
>
> 計算コア L1 を `index.html` 内の `<script id="tenbin-core">` に置き、その**内側**を一対の文字列マーカで囲う。マーカ間の領域は
> - **DOM API を1つも参照しない**
> - **グローバルへの副作用を1つも持たない**(最後の1文で `const TenbinCore` を束縛して終わる)
>
> ことを満たす。ブラウザはこのブロックを普通に評価して使う。テストは `index.html` をテキストとして読み、マーカ間を切り出して `new Function` で評価し、返された `TenbinCore` を直接呼ぶ。
>
> **同一の文字列が、ブラウザでは script として、Node では関数本体として、まったく同じ意味で評価される。** 配布物とテスト対象が同一バイト列であることが、この設計の核心である。

### 2-2. 抽出マーカの規定(文字列を確定する)

以下の2行を**バイト列として厳密に**規定する。前後の空白・大文字小文字・記号を一切変えない。

```
/*===TENBIN-CORE-BEGIN===*/
/*===TENBIN-CORE-END===*/
```

**マーカ契約(CONTRACT-CORE):**

| # | 規則 |
|---|---|
| C-1 | 両マーカは `index.html` 全体でそれぞれ**ちょうど1回**だけ出現する |
| C-2 | 両マーカは `<script id="tenbin-core">` と `</script>` の間に、この順で出現する |
| C-3 | BEGIN と END の間の領域(**コア領域**)は、それ自体で構文的に完結した JavaScript 文の並びである |
| C-4 | コア領域の**最後の文**は `const TenbinCore = Object.freeze({ … });` である |
| C-5 | コア領域は次の識別子を1つも含まない: `document` `window` `localStorage` `sessionStorage` `navigator` `fetch` `XMLHttpRequest` `alert` `Date` `Math.random` `globalThis` |
| C-6 | コア領域は文字列 `</script` を含まない(HTML パーサによる早期終端の防止) |
| C-7 | グローバル公開は END マーカの**外側**、同じ `<script>` 内の1行 `globalThis.TenbinCore = TenbinCore;` で行う |

C-5 が INV-1 の機械的な検査条件であり、C-7 によってコア領域自身は副作用ゼロを保つ。C-4 は抽出側が `return TenbinCore;` を追記するだけで値を取り出せることを保証する。

**HTML 上の配置(構造のみ。中身は実装位相が書く):**

```html
<script id="tenbin-core">
/*===TENBIN-CORE-BEGIN===*/

  // … 純粋関数群(§4 の全シグネチャ)…
  // … フォーマッタ・バリデータ …

  const TenbinCore = Object.freeze({
    VERSION, EPS,
    normalize, normalizeWeights, reweight, computeScores, rank,
    tippingPoint, criticality, scoreContribution, winContribution,
    robustness, anchoringDetect, applyCutoffs,
    analyze, validateState, migrateState, createInitialState,
    fmt, TEXT
  });

/*===TENBIN-CORE-END===*/
globalThis.TenbinCore = TenbinCore;
</script>
```

### 2-3. テスト側の抽出手順(疑似コード)

```
FUNCTION loadCore(htmlPath):

    # ── 1. 読み込み ───────────────────────────────────────────
    html ← readFileAsUtf8(htmlPath)

    # ── 2. マーカの一意性を検査(C-1)────────────────────────
    BEGIN ← "/*===TENBIN-CORE-BEGIN===*/"
    END   ← "/*===TENBIN-CORE-END===*/"
    ASSERT countOccurrences(html, BEGIN) == 1  ELSE fail("C-1 違反: BEGIN が " + n + " 個")
    ASSERT countOccurrences(html, END)   == 1  ELSE fail("C-1 違反: END が " + n + " 個")

    b ← indexOf(html, BEGIN)
    e ← indexOf(html, END)
    ASSERT b < e                                ELSE fail("C-1 違反: 順序が逆")

    # ── 3. <script id="tenbin-core"> の内側にあることを検査(C-2)──
    sOpen  ← indexOf(html, '<script id="tenbin-core">')
    ASSERT sOpen >= 0                           ELSE fail("C-2 違反: コアブロックが無い")
    sClose ← indexOf(html, "</script>", sOpen)
    ASSERT sOpen < b AND e < sClose             ELSE fail("C-2 違反: マーカがブロック外")

    # ── 4. 切り出し ──────────────────────────────────────────
    src ← substring(html, b + length(BEGIN), e)

    # ── 5. 純粋性ガード(C-5 / C-6)★これ自体が1本のテスト ─────
    FORBIDDEN ← ["document", "window", "localStorage", "sessionStorage",
                 "navigator", "fetch", "XMLHttpRequest", "alert",
                 "Date", "Math.random", "globalThis", "</script"]
    FOR each token IN FORBIDDEN:
        # 単語境界つきで照合(誤検出防止: "documentFragment" 等は別途許容しない)
        ASSERT NOT matchesWordBoundary(src, token)
            ELSE fail("INV-1 違反: コア領域が '" + token + "' を参照している")

    # ── 6. 評価(C-3 / C-4)──────────────────────────────────
    # new Function は呼び出し元スコープを閉じ込めないため、テスト側の変数は不可視。
    # sloppy mode の暗黙グローバル生成を防ぐため "use strict" を前置する。
    factory ← new Function('"use strict";\n' + src + '\nreturn TenbinCore;')
    core    ← factory()

    ASSERT core is an object            ELSE fail("C-4 違反: TenbinCore が返らない")
    ASSERT isFrozen(core)               ELSE fail("C-4 違反: Object.freeze されていない")

    RETURN core
```

**テストからの使い方:**

```
core ← loadCore("index.html")

# AC-01
st  ← buildDS1()                       # DS-1 を組み立てるテスト側ヘルパ
vm  ← core.analyze(st)
ASSERT vm.ranking[0].displayScore == "67.0"
ASSERT vm.ranking[1].displayScore == "63.5"
ASSERT vm.ranking[2].displayScore == "51.0"

# AC-05
ASSERT vm.criticality[0].name == "移行コスト"
ASSERT vm.criticality[0].displayDelta == "+6.8"
ASSERT vm.criticality[3].infeasible == true          # サポート

# 厳密値との突合(prd §7-2-4 の 1e-9)
ASSERT abs(vm.ranking[0].score - 67/100) <= 1e-9
```

### 2-4. この仕組みが与える保証

1. **配布物 = テスト対象。** ビルド生成物ではなく、ユーザーがダブルクリックする当のファイルからコアを取り出す。「テストは通るが配布物は壊れている」が構造的に起きない。
2. **INV-1 が自動検査される。** 手順5の純粋性ガードは、それ自体が独立した1本のテストである。将来 L1 に `document.querySelector` を書き足した瞬間にテストが赤くなる。
3. **AC-24 と同じ検査器を再利用できる。** AC-24(`<script src=` の出現回数 = 0 など)は `index.html` に対する文字列検索であり、手順1〜3と同じ「HTML をテキストとして読む」枠組みに乗る。
4. **ブラウザ側も同じ入口。** ブラウザ内テストが必要になっても `globalThis.TenbinCore` を呼ぶだけで、Node 側と同一の表明が使える。
5. **反例探索が現実的になる。** §5 の誤差測定や、逆転閾値の代入検算(閾値まで動かすと本当に同点になるか)を数千試行回すことが、DOM 起動なしにできる。

### 2-5. 実装位相への申し送り(この契約を壊す典型)

- コア領域の中でうっかり `console.log` を使う → `console` は FORBIDDEN に入れていないので通るが、**入れない**。デバッグ出力は L2/L3 側に置く。
- 日付を扱いたくなる(重み編集履歴の時刻)→ **`Date` はコア領域で禁止**。時刻は L3 が採取して引数で渡す(§4-11 の `anchoringDetect` は `history` を受け取るだけで時計を読まない)。
- 乱数が欲しくなる → v1 に乱数を使う機能は無い(Monte Carlo は prd §6-2 で不採用)。
- コア領域に文字列 `"</script>"` を書く(エクスポート機能の HTML 生成等)→ C-6 違反。必要なら `"<\/script>"` と分割して書く。

---

## 3. データモデル

### 3-1. 型定義(TypeScript 風。実装は素の JS でよいが、この形を守る)

```ts
// ───────────────────────────────────────────────────────────
//  基本型
// ───────────────────────────────────────────────────────────

/** 基準の向き。FR-04 */
type Direction = "benefit" | "cost";

/** 頑健性ラベル。FR-11 / analysis §3-6 */
type RobustnessLabel = "robust" | "contingent" | "fragile";

/** 生スコア。0〜10、step 0.5。未入力は null(0 ではない)。FR-01 */
type RawScore = number | null;

/** 不透明な識別子。配列 index を ID 代わりにしない(§3-4) */
type Id = string;


// ───────────────────────────────────────────────────────────
//  入力モデル
// ───────────────────────────────────────────────────────────

/** 基準。FR-01 / FR-04 / FR-20 */
interface Criterion {
  id:        Id;
  name:      string;          // 表示名。空文字可(UI が「基準1」等を代替表示)
  direction: Direction;       // FR-04
  rawWeight: number;          // ŵ_j ≥ 0。UI の 0-100 スライダー生値。
                              // 正規化前。w_j = ŵ_j / Σŵ は導出量であり保存しない(§3-3)
  cutoff:    number | null;   // FR-20 足切り値。正規化後 0-10 尺度。null = 未設定(既定)
}

/** 選択肢。FR-01 */
interface Option {
  id:     Id;
  name:   string;
  scores: Record<Id, RawScore>;   // 基準 id → 生スコア(0〜10)
}
// 注: scores を配列にせず Map にすることで、基準の削除/並べ替えでスコアが
//     ずれる事故を構造的に防ぐ(§3-4)。

/** 重み編集の1件。FR-18 / analysis §5-3 */
interface WeightEdit {
  at:            number;        // epoch ミリ秒。L3 が採取(L1 は時計を読まない)
  criterionId:   Id;
  criterionName: string;        // 基準が後で削除されても履歴が読めるよう名前を焼き込む
  before:        number;        // 変更前の正規化重み w_k ∈ [0,1]
  after:         number;        // 変更後の正規化重み w_k ∈ [0,1]
  leaderBefore:  Id | null;     // 編集直前の1位。同点/未確定なら null
  leaderAfter:   Id | null;     // 編集直後の1位
}
// 注: leaderBefore と leaderAfter の両方を持たせることで、
//     f(1位入替回数)= count(e => e.leaderBefore !== e.leaderAfter) と
//     履歴だけで自己完結して数えられる。外部の初期値を要さない。AC-21。

/** ユーザー設定 */
interface Settings {
  theta:            number;   // FR-11 / FR-12。既定 0.10(重み単位。10 ポイント)
  flipThreshold:    number;   // FR-18。既定 3
  challengerId:     Id | null; // FR-15。貢献度(B)の挑戦者。null = 既定(2位)
}

/** アプリ状態の全容 */
interface AppState {
  schemaVersion:  1;                    // §3-5
  criteria:       Criterion[];          // 長さ 0〜10(FR-02)
  options:        Option[];             // 長さ 0〜10(FR-02)
  settings:       Settings;
  initialWeights: Record<Id, number> | null;
                  // FR-18 の w⁰。全スコアが埋まった瞬間に1度だけ確定し、以後不変。
                  // null = まだ確定していない
  history:        WeightEdit[];         // FR-18。上限 §3-5
}


// ───────────────────────────────────────────────────────────
//  導出モデル(ViewModel)— 永続化しない。analyze() が毎回作る
// ───────────────────────────────────────────────────────────

/** 1選択肢分の結果 */
interface ScoredOption {
  id:            Id;
  name:          string;
  a:             number[];      // 正規化スコア a_ij ∈ [0,1](基準の並び順)
  score:         number;        // S_i ∈ [0,1]
  displayScore:  string;        // "67.0" — S_i × 100 を小数1桁(D-1)
  rank:          number;        // 1 始まり。除外された選択肢は 0
  excluded:      boolean;       // FR-20 で足切りされた
  exclusionText: string | null; // "移行コストが最低ライン3.0を下回るため除外"
  contribution:  Contribution[];// FR-14 スコア貢献度 c_ij
}

/** 貢献度1件。FR-13 / FR-14 */
interface Contribution {
  criterionId: Id;
  name:        string;
  value:       number | null;   // c_ij または g_j。未定義なら null(S_i = 0 等)
  display:     string;          // "31.3" / "-171.4" / "—"
  negative:    boolean;         // FR-13 逆符号バー
}

/** 基準1件の臨界度。FR-08 / FR-09 / FR-10 */
interface CriticalityRow {
  criterionId:   Id;
  name:          string;
  weight:        number;          // w_k ∈ [0,1]
  displayWeight: string;          // "15.0"
  infeasible:    boolean;         // true = 支配的優位(逆転不能)FR-09
  delta:         number;          // Δw_k(重み単位、符号付き)。infeasible なら Infinity
  displayDelta:  string;          // "+6.8" / "-8.6" / "—"(必ず符号付き)FR-10④
  wStar:         number;          // w_k* = w_k + Δw_k。infeasible なら NaN
  displayWStar:  string;          // "21.8" / "—"
  sens:          number;          // sens_k = 1/|Δw_k|。infeasible なら 0。★§3-6
  displaySens:   string;          // "14.6" / "0"
  opponentId:    Id | null;       // 逆転相手(argmin)。FR-08
  opponentName:  string | null;
  text:          string;          // FR-10 の行文言テンプレート適用済み
}

/** 頑健性の判定。FR-11 */
interface Robustness {
  label:         RobustnessLabel;
  deltaStar:     number;          // Δ* (重み単位)。robust なら Infinity
  displayDelta:  string;          // "6.8" / "逆転不能"
  kStarId:       Id | null;
  kStarName:     string | null;
  labelLine:     string;          // prd §5-1 のラベル本体テンプレート適用済み
  verdict:       string;          // 一次出力文(prd §5-1)。ラベル単独表示を禁ずる FR-11
  caveat:        string | null;   // robust に必ず添える但し書き FR-22
}

/** 逆算検知。FR-18 */
interface AnchoringResult {
  edits:   number;          // N
  flips:   number;          // f
  warn:    boolean;         // f >= flipThreshold
  message: string | null;   // prd §5-4 の文言(warn のときのみ)
}

/** 退化状態。FR-19 / prd §5-3 */
type DegenerateKind =
  | "no-options" | "one-option" | "no-criteria"
  | "unfilled-cells" | "tie" | "no-weight" | "all-excluded" | null;

/** analyze() の返り値 — 画面に出る全てがここに揃う */
interface Analysis {
  ok:          boolean;             // false なら degenerate を表示して他は使わない
  degenerate:  DegenerateKind;
  message:     string | null;       // 退化時の確定文言(prd §5-3)
  weights:     WeightView[];        // 正規化重み w_j と表示文字列
  ranking:     ScoredOption[];      // 順位昇順(除外分は末尾)FR-07
  winner:      ScoredOption | null;
  challenger:  ScoredOption | null; // FR-15
  d0:          number;              // D₀ = S_W − S_L
  displayD0:   string;              // "3.5"
  criticality: CriticalityRow[];    // |Δw_k| 昇順、逆転不能は末尾 FR-10
  winContrib:  Contribution[];      // g_j。FR-13。D₀=0 なら空配列
  robustness:  Robustness | null;   // D₀=0 なら null(FR-19)
  anchoring:   AnchoringResult;
  excluded:    ScoredOption[];      // FR-20
  warnings:    string[];            // FR-02 ソフト警告など
}

interface WeightView {
  criterionId:   Id;
  name:          string;
  weight:        number;    // w_j ∈ [0,1]、Σ = 1
  displayWeight: string;    // "35.0"
  initialWeight: number | null;   // w⁰_k。FR-18 の並記用
  displayInitial: string | null;  // "15.0"
}
```

### 3-2. 状態の最小性 — 何を保存し、何を保存しないか

> **設計判断 D-3: `AppState` には導出可能な量を1つも置かない。**

| 量 | 保存 | 理由 |
|---|---|---|
| `rawWeight` ŵ_j | **する** | ユーザーが打った値。唯一の真実 |
| 正規化重み `w_j` | **しない** | `ŵ_j / Σŵ` で常に導出。保存すると「合計が1でない状態」を永続化しうる |
| 生スコア `raw_ij` | **する** | ユーザーが打った値 |
| 正規化スコア `a_ij` | **しない** | `raw/10` または `(10−raw)/10` で導出。向きを変えた瞬間に整合が壊れる |
| 総合スコア `S_i` / 順位 | **しない** | 導出 |
| `Δw_k` / `Δ*` / ラベル | **しない** | 導出 |
| `w⁰`(初期重み) | **する** | 導出**不能**。時間軸上の1点を捉えた量。FR-18 |
| 重み編集履歴 | **する** | 導出不能。FR-18 |
| `θ` / `flipThreshold` / 挑戦者 | **する** | ユーザー設定 |

`w⁰` と `history` だけが「導出できない履歴的事実」であり、それ以外は全て `analyze()` が毎回作り直す。これにより「保存されたスコアと保存された順位が食い違う」という種類のバグが構造的に発生しない。

### 3-3. 重みの真実は `rawWeight` 側にある

FR-05 は「基準 k の重みを x にすると他は `w_j(x) = w_j(1−x)/(1−w_k)` で比例再正規化される」と定めるが、これを**正規化後の値を直接書き換える**実装にすると、繰り返し編集で `Σw = 1` から少しずつずれていく。

> **設計判断 D-4: スライダー操作は「正規化後の目標値 x」を受け取り、`reweight()` で新しい正規化重みベクトルを求め、それを `rawWeight` に書き戻す。** 具体的には `rawWeight_j ← w'_j × 100`(あるいは任意の共通スケール)。以後 `w_j = ŵ_j / Σŵ` が常に成り立つ。
>
> 比例再正規化は `w'_j = w_j(1−x)/(1−w_k)` という**全成分に共通の係数倍 + 1成分の置換**なので、`rawWeight` 側に書き戻しても比が保たれ、次回の正規化で同じ `w'` が復元される。

§5-2 の実測では、AC-21 の3連続編集(15%→25%→15%→30%)を経ても `|Σw − 1| = 0.000e+00`、AC-15 の再正規化でも `0.000e+00` であり、この経路で誤差は蓄積しない。

### 3-4. 配列 index を ID にしない

`Option.scores` を `RawScore[]`(基準と同じ並び)にすると、基準を1個削除した瞬間に全選択肢のスコアが1列ずれる。同様に基準の並べ替えでもずれる。

> **設計判断 D-5: 選択肢と基準は不透明な `Id` を持ち、スコアは `Record<Id, RawScore>` で保持する。** 配列 index は描画順序を決めるためだけに使う。
>
> `Id` の生成は `"c" + (++counter)` のような単調増加カウンタで行う(`crypto.randomUUID` は使わない — コア領域から `globalThis` を触れないため、また ID の再現性がテストを楽にするため)。カウンタは `AppState` に持たず、L3 が `max(既存 id の数値部) + 1` で復元する(復元時の衝突回避)。

### 3-5. localStorage のキーとスキーマ

**キー名(FR-16 / AC-22: 全て `tenbin.v1.` で始まること):**

| キー | 内容 | 更新頻度 |
|---|---|---|
| `tenbin.v1.state` | `AppState` から `history` を除いた全体(JSON) | 入力のたび(デバウンス後) |
| `tenbin.v1.history` | `WeightEdit[]`(JSON) | 重み編集のたび |
| `tenbin.v1.corrupt` | 破損データの隔離先(生文字列、最大1件) | 破損検出時のみ |

`state` と `history` を分けるのは、履歴が単調増加する追記型で、入力のたびに丸ごと書き直すのが無駄だからである。`corrupt` は復旧方針(§3-6)で使う。

**AC-22 の要求「全消去実行後、`tenbin.v1.` で始まるキーが0個」への対応:** 全消去は `Object.keys(localStorage)` を走査して `tenbin.v1.` 前置のキーを**全て**削除する。上の3キーを名指しで削除する実装にはしない(将来キーが増えたときに取り残すため)。

**スキーマバージョン:** `AppState.schemaVersion: 1` を JSON の中に持たせる。**キー名の `v1` とは別物**である。

- キー名の `v1` … 名前空間の世代。**破壊的で復旧不能な変更**のときだけ上げる(`tenbin.v2.*` へ移り、v1 は放置)。
- `schemaVersion` … データ構造の世代。**移行可能な変更**のときに上げる。

読み込み時は `migrateState(raw)` が `schemaVersion` を見て段階的に持ち上げる。v1 の時点では恒等変換だが、**関数と分岐は最初から置いておく**(後から挿す方が壊れやすい)。

**履歴の上限:** `history` は無制限に伸びうる。上限 **500件**とし、超えたら古い方から捨てる。理由: FR-18 が数えるのは「1位が入れ替わった回数」であって全履歴の保持ではなく、localStorage の容量(概ね 5MB)を1機能で食い潰すのは他の保存を巻き添えにするため。ただし **`f` のカウントは切り捨て前の累計を別途 `state` 側に持たない** — AC-21 が要求するのは3回の編集での検知であり、500件の窓で十分すぎる。

### 3-6. 壊れた JSON を読んだときの復旧方針

localStorage は「ユーザーが DevTools で書き換える」「別タブの古い版が書く」「量子化されたディスクエラー」等で壊れうる。**壊れたデータで起動して例外を投げるのが最悪**である(白画面になり、ユーザーは自力で復旧できない)。

> ### 設計判断 D-6 — 3段の復旧ラダー
>
> ```
> load(key):
>   ── 段1: 読めるか ─────────────────────────────
>   raw ← localStorage.getItem(key)
>   IF raw is null            → 初期状態で起動(初回訪問。正常系)
>   IF getItem 自体が throw   → 段3へ(localStorage 無効環境。§8-1)
>
>   ── 段2: パースできるか ────────────────────────
>   TRY parsed ← JSON.parse(raw)
>   CATCH                     → 段3へ
>
>   ── 段3: 意味が通るか(★ここが本体)──────────────
>   result ← TenbinCore.validateState(parsed)
>   IF result.ok              → result.value で起動(正常系)
>   IF result.repaired        → result.value で起動 + 軽微な修復を通知
>   ELSE                      → 隔離して初期状態で起動
> ```

**`validateState` の3値応答:**

| 応答 | 条件 | 挙動 |
|---|---|---|
| `ok` | 全フィールドが型・範囲とも正しい | そのまま採用 |
| `repaired` | **局所的な異常**を安全側に丸められる | 丸めて採用し、UI に「保存データの一部を修復しました」を1回表示 |
| `failed` | 構造そのものが違う(配列であるべき所がオブジェクト等) | 隔離 |

**`repaired` として救う異常(具体的に列挙する):**

| 異常 | 修復 |
|---|---|
| `rawWeight` が負 / NaN / 非数 | `0` に丸める |
| `rawWeight` の合計が 0 | 全基準を等重み(全て `1`)にする。§8-2 |
| 生スコアが 0〜10 の外 | `[0,10]` にクランプ |
| 生スコアが 0.5 の倍数でない | 最近接の 0.5 倍数に丸める |
| 生スコアが数値でない | `null`(未入力)にする |
| `direction` が `"benefit"`/`"cost"` 以外 | `"benefit"` |
| `theta` が [0,1] の外 / 非数 | 既定 `0.10` |
| `flipThreshold` が 1 未満 / 非数 | 既定 `3` |
| 基準/選択肢が上限10を超える | 先頭10件で切る(FR-02) |
| `Option.scores` に未知の基準 id | 無視して捨てる |
| `Option.scores` に不足する基準 id | `null`(未入力)を補う |
| `challengerId` が存在しない選択肢を指す | `null`(既定=2位) |
| `initialWeights` のキーが現在の基準と不一致 | `null`(w⁰ 未確定に戻す) |
| `history` の要素が壊れている | **その要素だけ**捨てる(配列全体は保つ) |
| `id` の重複 | 後勝ちで1つに寄せ、他方に新 id を振る |

**`failed` のときの隔離手順:**

```
1. localStorage["tenbin.v1.corrupt"] ← raw        (生文字列のまま。上書き。1件のみ保持)
2. localStorage.removeItem(key)
3. 初期状態で起動
4. UI に非ブロッキングの通知を出す:
     「保存されていたデータを読み込めませんでした。
      新しく開始します。壊れたデータは復旧用に取ってあります。」
   + 「壊れたデータを表示」ボタン(押すと corrupt の中身を <textarea> に出す)
```

**隔離を捨てずに取っておく理由:** ユーザーの入力は「転職先・年収・住所」(FR-24 の動機)であり、数十分かけて打ち込んだ可能性がある。黙って消すのは信頼を失う挙動である。ネットワーク送信ゼロの製品では、我々が復旧を代行できないので、**生データを本人の手元に残すことだけが唯一の救済手段**になる。

**`state` と `history` は独立に復旧する。** 履歴が壊れても入力は生き残る(逆も同様)。履歴が失われた場合 `f` は 0 から数え直しになるが、これは FR-18 の警告が出にくくなる方向の劣化であり、入力を失う方がはるかに重い。

**書き込み失敗(QuotaExceededError / Safari プライベートモード)** は §8-1 で扱う。

---

## 4. 計算コアの関数署名

analysis 付録 / prd §8 付録の計算サマリと**一対一**で対応させる。表の「付録対応」列が式の出所である。

### 4-0. 共通の約束

- 全関数は**純粋**である。引数を破壊せず、同じ入力に同じ出力を返し、外部を読まない。
- 重みとスコアは**内部では常に [0,1]**。ポイント表記(%)は表示層に入る直前でのみ 100 倍する。
- `Infinity` は「逆転不能」を表す**正当な値**として流通させる(FR-09)。`null` で代用しない — `Math.min` が自然に働き、昇順ソートで自動的に末尾に行くため(FR-10)。
- **事前条件を破った呼び出しは例外を投げず、定義された縮退値を返す。** 単一HTMLの UI から呼ばれる関数が throw すると画面全体が止まるため。

```ts
const EPS = 1e-9;   // §5 で根拠を実測
```

### 4-1. `normalize` — スコア正規化(FR-03 / FR-04)

```ts
function normalize(raw: RawScore, direction: Direction): number | null
```

| 項目 | 内容 |
|---|---|
| 付録対応 | `a_ij = raw_ij/10`(benefit) / `a_ij = (10 − raw_ij)/10`(cost) |
| 事前条件 | `raw ∈ [0,10] ∪ {null}`、`direction ∈ {"benefit","cost"}` |
| 事後条件 | 返り値 `∈ [0,1] ∪ {null}`。`raw = null` なら `null` |
| 縮退 | `raw` が範囲外なら `[0,10]` にクランプしてから変換。NaN なら `null` |
| 不変条件 | **他の選択肢に一切依存しない**(FR-21 / AC-20 の集合非依存性の根拠) |

```ts
function normalizeMatrix(
  options: Option[], criteria: Criterion[]
): (number | null)[][]        // [選択肢][基準]
```
事後条件: 返り値は `options.length × criteria.length`。行と列の順序は引数の配列順。

### 4-2. `normalizeWeights` — 重み正規化(FR-05 / AC-03 / AC-04)

```ts
function normalizeWeights(rawWeights: number[]): number[]
```

| 項目 | 内容 |
|---|---|
| 付録対応 | `w_j = ŵ_j / Σ_j' ŵ_j'` |
| 事前条件 | `rawWeights[j] ≥ 0`、長さ ≥ 1 |
| 事後条件 | `w[j] ≥ 0` かつ `\|Σ_j w[j] − 1\| ≤ EPS`(長さ0のときを除く) |
| 縮退 | `Σŵ = 0` → **等重み `1/n` を返す**(§8-2)。長さ0 → `[]` |
| 実測 | AC-03(35/30/20/15)で誤差 `0.0`、AC-04(5/3/2/2)で `Σ−1 = 0.0`(§5-2) |

`Σŵ = 0` で等重みに落とす判断: FR-19 は「重み全ゼロ」の文言を定めていないが、`0/0 = NaN` を全計算に伝播させるのが最悪の選択である。等重みは「どの基準も同じだけ重視する」という自然な既定であり、UI では別途「全ての基準の重みが 0 です。等分として計算しています。」を警告として出す(§8-2)。

### 4-3. `reweight` — 比例再正規化(FR-05 / AC-10 / AC-15 / AC-21)

```ts
function reweight(w: number[], k: number, x: number): number[]
```

| 項目 | 内容 |
|---|---|
| 付録対応 | `w_j(x) = w_j(1−x)/(1−w_k)` (j≠k)、`w_k(x) = x` |
| 事前条件 | `\|Σw − 1\| ≤ EPS`、`0 ≤ k < w.length`、`x ∈ [0,1]`、**`w[k] < 1 − EPS`** |
| 事後条件 | `\|Σ返り値 − 1\| ≤ EPS` かつ `返り値[k] = x` |
| 縮退 | `w[k] ≥ 1 − EPS`(基準 k が単独100%)→ **`w` をそのまま返す**(§5-5 ゼロ除算箇所⑤) |
| 縮退 | `n = 1` → `[1]` を返す |
| 実測 | AC-15(価格 35→50%)で `Σ−1 = 0.0`、AC-10 の3閾値で全て `Σ−1 = 0.0`、AC-21 の3連続適用でも `Σ−1 = 0.0` |

**この関数が §4-6 `tippingPoint` の前提と厳密に同一の写像であること**が、AC-10(「閾値まで動かすと画面上で本当に同点になる」)の成立条件である。両者を別々に実装してはならない — **AC-10 のテストは `reweight(w, k, wStar)` の結果で `computeScores` を回し、`S_W − S_L` が `EPS` 以下であることを表明する形で書く**(§5-4 の実測で残差は最大 `2.22e-16`)。

### 4-4. `computeScores` — 加重和(FR-06 / AC-01)

```ts
function computeScores(a: (number|null)[][], w: number[]): number[]
```

| 項目 | 内容 |
|---|---|
| 付録対応 | `S_i = Σ_j w_j · a_ij`(表示は `S_i × 100`) |
| 事前条件 | `a` は m×n、`w` は長さ n、`\|Σw − 1\| ≤ EPS`、**`a` に `null` を含まない** |
| 事後条件 | 返り値は長さ m、各要素 `∈ [0,1]` |
| 縮退 | `a[i][j] = null` が1つでもあれば呼び出し側が先に弾く(§4-12 `analyze` が `unfilled-cells` を返す)。防御的に `null` を `0` として扱うが**この経路に入ること自体が呼び出し側のバグ**である |
| 実測 | AC-01 で `S = [0.635, 0.6699999999999999, 0.51]`、厳密値との誤差 `≤ 1.11e-16`。表示は `63.5 / 67.0 / 51.0` で完全一致 |

**総和の順序を固定する。** 浮動小数の加算は非結合的なので、`j` の昇順で単純に足す(`reduce`)ことを規定する。Kahan 加算は使わない — §5-2 の実測で n=10・m=10 の最悪ケースでも誤差は `2.22e-16` であり、要求 `1e-9` に対し6桁以上の余裕があるため、複雑さに見合わない。

### 4-5. `rank` — 順位付け(FR-07 / AC-02 / AC-20)

```ts
function rank(scores: number[], options: Option[]): {
  order: number[];          // scores 降順の index 配列
  winnerIndex: number;      // -1 なら未確定
  tied: boolean;            // 1位が同点(D₀ ≤ EPS)
}
```

| 項目 | 内容 |
|---|---|
| 付録対応 | `W = argmax_i S_i`、挑戦者は残り全て |
| 事前条件 | `scores.length = options.length ≥ 0` |
| 事後条件 | `order` は `scores` の順列。`scores[order[0]] ≥ scores[order[1]] ≥ …` |
| 縮退 | 長さ0 → `{order: [], winnerIndex: -1, tied: false}` |
| 縮退 | 長さ1 → `winnerIndex: 0` だが `analyze` が `one-option` で弾く(FR-19) |
| 同点 | `scores[order[0]] − scores[order[1]] ≤ EPS` なら `tied: true` → FR-19 の分岐へ |

**ソートの安定性を要求する。** 同スコアの選択肢は**入力順**を保つ。`Array.prototype.sort` は ES2019 以降で安定と規定されており、対象ブラウザ全てで満たされる。安定でないと、無関係なセルを編集しただけで同点の2件の表示順が入れ替わり、画面がちらつく。

**比較関数に NaN を渡さない。** §5-6 の実測通り NaN は全ての比較で `false` を返すため、混入すると順位が「入力順依存の意味不明な列」になる。NaN は `analyze` の入口で遮断する(§4-12 / §8-5)。

### 4-6. `tippingPoint` — 逆転閾値(FR-08 / FR-09)★中核

```ts
function tippingPoint(d0: number, dk: number, wk: number): {
  feasible: boolean;
  delta:    number;    // Δw_k(符号付き、重み単位)。infeasible なら Infinity
  wStar:    number;    // w_k + Δw_k。infeasible なら NaN
  reason:   "up" | "down" | "dominant";
}
```

| 項目 | 内容 |
|---|---|
| 付録対応 | `Δw_k = D₀(1 − w_k)/(D₀ − d_k)`、`w_k* = w_k + Δw_k` |
| 付録対応 | 実行可能 ⟺ `d_k < 0`(上げて逆転)または `w_k·d_k > D₀`(下げて逆転) |
| 事前条件 | `d0 > EPS`(呼び出し側が同点を排除済み)、`wk ∈ [0, 1−EPS]`、`dk ∈ [−1, 1]` |
| 事後条件 | `feasible = true` なら `delta` は有限、`wStar ∈ [0,1]`(§4-6-2) |
| 事後条件 | `feasible = false` なら `delta = Infinity`、`reason = "dominant"` |

**判定順序(この順を守ることが安全性の根拠):**

```
1. IF d0 <= EPS            → { feasible:false, delta:Infinity, reason:"dominant" }
2. IF wk >= 1 - EPS        → { feasible:false, delta:Infinity, reason:"dominant" }
3. up   ← (dk < -EPS)
   down ← (wk * dk > d0 + EPS)
4. IF NOT up AND NOT down  → { feasible:false, delta:Infinity, reason:"dominant" }   ← FR-09
5. den ← d0 - dk
6. IF |den| <= EPS         → { feasible:false, delta:Infinity, reason:"dominant" }   ← FR-09 の d_k = D₀
7. delta ← d0 * (1 - wk) / den
   RETURN { feasible:true, delta, wStar: wk + delta, reason: up ? "up" : "down" }
```

> **設計判断 D-7: 手順4(実行可能性)を手順5〜7(除算)より前に置くことで、`d_k = D₀` によるゼロ除算は構造的に到達不能になる。**
>
> 証明: `d_k = D₀` かつ `D₀ > 0` を仮定する。このとき `d_k = D₀ > 0` なので `up` は偽。また `w_k < 1` より `w_k·d_k = w_k·D₀ < D₀` なので `down` も偽。よって手順4で `dominant` として返り、手順5に到達しない。∎
>
> 手順6はそれでも残す — 浮動小数で `d0 - dk` が「厳密には0でないが極小」になり `delta` が発散する縁を塞ぐため。これは証明の外側にある数値的な安全弁である。

**AC-05 実測(DS-1、全て挑戦者=ベンダーA が argmin):**

| 基準 | `Δw_k` float | 厳密値 | 誤差 | pt 誤差 | 表示 |
|---|---|---|---|---|---|
| 移行コスト | `0.068390804597701` | 119/1740 | `1.53e-16` | `1.51e-14` | `+6.8` ✓ |
| 価格 | `-0.08584905660377336` | −91/1060 | `2.22e-16` | `2.31e-14` | `-8.6` ✓ |
| 機能充足度 | `0.1814814814814812` | 49/270 | `3.05e-16` | `2.84e-14` | `+18.1` ✓ |
| サポート | — | ∞ | — | — | 逆転不能 ✓ |

**AC-07(サポートの逆転不能)の判定も実測で確認:** vs ベンダーA は `d = +0.10 ≥ 0` かつ `w·d = 0.02 ≤ D₀ = 0.035`、vs ベンダーC は `d = +0.30 ≥ 0` かつ `w·d = 0.06 ≤ D₀ = 0.16`。両挑戦者とも手順4で `dominant`。

#### 4-6-1. `sens_k` の単位 ★実装位相への重要な申し送り

AC-05 は `sens_k = 1/|Δw_k|` の期待値を **14.6 / 11.6 / 5.5** と定めている。この値は

```
1 / 0.068390804597701 = 14.621849…   ✓ 14.6
1 / 0.085849056603773 = 11.648352…   ✓ 11.6
1 / 0.181481481481481 =  5.510204…   ✓ 5.5
```

すなわち **`Δw_k` を重み単位([0,1] 尺度)で取った逆数**である。**ポイント単位(×100)の逆数ではない**(それだと 0.146 / 0.116 / 0.055 になり AC-05 と合わない)。設計時にこの取り違えを実際に1度起こしたため明記する。

> **規定: `sens_k = 1/|Δw_k|`、`Δw_k` は重み単位。** 表示は小数1桁。逆転不能なら `sens_k = 0`(FR-09)。

#### 4-6-2. `wStar` が [0,1] に入ることの確認

`feasible` のとき `w_k*` が区間外に出ないことは analysis §3-2 (ii)(iii) が示している(上方向は `d_k < 0` ⟹ `x* ≤ 1`、下方向は `w_k d_k > D₀` ⟹ `x* ≥ 0`)。実装は追加のクランプを**入れない** — クランプすると AC-10 の「閾値まで動かすと厳密に同点」が壊れうるため。代わりに事後条件として `wStar ∈ [−EPS, 1+EPS]` を**表明**し、外れたら開発時に検出できるようにする。

### 4-7. `criticality` — 臨界度ランキング(FR-08 / FR-10 / AC-06)

```ts
function criticality(
  a: number[][], w: number[], scores: number[],
  criteria: Criterion[], options: Option[], winnerIndex: number
): CriticalityRow[]
```

| 項目 | 内容 |
|---|---|
| 付録対応 | `Δ*_k = min over 挑戦者 i の \|Δw_k^(i)\|`、ランキングは `Δ*_k` 昇順 |
| 事前条件 | `winnerIndex ≥ 0`、`options.length ≥ 2`、`D₀ > EPS`(同点でない) |
| 事後条件 | 長さ = `criteria.length`。`\|delta\|` 昇順、`infeasible` は必ず末尾 |
| 事後条件 | `infeasible` な行は `delta = Infinity`、`sens = 0`、`opponentId = null` |

**全挑戦者を走査する(FR-15: 挑戦者の選択は貢献度表示にのみ影響し、臨界度は常に全挑戦者対象):**

```
FOR each 基準 k:
    best ← { delta: Infinity, opponent: null }
    FOR each 選択肢 i ≠ winner:
        d0 ← scores[winner] - scores[i]
        IF d0 <= EPS: CONTINUE                      # 同点の挑戦者は飛ばす
        dk ← a[winner][k] - a[i][k]
        r  ← tippingPoint(d0, dk, w[k])
        IF r.feasible AND |r.delta| < |best.delta| - EPS:
            best ← { delta: r.delta, opponent: i, wStar: r.wStar }
    行[k] ← best
SORT 行 BY (infeasible ? +∞ : |delta|) 昇順、同値なら基準の入力順(安定ソート)
```

**`|r.delta| < |best.delta| - EPS` と EPS を引く理由:** 複数の挑戦者が同じ `|Δw|` を与えるとき、`<` だけだと浮動小数の最下位ビットの揺らぎで「逆転相手」の表示が入力と無関係にちらつく。EPS 分のヒステリシスを入れて**先に見つかった(= 入力順で早い)挑戦者を保持する**。

**AC-06 の反直感的洞察の再現(実測):** DS-1 で並び順は `[移行コスト(6.8pt), 価格(8.6pt), 機能充足度(18.1pt), サポート(逆転不能)]`。最も重みの小さい移行コスト(15%)が、最も重みの大きい価格(35%)より上位に来る。これは `Δw_k = D₀(1−w_k)/(D₀−d_k)` で `w_k` が分子に `(1−w_k)` としてしか現れないのに対し `d_k` が分母に直接入る構造の帰結であり(analysis §3-3)、**特別扱いのコードを1行も書かずに式から出る**。実装がこの順序を出さない場合、それは式の写し間違いである。

### 4-8. `winContribution` — 勝敗貢献度 g_j(FR-13 / AC-11 / AC-12)

```ts
function winContribution(
  a: number[][], w: number[], winnerIndex: number,
  challengerIndex: number, d0: number, criteria: Criterion[]
): Contribution[]
```

| 項目 | 内容 |
|---|---|
| 付録対応 | `g_j = w_j·(a_Wj − a_Lj) / D₀`、`Σ_j g_j = 1` |
| 事前条件 | **`d0 > EPS`**(FR-19: `D₀ = 0` のときは呼ばない) |
| 事後条件 | `\|Σ_j value − 1\| ≤ 1e-12`。`negative = (value < 0)` |
| 縮退 | `d0 ≤ EPS` → **空配列を返す**。呼び出し側(`analyze`)が FR-19 のメッセージに切り替える |
| 実測 | AC-11 で `Σg − 1 = 2.89e-15`、各成分の誤差 `≤ 6.66e-15`。表示 `+300.0 / -85.7 / +57.1 / -171.4` は期待値と完全一致 |

**AC-12 の相互整合(`g_k ≤ 1 ⟺ 基準 k は下方向に逆転不能`)は、テストとして書けるが実装では使わない。** analysis §3-5 の通りこれは `w_k d_k ≤ D₀` と `g_k ≤ 1` が同値であることの言い換えであり、`tippingPoint` の判定と `winContribution` の値が**独立に計算されて一致する**ことに検証の価値がある。片方をもう片方から導出すると、この相互検算が自明化して意味を失う。

### 4-9. `scoreContribution` — スコア貢献度 c_ij(FR-14 / AC-13 / AC-19)

```ts
function scoreContribution(
  a: number[][], w: number[], scores: number[],
  optionIndex: number, criteria: Criterion[]
): Contribution[]
```

| 項目 | 内容 |
|---|---|
| 付録対応 | `c_ij = w_j·a_ij / S_i`、`Σ_j c_ij = 1` |
| 事前条件 | `optionIndex` が有効 |
| 事後条件 | `S_i > EPS` なら `\|Σ value − 1\| ≤ 1e-12` |
| 縮退 | **`S_i ≤ EPS` → 全要素 `{value: null, display: "—"}`**(FR-14 / AC-19) |
| 実測 | AC-13 の3行とも `Σ−1 ≤ 2.22e-16`、表示は9個の期待値と完全一致 |

**AC-19 は「数値・0%・NaN のいずれも表示してはならない」と明示している。** したがって `S_i = 0` の判定は**除算より前**に行い、`0/0 = NaN` を一度も生成しない。`NaN` を作ってから表示側で `isNaN` を見る実装にしない — NaN は §5-6 の通り比較で常に `false` を返し、他所へ漏れると順位を壊すため、**そもそも作らない**のが正しい。

### 4-10. `robustness` — 頑健性ラベル(FR-11 / FR-22 / AC-08 / AC-09 / AC-17)

```ts
function robustness(
  rows: CriticalityRow[], theta: number,
  winnerName: string, challengerName: string
): Robustness
```

| 項目 | 内容 |
|---|---|
| 付録対応 | `Δ* = min_k Δ*_k`、`k* = argmin_k Δ*_k`。`Δ*=∞ → robust` / `Δ* ≤ θ → fragile` / それ以外 `contingent` |
| 事前条件 | `rows` は `criticality` の出力(昇順済み)、`theta ∈ [0,1]` |
| 事後条件 | `label` は3値のいずれか。`verdict` は必ず非空文字列 |
| 事後条件 | **`label = "robust"` なら `caveat` は必ず非 null**(FR-22) |
| 縮退 | `rows` が空(基準0個)→ `analyze` が `no-criteria` で先に弾く |

**判定に EPS を使う位置:**

```
deltaStar ← rows[0].infeasible ? Infinity : |rows[0].delta|
IF deltaStar = Infinity        → "robust"
ELSE IF deltaStar <= theta + EPS → "fragile"      # 境界は fragile 側に含める
ELSE                            → "contingent"
```

境界(`Δ* = θ` ちょうど)を `fragile` に含めるのは FR-11 の `Δ* ≤ θ → fragile` の記述通りである。EPS を足すのは、`θ = 0.10` に対し `Δ*` が `0.09999999999999999` と `0.10000000000000001` のどちらに落ちるかで**ラベルが変わってしまう**のを防ぐため。ラベルは製品の一次出力であり、最下位ビットで反転してはならない。

**実測:** AC-08 で `Δ* = 0.068390804597701` → 表示 `6.8`、`6.839… ≤ 10` より **fragile** ✓。AC-09 で `θ = 0.05` に変えると `6.839… > 5` かつ有限より **contingent** ✓、`Δ*` と `k*` は θ に依らず不変 ✓。AC-17(DS-2)で3基準とも `dominant` → `Δ* = ∞` → **robust** ✓、`caveat` 付与 ✓。

**文言生成(prd §5-1 / §5-2 を正典とする):** `verdict` は次の要素を順に連結する。

```
1. [fragile/contingent] 「{W} の1位は、{k*} の重みを {w_k}% から {x*}%({±Δ}ポイント)に
                          動かすと {L} に入れ替わります。他の {r} 個の基準では単独で逆転しません。」
   [robust]             「{W} の1位は、どの単一基準の重みを 0% から 100% のどこに動かしても
                          入れ替わりません。」
2. 2番目以降の実行可能な基準を列挙: 「{k₂} を {x₂}% まで{上げて/下げて}も同じことが起きます。」
3. 逆転不能な基準を列挙:            「{k_dom} の重みは単独では結論を変えません。」
4. [robust のみ] caveat:            「基準そのものが抜けている可能性は、この分析では検出できません。」
```

`{r}` は逆転不能と判定された基準の個数。`{上げて/下げて}` は `delta > 0` なら「上げて」、`delta < 0` なら「下げて」。**この文言生成も L1 に置く**(D-1)ため、AC-08 の期待文字列を Node のテストで直接検証できる。

### 4-11. `anchoringDetect` — 結論ありき逆算の検知(FR-18 / AC-21)

```ts
function anchoringDetect(history: WeightEdit[], threshold: number): AnchoringResult
```

| 項目 | 内容 |
|---|---|
| 付録対応 | 重み編集履歴で1位が入れ替わった回数 `f ≥ 3` → 警告 |
| 事前条件 | `history` は時刻昇順、`threshold ≥ 1` |
| 事後条件 | `edits = history.length`、`flips = count(e => e.leaderBefore ≠ e.leaderAfter)` |
| 事後条件 | `warn = (flips ≥ threshold)`。`warn` が偽なら `message = null` |
| 縮退 | `history` が空 → `{edits:0, flips:0, warn:false, message:null}` |
| **禁止** | **この関数は時計を読まない。** `at` は既に履歴に焼かれている(C-5: `Date` はコア領域で禁止) |

**`leaderBefore` / `leaderAfter` の両方を履歴に持たせる設計(§3-1)の効き目:** `f` の計算が履歴だけで自己完結し、「セッション開始時の1位」という外部状態を要さない。AC-21 の検証列は

| 編集 | leaderBefore | leaderAfter | flip |
|---|---|---|---|
| 1 (15%→25%) | ベンダーB | ベンダーA | ✓ |
| 2 (25%→15%) | ベンダーA | ベンダーB | ✓ |
| 3 (15%→30%) | ベンダーB | ベンダーA | ✓ |

で `N = 3`、`f = 3 ≥ 3` → 警告。**実測で各編集後の1位が AC-21 の表と一致することを確認済み**(x=0.25 → ベンダーA、x=0.15 → ベンダーB、x=0.30 → ベンダーA、重み6桁表示も `30.882353 / 26.470588 / 17.647059 / 25.000000` および `28.823529 / 24.705882 / 16.470588 / 30.000000` で完全一致)。

**メッセージ(prd §5-4 正典、`{}` のみ置換):**
```
重みを {N} 回編集する間に1位が {f} 回入れ替わっています。
結論に合わせて重みを調整していないか確認してください。
```
**警告は表示のみで、編集をブロックしない**(FR-18)。したがってこの関数の返り値は `analyze` の結果に**混ぜるだけ**で、他のどの値にも影響を与えない。

### 4-12. `applyCutoffs` — 足切り(FR-20 / AC-16)

```ts
function applyCutoffs(
  a: (number|null)[][], criteria: Criterion[], options: Option[]
): { includedIndices: number[]; excluded: { index: number; text: string }[] }
```

| 項目 | 内容 |
|---|---|
| 事前条件 | `a` は正規化済み(0-1)、`criteria[j].cutoff` は **0-10 尺度**(FR-20 の記述通り) |
| 事後条件 | `includedIndices ∪ excluded.index` = 全選択肢の index、交差は空 |
| 判定 | 選択肢 i は、ある基準 j で `a[i][j] × 10 < cutoff_j − EPS` なら除外 |
| 縮退 | 全 `cutoff` が `null`(既定)→ 全件 `included`、`excluded` は空 |
| 縮退 | **全件が除外された** → `analyze` が `all-excluded` を返す(§8-7) |
| 文言 | prd §5-8: `「{選択肢名} — {基準}が最低ライン{v}を下回るため除外」` |

**加重和の「前段」で効かせる(FR-20 / analysis §5-1)。** すなわち `applyCutoffs` → `computeScores` → `rank` → `criticality` の順であり、除外された選択肢は**挑戦者としても数えない**。

**AC-16 の集合非依存性の確認(実測):** DS-1 で移行コストに最低ライン 3.0 を設定するとベンダーC(正規化後 2.0)のみ除外され、残る2件の `S` は `['63.5', '67.0']` で AC-01 と厳密に同一。`Δ*` も `6.8pt`、`k* = 移行コスト`、ラベル `fragile` で AC-08 と一致。これは固定尺度(FR-03)により `a_ij` が集合非依存であることの直接の帰結である。

### 4-13. `analyze` — 単一の入口(FR-06 / FR-19)

```ts
function analyze(state: AppState): Analysis
```

**唯一の公開エントリポイント。** L3 はこれ1つだけを呼ぶ。上記の全関数はここから呼ばれ、`Analysis` に畳み込まれる。

| 項目 | 内容 |
|---|---|
| 事前条件 | `state` は `validateState` を通過済み |
| 事後条件 | 例外を投げない。**いかなる入力に対しても `Analysis` を返す** |
| 事後条件 | `ok = false` のとき `degenerate ≠ null` かつ `message ≠ null` |

**退化判定の順序(FR-19 / prd §5-3。この順で最初に当たったものを返す):**

```
1. criteria.length = 0                    → "no-criteria"     「何で比べるかを決めてください。基準を1つ以上足してください。」
2. options.length  = 0                    → "no-options"      「まず、比べたいものを2つ以上足してください。」
3. options.length  = 1                    → "one-option"      「比べる相手がいません。選択肢をもう1つ足してください。」
4. 未入力セルが c 個 (c > 0)               → "unfilled-cells"  「未入力のセルが {c} 個あります。埋めるまで結論は出せません。」
5. applyCutoffs で残り 0 件                → "all-excluded"    §8-7
6. applyCutoffs で残り 1 件                → "one-option"
7. rank().tied  (D₀ ≤ EPS)                → "tie"             「同点です。基準またはスコアを見直してください。」
   ★このとき robustness = null、winContrib = [] とする(FR-19 / AC-18)
8. それ以外                                → ok = true
```

**順序が意味を持つ理由:** 4 を 7 より前に置くのは、未入力セルを 0 とみなして「同点です」と言うのが誤誘導だからである。5/6 を 7 より前に置くのは、足切りが加重和の前段だからである(FR-20)。

**`ok = false` でも計算できる部分は計算する。** 例えば `tie` のとき順位表とスコアは表示してよい(AC-18 が禁じているのは頑健性ラベルと `g_j` のみ)。`Analysis` の該当フィールドだけを `null` / `[]` にする。

**実測(AC-18 / DS-3):** `S_X = 0.6`、`S_Y = 0.6000000000000001`、差 `−1.11e-16`。**厳密には同点だが float では 0 でない。** `D₀ ≤ EPS` という EPS 付き判定でなければ AC-18 は通らない。これが §5 の epsilon が必要な最も直接的な理由である。

### 4-14. `fmt` — フォーマッタ群(D-1)

```ts
const fmt = {
  score:   (s: number) => string,   // S_i → "67.0"        (×100, 小数1桁)
  weight:  (w: number) => string,   // w_j → "35.0"         (×100, 小数1桁)
  weight6: (w: number) => string,   // w_j → "30.882353"    (×100, 小数6桁) AC-15/AC-21
  points:  (d: number) => string,   // Δw  → "+6.8" / "-8.6" (×100, 小数1桁, 必ず符号)
  percent: (g: number) => string,   // g_j → "+300.0" / "-171.4"
  sens:    (s: number) => string,   // sens → "14.6"         (重み単位の逆数, 小数1桁) §4-6-1
  dash:    ()          => "—",      // 未定義値 FR-14 / AC-19
};
```

事後条件: 全て文字列を返す。**`NaN` / `Infinity` を渡された場合は `"—"` を返す**(画面に `NaN` の4文字を出さないための最後の砦)。

`points` と `percent` は**必ず符号を付ける**(FR-10④「必ず符号付き」/ FR-13)。`+0.0` にならないよう、値が `[-0.05, 0.05)` に入る場合の符号は元の値の符号で決める。

**実測: §5-3 で AC が要求する表示文字列29個すべてが `toFixed` 相当の丸めで一致することを確認済み(不一致 0 件)。**

---

## 5. 数値精度の方針

**本節の全ての数値は、Python の `float`(IEEE754 binary64、JavaScript の `Number` と同一表現)と `fractions.Fraction` による厳密値を突き合わせた実測である。** 推定値・概算は含まない。

### 5-1. 基本方針 — 有理数演算を実装しない

analysis と prd は厳密分数で検算されているので、実装も有理数でやりたくなる。**採らない。**

| 案 | 判断 |
|---|---|
| `BigInt` による有理数演算 | **不採用。** コアの全関数が2〜3倍に膨らみ、単一HTMLの可読性を大きく損なう。かつ後述の実測通り不要 |
| 固定小数点(整数 × 10^k) | **不採用。** `Δw = D₀(1−w_k)/(D₀−d_k)` は本質的に除算であり、有理数にしないなら固定小数点でも丸めが出る |
| **`Number`(binary64)+ 明示的な EPS** | **採用。** 実測で要求 `1e-9` に対し6桁以上の余裕がある |

### 5-2. 誤差の実測

**測定A — DS-1 / DS-2 / DS-3 の全 AC 値:**

| 量 | float 値 | 厳密値 | 絶対誤差 |
|---|---|---|---|
| `Σw`(AC-03) | `0.9999999999999999` | 1 | `1.11e-16` |
| `Σw`(AC-04, 合計12) | `1.0` | 1 | `0.00e+00` |
| `S_A`(AC-01) | `0.635` | 127/200 | `0.00e+00` |
| `S_B`(AC-01) | `0.6699999999999999` | 67/100 | `1.11e-16` |
| `S_C`(AC-01) | `0.51` | 51/100 | `0.00e+00` |
| `D₀`(AC-02) | `0.03499999999999992` | 7/200 | `7.63e-17` |
| `Δw` 移行コスト(AC-05) | `0.068390804597701` | 119/1740 | `1.53e-16` |
| `Δw` 価格(AC-05) | `-0.08584905660377336` | −91/1060 | `2.22e-16` |
| `Δw` 機能充足度(AC-05) | `0.1814814814814812` | 49/270 | `3.05e-16` |
| `Σg`(AC-11) | — | 1 | `2.89e-15` |
| `Σc` 各行(AC-13) | — | 1 | `≤ 2.22e-16` |
| `S_P`(AC-17) | `0.685` | 137/200 | `0.00e+00` |
| `D₀`(AC-17) | `0.29500000000000004` | 59/200 | `5.55e-17` |

**測定B — 最悪規模での無作為試行(m=10, n=10, 1000試行、重みは1〜100の整数、スコアは0.5刻み):**

```
最大 |S_i − 厳密 S_i|      = 2.220e-16
最大 |Σw − 1|              = 3.331e-16
閾値適用後の同点残差の最大   = 4.441e-16
```

**測定C — 厳密に同点(D₀ = 0)になる入力を77件生成し、float での残差を測定:**

```
最大残差 = 1.1102e-16   平均 = 1.694e-17   非ゼロ率 = 20.8%
```

**測定D — 構造的に到達しうる最小の非ゼロギャップ:**

重みの生値は 0-100 の整数(FR-26⑤ の1ポイント刻み)、`n ≤ 10` なので `Σŵ ≤ 1000`。スコアは 0.5 刻みなので `a_ij` の分母は 20。したがって `S_i − S_j` は分母が `20 × Σŵ ≤ 20000` の有理数であり、

```
最小の非ゼロ |S_i − S_j| = 1/20000 = 5.00e-05      (表示 5.00e-03 ポイント)
```

### 5-3. 表示丸めと内部値の分離

> **設計判断 D-8: 内部値は常に丸めない。丸めるのは `fmt.*` が文字列を作る一瞬だけで、丸めた値を計算に戻さない。**

丸めた値を計算に戻す実装(例: 重みを表示用に 0.1% 刻みに丸めてから再正規化する)は、AC-10 / AC-15 / AC-21 の「合計が厳密に1」を確実に壊す。§5-2 測定Bの通り、丸めなければ `|Σw − 1| ≤ 3.33e-16` に留まる。

**丸め方式:** `toFixed(n)` 相当(binary64 の値を10進 n 桁に最近接丸め)。**AC が要求する表示文字列29個すべてで期待値と一致することを実測で確認した(不一致 0 件)。** 検証した値には次のような「危うい」ものが含まれる:

| AC | 内部値 | 表示 | 期待 |
|---|---|---|---|
| AC-05 | `6.839080459770115` | `6.8` | `6.8` ✓ |
| AC-05 | `-8.584905660377336` | `-8.6` | `-8.6` ✓ |
| AC-04 | `41.666666666666664` | `41.7` | `41.7` ✓ |
| AC-11 | `-171.42857142857142` | `-171.4` | `-171.4` ✓ |
| AC-13 | `5.882352941176471` | `5.9` | `5.9` ✓ |
| AC-10 | `27.586206896551722` | `27.6` | `27.6` ✓ |
| AC-15 | `23.076923076923077` | `23.1` | `23.1` ✓ |

**ただし丸め境界そのものは信用しない。** 実測:

```
0.15  の binary64 実体 = 0.1499999999999999944…  → "%.1f" → 0.1   (0.2 ではない)
0.45  の binary64 実体 = 0.4500000000000000111…  → "%.1f" → 0.5
21.85 の binary64 実体 = 21.8500000000000014210…  → "%.1f" → 21.9
63.55 の binary64 実体 = 63.5499999999999971578…  → "%.1f" → 63.5
```

**`.x5` ちょうどに見える値の丸め方向は、10進の直観と一致しない。** 幸い AC-01〜AC-23 の期待値にこの境界に乗るものは1つも無い(実測で確認済み)。しかしユーザーの任意入力では起こりうるので、**設計として「丸め境界での方向は仕様に含めない」と明記する。** 表示が `21.8` か `21.9` かで意味が変わる画面を作らない — 実際 FR-10 は `Δw_k` を表示すると同時に**必ず逆転相手の名前と理由文を併記**させており、丸めの1桁目に判断を負わせない設計になっている。

**表示桁数の使い分け:**

| 用途 | 桁 | 根拠 |
|---|---|---|
| 総合スコア `S_i × 100` | 小数1桁 | AC-01 `67.0` |
| 重み `w_j × 100`(通常) | 小数1桁 | AC-03 `35.0%` / AC-04 `41.7%` |
| 重み `w_j × 100`(検証時) | 小数6桁 | AC-15 `23.076923` / AC-21 `30.882353` |
| `Δw_k`(ポイント) | 小数1桁 + 符号 | AC-05 `+6.8` / FR-10④ |
| 貢献度 `g_j` / `c_ij` | 小数1桁 + 符号 | AC-11 `-171.4` / AC-13 `31.3` |
| `sens_k` | 小数1桁 | AC-05 `14.6`(**重み単位の逆数** §4-6-1) |

AC-04 が明記する通り、**丸め表示の合計が 100.1% になりうるが、内部値の合計は厳密に 1 である。** これは仕様であって不具合ではない。UI では重みの合計を「100.0%」と別途表示せず、各行の値のみを出す(合計を出すと丸め誤差が見えてしまい、かえって不信を招く)。

### 5-4. 同点判定の epsilon

> **設計判断 D-9: `EPS = 1e-9` を単一の定数として定め、全ての「ゼロとの比較」「同値比較」に用いる。**

**根拠(実測値の3点で挟む):**

```
① float の雑音の上限(測定B/C)          : 2.22e-16
② prd §7-2-4 が要求する許容差            : 1.00e-09      ← EPS
③ 構造的に到達しうる最小の非ゼロ差(測定D): 5.00e-05
```

- `EPS` は ①の **4.5×10⁶ 倍**。あらゆる float 雑音を確実に飲み込む。
- `EPS` は ③の **1/50000**。**実在する最小の差を「同点」と誤判定することがない。**
- `EPS` は prd が要求する許容差そのものなので、「AC を通す閾値」と「実装が使う閾値」が一致し、二重管理にならない。

上下に 6桁 / 4.7桁 の余裕があり、この選択は安全域の中央付近にある。

**EPS を使う箇所(全列挙):**

| # | 箇所 | 比較 | 根拠 AC |
|---|---|---|---|
| E-1 | 1位の同点判定 | `S_W − S_2 ≤ EPS` → `tie` | AC-18(float 残差 `−1.11e-16`) |
| E-2 | 挑戦者ごとの `D₀` | `d0 ≤ EPS` → その挑戦者を飛ばす | FR-19 |
| E-3 | 実行可能性(上げて) | `d_k < −EPS` | FR-09 / AC-07 |
| E-4 | 実行可能性(下げて) | `w_k·d_k > D₀ + EPS` | FR-09 / AC-07 |
| E-5 | 閾値の分母 | `\|D₀ − d_k\| ≤ EPS` → 逆転不能 | FR-09(`d_k = D₀`) |
| E-6 | 比例再正規化 | `w_k ≥ 1 − EPS` → 恒等写像 | §4-3 縮退 |
| E-7 | ラベル境界 | `Δ* ≤ θ + EPS` → fragile | FR-11 |
| E-8 | スコア貢献度 | `S_i ≤ EPS` → `"—"` | AC-19 |
| E-9 | 重み総和 | `Σŵ ≤ EPS` → 等重み | §8-2 |
| E-10 | argmin のヒステリシス | `\|δ\| < \|best\| − EPS` | §4-7(表示のちらつき防止) |
| E-11 | 足切り | `a×10 < cutoff − EPS` | AC-16 |

**`===` による 0 との比較を1箇所も書かない。** 上の11箇所が全てであり、コードレビューはこのリストとの突合で行う。

### 5-5. ゼロ除算の全発生箇所と回避

JavaScript の除算は例外を投げない。`x/0` は `Infinity`(x>0)/ `-Infinity`(x<0)/ `NaN`(x=0)を返して**静かに伝播する**。したがって「try/catch で守る」ことができず、**除算の直前に分母を検査する以外に方法がない。**

| # | 式 | 分母が0になる条件 | 回避 | 根拠 |
|---|---|---|---|---|
| Z-1 | `w_j = ŵ_j / Σŵ` | 全ての重みが0 | E-9: `Σŵ ≤ EPS` → 等重み `1/n` + 警告 | §8-2 |
| Z-2 | `c_ij = w_j a_ij / S_i` | `S_i = 0`(全セル0) | E-8: **除算前**に判定し `"—"` を返す。`NaN` を生成しない | AC-19 |
| Z-3 | `g_j = w_j d_j / D₀` | `D₀ = 0`(1位が同点) | E-1 で `tie` と判定し、`winContribution` を**呼ばない** | AC-18 / FR-19 |
| Z-4 | `Δw = D₀(1−w_k)/(D₀−d_k)` | `d_k = D₀` | **D-7 により到達不能**(手順4の実行可能性判定が先に `dominant` を返す)。加えて E-5 を数値的安全弁として置く | FR-09 |
| Z-5 | `w_j(x) = w_j(1−x)/(1−w_k)` | `w_k = 1`(単独100%) | E-6: `w_k ≥ 1−EPS` → 恒等写像を返す | analysis §3-0 の仮定 `w_k < 1` |
| Z-6 | `sens_k = 1/\|Δw_k\|` | `Δw_k = 0` | **構造的に不可能。** 分子 `D₀(1−w_k)` は `D₀ > EPS` かつ `w_k < 1−EPS` のとき常に正なので `Δw ≠ 0`。加えて infeasible 側は `sens = 0` を直接返し除算しない | §4-6 |
| Z-7 | バー幅 `= value / max × 100` | 全ての値が0 | L2 側。`max ≤ EPS` なら全バーを幅0で描く | FR-25 |
| Z-8 | `a_ij = raw/10` | — | 定数除算。発生しない | — |

**Z-4 の到達不能性は §4-6 D-7 で証明した。** Z-6 の不可能性も同様に構造的であり、この2つは「防御コードは書くが、実行されたら設計の破れである」という位置づけになる。開発時は表明(assertion)を置き、本番では縮退値を返す。

### 5-6. NaN の遮断

実測:
```
NaN > 1  → false
NaN < 1  → false
NaN === NaN → false
```

**NaN は全ての比較で `false` を返すため、`sort` / `max` に混入すると順位が「入力順に依存した無意味な列」になる。** しかも例外は出ないので、**画面に嘘の順位が出る**。これは本製品で最も危険な故障モードである(§8-5)。

> **設計判断 D-10: NaN は生成しない・受け取らない・作られたら入口で止める、の3段で防ぐ。**
>
> 1. **生成しない** — Z-1〜Z-8 の全てで除算前に分母を検査する(§5-5)。
> 2. **受け取らない** — `validateState`(§3-6)が生スコアと重みの `Number.isFinite` を検査し、通らないものを `null` / `0` に落とす。
> 3. **入口で止める** — `analyze` は先頭で `a` と `w` の全要素に `Number.isFinite` を掛け、1つでも偽なら `degenerate: "unfilled-cells"` 相当に落として計算を打ち切る。
>
> `fmt.*` も最後の砦として `NaN`/`Infinity` に `"—"` を返す(§4-14)。**画面に文字列 `NaN` が出る経路を1本も残さない。**

### 5-7. AC の `1e-9` をどう満たすか — まとめ

prd §7-2-4 は「浮動小数実装の場合、本 PRD の厳密分数値との差が `1e-9` 以内であること」を要求する。

1. **測定A** で DS-1 / DS-2 / DS-3 の全 AC 値が厳密値と `≤ 3.05e-16` で一致することを確認した。要求の **3×10⁻⁷ 倍**、すなわち **6桁以上の余裕**がある。
2. **測定B** で prd の上限規模(m=10, n=10)1000試行でも最大誤差が `2.22e-16` に留まることを確認した。規模を上げても誤差は増えない — 加算回数が `n ≤ 10` と小さく、丸め誤差が蓄積する余地がないためである。
3. **有理数演算は不要。** binary64 で要求を6桁上回る。
4. **テストは `EPS = 1e-9` を許容差として `assertClose(actual, exact, 1e-9)` の形で書く。** 実装が使う閾値とテストが使う許容差を同一の定数にすることで、片方だけが緩む事故を防ぐ。
5. **表示文字列は完全一致で表明する。** `assertEqual(vm.displayScore, "67.0")` — 丸め後は離散値なので許容差の概念が要らず、より強い表明になる(§5-3 で29個すべて一致を実測)。

---

## 6. レンダリング戦略

### 6-1. 再計算と再描画の分離

FR-06 は「計算ボタンを持たない」ライブ更新を要求する。素朴に「入力のたびに DOM を作り直す」と、**ユーザーが今まさに打ち込んでいる `<input>` が消えて再生成され、フォーカスとカーソル位置が飛ぶ。** これは実際に打てなくなるレベルの故障である。

> **設計判断 D-11: 「再計算は常に全部、再描画は差分だけ、DOM の生成は構造変化のときだけ」の3層に分ける。**

| 段 | いつ | 何をするか |
|---|---|---|
| **再計算** | 入力イベントのたび **必ず全部** | `analyze(state)` を丸ごと呼び直す。部分計算・キャッシュ・メモ化を**一切しない** |
| **再描画** | 再計算のたび | ViewModel の各フィールドを前回と比較し、**変わった箇所のテキストだけ**書き換える |
| **DOM 生成** | 構造変化のときだけ | 選択肢/基準の追加・削除・並べ替え・復元時のみ、行や列の要素を作る/消す |

**再計算を部分化しない理由:** §7 の通り全再計算は 10×10 の最悪ケースで約1140演算であり、16ms の予算の1/1000未満で終わる。部分計算は速度を1ミリも改善せず、「重みだけ変えたときスコア貢献度の更新を忘れる」種類のバグを生むだけである。**単純さが正しさを買える場面で、複雑さを買わない。**

### 6-2. 描画領域の分割

`Analysis` の各フィールドが、それぞれ1つの描画領域に対応する。

| 領域 | 依存する ViewModel | 更新方法 |
|---|---|---|
| `#verdict`(一次出力文 FR-07/FR-11) | `robustness.verdict` / `labelLine` / `caveat` | 文字列比較 → `textContent` 差し替え |
| `#ranking`(順位表 FR-07) | `ranking[].displayScore` / `rank` | 行数不変なら各セルの `textContent` のみ |
| `#criticality`(臨界度 FR-10) | `criticality[]` | **並び順が変わるので §6-4 で扱う** |
| `#win-contrib`(勝敗貢献度 FR-13) | `winContrib[]` | バー幅(`style.width`)+ 数値ラベル |
| `#score-contrib`(スコア貢献度 FR-14) | `ranking[].contribution` | 同上 |
| `#weights`(重み FR-05) | `weights[]` | **フォーカス保護あり §6-3** |
| `#grid`(スコア入力 FR-01) | 入力そのもの | **原則書き戻さない §6-3** |
| `#warnings`(FR-02/FR-18/FR-20) | `warnings` / `anchoring` / `excluded` | 文字列比較 |

**書き込みは1フレームにまとめる。** 入力イベントで `analyze` を同期実行し、結果を保持して `requestAnimationFrame` で1回だけ DOM に流す。同一フレーム内で複数のイベント(スライダーのドラッグは連続発火する)が来ても描画は1回で済む。

### 6-3. フォーカスを失わずにグリッドと重みを更新する

> **設計判断 D-12: 「フォーカスを持つ要素の `.value` には、決して書き戻さない。」**

これが本節の中心規則である。

**スコアセル(`#grid` の `<input type=number>`):**

```
ユーザーが打った値は state に流れ込むが、state から input へは戻さない。
つまりスコア入力は「一方向」である。

on input(cell):
    v ← parseScore(cell.value)        # 空文字 → null、非数 → null
    store.setScore(optionId, criterionId, v)
    # ★ cell.value には触らない

再描画時:
    IF cell === document.activeElement:  SKIP     # 触らない
    ELSE IF cell.value ≠ 期待表示:        書き戻す  # 復元・全消去・修復のときだけ実際に動く
```

書き戻しが必要になるのは「localStorage からの復元」「全消去」「`validateState` による修復」の3場面だけで、いずれもユーザーがそのセルにフォーカスしていない。**通常のタイピング中は書き戻し経路に一度も入らない。**

`step=0.5` の丸め(§3-6 の `repaired`)を**入力中に適用しない**ことも重要である。ユーザーが `7` を消して `8` を打つ途中の空文字や、`0.` のような中間状態を即座に矯正すると入力が破壊される。**丸めは blur 時と復元時にのみ適用する。**

**重みスライダー(`#weights` の `<input type=range>` + 数値入力):**

こちらは事情が違う。FR-05 により、**基準 k を動かすと他の n−1 個のスライダーの値が変わる**ので、書き戻しが必須である。

```
on input(slider_k):
    x ← slider_k.value / 100
    w' ← TenbinCore.reweight(currentW, k, x)
    store.setWeights(w')                        # rawWeight に書き戻す(D-4)

再描画時 for each slider_j:
    IF slider_j === document.activeElement:  SKIP        # ★ドラッグ中の自分には触らない
    ELSE:  slider_j.value ← round(w[j] × 100)
```

**ドラッグ中のスライダー自身に書き戻すと、値が微妙にずれて「つまみが指から逃げる」現象が起きる。** `reweight` は `w'[k] = x` を保証するので(§4-3 事後条件)、書き戻さなくても状態と表示は一致している。

**数値直接入力(FR-26⑤ の併設フィールド)** も同じ規則に従う。スライダーと数値入力は互いの相手であり、片方にフォーカスがある間はもう片方だけを更新する。

**ペアの同期:** スライダーと数値入力は同じ `criterionId` を共有する。`document.activeElement` がそのペアのどちらかであれば、**ペアの両方**をスキップする(数値入力中にスライダーが動くと視覚的に落ち着かないため)。

### 6-4. 並び順が変わる表(臨界度ランキング)

`#criticality` は `|Δw_k|` 昇順(FR-10)なので、重みを動かすと**行の順番が入れ替わる**。行を作り直すと、その中のボタンにフォーカスがあった場合に失われる。

> **設計判断 D-13: 行要素は基準 `Id` をキーとして生成時に1度だけ作り、以後は使い回す。順序変更は `appendChild` による並べ替えで行う。**

```
再描画 for #criticality:
    rows ← analysis.criticality                 # 既に昇順
    FOR each row IN rows:
        el ← rowElementsById[row.criterionId]   # 既存要素を取得(なければ生成)
        更新: el の各セルの textContent を差分更新
        container.appendChild(el)               # ★既存要素の移動として働く
```

`appendChild` は既に DOM 内にある要素に対しては**移動**として働くので、要素の同一性が保たれフォーカスも生き残る。全行に対してこれを順に呼べば、結果として正しい順序に並ぶ。

「逆転不能」の行は `delta = Infinity` なので昇順ソートで自動的に末尾に来る(§4-0)。**末尾に置くための特別な分岐を書かない。**

### 6-5. `aria-live` の更新頻度

FR-26③ は「頑健性ラベルの更新は `aria-live="polite"` 領域に流す」ことを要求する。しかし FR-06 のライブ更新と素直に組み合わせると、**スライダーを1回ドラッグするだけで数十回の読み上げが発生し、スクリーンリーダー利用者にとって使用不能になる。**

> **設計判断 D-14: 視覚的な結論表示は即時更新するが、`aria-live` 領域への書き込みは「入力が 600ms 止まってから」「かつ文字列が実際に変わったときだけ」行う。**

```
#verdict          … 視覚用。即時更新。aria-hidden="true"
#verdict-live     … スクリーンリーダー用。aria-live="polite"。視覚的に隠す(sr-only)
                    600ms のデバウンス後、前回と異なる場合のみ textContent を更新
```

視覚領域を `aria-hidden` にして読み上げ専用の双子を置くのは、同じ文言が二重に読まれるのを防ぐためである。**内容は完全に同一の文字列**(どちらも `robustness.verdict`)なので、見えているものと読まれるものが食い違わない。

600ms はキーストローク間隔(通常 100〜300ms)より長く、「入力を止めて結果を待つ」動作の体感(1秒未満)より短い値として選んだ。**これは経験則であり理論的裏付けを持たない** — prd が θ=0.10 の由来を明示させている(FR-12)のと同じ規律で、設定値としてコード上にコメントを残す。

### 6-6. 描画に使ってよい手段(FR-25)

- 貢献度バー: `<div>` の `style.width = "…%"` のみ。負値(FR-13 の逆符号)は中央を0とする左右2分割のバーで表現する。
- 臨界度の視覚化: 同上。
- アイコン形状(FR-26④ の robust/fragile/contingent の区別): **inline SVG**(`<svg><path d="…"/></svg>`)。外部アイコンフォントは FR-23 違反。
- 数値ラベルは**必ず併記**する(FR-26① / FR-13)。バーの長さだけで意味を伝えない。
- **canvas を使わない。** テキストが選択できず、スクリーンリーダーから読めず、ズーム200%(FR-26⑥)で粗くなる。

---

## 7. 計算量と上限

### 7-1. 記号

`m` = 選択肢数(FR-02: 上限10)、`n` = 基準数(FR-02: 上限10)。

### 7-2. 各段の計算量

| 段 | 計算量 | 根拠 |
|---|---|---|
| 正規化 `a_ij` | `O(m·n)` | 各セル1回の定数演算 |
| 重み正規化 `w_j` | `O(n)` | 総和1回 + 除算 n 回 |
| 足切り `applyCutoffs` | `O(m·n)` | 各セルを1回比較 |
| 総合スコア `S_i` | `O(m·n)` | m 個の内積、各 n 項 |
| 順位 `rank` | `O(m log m)` | 比較ソート |
| **逆転閾値(全基準 × 全挑戦者)** | **`O(n·m)`** | `n × (m−1)` 個のペア、各ペアは `tippingPoint` の定数演算 |
| 臨界度のソート | `O(n log n)` | |
| 勝敗貢献度 `g_j` | `O(n)` | |
| スコア貢献度 `c_ij` | `O(m·n)` | 全セル |
| 逆算検知 | `O(h)` | `h` = 履歴長(上限500、§3-5) |

> ### **全体: `O(m·n)`**
>
> 感度分析(`n × (m−1)` ペア)が支配項だが、これも `m·n` のオーダーである。**選択肢数と基準数の積に線形**であり、指数的・二次的に膨らむ段は1つも無い。analysis §3-4 が「1位が関わるペアのみ」に限定した効果で、総当たり `2 × (n × m(m−1)/2) = O(n·m²)` から1次下がっている。

### 7-3. prd 上限値での実際の演算回数(実測カウント)

`m = 10`, `n = 10`:

| 段 | 演算回数 |
|---|---|
| 正規化 `a_ij` | `m·n` = **100** |
| 重み正規化 | `2n` = **20** |
| 総合スコア | `m·n` 乗算 + `m(n−1)` 加算 = `m(2n−1)` = **190** |
| 順位ソート | `≈ m log₂m` ≈ **30** 比較 |
| **逆転閾値** | `n(m−1)` = **90 ペア** × 約8演算 = **720** |
| 勝敗貢献度 | `n` = **10** |
| スコア貢献度 | `m·n` = **100** |
| **合計** | **約 1,140 演算 / 全再計算1回** |

analysis §4-2 が「最悪 `n × (m−1) = 90` 個の分数計算」と述べた見積りと一致する(90ペアが感度分析の中核であり、周辺を含めて約1140演算)。

**知覚閾値との比較:** 16ms(60fps の1フレーム)で現代の JS エンジンは概ね 10⁶〜10⁷ の単純演算を実行できる。1,140 演算は**予算の 1/1000 未満**であり、FR-06 の「計算ボタンを持たない」ライブ更新は余裕をもって成立する。

**実際のボトルネックは計算ではなく DOM である。** 10×10 のグリッドは100個の `<input>` を持ち、臨界度10行・貢献度20行と合わせて描画対象は数百ノードになる。§6-1 で「再計算は全部・DOM 生成は構造変化時のみ」と分けたのは、この非対称性(計算は1000倍安く、DOM は1000倍高い)に基づく。**最適化すべきは `analyze` ではなく描画であり、`analyze` のメモ化は投資先を間違えている。**

### 7-4. 上限を10に留める効き目

もし上限が無ければ `O(m·n)` は素直に伸びるが、FR-02 が `m ≤ 10`, `n ≤ 10` を課しているため、**最悪ケースが定数で押さえられる**。この設計は「規模が大きくなったときの振る舞い」を考慮する必要がない — 大きくならないことが仕様で保証されている。

上限は認知負荷を根拠に決まったもの(analysis §4-2: 1000minds「基準が増えるほど回答者が圧倒される」)だが、**結果として実装の複雑さも消している。** 仮想スクロール、ページング、Web Worker、増分計算のいずれも不要になる。

### 7-5. localStorage の書き込み頻度

FR-16 は「入力の変更ごとに保存」を要求するが、キーストロークごとの `setItem` は同期 I/O であり、`JSON.stringify` と合わせて描画を詰まらせうる。

> **設計判断 D-15: 保存は 300ms のデバウンスをかける。ただし「重み編集の確定」「選択肢/基準の追加・削除」「全消去」は即時に書く。**

10×10 の `AppState` は概ね 3〜6 KB(JSON)で、`stringify` + `setItem` は 1ms 未満。デバウンスは性能というより**書き込み回数を減らして SSD 寿命とブラウザの内部整合に優しくする**ためのものである。デバウンス中にタブが閉じられる可能性に備え、`visibilitychange` (`hidden`) で即時フラッシュする(`beforeunload` は モバイルで発火しないことがあるため両方に掛ける)。

---

## 8. 失敗モード一覧

各項目は「**何が壊れるか** / **なぜ壊れるか** / **防御** / **確認方法**」で書く。

### 8-1. localStorage が使えない環境

**壊れ方:** Safari のプライベートブラウジング、`file://` での一部設定、ストレージ無効化ポリシー下では `localStorage` へのアクセス自体が `SecurityError` を投げる、あるいは `setItem` が `QuotaExceededError` を投げる。**素朴な実装では起動時に例外で白画面になる。**

**防御:**
1. 起動時に **capability probe** を1回だけ実行する: `tenbin.v1.__probe` に書いて読んで消す、を try/catch で囲む。
2. 失敗したら `storageAvailable = false` を立て、**アプリは通常通り起動する**(計算機能は localStorage に一切依存しない — L1 は純粋関数であり、L3 はメモリ上に状態を持つ)。
3. 常時表示のプライバシー文言(prd §5-5)を差し替える:
   ```
   このブラウザではデータを保存できません。
   このページを閉じると入力は失われます。(どこにも送信していません。)
   ```
4. 以後の `save()` は**何もしない**(毎回 try/catch する必要をなくす)。
5. `QuotaExceededError`(容量超過)は別扱いとし、まず `history` を半分に切り詰めて1回だけ再試行する。それでも失敗したら上と同じ縮退に落ちる。

**確認:** プライベートウィンドウで開き、DS-1 を入力して AC-01 / AC-08 の値が得られること。FR-24 の常時表示文言が差し替わっていること。

**設計上の含意:** **永続化は機能であって前提ではない。** L1 が localStorage を知らない(INV-1 / C-5)ことが、この縮退を自明にしている。

### 8-2. 重みが全てゼロ

**壊れ方:** `w_j = ŵ_j / Σŵ` で `Σŵ = 0` → `0/0 = NaN` → 全スコアが NaN → 順位が NaN 比較で崩壊(§5-6)→ **画面に嘘の順位が出る。** 例外は1つも出ないので気づけない。

**なぜ起きるか:** ユーザーが全スライダーを0に引き切ることは容易であり、UI 上これを禁止する自然な方法がない(1つだけ0にできるなら全部0にもできる)。

**防御:**
- `normalizeWeights` が `Σŵ ≤ EPS`(E-9)を検出し、**等重み `1/n` を返す**(§4-2)。
- `analyze` が `warnings` に加える: 「**全ての基準の重みが 0 です。等分として計算しています。**」
- **計算を止めない。** 等重みは意味のある既定であり、結論を出せなくする理由がない。

**確認:** 全ての重みを0にして、`Σw = 1`(各 `1/n`)となり順位が出ること。警告が表示されること。NaN が画面に1つも出ないこと。

### 8-3. 選択肢が0件 / 1件、基準が0件

**壊れ方:** `argmax` が空配列に対して `-Infinity` を返す、`rank[1]` が `undefined`、`D₀` が `NaN`。

**防御:** `analyze` の退化判定(§4-13)が **計算に入る前に**弾き、prd §5-3 の確定文言を返す。

| 状態 | `degenerate` | 文言(prd §5-3 正典) |
|---|---|---|
| 選択肢 0 件 | `no-options` | まず、比べたいものを2つ以上足してください。 |
| 選択肢 1 件 | `one-option` | 比べる相手がいません。選択肢をもう1つ足してください。 |
| 基準 0 件 | `no-criteria` | 何で比べるかを決めてください。基準を1つ以上足してください。 |

**確認:** 3状態それぞれで、例外が出ず、当該文言のみが表示され、順位表・臨界度・貢献度が空であること。

### 8-4. 同点(D₀ = 0)

**壊れ方:** `g_j = w_j d_j / D₀` がゼロ除算(Z-3)。`Δw_k = D₀(1−w_k)/(D₀−d_k)` は分子が0になり `Δw = 0` → `sens = 1/0 = Infinity` → 「変化量0ポイントで逆転する」という無意味な表示。

**★実測で判明した最重要点:** AC-18(DS-3)は**厳密には**同点だが、float では `S_X − S_Y = −1.11e-16` で **0 ではない**。したがって `D₀ === 0` という判定では AC-18 が通らない。

**防御:**
- E-1: `S_W − S_2 ≤ EPS` で `tie` と判定する(`=== 0` は使わない)。
- `robustness = null`、`winContrib = []` とし、**頑健性ラベルを一切表示しない**(AC-18 が明示的に禁じている)。
- prd §5-3 の文言「**同点です。基準またはスコアを見直してください。**」を表示。
- 順位表とスコア表示は**出してよい**(AC-18 が禁じているのはラベルと `g_j` のみ)。
- 挑戦者側の同点(2位と3位が同点等)は E-2 で個別に飛ばす。1位の同点とは別問題であり、こちらは分析を止めない。

**確認:** DS-3 を入力し、`S_X = S_Y = 60.0`、ラベルが表示されないこと、貢献度バーが表示されないこと、当該文言が出ること。

### 8-5. NaN が入力される

**壊れ方:** §5-6 の通り NaN は全比較で `false` を返すため、**例外を出さずに順位を静かに壊す。** これが本製品で最も危険な故障モードである。

**侵入経路(全列挙):**

| 経路 | 防御 |
|---|---|
| `<input type=number>` に `"e"` `"-"` `"1e999"` 等が入る | `parseScore` が `Number.isFinite` で検査し、偽なら `null`(未入力扱い) |
| localStorage の壊れた JSON | `validateState`(§3-6)が `repaired` として `null` / `0` に落とす |
| `0/0` の生成 | Z-1〜Z-8 の除算前検査(§5-5) |
| `Infinity − Infinity`(2つの逆転不能な基準の差を取る等) | `Infinity` を減算する箇所を作らない。比較のみに使う |
| `parseFloat("")` = `NaN` | 空文字は**パース前に** `null` へ分岐 |

**3段防御(D-10):**
1. **入口** — `validateState` と `parseScore` で遮断。
2. **中間** — `analyze` の先頭で `a` と `w` の全要素に `Number.isFinite` を掛け、偽が1つでもあれば計算を打ち切って退化状態に落とす。
3. **出口** — `fmt.*` が `NaN`/`Infinity` に `"—"` を返す(§4-14)。**画面に文字列 `NaN` が出る経路が1本も残らない。**

**確認:** DevTools から `localStorage` に `{"criteria":[{"rawWeight":"abc"}]}` を書き込んでリロードし、修復されて起動すること。スコア欄に不正文字を入れて NaN が画面に出ないこと。

### 8-6. 巨大入力

**壊れ方:**

| 種類 | 壊れ方 | 防御 |
|---|---|---|
| 選択肢/基準が上限超過 | 描画が重くなる。localStorage を圧迫 | FR-02 のハード上限10で `store` が追加を拒否。`validateState` は先頭10件で切る |
| 名前が極端に長い(数万文字) | レイアウト破壊、`stringify` の肥大 | 名前を **200文字**で切る。`validateState` と入力時の両方で |
| スコアが `1e308` 等 | 加重和がオーバーフロー → `Infinity` | `[0,10]` にクランプ(§4-1)。`type=number` の `min`/`max` は**検証にならない**(ユーザーは任意の値をペーストできる)ので JS 側で必ずクランプする |
| 履歴が無限に伸びる | localStorage 容量超過 | 500件で打ち切り(§3-5)。超過時は §8-1 の縮退 |
| ペーストによる大量入力 | 上記の複合 | 全て入口の `validateState` で正規化してから state に入れる |

**上限10という仕様が、この故障モード群の大半を無効化している**(§7-4)。**確認:** 名前欄に10万文字をペーストして、レイアウトが崩れず保存も成功すること。

### 8-7. 足切りで全選択肢が除外される

**壊れ方:** FR-20 の最低ラインを厳しく設定すると、残る選択肢が0件または1件になり、順位も感度分析も定義されない。

**防御:** §4-13 の退化判定 5/6 で捕捉し、専用メッセージを出す:
```
すべての選択肢が最低ラインで除外されました。最低ラインを見直してください。
```
**除外された選択肢とその理由(prd §5-8 の文言)は必ず全件表示する。** 何が起きたか分からないまま画面が空になるのが最悪であり、ユーザーが自力で最低ラインを緩められる情報を残す。

### 8-8. 重みが単独100%

**壊れ方:** `w_k = 1` で比例再正規化の分母 `(1 − w_k) = 0`(Z-5)。他の全基準の重みが0になり、実質的に単一基準の比較になる。

**防御:** E-6 で `reweight` が恒等写像を返す。`tippingPoint` も手順2で `dominant` を返す(全基準が逆転不能 → ラベルは `robust`)。**これは数学的に正しい** — 単一基準しか見ていないなら、その基準の重みをどう動かしても順位は変わらない(analysis §3-0 の「`w_k < 1` を仮定する。ある基準が単独で100%なら感度分析は自明」)。

**確認:** 1つの基準を100%にして、例外が出ず、ラベルが `robust` になり、他のスライダーが0を示すこと。

### 8-9. 未入力セルがある状態での計算

**壊れ方:** `null` を `0` とみなして計算すると、**未入力が「最低評価」として結論に影響する。** ユーザーは自分が入力していない値で順位を見せられる。

**防御:** §4-13 の退化判定4で捕捉し、prd §5-3 の文言「**未入力のセルが {c} 個あります。埋めるまで結論は出せません。**」を表示して**結論を出さない**。未入力を0で代用しない。

**ただし入力途中の体験を壊さない:** グリッドと重みは通常通り表示・編集でき、`#verdict` 領域だけがこのメッセージになる。最後の1セルを埋めた瞬間に結論が現れる。

### 8-10. 同一の `|Δw|` を複数の基準/挑戦者が与える

**壊れ方:** 臨界度ランキングの順序と「逆転相手」の表示が、浮動小数の最下位ビットで**入力と無関係にちらつく。**

**防御:** E-10 のヒステリシス(`|δ| < |best| − EPS` で初めて更新)と、安定ソート(§4-5)。同値なら**基準の入力順**を保つ。

**確認:** 対称なデータ(2つの基準が完全に同じ列を持つ)を入力し、無関係なセルを編集しても臨界度の順序が動かないこと。

### 8-11. 「robust だから正しい」という誤読

**壊れ方:** 数値的な故障ではなく**意味の故障**だが、製品の信頼性としては同格に重い。robust は「この重みの下で結論が安定」であって「基準の選び方が正しい」ではない(analysis §5-4)。

**防御:** FR-22 により、`label = "robust"` のとき `caveat` が非 null であることを**型の事後条件として要求する**(§4-10)。テストで表明する:
```
IF vm.robustness.label == "robust":
    ASSERT vm.robustness.caveat == "基準そのものが抜けている可能性は、この分析では検出できません。"
```
同様に FR-11 の「ラベル単独では表示しない」も、`verdict` が常に非空であることを表明して守る。

### 8-12. 失敗モード対応表(FR/AC への逆引き)

| # | 失敗モード | 主防御 | 関連 FR/AC |
|---|---|---|---|
| 8-1 | localStorage 無効 | capability probe + 縮退起動 | FR-16 / AC-22 |
| 8-2 | 重み全ゼロ | 等重みフォールバック(E-9) | FR-05 |
| 8-3 | 選択肢0/1件・基準0件 | 退化判定 1〜3 | FR-19 / prd §5-3 |
| 8-4 | 同点 D₀=0 | EPS 付き判定(E-1) | FR-19 / AC-18 |
| 8-5 | NaN 入力 | 3段防御(D-10) | FR-19 |
| 8-6 | 巨大入力 | 上限10 + クランプ + 名前200字 | FR-02 |
| 8-7 | 全件足切り | 退化判定 5 + 理由全件表示 | FR-20 / AC-16 |
| 8-8 | 単独100% | 恒等写像(E-6)+ robust | analysis §3-0 |
| 8-9 | 未入力セル | 退化判定 4 | FR-19 / prd §5-3 |
| 8-10 | 同値のちらつき | ヒステリシス(E-10)+ 安定ソート | FR-10 |
| 8-11 | robust の誤読 | caveat の事後条件 | FR-22 / AC-17 |
| — | 破損 localStorage | 3段の復旧ラダー(D-6) | FR-16 |

---

## 付録A. 設計判断の索引

| # | 判断 | 節 |
|---|---|---|
| D-1 | 丸めと文言生成を L1(純粋関数)の責務とする | §1-4 |
| D-2 | 抽出可能コアブロック(マーカ + `new Function`) | §2-1 |
| D-3 | `AppState` に導出可能な量を置かない | §3-2 |
| D-4 | 重みの真実は `rawWeight` 側に置く | §3-3 |
| D-5 | 配列 index を ID にしない。スコアは `Record<Id, …>` | §3-4 |
| D-6 | 破損 localStorage への3段の復旧ラダー | §3-6 |
| D-7 | 実行可能性判定を除算より先に置き Z-4 を到達不能にする | §4-6 |
| D-8 | 内部値は丸めない。丸めた値を計算に戻さない | §5-3 |
| D-9 | `EPS = 1e-9` を単一定数として全ての0比較に用いる | §5-4 |
| D-10 | NaN の3段防御(生成しない/受け取らない/入口で止める) | §5-6 |
| D-11 | 再計算は全部・再描画は差分・DOM 生成は構造変化時のみ | §6-1 |
| D-12 | フォーカスを持つ要素の `.value` に書き戻さない | §6-3 |
| D-13 | 行要素を Id キーで使い回し `appendChild` で並べ替える | §6-4 |
| D-14 | `aria-live` は 600ms デバウンス + 変化時のみ | §6-5 |
| D-15 | 保存は 300ms デバウンス、構造変化は即時 | §7-5 |

## 付録B. 不変条件と契約の索引

| # | 内容 | 検査方法 |
|---|---|---|
| INV-1 | L1 は何にも依存しない | §2-3 手順5(自動) |
| INV-2 | L2 は計算しない | コードレビュー |
| INV-3 | 状態は L3 が単独で保持する | コードレビュー |
| C-1〜C-7 | 抽出マーカ契約 | §2-3 手順2/3/5/6(自動) |
| E-1〜E-11 | EPS を使う全箇所 | §5-4 のリストとの突合 |
| Z-1〜Z-8 | ゼロ除算の全発生箇所 | §5-5 のリストとの突合 |

## 付録C. 実装位相への申し送り(要点のみ)

1. **`sens_k = 1/|Δw_k|` の `Δw_k` は重み単位。**ポイント単位ではない(§4-6-1)。設計時に実際に取り違えた。
2. **`D₀ === 0` と書かない。** AC-18 の DS-3 は float で `−1.11e-16` になる(§8-4)。
3. **`tippingPoint` は実行可能性判定を除算より先に。** 順序が安全性の根拠である(D-7)。
4. **`reweight` と `tippingPoint` は同一の写像を前提とする。** AC-10 はこの一致を検証している(§4-3)。
5. **コア領域に `Date` / `document` / `console` を書かない。** C-5 の自動検査で落ちる。
6. **`0/0` を作ってから `isNaN` で拾わない。** 除算前に分母を見る(§5-5)。
7. **臨界度の「逆転不能を末尾に」は `Infinity` の昇順ソートで自動的に満たされる。** 分岐を書かない(§4-7)。
8. **フォーカス中の `<input>` に書き戻さない。** これを破ると打鍵できなくなる(D-12)。
