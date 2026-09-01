/*
 * 天秤(tenbin)— 受け入れ基準テスト
 * ============================================================================
 *  正典: prd.md §4 AC-01〜AC-26 / design.md §2(CONTRACT-CORE)・§4(関数署名)
 *  実行: node tests/tenbin.test.js
 *  依存: なし(Node 標準ライブラリのみ。npm install 不要)
 *  終了: 全緑 0 / 1本でも赤 1
 *
 *  このファイルは TDD の RED を先に立てるために、実装(index.html)より先に書かれた。
 *  index.html が存在しない/未完成の間は全ての core 依存テストが赤くなるが、
 *  それが正しい状態である。テストを通すために index.html を編集してはならない。
 * ============================================================================
 */

"use strict";

const fs = require("fs");
const path = require("path");

const CREATION_DIR = path.resolve(__dirname, "..");
const HTML_PATH = path.join(CREATION_DIR, "index.html");

// ════════════════════════════════════════════════════════════════════════════
//  §A  ミニランナー
// ════════════════════════════════════════════════════════════════════════════

const RESULTS = { passed: 0, failed: 0, skipped: 0 };
const FAILURES = [];

function test(name, fn) {
  try {
    fn();
    RESULTS.passed++;
    console.log("  \u2713 " + name);
  } catch (err) {
    RESULTS.failed++;
    const msg = err && err.message ? err.message : String(err);
    FAILURES.push({ name, msg });
    console.log("  \u2717 " + name);
    for (const line of String(msg).split("\n")) console.log("      " + line);
  }
}

/** 明示的なスキップ。黙って飛ばさず、必ず件数と理由を記録する。 */
function SKIP(name, reason) {
  RESULTS.skipped++;
  console.log("  - SKIP " + name + "  \u2192 " + reason);
}

function section(title) {
  console.log("\n" + title);
}

function fail(msg) {
  throw new Error(msg);
}

function assert(cond, msg) {
  if (!cond) fail(msg || "assert 失敗");
}

function assertEqual(actual, expected, msg) {
  if (!Object.is(actual, expected)) {
    fail((msg ? msg + ": " : "") + "期待 " + JSON.stringify(expected) + " / 実際 " + JSON.stringify(actual));
  }
}

const TOL = 1e-9;

function assertClose(actual, expected, tol, msg) {
  const t = typeof tol === "number" ? tol : TOL;
  if (typeof actual !== "number" || !isFinite(actual)) {
    fail((msg ? msg + ": " : "") + "数値でない値 " + String(actual) + "(期待 " + expected + ")");
  }
  const d = Math.abs(actual - expected);
  if (!(d <= t)) {
    fail((msg ? msg + ": " : "") + "期待 " + expected + " / 実際 " + actual + " / 差 " + d.toExponential(3) + " > " + t);
  }
}

function assertDeepEqual(actual, expected, msg) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) fail((msg ? msg + ": " : "") + "期待 " + b + " / 実際 " + a);
}

// ════════════════════════════════════════════════════════════════════════════
//  §B  loadCore — design.md §2-3 の疑似コードをそのまま写す(追加も省略もしない)
// ════════════════════════════════════════════════════════════════════════════

const BEGIN_MARK = "/*===TENBIN-CORE-BEGIN===*/";
const END_MARK = "/*===TENBIN-CORE-END===*/";

/** C-5 / C-6 の禁止識別子 */
const FORBIDDEN = [
  "document", "window", "localStorage", "sessionStorage", "navigator",
  "fetch", "XMLHttpRequest", "alert", "Date", "globalThis",
];
/** 単語境界で照合できないもの(ドット/スラッシュを含む)は includes で照合 */
const FORBIDDEN_SUBSTR = ["Math.random", "</script"];

function countOccurrences(hay, needle) {
  let n = 0, i = 0;
  for (;;) {
    const j = hay.indexOf(needle, i);
    if (j < 0) return n;
    n++;
    i = j + needle.length;
  }
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function forbiddenHits(src) {
  const hits = [];
  for (const tok of FORBIDDEN) {
    if (new RegExp("\\b" + escapeRegExp(tok) + "\\b").test(src)) hits.push(tok);
  }
  for (const tok of FORBIDDEN_SUBSTR) {
    if (src.indexOf(tok) >= 0) hits.push(tok);
  }
  return hits;
}

function readHtml() {
  if (!fs.existsSync(HTML_PATH)) {
    fail(
      "index.html が存在しない: " + HTML_PATH + "\n" +
      "これは実装位相がまだ index.html を書いていない場合の正しい RED である。\n" +
      "テストを通すために index.html をこのテスト側から作成/編集してはならない。"
    );
  }
  return fs.readFileSync(HTML_PATH, "utf8");
}

/** design.md §2-3。マーカで囲まれたコア領域を切り出し、評価して TenbinCore を返す。 */
function loadCore(htmlPath) {
  if (!fs.existsSync(htmlPath)) {
    fail("index.html が存在しない: " + htmlPath);
  }
  const html = fs.readFileSync(htmlPath, "utf8");

  // ── C-1: マーカの一意性 ──────────────────────────────────────────
  const nB = countOccurrences(html, BEGIN_MARK);
  const nE = countOccurrences(html, END_MARK);
  if (nB !== 1) fail("C-1 違反: BEGIN マーカが " + nB + " 個(ちょうど1個であること)");
  if (nE !== 1) fail("C-1 違反: END マーカが " + nE + " 個(ちょうど1個であること)");

  const b = html.indexOf(BEGIN_MARK);
  const e = html.indexOf(END_MARK);
  if (!(b < e)) fail("C-1 違反: BEGIN と END の順序が逆(b=" + b + ", e=" + e + ")");

  // ── C-2: <script id="tenbin-core"> の内側にあること ───────────────
  const sOpen = html.indexOf('<script id="tenbin-core">');
  if (sOpen < 0) fail('C-2 違反: <script id="tenbin-core"> ブロックが無い');
  const sClose = html.indexOf("</script>", sOpen);
  if (sClose < 0) fail("C-2 違反: コアブロックが閉じていない");
  if (!(sOpen < b && e < sClose)) fail("C-2 違反: マーカが tenbin-core ブロックの外にある");

  // ── 切り出し ────────────────────────────────────────────────────
  const src = html.slice(b + BEGIN_MARK.length, e);

  // ── C-5 / C-6: 純粋性ガード ─────────────────────────────────────
  const hits = forbiddenHits(src);
  if (hits.length > 0) {
    fail("INV-1 違反: コア領域が禁止識別子を参照している \u2192 " + hits.join(", "));
  }

  // ── C-3 / C-4: 評価 ─────────────────────────────────────────────
  let core;
  try {
    const factory = new Function('"use strict";\n' + src + "\nreturn TenbinCore;");
    core = factory();
  } catch (err) {
    fail("C-3/C-4 違反: コア領域の評価に失敗 \u2192 " + (err && err.message ? err.message : String(err)));
  }
  if (core === null || typeof core !== "object") {
    fail("C-4 違反: TenbinCore がオブジェクトとして返らない(typeof=" + typeof core + ")");
  }
  if (!Object.isFrozen(core)) {
    fail("C-4 違反: TenbinCore が Object.freeze されていない");
  }
  return core;
}

// モジュール先頭で1回だけ呼び、返り値を全テストで共有する(design.md §4-2)。
let core = null;
let CORE_ERROR = null;
try {
  core = loadCore(HTML_PATH);
} catch (err) {
  CORE_ERROR = err && err.message ? err.message : String(err);
}

/** コア未ロードのときに全 core 依存テストを分かりやすく落とすためのガード */
function requireCore() {
  if (core === null) {
    fail("コア未ロード(loadCore が失敗している)。原因:\n" + CORE_ERROR);
  }
  return core;
}

// ════════════════════════════════════════════════════════════════════════════
//  §D  データセット組立ヘルパ(tasks.md §4-3)
// ════════════════════════════════════════════════════════════════════════════

function crit(id, name, direction, rawWeight, cutoff) {
  return { id, name, direction, rawWeight, cutoff: cutoff === undefined ? null : cutoff };
}
function opt(id, name, scores) {
  return { id, name, scores: Object.assign({}, scores) };
}
function baseSettings(over) {
  return Object.assign({ theta: 0.10, flipThreshold: 3, challengerId: null }, over || {});
}
function mkState(criteria, options, settings) {
  return {
    schemaVersion: 1,
    criteria,
    options,
    settings: baseSettings(settings),
    initialWeights: null,
    history: [],
  };
}

/** prd §4-0 DS-1 — 3社のベンダー選定(基準4 / 選択肢3、うちコスト基準2) */
function buildDS1() {
  return mkState(
    [
      crit("c1", "価格", "cost", 35),
      crit("c2", "機能充足度", "benefit", 30),
      crit("c3", "サポート", "benefit", 20),
      crit("c4", "移行コスト", "cost", 15),
    ],
    [
      opt("o1", "ベンダーA", { c1: 7, c2: 9, c3: 7, c4: 2 }),
      opt("o2", "ベンダーB", { c1: 4, c2: 8, c3: 8, c4: 6 }),
      opt("o3", "ベンダーC", { c1: 6, c2: 8, c3: 5, c4: 8 }),
    ]
  );
}

/** prd AC-17 DS-2 — 物件選び(基準3 / 選択肢2)。robust ケース */
function buildDS2() {
  return mkState(
    [
      crit("c1", "家賃", "cost", 40),
      crit("c2", "通勤時間", "cost", 35),
      crit("c3", "環境", "benefit", 25),
    ],
    [
      opt("o1", "物件P", { c1: 4, c2: 3, c3: 8 }),
      opt("o2", "物件Q", { c1: 6, c2: 7, c3: 5 }),
    ]
  );
}

/** prd AC-18 DS-3 — 厳密同点(基準2 / 選択肢2) */
function buildDS3() {
  return mkState(
    [
      crit("c1", "価格", "cost", 50),
      crit("c2", "品質", "benefit", 50),
    ],
    [
      opt("o1", "案X", { c1: 4, c2: 6 }),
      opt("o2", "案Y", { c1: 6, c2: 8 }),
    ]
  );
}

/** AC-19 — DS-1 + 案Z(全 a_ij = 0 になる選択肢) */
function buildDS1WithZ() {
  const st = buildDS1();
  st.options.push(opt("o4", "案Z", { c1: 10, c2: 0, c3: 0, c4: 10 }));
  return st;
}

/** AC-20 — DS-1 + ベンダーD */
function buildDS1WithD() {
  const st = buildDS1();
  st.options.push(opt("o4", "ベンダーD", { c1: 3, c2: 10, c3: 9, c4: 1 }));
  return st;
}

/** AC-14 — DS-1 の direction を全て benefit にした誤設定 */
function buildDS1AllBenefit() {
  const st = buildDS1();
  for (const c of st.criteria) c.direction = "benefit";
  return st;
}

/** AC-16 — DS-1 + 移行コストに最低ライン 3.0 */
function buildDS1WithCutoff() {
  const st = buildDS1();
  st.criteria[3].cutoff = 3.0;
  return st;
}

/** AC-04 — DS-1 の基準構成に対し重み生入力 [5,3,2,2] */
function buildDS1RawWeights(raws) {
  const st = buildDS1();
  st.criteria.forEach((c, j) => { c.rawWeight = raws[j]; });
  return st;
}

// ── 共通ユーティリティ ────────────────────────────────────────────────

/** state から正規化行列 a[選択肢][基準] を組む(core.normalize を独立に使う) */
function matrixOf(c, st) {
  return st.options.map((o) =>
    st.criteria.map((cr) => c.normalize(o.scores[cr.id], cr.direction))
  );
}
function rawWeightsOf(st) {
  return st.criteria.map((c) => c.rawWeight);
}
function byName(rows, name) {
  const r = rows.find((x) => x && x.name === name);
  if (!r) fail("行が見つからない: " + name + "(候補: " + rows.map((x) => x && x.name).join(", ") + ")");
  return r;
}
function optIndexById(st, id) {
  return st.options.findIndex((o) => o.id === id);
}
function names(list) {
  return list.map((x) => x.name);
}
/** analyze を呼び、ok を要求する */
function analyzeOk(c, st, label) {
  const vm = c.analyze(st);
  assert(vm && typeof vm === "object", (label || "analyze") + ": Analysis が返らない");
  if (!vm.ok) {
    fail((label || "analyze") + ": ok=false(degenerate=" + vm.degenerate + " / message=" + vm.message + ")");
  }
  return vm;
}

// ════════════════════════════════════════════════════════════════════════════
//  §C  静的検査 — HTML をテキストとして読む(AC-24 / AC-25 / AC-26 / 契約検査)
// ════════════════════════════════════════════════════════════════════════════

section("[契約] CONTRACT-CORE / 抽出マーカ (design.md §2-2)");

test("CONTRACT-CORE C-1 マーカが各ちょうど1回", () => {
  const html = readHtml();
  assertEqual(countOccurrences(html, BEGIN_MARK), 1, "BEGIN マーカの出現回数");
  assertEqual(countOccurrences(html, END_MARK), 1, "END マーカの出現回数");
  assert(html.indexOf(BEGIN_MARK) < html.indexOf(END_MARK), "C-1: BEGIN が END より前にあること");
});

test("CONTRACT-CORE C-2 マーカが <script id=\"tenbin-core\"> の内側", () => {
  const html = readHtml();
  const sOpen = html.indexOf('<script id="tenbin-core">');
  assert(sOpen >= 0, 'C-2: <script id="tenbin-core"> が無い');
  const sClose = html.indexOf("</script>", sOpen);
  assert(sClose > sOpen, "C-2: コアブロックが閉じていない");
  assert(sOpen < html.indexOf(BEGIN_MARK), "C-2: BEGIN がブロックより前にある");
  assert(html.indexOf(END_MARK) < sClose, "C-2: END がブロックより後にある");
});

test("CONTRACT-CORE C-5/C-6 コア領域に禁止識別子が0件 (INV-1)", () => {
  const html = readHtml();
  const b = html.indexOf(BEGIN_MARK);
  const e = html.indexOf(END_MARK);
  assert(b >= 0 && e > b, "マーカが取れないため純粋性を検査できない");
  const src = html.slice(b + BEGIN_MARK.length, e);
  const hits = forbiddenHits(src);
  assertDeepEqual(hits, [], "コア領域の禁止識別子(document/window/localStorage/.../Math.random/globalThis)");
});

test("CONTRACT-CORE C-4 TenbinCore が凍結オブジェクトとして取り出せる", () => {
  const c = requireCore();
  assertEqual(typeof c, "object", "TenbinCore の型");
  assertEqual(Object.isFrozen(c), true, "Object.freeze されていること");
});

test("CONTRACT-CORE 公開 API が design.md §2-2 の一覧を満たす", () => {
  const c = requireCore();
  const required = [
    "VERSION", "EPS", "normalize", "normalizeWeights", "reweight", "computeScores",
    "rank", "tippingPoint", "criticality", "scoreContribution", "winContribution",
    "robustness", "anchoringDetect", "applyCutoffs", "analyze", "validateState",
    "migrateState", "createInitialState", "fmt", "TEXT",
  ];
  const missing = required.filter((k) => !(k in c));
  assertDeepEqual(missing, [], "TenbinCore に不足している公開メンバ");
});

section("[静的] AC-24 / AC-25 / AC-26 — HTML テキスト検査");

test("AC-24 単一HTML: 添付の .js/.css/フォント/画像が0個", () => {
  readHtml(); // index.html の存在を先に要求する
  const entries = fs.readdirSync(CREATION_DIR, { withFileTypes: true });
  const bad = entries
    .filter((d) => d.isFile())
    .map((d) => d.name)
    .filter((n) => /\.(js|mjs|cjs|css|woff2?|ttf|otf|eot|png|jpe?g|gif|svg|webp|ico)$/i.test(n));
  assertDeepEqual(bad, [], "配布ディレクトリ直下に置かれた外部リソースファイル");
  const htmls = entries.filter((d) => d.isFile() && /\.html?$/i.test(d.name)).map((d) => d.name);
  assertDeepEqual(htmls, ["index.html"], "成果物の .html ファイル");
});

test("AC-24 単一HTML: <script src= / <link rel=stylesheet / @import が0回", () => {
  const html = readHtml();
  assertEqual(countOccurrences(html, "<script src="), 0, "<script src= の出現回数");
  assertEqual((html.match(/<script\s[^>]*\bsrc\s*=/gi) || []).length, 0, "<script ... src= の出現回数");
  assertEqual((html.match(/<link\b/gi) || []).length, 0, "<link 要素の出現回数");
  assertEqual(countOccurrences(html, "@import"), 0, "@import の出現回数");
});

test("AC-24 単一HTML: http:// https:// のリソース参照が0回", () => {
  const html = readHtml();
  const refs = html.match(/\b(?:src|href)\s*=\s*["']?https?:\/\//gi) || [];
  assertDeepEqual(refs, [], "src/href による外部 URL 参照");
});

test("AC-25 ネットワーク送信ゼロ: 禁止トークン6種が0回", () => {
  const html = readHtml();
  const checks = [
    ["fetch(", countOccurrences(html, "fetch(")],
    ["XMLHttpRequest", countOccurrences(html, "XMLHttpRequest")],
    ["navigator.sendBeacon", countOccurrences(html, "navigator.sendBeacon")],
    ["new WebSocket", countOccurrences(html, "new WebSocket")],
    ["new EventSource", countOccurrences(html, "new EventSource")],
    ["<form action=", (html.match(/<form\s[^>]*\baction\s*=/gi) || []).length],
  ];
  const bad = checks.filter((x) => x[1] !== 0).map((x) => x[0] + "=" + x[1]);
  assertDeepEqual(bad, [], "AC-25 の禁止トークン出現回数");
});

test("AC-25 「どこにも送信していません」の文言が常時表示される", () => {
  const html = readHtml();
  assert(html.indexOf("どこにも送信していません") >= 0, "prd §5-5 の送信ゼロ文言が HTML に無い");
  assert(html.indexOf("あなたのブラウザにだけ保存されています") >= 0, "prd §5-5 の保存先明示の文言が HTML に無い");
});

test("AC-26 キーボード操作: outline:none と tabindex=\"1-9\" が0回", () => {
  const html = readHtml();
  const outlineNone = (html.match(/outline\s*:\s*none/gi) || []).length;
  assertEqual(outlineNone, 0, "outline: none の出現回数(フォーカスリングを消してはならない)");
  const positiveTabindex = (html.match(/tabindex\s*=\s*["']?[1-9]/gi) || []).length;
  assertEqual(positiveTabindex, 0, 'tabindex="1以上" の出現回数(タブ順を壊してはならない)');
});

test("AC-26 アクセシビリティ構造: aria-live=polite / range / number入力 が存在", () => {
  const html = readHtml();
  assert(/aria-live\s*=\s*["']polite["']/i.test(html), "頑健性ラベル用の aria-live=\"polite\" 領域が無い");
  assert(/<input[^>]*type\s*=\s*["']range["']/i.test(html), "重み用の <input type=\"range\"> が無い");
  assert(/<input[^>]*type\s*=\s*["']number["']/i.test(html), "スコア用の <input type=\"number\"> が無い");
  assert(/<th[^>]*\bscope\s*=/i.test(html), "<th scope> を持つグリッドが無い");
});

// ════════════════════════════════════════════════════════════════════════════
//  §E  AC-01 〜 AC-26
// ════════════════════════════════════════════════════════════════════════════

section("[AC] prd.md §4 受け入れ基準");

// ── AC-01 ────────────────────────────────────────────────────────────
test("AC-01 総合スコアと表示値", () => {
  const c = requireCore();
  const vm = analyzeOk(c, buildDS1(), "AC-01");
  assertDeepEqual(names(vm.ranking), ["ベンダーB", "ベンダーA", "ベンダーC"], "順位順の選択肢名");
  assertDeepEqual(vm.ranking.map((r) => r.displayScore), ["67.0", "63.5", "51.0"], "displayScore");
  assertClose(byName(vm.ranking, "ベンダーB").score, 67 / 100, TOL, "S_B");
  assertClose(byName(vm.ranking, "ベンダーA").score, 127 / 200, TOL, "S_A");
  assertClose(byName(vm.ranking, "ベンダーC").score, 51 / 100, TOL, "S_C");
});

// ── AC-02 ────────────────────────────────────────────────────────────
test("AC-02 順位と勝者と勝ち幅 D₀", () => {
  const c = requireCore();
  const vm = analyzeOk(c, buildDS1(), "AC-02");
  assertDeepEqual(names(vm.ranking), ["ベンダーB", "ベンダーA", "ベンダーC"], "順位");
  assertEqual(vm.winner.name, "ベンダーB", "勝者 W");
  assertEqual(vm.challenger.name, "ベンダーA", "既定の挑戦者 L");
  assertClose(vm.d0, 7 / 200, TOL, "D₀ = 7/200");
  assertEqual(vm.displayD0, "3.5", "displayD0");
});

// ── AC-03 ────────────────────────────────────────────────────────────
test("AC-03 重みの合計が厳密に1", () => {
  const c = requireCore();
  const w = c.normalizeWeights([35, 30, 20, 15]);
  assertClose(w[0], 7 / 20, TOL, "w_価格");
  assertClose(w[1], 3 / 10, TOL, "w_機能充足度");
  assertClose(w[2], 1 / 5, TOL, "w_サポート");
  assertClose(w[3], 3 / 20, TOL, "w_移行コスト");
  assertClose(w.reduce((a, b) => a + b, 0), 1, TOL, "Σw");
  const vm = analyzeOk(c, buildDS1(), "AC-03");
  assertDeepEqual(vm.weights.map((x) => x.displayWeight), ["35.0", "30.0", "20.0", "15.0"], "displayWeight");
});

// ── AC-04 ────────────────────────────────────────────────────────────
test("AC-04 合計が100でない重みの正規化", () => {
  const c = requireCore();
  const w = c.normalizeWeights([5, 3, 2, 2]);
  assertClose(w[0], 5 / 12, TOL, "w_1");
  assertClose(w[1], 1 / 4, TOL, "w_2");
  assertClose(w[2], 1 / 6, TOL, "w_3");
  assertClose(w[3], 1 / 6, TOL, "w_4");
  assertClose(w.reduce((a, b) => a + b, 0), 1, TOL, "Σw");
  const vm = analyzeOk(c, buildDS1RawWeights([5, 3, 2, 2]), "AC-04");
  // 丸め表示の合計は 100.1% になりうるが、内部値の合計は厳密に1であること
  assertDeepEqual(vm.weights.map((x) => x.displayWeight), ["41.7", "25.0", "16.7", "16.7"], "displayWeight");
  assertClose(vm.weights.reduce((a, x) => a + x.weight, 0), 1, TOL, "内部 Σw");
});

// ── AC-05 ★中核 ──────────────────────────────────────────────────────
test("AC-05 逆転閾値 Δw_k(厳密値との一致)", () => {
  const c = requireCore();
  const vm = analyzeOk(c, buildDS1(), "AC-05");
  const expect = [
    { name: "移行コスト", wk: 3 / 20, delta: 119 / 1740, wStar: 19 / 87, sens: 1740 / 119, opp: "ベンダーA" },
    { name: "価格", wk: 7 / 20, delta: -91 / 1060, wStar: 14 / 53, sens: 1060 / 91, opp: "ベンダーA" },
    { name: "機能充足度", wk: 3 / 10, delta: 49 / 270, wStar: 13 / 27, sens: 270 / 49, opp: "ベンダーA" },
  ];
  for (const ex of expect) {
    const row = byName(vm.criticality, ex.name);
    assertEqual(row.infeasible, false, ex.name + ": infeasible");
    assertClose(row.weight, ex.wk, TOL, ex.name + ": w_k");
    assertClose(row.delta, ex.delta, TOL, ex.name + ": Δw_k");
    assertClose(row.wStar, ex.wStar, TOL, ex.name + ": w_k*");
    assertClose(row.sens, ex.sens, TOL, ex.name + ": sens_k = 1/|Δw_k|(重み単位)");
    assertEqual(row.opponentName, ex.opp, ex.name + ": 逆転相手");
  }
  const sup = byName(vm.criticality, "サポート");
  assertEqual(sup.infeasible, true, "サポート: 逆転不能であること");
  assertEqual(sup.delta, Infinity, "サポート: delta = Infinity");
  assertEqual(sup.sens, 0, "サポート: sens = 0");
});

test("AC-05 逆転閾値 Δw_k(表示値)", () => {
  const c = requireCore();
  const vm = analyzeOk(c, buildDS1(), "AC-05 表示");
  const m = byName(vm.criticality, "移行コスト");
  assertEqual(m.displayDelta, "+6.8", "移行コスト displayDelta(必ず符号付き)");
  assertEqual(m.displayWStar, "21.8", "移行コスト displayWStar");
  assertEqual(m.displaySens, "14.6", "移行コスト displaySens");
  const p = byName(vm.criticality, "価格");
  assertEqual(p.displayDelta, "-8.6", "価格 displayDelta");
  assertEqual(p.displayWStar, "26.4", "価格 displayWStar");
  assertEqual(p.displaySens, "11.6", "価格 displaySens");
  const f = byName(vm.criticality, "機能充足度");
  assertEqual(f.displayDelta, "+18.1", "機能充足度 displayDelta");
  assertEqual(f.displayWStar, "48.1", "機能充足度 displayWStar");
  assertEqual(f.displaySens, "5.5", "機能充足度 displaySens");
  const s = byName(vm.criticality, "サポート");
  assertEqual(s.displaySens, "0", "サポート displaySens");
});

// ── AC-06 ────────────────────────────────────────────────────────────
test("AC-06 臨界度ランキングの並び順(反直感的洞察)", () => {
  const c = requireCore();
  const vm = analyzeOk(c, buildDS1(), "AC-06");
  assertDeepEqual(names(vm.criticality), ["移行コスト", "価格", "機能充足度", "サポート"], "|Δw_k| 昇順・逆転不能は末尾");
  // 最も重みの小さい基準(移行コスト15%)が最も重みの大きい基準(価格35%)より上位
  const iM = names(vm.criticality).indexOf("移行コスト");
  const iP = names(vm.criticality).indexOf("価格");
  assert(iM < iP, "反直感的洞察: 移行コスト(15%)が価格(35%)より critical であること");
});

// ── AC-07 ★必須ケース ────────────────────────────────────────────────
test("AC-07 支配的優位(逆転不能)の判定", () => {
  const c = requireCore();
  const st = buildDS1();
  const a = matrixOf(c, st);
  const w = c.normalizeWeights(rawWeightsOf(st));
  const kSupport = 2; // c3 サポート
  const iA = 0, iB = 1, iC = 2;
  const sB = 67 / 100;
  // vs ベンダーA: D₀=7/200, d=1/10, w·d=1/50 ≤ D₀
  const rA = c.tippingPoint(sB - 127 / 200, a[iB][kSupport] - a[iA][kSupport], w[kSupport]);
  assertEqual(rA.feasible, false, "サポート vs ベンダーA: feasible");
  assertEqual(rA.reason, "dominant", "サポート vs ベンダーA: reason");
  assertEqual(rA.delta, Infinity, "サポート vs ベンダーA: delta");
  // vs ベンダーC: D₀=4/25, d=3/10, w·d=3/50 ≤ D₀
  const rC = c.tippingPoint(sB - 51 / 100, a[iB][kSupport] - a[iC][kSupport], w[kSupport]);
  assertEqual(rC.feasible, false, "サポート vs ベンダーC: feasible");
  assertEqual(rC.reason, "dominant", "サポート vs ベンダーC: reason");

  const vm = analyzeOk(c, st, "AC-07");
  const row = byName(vm.criticality, "サポート");
  assertEqual(row.infeasible, true, "サポート行: infeasible");
  assertEqual(row.sens, 0, "サポート行: sens");
  assertEqual(names(vm.criticality)[vm.criticality.length - 1], "サポート", "逆転不能はランキング末尾");
});

test("AC-07 両端点(0% / 100%)で1位が入れ替わらない", () => {
  const c = requireCore();
  const st = buildDS1();
  const a = matrixOf(c, st);
  const w = c.normalizeWeights(rawWeightsOf(st));
  const k = 2; // サポート
  // 0%: S = {A: 61.875, B: 63.75, C: 51.25}
  const w0 = c.reweight(w, k, 0);
  const s0 = c.computeScores(a, w0);
  assertClose(s0[0] * 100, 61.875, 1e-9, "サポート0% の S_A");
  assertClose(s0[1] * 100, 63.75, 1e-9, "サポート0% の S_B");
  assertClose(s0[2] * 100, 51.25, 1e-9, "サポート0% の S_C");
  assert(s0[1] > s0[0] && s0[1] > s0[2], "サポート0% でも1位はベンダーB");
  // 100%: S = {A: 70.0, B: 80.0, C: 50.0}
  const w1 = c.reweight(w, k, 1);
  const s1 = c.computeScores(a, w1);
  assertClose(s1[0] * 100, 70.0, 1e-9, "サポート100% の S_A");
  assertClose(s1[1] * 100, 80.0, 1e-9, "サポート100% の S_B");
  assertClose(s1[2] * 100, 50.0, 1e-9, "サポート100% の S_C");
  assert(s1[1] > s1[0] && s1[1] > s1[2], "サポート100% でも1位はベンダーB");
});

// ── AC-08 ────────────────────────────────────────────────────────────
test("AC-08 頑健性ラベル fragile(θ=0.10)", () => {
  const c = requireCore();
  const vm = analyzeOk(c, buildDS1(), "AC-08");
  assert(vm.robustness !== null, "robustness が null(D₀>0 なのでラベルが出るはず)");
  assertEqual(vm.robustness.label, "fragile", "ラベル");
  assertClose(vm.robustness.deltaStar, 119 / 1740, TOL, "Δ*");
  assertEqual(vm.robustness.displayDelta, "6.8", "Δ* 表示");
  assertEqual(vm.robustness.kStarName, "移行コスト", "k*");
});

test("AC-08 一次出力文 verdict の完全一致 (prd §5-1)", () => {
  const c = requireCore();
  const vm = analyzeOk(c, buildDS1(), "AC-08 verdict");
  const expected =
    "ベンダーB の1位は、移行コストの重みを 15.0% から 21.8%(+6.8ポイント)に動かすと ベンダーA に入れ替わります。" +
    "他の 1 個の基準では単独で逆転しません。" +
    "価格を 26.4% まで下げても同じことが起きます。" +
    "機能充足度を 48.1% まで上げても同じことが起きます。" +
    "サポートの重みは単独では結論を変えません。";
  assertEqual(vm.robustness.verdict, expected, "verdict 全文");
});

// ── AC-09 ────────────────────────────────────────────────────────────
test("AC-09 θ を 0.05 に変えるとラベルが contingent になる", () => {
  const c = requireCore();
  const st = buildDS1();
  st.settings.theta = 0.05;
  const vm = analyzeOk(c, st, "AC-09");
  assertEqual(vm.robustness.label, "contingent", "θ=0.05 のラベル");
  // Δ* と k* は θ に依らず不変
  assertClose(vm.robustness.deltaStar, 119 / 1740, TOL, "Δ*(θ 不変)");
  assertEqual(vm.robustness.displayDelta, "6.8", "Δ* 表示(θ 不変)");
  assertEqual(vm.robustness.kStarName, "移行コスト", "k*(θ 不変)");
});

// ── AC-10 ★★中核の整合性 ─────────────────────────────────────────────
test("AC-10 閾値まで動かすと厳密に同点になる(3基準)", () => {
  const c = requireCore();
  const st = buildDS1();
  const a = matrixOf(c, st);
  const w = c.normalizeWeights(rawWeightsOf(st));
  const iA = 0, iB = 1;
  const cases = [
    { name: "移行コスト", k: 3, x: 19 / 87, tie: 94 / 145, disp: "64.8" },
    { name: "価格", k: 0, x: 14 / 53, tie: 36 / 53, disp: "67.9" },
    { name: "機能充足度", k: 1, x: 13 / 27, tie: 19 / 27, disp: "70.4" },
  ];
  for (const cs of cases) {
    const w2 = c.reweight(w, cs.k, cs.x);
    assertClose(w2.reduce((p, q) => p + q, 0), 1, TOL, cs.name + ": 再正規化後の Σw");
    assertClose(w2[cs.k], cs.x, TOL, cs.name + ": w'_k = x");
    const s2 = c.computeScores(a, w2);
    assertClose(s2[iA] - s2[iB], 0, TOL, cs.name + " を x* に動かしたときの S_A − S_B");
    assertClose(s2[iA], cs.tie, TOL, cs.name + ": 同点スコア");
    assertEqual(c.fmt.score(s2[iA]), cs.disp, cs.name + ": 同点スコアの表示");
  }
});

test("AC-10 移行コスト x* での再正規化重みの表示", () => {
  const c = requireCore();
  const st = buildDS1();
  const w = c.normalizeWeights(rawWeightsOf(st));
  const w2 = c.reweight(w, 3, 19 / 87);
  assertClose(w2[0], 28 / 87, TOL, "価格");
  assertClose(w2[1], 24 / 87, TOL, "機能充足度");
  assertClose(w2[2], 16 / 87, TOL, "サポート");
  assertClose(w2[3], 19 / 87, TOL, "移行コスト");
  assertDeepEqual(w2.map((x) => c.fmt.weight(x)), ["32.2", "27.6", "18.4", "21.8"], "表示重み");
  const a = matrixOf(c, st);
  assertEqual(c.fmt.score(c.computeScores(a, w2)[2]), "48.5", "S_C の表示");
});

// ── AC-11 ────────────────────────────────────────────────────────────
test("AC-11 勝敗貢献度 g_j", () => {
  const c = requireCore();
  const vm = analyzeOk(c, buildDS1(), "AC-11");
  const g = vm.winContrib;
  assertEqual(g.length, 4, "g_j の件数");
  assertDeepEqual(names(g), ["価格", "機能充足度", "サポート", "移行コスト"], "基準の並び順");
  assertClose(byName(g, "価格").value, 3, TOL, "g_価格");
  assertClose(byName(g, "機能充足度").value, -6 / 7, TOL, "g_機能充足度");
  assertClose(byName(g, "サポート").value, 4 / 7, TOL, "g_サポート");
  assertClose(byName(g, "移行コスト").value, -12 / 7, TOL, "g_移行コスト");
  assertDeepEqual(g.map((x) => x.display), ["+300.0", "-85.7", "+57.1", "-171.4"], "表示(必ず符号付き)");
  assertDeepEqual(g.map((x) => x.negative), [false, true, false, true], "逆符号バーの向き");
  assertClose(g.reduce((p, x) => p + x.value, 0), 1, 1e-12, "Σg = 1(厳密)");
});

// ── AC-12 ────────────────────────────────────────────────────────────
test("AC-12 貢献度と実行可能性の相互整合 (g_k ≤ 1 ⟺ 下方向に逆転不能)", () => {
  const c = requireCore();
  const st = buildDS1();
  const vm = analyzeOk(c, st, "AC-12");
  const a = matrixOf(c, st);
  const w = c.normalizeWeights(rawWeightsOf(st));
  const iW = optIndexById(st, vm.winner.id);
  const iL = optIndexById(st, vm.challenger.id);
  const d0 = vm.d0;
  for (let k = 0; k < st.criteria.length; k++) {
    const nm = st.criteria[k].name;
    const g = byName(vm.winContrib, nm).value;
    // tippingPoint を独立に計算(片方から導出しない — design.md §4-8)
    const r = c.tippingPoint(d0, a[iW][k] - a[iL][k], w[k]);
    const downFeasible = r.feasible && r.reason === "down";
    const gLe1 = g <= 1 + 1e-12;
    assertEqual(gLe1, !downFeasible, nm + ": g_k ≤ 1 ⟺ 下方向に逆転不能(g=" + g + ", reason=" + r.reason + ")");
  }
  // prd AC-12 が名指しする具体の一致
  assert(byName(vm.winContrib, "価格").value > 1, "g_価格 > 1");
  assert(byName(vm.criticality, "価格").delta < 0, "Δw_価格 < 0(下げて逆転)");
});

// ── AC-13 ────────────────────────────────────────────────────────────
test("AC-13 スコア貢献度 c_ij(3行 × 4基準)", () => {
  const c = requireCore();
  const vm = analyzeOk(c, buildDS1(), "AC-13");
  const expect = {
    "ベンダーB": { vals: [21 / 67, 24 / 67, 16 / 67, 6 / 67], disp: ["31.3", "35.8", "23.9", "9.0"] },
    "ベンダーA": { vals: [21 / 127, 54 / 127, 28 / 127, 24 / 127], disp: ["16.5", "42.5", "22.0", "18.9"] },
    "ベンダーC": { vals: [14 / 51, 8 / 17, 10 / 51, 1 / 17], disp: ["27.5", "47.1", "19.6", "5.9"] },
  };
  for (const nm of Object.keys(expect)) {
    const row = byName(vm.ranking, nm);
    assertEqual(row.contribution.length, 4, nm + ": 貢献度の件数");
    expect[nm].vals.forEach((v, j) => {
      assertClose(row.contribution[j].value, v, TOL, nm + " × " + row.contribution[j].name + ": c_ij");
    });
    assertDeepEqual(row.contribution.map((x) => x.display), expect[nm].disp, nm + ": c_ij 表示");
    assertClose(row.contribution.reduce((p, x) => p + x.value, 0), 1, 1e-12, nm + ": Σc = 1");
  }
});

// ── AC-14 ★必須ケース ────────────────────────────────────────────────
test("AC-14 コスト反転が結論に効いている", () => {
  const c = requireCore();
  const ok = analyzeOk(c, buildDS1(), "AC-14 正");
  const ng = analyzeOk(c, buildDS1AllBenefit(), "AC-14 誤");
  assertEqual(ok.winner.name, "ベンダーB", "正しい設定の勝者");
  assertDeepEqual(
    ["ベンダーA", "ベンダーB", "ベンダーC"].map((n) => byName(ok.ranking, n).displayScore),
    ["63.5", "67.0", "51.0"], "正しい設定のスコア"
  );
  assertEqual(ng.winner.name, "ベンダーA", "全 benefit 誤設定の勝者");
  assertDeepEqual(
    ["ベンダーA", "ベンダーB", "ベンダーC"].map((n) => byName(ng.ranking, n).displayScore),
    ["68.5", "63.0", "67.0"], "全 benefit 誤設定のスコア"
  );
  assert(ok.winner.name !== ng.winner.name, "反転の有無で勝者が変わること");
});

test("AC-14 セル単位の cost 反転(0-10 表示尺度)", () => {
  const c = requireCore();
  // 価格 生値 A=7 / B=4 / C=6 → 3.0 / 6.0 / 4.0
  assertClose(c.normalize(7, "cost") * 10, 3.0, TOL, "価格 A");
  assertClose(c.normalize(4, "cost") * 10, 6.0, TOL, "価格 B");
  assertClose(c.normalize(6, "cost") * 10, 4.0, TOL, "価格 C");
  // 移行コスト 生値 A=2 / B=6 / C=8 → 8.0 / 4.0 / 2.0
  assertClose(c.normalize(2, "cost") * 10, 8.0, TOL, "移行コスト A");
  assertClose(c.normalize(6, "cost") * 10, 4.0, TOL, "移行コスト B");
  assertClose(c.normalize(8, "cost") * 10, 2.0, TOL, "移行コスト C");
  // benefit 側
  assertClose(c.normalize(9, "benefit") * 10, 9.0, TOL, "機能充足度 A");
  assertEqual(c.normalize(null, "benefit"), null, "未入力は null(0 ではない)");
});

// ── AC-15 ★必須ケース ────────────────────────────────────────────────
test("AC-15 再正規化後の合計が1(価格 35% → 50%)", () => {
  const c = requireCore();
  const st = buildDS1();
  const a = matrixOf(c, st);
  const w = c.normalizeWeights(rawWeightsOf(st));
  const w2 = c.reweight(w, 0, 0.5);
  assertClose(w2[0], 1 / 2, TOL, "価格");
  assertClose(w2[1], 3 / 13, TOL, "機能充足度");
  assertClose(w2[2], 2 / 13, TOL, "サポート");
  assertClose(w2[3], 3 / 26, TOL, "移行コスト");
  assertClose(w2.reduce((p, q) => p + q, 0), 1, TOL, "Σw' = 1(厳密)");
  assertDeepEqual(
    w2.map((x) => c.fmt.weight6(x)),
    ["50.000000", "23.076923", "15.384615", "11.538462"], "6桁表示"
  );
  const s2 = c.computeScores(a, w2);
  assertClose(s2[0], 29 / 52, TOL, "S_A");
  assertClose(s2[1], 17 / 26, TOL, "S_B");
  assertClose(s2[2], 63 / 130, TOL, "S_C");
  assertDeepEqual(s2.map((x) => c.fmt.score(x)), ["55.8", "65.4", "48.5"], "スコア表示");
  const r = c.rank(s2, st.options);
  assertDeepEqual(r.order.map((i) => st.options[i].name), ["ベンダーB", "ベンダーA", "ベンダーC"], "順位不変");
});

// ── AC-16 ────────────────────────────────────────────────────────────
test("AC-16 足切りが加重和の前段で効く", () => {
  const c = requireCore();
  const st = buildDS1WithCutoff();
  const a = matrixOf(c, st);
  const cut = c.applyCutoffs(a, st.criteria, st.options);
  assertDeepEqual(cut.includedIndices, [0, 1], "残る選択肢の index(ベンダーA / B)");
  assertEqual(cut.excluded.length, 1, "除外件数");
  assertEqual(cut.excluded[0].index, 2, "除外されたのはベンダーC");
  assert(
    cut.excluded[0].text.indexOf("移行コストが最低ライン3.0を下回るため除外") >= 0,
    "除外理由文(prd §5-8)。実際: " + cut.excluded[0].text
  );
  const vm = analyzeOk(c, st, "AC-16");
  assertDeepEqual(names(vm.ranking), ["ベンダーB", "ベンダーA"], "残る2件の順位");
  assertDeepEqual(vm.ranking.map((r) => r.displayScore), ["67.0", "63.5"], "AC-01 と同一(集合非依存)");
  assertEqual(vm.excluded.length, 1, "excluded の件数");
  assertEqual(vm.excluded[0].name, "ベンダーC", "excluded の中身");
  // Δ* / k* / ラベルが AC-08 と一致
  assertClose(vm.robustness.deltaStar, 119 / 1740, TOL, "Δ*(AC-08 と一致)");
  assertEqual(vm.robustness.kStarName, "移行コスト", "k*(AC-08 と一致)");
  assertEqual(vm.robustness.label, "fragile", "ラベル(AC-08 と一致)");
});

// ── AC-17 ★必須ケース ────────────────────────────────────────────────
test("AC-17 robust ケース(DS-2)", () => {
  const c = requireCore();
  const st = buildDS2();
  const vm = analyzeOk(c, st, "AC-17");
  const P = byName(vm.ranking, "物件P");
  const Q = byName(vm.ranking, "物件Q");
  assertDeepEqual(P.a.slice(), [3 / 5, 7 / 10, 4 / 5], "物件P の正規化値");
  assertDeepEqual(Q.a.slice(), [2 / 5, 3 / 10, 1 / 2], "物件Q の正規化値");
  assertClose(P.score, 137 / 200, TOL, "S_P");
  assertClose(Q.score, 39 / 100, TOL, "S_Q");
  assertDeepEqual([P.displayScore, Q.displayScore], ["68.5", "39.0"], "スコア表示");
  assertEqual(vm.winner.name, "物件P", "勝者");
  assertClose(vm.d0, 59 / 200, TOL, "D₀");
  assertEqual(vm.displayD0, "29.5", "D₀ 表示");
  // 全基準が逆転不能
  assertEqual(vm.criticality.length, 3, "臨界度の行数");
  for (const row of vm.criticality) {
    assertEqual(row.infeasible, true, row.name + ": 逆転不能であること");
    assertEqual(row.sens, 0, row.name + ": sens = 0");
  }
  assertEqual(vm.robustness.label, "robust", "ラベル");
  assertEqual(vm.robustness.deltaStar, Infinity, "Δ* = ∞");
  assert(vm.robustness.caveat !== null && vm.robustness.caveat !== undefined, "robust に caveat が必須 (FR-22)");
  assert(
    vm.robustness.caveat.indexOf("基準そのものが抜けている可能性は、この分析では検出できません。") >= 0,
    "FR-22 の但し書き文言。実際: " + vm.robustness.caveat
  );
  // 勝敗貢献度(全て正)
  assertClose(byName(vm.winContrib, "家賃").value, 16 / 59, TOL, "g_家賃");
  assertClose(byName(vm.winContrib, "通勤時間").value, 28 / 59, TOL, "g_通勤時間");
  assertClose(byName(vm.winContrib, "環境").value, 15 / 59, TOL, "g_環境");
  assertDeepEqual(vm.winContrib.map((x) => x.display), ["+27.1", "+47.5", "+25.4"], "g 表示");
  assertDeepEqual(vm.winContrib.map((x) => x.negative), [false, false, false], "全て正であること");
  assertClose(vm.winContrib.reduce((p, x) => p + x.value, 0), 1, 1e-12, "Σg = 1");
});

// ── AC-18 ────────────────────────────────────────────────────────────
test("AC-18 同点(D₀ = 0)の退化ケース", () => {
  const c = requireCore();
  const st = buildDS3();
  const a = matrixOf(c, st);
  assertDeepEqual(a[0], [3 / 5, 3 / 5], "案X の正規化値");
  assertDeepEqual(a[1], [2 / 5, 4 / 5], "案Y の正規化値");
  const vm = c.analyze(st);
  assertEqual(vm.ok, false, "ok");
  assertEqual(vm.degenerate, "tie", "degenerate");
  assertEqual(vm.message, "同点です。基準またはスコアを見直してください。", "退化文言(prd §5-3)");
  assertClose(vm.d0, 0, TOL, "D₀ = 0");
  assertEqual(vm.robustness, null, "頑健性ラベルを一切表示しないこと");
  assertDeepEqual(vm.winContrib, [], "g_j も表示しないこと(分母0)");
  assertDeepEqual(vm.ranking.map((r) => r.displayScore), ["60.0", "60.0"], "スコアは表示してよい");
  // float では厳密に 0 にならない(実測 -1.11e-16)。EPS 判定の存在証明。
  const r = c.rank(c.computeScores(a, c.normalizeWeights(rawWeightsOf(st))), st.options);
  assertEqual(r.tied, true, "rank().tied が EPS 判定で true になること");
});

// ── AC-19 ────────────────────────────────────────────────────────────
test("AC-19 S_i = 0 の退化ケース(貢献度は「—」)", () => {
  const c = requireCore();
  const st = buildDS1WithZ();
  const vm = analyzeOk(c, st, "AC-19");
  const z = byName(vm.ranking, "案Z");
  assertDeepEqual(z.a.slice(), [0, 0, 0, 0], "案Z の a_ij");
  assertEqual(z.score, 0, "S_Z = 0(厳密)");
  assertEqual(z.displayScore, "0.0", "S_Z の表示");
  assertEqual(z.contribution.length, 4, "貢献度の件数");
  for (const cb of z.contribution) {
    assertEqual(cb.display, "\u2014", cb.name + ": 貢献度表示は em dash 「—」であること");
    assertEqual(cb.value, null, cb.name + ": value は null");
  }
  const joined = JSON.stringify(z.contribution);
  assert(joined.indexOf("NaN") < 0, "出力に NaN を含まないこと: " + joined);
  assert(joined.indexOf('"0%"') < 0 && joined.indexOf('"0.0"') < 0, "出力に 0% / 0.0 を含まないこと: " + joined);
});

// ── AC-20 ────────────────────────────────────────────────────────────
test("AC-20 選択肢追加に対する順位不変(rank invariance)", () => {
  const c = requireCore();
  const before = analyzeOk(c, buildDS1(), "AC-20 前");
  const after = analyzeOk(c, buildDS1WithD(), "AC-20 後");
  for (const nm of ["ベンダーA", "ベンダーB", "ベンダーC"]) {
    // ビット単位で一致すること(集合非依存性 FR-21)
    assertEqual(byName(after.ranking, nm).score, byName(before.ranking, nm).score, nm + ": S_i が厳密一致");
  }
  assertDeepEqual(names(after.ranking), ["ベンダーD", "ベンダーB", "ベンダーA", "ベンダーC"], "追加後の全体順位");
  assertDeepEqual(
    after.ranking.map((r) => r.displayScore), ["86.0", "67.0", "63.5", "51.0"], "追加後のスコア表示"
  );
  assertClose(byName(after.ranking, "ベンダーD").score, 43 / 50, TOL, "S_D");
  const existing = names(after.ranking).filter((n) => n !== "ベンダーD");
  assertDeepEqual(existing, ["ベンダーB", "ベンダーA", "ベンダーC"], "既存3件の相対順序が不変");
  const rr = (after.warnings || []).filter((s) => /rank\s*reversal|順位逆転|パラドクス/i.test(s));
  assertDeepEqual(rr, [], "rank reversal 警告を出さないこと");
});

// ── AC-21 ★必須ケース ────────────────────────────────────────────────
test("AC-21 結論ありき逆算の検知(3編集の重み・1位・警告文)", () => {
  const c = requireCore();
  const st = buildDS1();
  const a = matrixOf(c, st);
  const w0 = c.normalizeWeights(rawWeightsOf(st));
  const kMig = 3;

  // 初期
  const s0 = c.computeScores(a, w0);
  assertDeepEqual(s0.map((x) => c.fmt.score(x)), ["63.5", "67.0", "51.0"], "初期スコア");
  assertEqual(st.options[c.rank(s0, st.options).winnerIndex].name, "ベンダーB", "初期の1位");

  // 編集1: 15% → 25%
  const w1 = c.reweight(w0, kMig, 0.25);
  assertDeepEqual(
    w1.map((x) => c.fmt.weight6(x)),
    ["30.882353", "26.470588", "17.647059", "25.000000"], "編集1の重み(6桁)"
  );
  assertClose(w1.reduce((p, q) => p + q, 0), 1, TOL, "編集1の Σw");
  const s1 = c.computeScores(a, w1);
  assertClose(s1[0] * 100, 65.44117647058823, 1e-9, "編集1 S_A");
  assertClose(s1[1] * 100, 63.82352941176471, 1e-9, "編集1 S_B");
  assertClose(s1[2] * 100, 47.35294117647059, 1e-9, "編集1 S_C");
  assertEqual(st.options[c.rank(s1, st.options).winnerIndex].name, "ベンダーA", "編集1後の1位");

  // 編集2: 25% → 15%(元に戻す)
  const w2 = c.reweight(w1, kMig, 0.15);
  const s2 = c.computeScores(a, w2);
  assertDeepEqual(s2.map((x) => c.fmt.score(x)), ["63.5", "67.0", "51.0"], "編集2のスコア");
  assertEqual(st.options[c.rank(s2, st.options).winnerIndex].name, "ベンダーB", "編集2後の1位");

  // 編集3: 15% → 30%
  const w3 = c.reweight(w2, kMig, 0.30);
  assertDeepEqual(
    w3.map((x) => c.fmt.weight6(x)),
    ["28.823529", "24.705882", "16.470588", "30.000000"], "編集3の重み(6桁)"
  );
  assertClose(w3.reduce((p, q) => p + q, 0), 1, TOL, "編集3の Σw");
  const s3 = c.computeScores(a, w3);
  assertClose(s3[0] * 100, 66.41176470588235, 1e-9, "編集3 S_A");
  assertClose(s3[1] * 100, 62.23529411764706, 1e-9, "編集3 S_B");
  assertClose(s3[2] * 100, 45.529411764705884, 1e-9, "編集3 S_C");
  assertEqual(st.options[c.rank(s3, st.options).winnerIndex].name, "ベンダーA", "編集3後の1位");

  // anchoringDetect
  const history = [
    { at: 1, criterionId: "c4", criterionName: "移行コスト", before: 0.15, after: 0.25, leaderBefore: "o2", leaderAfter: "o1" },
    { at: 2, criterionId: "c4", criterionName: "移行コスト", before: 0.25, after: 0.15, leaderBefore: "o1", leaderAfter: "o2" },
    { at: 3, criterionId: "c4", criterionName: "移行コスト", before: 0.15, after: 0.30, leaderBefore: "o2", leaderAfter: "o1" },
  ];
  const r = c.anchoringDetect(history, 3);
  assertEqual(r.edits, 3, "N(編集回数)");
  assertEqual(r.flips, 3, "f(1位入替回数)");
  assertEqual(r.warn, true, "f ≥ 3 で警告");
  assertEqual(
    r.message,
    "重みを 3 回編集する間に1位が 3 回入れ替わっています。\n結論に合わせて重みを調整していないか確認してください。",
    "警告文(prd §5-4 正典)"
  );
});

test("AC-21 警告は編集をブロックしない(analyze の他の値に影響しない)", () => {
  const c = requireCore();
  const st = buildDS1();
  const plain = analyzeOk(c, st, "AC-21 履歴なし");
  const st2 = buildDS1();
  st2.history = [
    { at: 1, criterionId: "c4", criterionName: "移行コスト", before: 0.15, after: 0.25, leaderBefore: "o2", leaderAfter: "o1" },
    { at: 2, criterionId: "c4", criterionName: "移行コスト", before: 0.25, after: 0.15, leaderBefore: "o1", leaderAfter: "o2" },
    { at: 3, criterionId: "c4", criterionName: "移行コスト", before: 0.15, after: 0.30, leaderBefore: "o2", leaderAfter: "o1" },
  ];
  const warned = analyzeOk(c, st2, "AC-21 履歴あり");
  assertEqual(warned.anchoring.warn, true, "警告が出ていること");
  assertEqual(warned.ok, true, "ok=true のまま(ブロックしない)");
  assertDeepEqual(
    warned.ranking.map((r) => r.displayScore),
    plain.ranking.map((r) => r.displayScore),
    "履歴の有無でスコアが変わらないこと"
  );
  assertEqual(c.anchoringDetect([], 3).warn, false, "履歴が空なら警告なし");
  assertEqual(c.anchoringDetect([], 3).message, null, "履歴が空なら message は null");
});

// ── AC-22 ────────────────────────────────────────────────────────────
/**
 * design.md §3-6 D-6 の3値応答を読む。
 * 応答は判別可能であればよく、フィールド配置は設計で固定されていないため
 * {ok:true,value} / {repaired:true,value} / {failed:true} のいずれの形も受ける。
 */
function readValidation(res) {
  assert(res !== null && typeof res === "object", "validateState が応答オブジェクトを返さない");
  const failed = res.failed === true || res.ok === false && res.repaired !== true && !res.value;
  const repaired = res.repaired === true;
  const ok = !failed && !repaired && (res.ok === true || !!res.value);
  return { ok, repaired, failed, value: res.value, notes: res.notes || [] };
}

test("AC-22 永続化: state の JSON round-trip が AC-01 / AC-09 と一致", () => {
  const c = requireCore();
  const st = buildDS1();
  st.settings.theta = 0.05;
  const res = readValidation(c.validateState(JSON.parse(JSON.stringify(st))));
  assertEqual(res.failed, false, "健全な state が failed になってはならない");
  assertEqual(res.repaired, false, "健全な state は修復不要であること");
  assertEqual(res.ok, true, "健全な state は ok であること");
  const restored = res.value;
  assert(restored && typeof restored === "object", "validateState の value が state でない");
  assertEqual(restored.settings.theta, 0.05, "θ = 0.05 が復元されること");
  assertDeepEqual(restored.criteria.map((x) => x.name), ["価格", "機能充足度", "サポート", "移行コスト"], "基準名");
  assertDeepEqual(restored.criteria.map((x) => x.direction), ["cost", "benefit", "benefit", "cost"], "向き");
  assertDeepEqual(restored.criteria.map((x) => x.rawWeight), [35, 30, 20, 15], "重み");
  const vm = analyzeOk(c, restored, "AC-22");
  assertEqual(byName(vm.ranking, "ベンダーB").displayScore, "67.0", "S_B(AC-01 と一致)");
  assertEqual(vm.robustness.displayDelta, "6.8", "Δ*(AC-05 と一致)");
  assertEqual(vm.robustness.kStarName, "移行コスト", "k*(AC-05 と一致)");
  assertEqual(vm.robustness.label, "contingent", "θ=0.05 保持によりラベルは contingent(AC-09 と一致)");
});

test("AC-22 永続化: 壊れたデータの復旧ラダー (design.md §3-6 D-6)", () => {
  const c = requireCore();
  // repaired: 局所的な異常を安全側に丸めて採用する
  const broken = buildDS1();
  broken.criteria[0].rawWeight = -5;        // 負 → 0
  broken.criteria[1].direction = "unknown"; // 不正 → benefit
  broken.settings.theta = 99;               // 範囲外 → 既定 0.10
  broken.options[0].scores.c1 = 999;        // 範囲外 → [0,10] にクランプ
  const r1 = readValidation(c.validateState(JSON.parse(JSON.stringify(broken))));
  assertEqual(r1.repaired, true, "局所的な異常は repaired として救うこと");
  assert(r1.value !== null && r1.value !== undefined, "repaired でも value を返すこと");
  assertEqual(r1.value.criteria[0].rawWeight, 0, "負の rawWeight を 0 に丸める");
  assertEqual(r1.value.criteria[1].direction, "benefit", "不正な direction を benefit にする");
  assertEqual(r1.value.settings.theta, 0.10, "範囲外の theta を既定 0.10 にする");
  assertEqual(r1.value.options[0].scores.c1, 10, "範囲外スコアを [0,10] にクランプ");

  // failed: 構造そのものが違う
  for (const junk of [null, 42, "文字列", [], { criteria: {}, options: {} }]) {
    const r = readValidation(c.validateState(junk));
    assertEqual(r.failed, true, JSON.stringify(junk) + ": 構造違いは failed として隔離すること");
  }
  // 例外を投げないこと(壊れたデータで白画面にしない)
  assert(typeof c.migrateState === "function", "migrateState が存在すること");
  const mig = c.migrateState({ schemaVersion: 1, criteria: [], options: [] });
  assert(mig !== undefined, "migrateState が値を返すこと(v1 では恒等変換)");
});

test("AC-22 localStorage のキーが全て tenbin.v1. で始まる(静的検査)", () => {
  const html = readHtml();
  const keys = [];
  const re = /localStorage\s*\.\s*(?:setItem|getItem|removeItem)\s*\(\s*(["'`])((?:\\.|(?!\1)[^\\])*)\1/g;
  let m;
  while ((m = re.exec(html)) !== null) keys.push(m[2]);
  assert(keys.length > 0, "localStorage のキーリテラルが1つも見つからない(FR-16 未実装か)");
  const bad = keys.filter((k) => k.indexOf("tenbin.v1.") !== 0);
  assertDeepEqual(bad, [], "tenbin.v1. で始まらないキー(他の名前空間を汚染している)");
});

SKIP("AC-22 リロード復元と「全消去」後のキー0個", "UI位相で検証(ブラウザ実機の localStorage 操作が必要)");

// ── AC-23 ────────────────────────────────────────────────────────────
test("AC-23 エクスポート: Analysis に必要な値が全て載っている", () => {
  const c = requireCore();
  const vm = analyzeOk(c, buildDS1(), "AC-23");
  // 総合スコアと順位
  assertDeepEqual(vm.ranking.map((r) => r.displayScore), ["67.0", "63.5", "51.0"], "総合スコア");
  assertDeepEqual(names(vm.ranking), ["ベンダーB", "ベンダーA", "ベンダーC"], "順位");
  // 各基準の Δw_k
  const byNm = {};
  for (const r of vm.criticality) byNm[r.name] = r;
  assertEqual(byNm["移行コスト"].displayDelta, "+6.8", "Δw 移行コスト");
  assertEqual(byNm["価格"].displayDelta, "-8.6", "Δw 価格");
  assertEqual(byNm["機能充足度"].displayDelta, "+18.1", "Δw 機能充足度");
  assertEqual(byNm["サポート"].infeasible, true, "サポート 逆転不能");
  // Δ* / k* / ラベル
  assertEqual(vm.robustness.displayDelta, "6.8", "Δ*");
  assertEqual(vm.robustness.kStarName, "移行コスト", "k*");
  assertEqual(vm.robustness.label, "fragile", "ラベル");
  // 各基準の向き
  const st = buildDS1();
  assertDeepEqual(st.criteria.map((x) => x.direction), ["cost", "benefit", "benefit", "cost"], "向き");
  // 数値フィールドが数値型であること(JSON エクスポートの前提)
  for (const r of vm.ranking) assertEqual(typeof r.score, "number", r.name + ": score は数値型");
  for (const wv of vm.weights) assertEqual(typeof wv.weight, "number", wv.name + ": weight は数値型");
  // JSON としてシリアライズ可能であること
  const json = JSON.stringify(vm);
  assert(typeof json === "string" && json.length > 0, "Analysis が JSON 化できない");
  assertEqual(typeof JSON.parse(json), "object", "生成された JSON がパース可能");
});

SKIP("AC-23 CSV / Markdown / JSON の実ファイル3本の内容確認", "UI位相で検証(エクスポートは L3 の責務)");

// ── AC-24 / AC-25 / AC-26 の手動部分 ─────────────────────────────────
SKIP("AC-24 ネットワーク遮断状態でのダブルクリック起動", "UI位相で検証(ブラウザ実機が必要)");
SKIP("AC-25 DevTools Network の記録リクエスト数 = 1", "UI位相で検証(ブラウザ実機が必要)");
SKIP("AC-26 キーボードのみ7操作の通し実行 / ズーム200%", "UI位相で検証(実キーボード操作が必要)");

// ════════════════════════════════════════════════════════════════════════════
//  §F  反例探索テスト(tasks.md §4-5)— 閉形式 vs ブルートフォース
// ════════════════════════════════════════════════════════════════════════════

section("[性質] 反例探索 — 閉形式 vs ブルートフォース");

/** 自前の線形合同法 PRNG。Math.random は使わない(反例を再現できなくなるため)。 */
function makeRng(seed) {
  let s = seed >>> 0;
  return function rng() {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
function randInt(rng, lo, hi) {   // [lo, hi] 両端含む
  return lo + Math.floor(rng() * (hi - lo + 1));
}

const SEED = 20260901;
const TRIALS = 500;

/** 1試行分の入力を生成する。反例として印字すればそのまま再現できる形。 */
function genCase(rng) {
  const m = randInt(rng, 2, 5);   // 選択肢 2〜5 件
  const n = randInt(rng, 2, 6);   // 基準 2〜6 個
  const rawW = [];
  for (let j = 0; j < n; j++) rawW.push(randInt(rng, 1, 100));
  const dir = [];
  for (let j = 0; j < n; j++) dir.push(rng() < 0.5 ? "benefit" : "cost");
  const raw = [];
  for (let i = 0; i < m; i++) {
    const row = [];
    for (let j = 0; j < n; j++) row.push(randInt(rng, 0, 20) / 2);  // 0〜10、0.5 刻み
    raw.push(row);
  }
  return { m, n, rawW, dir, raw };
}

function caseToState(cs) {
  const criteria = [];
  for (let j = 0; j < cs.n; j++) criteria.push(crit("c" + (j + 1), "基準" + (j + 1), cs.dir[j], cs.rawW[j]));
  const options = [];
  for (let i = 0; i < cs.m; i++) {
    const scores = {};
    for (let j = 0; j < cs.n; j++) scores["c" + (j + 1)] = cs.raw[i][j];
    options.push(opt("o" + (i + 1), "選択肢" + (i + 1), scores));
  }
  return mkState(criteria, options);
}

function showCase(cs, extra) {
  return "反例(seed=" + SEED + "):\n" + JSON.stringify({
    m: cs.m, n: cs.n, rawW: cs.rawW, dir: cs.dir, raw: cs.raw,
  }) + (extra ? "\n" + extra : "");
}

test("性質: 閉形式とブルートフォースが一致する(" + TRIALS + "試行)", () => {
  const c = requireCore();
  const rng = makeRng(SEED);
  const problems = [];
  let usable = 0, rowsChecked = 0, feasibleRows = 0, dominantRows = 0;

  for (let t = 0; t < TRIALS && problems.length < 5; t++) {
    const cs = genCase(rng);
    const st = caseToState(cs);
    let vm;
    try {
      vm = c.analyze(st);
    } catch (err) {
      problems.push(showCase(cs, "analyze が例外を投げた: " + (err && err.message)));
      continue;
    }
    if (!vm || !vm.ok) continue;   // 退化はこのテストの対象外
    usable++;

    const a = matrixOf(c, st);
    const w = c.normalizeWeights(rawWeightsOf(st));
    const iW = optIndexById(st, vm.winner.id);

    for (const row of vm.criticality) {
      rowsChecked++;
      const k = st.criteria.findIndex((x) => x.id === row.criterionId);
      if (k < 0) { problems.push(showCase(cs, "criticality 行の criterionId が不明: " + row.criterionId)); break; }

      if (!row.infeasible) {
        // ── 主張1: 実行可能なら閾値でちょうど同点になる ─────────────
        feasibleRows++;
        const iL = optIndexById(st, row.opponentId);
        if (iL < 0) { problems.push(showCase(cs, "k=" + k + " の opponentId が不明: " + row.opponentId)); break; }
        const w2 = c.reweight(w, k, row.wStar);
        const sumW = w2.reduce((p, q) => p + q, 0);
        if (!(Math.abs(sumW - 1) <= 1e-9)) {
          problems.push(showCase(cs, "k=" + k + ": 再正規化後の Σw = " + sumW + "(|Σw−1| > 1e-9)"));
          break;
        }
        const s2 = c.computeScores(a, w2);
        const gap = Math.abs(s2[iW] - s2[iL]);
        if (!(gap < 1e-9)) {
          problems.push(showCase(cs,
            "主張1 破れ: k=" + k + "(" + row.name + ") wStar=" + row.wStar +
            " で S_W−S_L = " + (s2[iW] - s2[iL]).toExponential(3) + "(|差| < 1e-9 のはず)"));
          break;
        }
      } else {
        // ── 主張2: 逆転不能なら [0,1] のどこへ動かしても1位が変わらない ──
        dominantRows++;
        let broke = null;
        for (let step = 0; step <= 100; step++) {
          const x = step / 100;
          const w2 = c.reweight(w, k, x);
          const sumW = w2.reduce((p, q) => p + q, 0);
          if (!(Math.abs(sumW - 1) <= 1e-9)) {
            broke = "x=" + x + " で Σw = " + sumW + "(|Σw−1| > 1e-9)";
            break;
          }
          const s2 = c.computeScores(a, w2);
          let best = -Infinity;
          for (const v of s2) if (v > best) best = v;
          // コア EPS 分のスラック(判定は d_k ≥ −EPS)を許容し 1e-8 で照合する
          if (!(s2[iW] >= best - 1e-8)) {
            broke = "x=" + x + " で1位が入れ替わった(S_W=" + s2[iW] + " < max=" + best + ")";
            break;
          }
        }
        if (broke) {
          problems.push(showCase(cs, "主張2 破れ: k=" + k + "(" + row.name + ")逆転不能のはずが " + broke));
          break;
        }
      }
    }
  }

  if (problems.length > 0) {
    fail("反例 " + problems.length + " 件:\n" + problems.join("\n---\n"));
  }
  assert(usable >= 50, "有効試行が少なすぎる(" + usable + "/" + TRIALS + ")。生成器か退化判定を疑うこと");
  assert(rowsChecked > 0, "臨界度の行が1つも検査されていない");
  console.log("      有効試行 " + usable + "/" + TRIALS + " / 検査行 " + rowsChecked +
    "(実行可能 " + feasibleRows + " / 逆転不能 " + dominantRows + ")");
});

test("性質: 実行可能な閾値の両側で1位が入れ替わる(偽陽性の検出)", () => {
  const c = requireCore();
  const rng = makeRng(SEED + 1);
  const problems = [];
  const EPS2 = 1e-4;

  for (let t = 0; t < 200 && problems.length < 5; t++) {
    const cs = genCase(rng);
    const st = caseToState(cs);
    let vm;
    try { vm = c.analyze(st); } catch (e) { continue; }
    if (!vm || !vm.ok) continue;
    const a = matrixOf(c, st);
    const w = c.normalizeWeights(rawWeightsOf(st));
    const iW = optIndexById(st, vm.winner.id);

    for (const row of vm.criticality) {
      if (row.infeasible) continue;
      if (!(row.wStar > EPS2 && row.wStar < 1 - EPS2)) continue;
      const k = st.criteria.findIndex((x) => x.id === row.criterionId);
      const argmax = (s) => { let b = 0; for (let i = 1; i < s.length; i++) if (s[i] > s[b]) b = i; return b; };
      const lo = argmax(c.computeScores(a, c.reweight(w, k, row.wStar - EPS2)));
      const hi = argmax(c.computeScores(a, c.reweight(w, k, row.wStar + EPS2)));
      if (lo === hi) {
        problems.push(showCase(cs,
          "主張3 破れ: k=" + k + "(" + row.name + ")wStar=" + row.wStar +
          " の両側で1位が同じ(" + st.options[lo].name + ")。閉形式が偽陽性を出している疑い"));
        break;
      }
      if (lo !== iW && hi !== iW) {
        problems.push(showCase(cs, "主張3: k=" + k + " の閾値手前で既に勝者が1位でない"));
        break;
      }
    }
  }
  if (problems.length > 0) fail("反例 " + problems.length + " 件:\n" + problems.join("\n---\n"));
});

test("性質 P-1: reweight を20回連鎖しても Σw = 1", () => {
  const c = requireCore();
  const rng = makeRng(SEED + 2);
  for (let t = 0; t < 100; t++) {
    const n = randInt(rng, 2, 6);
    const rawW = [];
    for (let j = 0; j < n; j++) rawW.push(randInt(rng, 1, 100));
    let w = c.normalizeWeights(rawW);
    for (let s = 0; s < 20; s++) {
      const k = randInt(rng, 0, n - 1);
      const x = randInt(rng, 0, 100) / 100;
      w = c.reweight(w, k, x);
      const sum = w.reduce((p, q) => p + q, 0);
      if (!(Math.abs(sum - 1) <= 1e-9)) {
        fail("反例(seed=" + (SEED + 2) + "): rawW=" + JSON.stringify(rawW) +
          " の " + (s + 1) + " 回目(k=" + k + ", x=" + x + ")で Σw = " + sum);
      }
    }
  }
});

test("性質 P-2/P-7: Σg = 1、Σc = 1、sens × |delta| = 1", () => {
  const c = requireCore();
  const rng = makeRng(SEED + 3);
  let checked = 0;
  for (let t = 0; t < 200; t++) {
    const cs = genCase(rng);
    const st = caseToState(cs);
    let vm;
    try { vm = c.analyze(st); } catch (e) { continue; }
    if (!vm || !vm.ok) continue;
    checked++;
    const sg = vm.winContrib.reduce((p, x) => p + x.value, 0);
    if (!(Math.abs(sg - 1) <= 1e-12)) fail(showCase(cs, "P-2: Σg = " + sg));
    for (const r of vm.ranking) {
      if (r.excluded || !(r.score > 1e-12)) continue;
      const sc = r.contribution.reduce((p, x) => p + (x.value === null ? 0 : x.value), 0);
      if (!(Math.abs(sc - 1) <= 1e-12)) fail(showCase(cs, "P-2: " + r.name + " の Σc = " + sc));
    }
    for (const row of vm.criticality) {
      if (row.infeasible) {
        if (row.sens !== 0) fail(showCase(cs, "P-7: 逆転不能なのに sens = " + row.sens));
        continue;
      }
      const prod = row.sens * Math.abs(row.delta);
      if (!(Math.abs(prod - 1) <= 1e-9)) {
        fail(showCase(cs, "P-7: sens×|delta| = " + prod + "(sens の単位取り違えの疑い。§4-6-1)"));
      }
    }
  }
  assert(checked >= 20, "有効試行が少なすぎる(" + checked + ")");
});

test("性質 P-3: 選択肢を1件足しても既存の S_i がビット単位で不変", () => {
  const c = requireCore();
  const rng = makeRng(SEED + 4);
  let checked = 0;
  for (let t = 0; t < 150; t++) {
    const cs = genCase(rng);
    const st = caseToState(cs);
    let a1;
    try { a1 = c.analyze(st); } catch (e) { continue; }
    if (!a1 || !a1.ok) continue;
    const st2 = caseToState(cs);
    const extra = {};
    for (let j = 0; j < cs.n; j++) extra["c" + (j + 1)] = randInt(rng, 0, 20) / 2;
    st2.options.push(opt("oX", "追加選択肢", extra));
    let a2;
    try { a2 = c.analyze(st2); } catch (e) { continue; }
    if (!a2 || !a2.ok) continue;
    checked++;
    for (const r of a1.ranking) {
      const r2 = a2.ranking.find((x) => x.id === r.id);
      if (!r2) fail(showCase(cs, "P-3: 追加後に " + r.name + " が消えた"));
      if (!Object.is(r.score, r2.score)) {
        fail(showCase(cs, "P-3: " + r.name + " の S_i が変化 " + r.score + " \u2192 " + r2.score +
          "(FR-21 集合非依存性の破れ)"));
      }
    }
  }
  assert(checked >= 20, "有効試行が少なすぎる(" + checked + ")");
});

test("性質 P-5/P-6: analyze は例外を投げず、表示文字列に NaN/Infinity/undefined が出ない", () => {
  const c = requireCore();
  const rng = makeRng(SEED + 5);
  for (let t = 0; t < 200; t++) {
    const cs = genCase(rng);
    const st = caseToState(cs);
    // 不正値の混入(§4-13 の事後条件: いかなる入力でも throw しない)
    if (t % 7 === 0) st.options[0].scores["c1"] = null;
    if (t % 11 === 0) st.criteria[0].rawWeight = 0;
    if (t % 13 === 0) st.options[0].scores["c1"] = NaN;
    if (t % 17 === 0) st.criteria = [];
    let vm;
    try {
      vm = c.analyze(st);
    } catch (err) {
      fail(showCase(cs, "P-6: analyze が例外を投げた(t=" + t + "): " + (err && err.message)));
    }
    const json = JSON.stringify(vm, (k, v) => (typeof k === "string" && k.indexOf("display") === 0) || k === "text" || k === "verdict" || k === "message" ? v : v);
    const disp = JSON.stringify(vm);
    for (const bad of ["NaN", "Infinity", "undefined"]) {
      // 数値フィールドの Infinity は仕様(delta=Infinity)なので、display* / text 系のみ検査する
      const strings = [];
      const walk = (o) => {
        if (o === null || typeof o !== "object") return;
        for (const key of Object.keys(o)) {
          const v = o[key];
          if (typeof v === "string" && (key.indexOf("display") === 0 || key === "text" || key === "verdict" ||
              key === "message" || key === "labelLine" || key === "caveat" || key === "exclusionText")) {
            strings.push(key + "=" + v);
          } else if (typeof v === "object") walk(v);
        }
      };
      walk(vm);
      const hit = strings.filter((s) => s.indexOf(bad) >= 0);
      if (hit.length > 0) fail(showCase(cs, "P-5: 表示文字列に '" + bad + "' が出現: " + hit.join(", ")));
    }
    void json; void disp;
  }
});

test("性質 P-8: label = robust なら caveat が必ず非 null (FR-22)", () => {
  const c = requireCore();
  const rng = makeRng(SEED + 6);
  let robustSeen = 0;
  for (let t = 0; t < 300; t++) {
    const cs = genCase(rng);
    const st = caseToState(cs);
    let vm;
    try { vm = c.analyze(st); } catch (e) { continue; }
    if (!vm || !vm.ok || !vm.robustness) continue;
    if (vm.robustness.label === "robust") {
      robustSeen++;
      if (vm.robustness.caveat === null || vm.robustness.caveat === undefined) {
        fail(showCase(cs, "P-8: robust なのに caveat が " + vm.robustness.caveat));
      }
    }
  }
  // DS-2 が robust なので、少なくとも既知の1件は必ず存在する
  const vm2 = analyzeOk(c, buildDS2(), "P-8 DS-2");
  assertEqual(vm2.robustness.label, "robust", "DS-2 は robust であること");
  assert(vm2.robustness.caveat !== null, "DS-2 の caveat");
  console.log("      ランダム試行中の robust 件数: " + robustSeen);
});

// ════════════════════════════════════════════════════════════════════════════
//  §G  結果報告
// ════════════════════════════════════════════════════════════════════════════

console.log("");
if (CORE_ERROR) {
  console.log("!!! コアのロードに失敗しています。原因:");
  for (const line of CORE_ERROR.split("\n")) console.log("    " + line);
  console.log("    \u2192 実装(index.html)がまだ無い/契約を満たしていない場合、これは正しい RED です。");
  console.log("");
}
if (FAILURES.length > 0) {
  console.log("失敗したテスト(" + FAILURES.length + "件):");
  for (const f of FAILURES) console.log("  \u2717 " + f.name);
  console.log("");
}
console.log(
  "Tenbin tests: " + RESULTS.passed + " passed, " +
  RESULTS.failed + " failed, " + RESULTS.skipped + " skipped"
);
process.exit(RESULTS.failed > 0 ? 1 : 0);
