'use strict';
const { loadCore, DS1, DS2, DS3, mkState } = require('./harness');
const core = loadCore();
const J = (x) => JSON.stringify(x);
const hdr = (t) => console.log('\n──────── ' + t + ' ────────');

/* ============================================================
   G-1  尺度不一致: グリッドの「変換後」表示は 0-100、最低ラインは 0-10
   ============================================================ */
hdr('G-1  「変換後」ゴースト(0-100)と「最低ライン」入力(0-10)の尺度が10倍ずれる');
const st = DS1();
console.log('  AC-16 の正典: 正規化後の移行コスト = A:8.0 / B:4.0 / C:2.0(0-10 尺度)');
for (const o of st.options) {
  const raw = o.scores.c4;
  const nv = core.normalize(raw, 'cost');
  // index.html:2388 と同じ式
  const ghost = '変換後 ' + core.fmt.score(nv);
  console.log('    ' + o.name + ': 生=' + raw + ' → a=' + nv +
    ' → グリッドのゴースト表示 = "' + ghost + '"  / AC-16 の尺度では ' + (nv * 10).toFixed(1));
}
console.log('  最低ライン入力欄(index.html:726)は min=0 max=10 step=0.5。');
console.log('  applyCutoffs(index.html:1275)の判定は a*10 < cutoff — つまり 0-10 尺度。');
console.log('  → 画面には "変換後 20.0" と出るのに、除外するには "2.0" 超を入れねばならない。');
const stC = DS1(); stC.criteria[3].cutoff = 20;   // ゴーストの数字をそのまま入れた場合
console.log('  ユーザーがゴースト通り 20 と入れた場合(0-10 にクランプされ 10 になる):');
const vsC = core.validateState(JSON.parse(JSON.stringify(stC)));
console.log('    validateState → cutoff=' + vsC.value.criteria[3].cutoff + ' (' + J(vsC.notes) + ')');
console.log('    analyze → ' + core.analyze(vsC.value).degenerate + ' (全滅)');
console.log('  UI 経路(index.html:2794)は Math.min(10,v) で 10 になる → 同じく全滅。');

/* ============================================================
   G-2  design §8-8 の「確認」項目が実装と食い違う
   ============================================================ */
hdr('G-2  §8-8「1基準を100%にすると robust」— 実装は contingent');
const st100 = DS1();
st100.criteria.forEach((c, j) => { c.rawWeight = (j === 0 ? 100 : 0); });
const v100 = core.analyze(st100);
console.log('  w = ' + J(v100.weights.map(x => x.displayWeight + '%')));
console.log('  label = ' + v100.robustness.label + '  (design §8-8 の確認欄は robust を要求)');
console.log('  caveat = ' + J(v100.robustness.caveat) + '  ← robust でないので null');
console.log('  criticality: ' + J(v100.criticality.map(k => k.name + ':' + k.displayDelta)));
console.log('  内訳(なぜ contingent か):');
const w100 = core.normalizeWeights(st100.criteria.map(c => c.rawWeight));
const a100 = core.normalizeMatrix(st100.options, st100.criteria);
const sc100 = core.computeScores(a100, w100);
const rk100 = core.rank(sc100, st100.options);
console.log('    scores=' + J(sc100) + ' winner=' + st100.options[rk100.winnerIndex].name);
for (let k = 0; k < 4; k++) {
  const dk = a100[rk100.winnerIndex][k] - a100[rk100.order[1]][k];
  const d0 = sc100[rk100.winnerIndex] - sc100[rk100.order[1]];
  console.log('    k=' + st100.criteria[k].name + ' w_k=' + w100[k] + ' d_k=' + dk +
    ' → ' + J(core.tippingPoint(d0, dk, w100[k])));
}
console.log('  結論: w_k=0 の基準は tippingPoint 手順2 を通らず、上げれば逆転しうる。');
console.log('        実装が正しく、design §8-8 の「robust になる」という確認手順が誤り。');

/* ============================================================
   G-3  L1(EPS あり)と L2(EPS なし)の逆転可能性判定が食い違う境界
   ============================================================ */
hdr('G-3  L2 の "crosses"(v>1、EPS なし)と L1 の feasible(EPS あり)の不一致');
// w_k·d_k − D₀ ∈ (0, EPS) を作る。二基準・二選択肢で直接組む。
function probe(delta) {
  // c1: W が勝つ基準 / c2: 調整用
  // a を直接与えるため normalize を迂回してコア関数を直接叩く
  const w = [0.5, 0.5];
  const a = [[0.6, 0.4], [0.4, 0.4 + delta]];  // W=row0
  const s = core.computeScores(a, w);
  const d0 = s[0] - s[1];
  const dk = a[0][0] - a[1][0];
  const tp = core.tippingPoint(d0, dk, w[0]);
  const g = w[0] * dk / d0;
  return { d0, dk, wk: w[0], wkdk: w[0] * dk, tp, g };
}
console.log('  w_k·d_k と D₀ の差を縮めていく:');
for (const d of [0.2, 0.19999999999, 0.1999999999999999, 0.19999999999999998]) {
  const r = probe(d);
  const gap = r.wkdk - r.d0;
  console.log('    d0=' + r.d0.toExponential(4) + ' w_k·d_k=' + r.wkdk.toExponential(4) +
    ' 差=' + gap.toExponential(3) +
    ' | L1 feasible=' + r.tp.feasible + ' | g_k=' + r.g + ' | L2 crosses(g>1)=' + (r.g > 1));
}
// 差が (0, EPS) に入る点を総当りで探す
let found = null;
for (let t = 0; t < 3000000 && !found; t++) {
  const wk = 0.1 + Math.random() * 0.8;
  const dk = Math.random() * 0.9 + 0.05;
  // d0 を w_k·d_k より僅かに小さく取る
  const target = wk * dk;
  const d0 = target - Math.random() * 9e-10;
  if (!(d0 > 1e-9)) { continue; }
  const tp = core.tippingPoint(d0, dk, wk);
  const g = wk * dk / d0;
  if (!tp.feasible && g > 1) { found = { wk, dk, d0, gap: target - d0, g, tp }; }
}
console.log('  探索結果(L1 は逆転不能・L2 は「単独で覆せる」と表示する組):');
console.log('    ' + (found ? J(found) : '見つからず'));

/* ============================================================
   G-4  §8-10 ちらつき(対称データ)を成立する形で再試験
   ============================================================ */
hdr('G-4  §8-10 同値 |Δw| のちらつき / 安定ソート');
const stSym = mkState(
  [{ id: 'c1', name: 'X1', rawWeight: 25 }, { id: 'c2', name: 'X2', rawWeight: 25 },
   { id: 'c3', name: 'X3', rawWeight: 25 }, { id: 'c4', name: 'X4', rawWeight: 25 }],
  [{ id: 'o1', name: 'W', scores: [9, 9, 6, 6] },
   { id: 'o2', name: 'L1', scores: [6, 6, 8, 8] },
   { id: 'o3', name: 'L2', scores: [6, 6, 8, 8] }]
);
const a = core.analyze(stSym);
console.log('  ranking: ' + J(a.ranking.map(r => r.name + '=' + r.displayScore)));
const sig = (v) => J(v.criticality.map(k => k.name + '/' + k.displayDelta + '/' + k.opponentName));
console.log('  before: ' + sig(a));
stSym.options[2].scores.c1 = 6.0;   // 同じ値で書き直す(無関係な編集)
console.log('  after同値書換: ' + sig(core.analyze(stSym)));
// 完全対称な2基準(X1/X2)が同じ |Δw| を出しているか
console.log('  X1 と X2 の |Δw| が厳密に同一か: ' +
  (a.criticality.find(k => k.name === 'X1').delta === a.criticality.find(k => k.name === 'X2').delta));
console.log('  → 同値のとき先に見つかった挑戦者(入力順で早い L1)が保持されるか: ' +
  J(a.criticality.map(k => k.name + '→' + k.opponentName)));

/* ============================================================
   G-5  reweight と tippingPoint の写像一致(AC-10 の核心)を上限規模で
   ============================================================ */
hdr('G-5  AC-10: 閾値まで動かすと厳密に同点になるか(10×10 で 2000 試行)');
let maxRes = 0, cases = 0, bad = 0, worst = null;
for (let t = 0; t < 2000; t++) {
  const n = 2 + (t % 9), m = 2 + ((t * 3) % 9);
  const crits = [], opts = [];
  for (let j = 0; j < n; j++) crits.push({ id: 'c' + j, name: 'c' + j, direction: (t + j) % 2 ? 'cost' : 'benefit', rawWeight: 1 + Math.floor(Math.random() * 100) });
  for (let i = 0; i < m; i++) { const sc = []; for (let j = 0; j < n; j++) sc.push(Math.floor(Math.random() * 21) / 2); opts.push({ id: 'o' + i, name: 'o' + i, scores: sc }); }
  const s = mkState(crits, opts);
  const vm = core.analyze(s);
  if (!vm.ok) continue;
  const w = core.normalizeWeights(crits.map(c => c.rawWeight));
  const A = core.normalizeMatrix(s.options, s.criteria);
  for (const row of vm.criticality) {
    if (row.infeasible) continue;
    cases++;
    const k = s.criteria.findIndex(c => c.id === row.criterionId);
    const w2 = core.reweight(w, k, row.wStar);
    const sc2 = core.computeScores(A, w2);
    const wIdx = s.options.findIndex(o => o.id === vm.winner.id);
    const oIdx = s.options.findIndex(o => o.id === row.opponentId);
    const res = Math.abs(sc2[wIdx] - sc2[oIdx]);
    if (res > maxRes) { maxRes = res; worst = { n, m, k, wStar: row.wStar, res }; }
    if (res > 1e-9) bad++;
  }
}
console.log('  検査した実行可能行: ' + cases + ' / 残差 > 1e-9 の件数: ' + bad);
console.log('  最大残差: ' + maxRes.toExponential(3) + '  (worst: ' + J(worst) + ')');
console.log('  Σw2 の最大逸脱も確認 →');
{
  const w = core.normalizeWeights([35, 30, 20, 15]);
  let mx = 0, cur = w;
  for (let i = 0; i < 200; i++) { cur = core.reweight(cur, i % 4, Math.random() * 0.9); mx = Math.max(mx, Math.abs(cur.reduce((x, y) => x + y, 0) - 1)); }
  console.log('    reweight 200 連鎖後の max|Σw−1| = ' + mx.toExponential(3));
}

/* ============================================================
   G-6  UI が rawWeight に書き戻す経路の誤差蓄積(D-4)
   ============================================================ */
hdr('G-6  D-4: setWeight(index.html:2478) の rawWeight 書き戻しを 500 回反復');
{
  let crit = DS1().criteria;
  const normW = () => core.normalizeWeights(crit.map(c => c.rawWeight));
  let maxDev = 0, minRaw = Infinity, maxRaw = 0;
  for (let i = 0; i < 500; i++) {
    const w = normW();
    const k = i % 4;
    const x = 0.05 + Math.random() * 0.9;
    const next = core.reweight(w, k, x);          // index.html:2480
    crit.forEach((c, j) => { c.rawWeight = next[j] * 100; });  // index.html:2482
    const w2 = normW();
    maxDev = Math.max(maxDev, Math.abs(w2.reduce((p, q) => p + q, 0) - 1), Math.abs(w2[k] - x));
    crit.forEach(c => { minRaw = Math.min(minRaw, c.rawWeight); maxRaw = Math.max(maxRaw, c.rawWeight); });
  }
  console.log('  500 回の書き戻し後: max|Σw−1| および max|w[k]−x| = ' + maxDev.toExponential(3));
  console.log('  rawWeight の到達範囲: ' + minRaw.toExponential(3) + ' 〜 ' + maxRaw.toExponential(3));
  console.log('  最終 rawWeight = ' + J(crit.map(c => c.rawWeight)));
  const sub = normW();
  console.log('  最終 w = ' + J(sub) + ' Σ=' + sub.reduce((p, q) => p + q, 0));
}

/* ============================================================
   G-7  rawWeight が非正規化数(denormal)まで落ちるか → 0 に潰れる
   ============================================================ */
hdr('G-7  重みを極端に下げ続けたときの下限');
{
  let w = core.normalizeWeights([25, 25, 25, 25]);
  for (let i = 0; i < 60; i++) { w = core.reweight(w, 0, 0.999999); }
  console.log('  reweight(...,0,0.999999) を 60 回 → w = ' + J(w));
  console.log('  Σw = ' + w.reduce((a, b) => a + b, 0));
  const st2 = DS1();
  st2.criteria.forEach((c, j) => { c.rawWeight = w[j] * 100; });
  const v2 = core.analyze(st2);
  console.log('  analyze → ' + J(v2.weights.map(x => x.displayWeight)) + ' ok=' + v2.ok +
    ' label=' + (v2.robustness && v2.robustness.label));
}
