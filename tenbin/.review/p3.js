'use strict';
const { loadCore, DS1, DS2, DS3, mkState, html } = require('./harness');
const core = loadCore();
const J = (x) => JSON.stringify(x);
const hdr = (t) => console.log('\n──────── ' + t + ' ────────');

/* ============================================================
   F-1  normalizeWeights: Σŵ が overflow すると w が全て 0 になる
        design §4-2 事後条件 |Σw−1| ≤ EPS 違反 / Z-1 の検査を素通り
   ============================================================ */
hdr('F-1  normalizeWeights の事後条件破れ(overflow)');
for (const rw of [[1e308, 1e308], [1.5e308, 1], [1e308, 1e308, 1e308]]) {
  const w = core.normalizeWeights(rw);
  const s = w.reduce((a, b) => a + b, 0);
  console.log('  ŵ=' + J(rw) + ' → w=' + J(w) + ' Σw=' + s +
    '  事後条件|Σw−1|≤1e-9: ' + (Math.abs(s - 1) <= 1e-9));
}

hdr('F-1b 到達性: validateState は 1e308 の rawWeight を "ok" として通す');
const stBig = mkState(
  [{ id: 'c1', name: '価格', rawWeight: 1e308 }, { id: 'c2', name: '品質', rawWeight: 1e308 }],
  [{ id: 'o1', name: 'X', scores: [10, 0] }, { id: 'o2', name: 'Y', scores: [0, 10] }]
);
const vsBig = core.validateState(JSON.parse(JSON.stringify(stBig)));
console.log('  validateState → ' + J(Object.keys(vsBig)) + ' (repaired でも failed でもない)');
console.log('  保持された rawWeight: ' + J(vsBig.value.criteria.map(c => c.rawWeight)));
const aBig = core.analyze(vsBig.value);
console.log('  analyze → ok=' + aBig.ok + ' degenerate=' + aBig.degenerate);
console.log('  message: ' + aBig.message);
console.log('  画面に出る重み: ' + J(aBig.weights.map(x => x.displayWeight + '%')) + '  ← 合計 0.0%');
console.log('  画面に出るスコア: ' + J(aBig.ranking.map(r => r.name + '=' + r.displayScore)));
console.log('  ※ X は c1 で満点・Y は c2 で満点。本来 50:50 で同点だが、');
console.log('    「重み 0.0% / スコア 0.0」という嘘の数字が出ている。');

/* ============================================================
   F-2  fmt が Infinity を画面に出す(§4-14 の「最後の砦」の穴)
        isShowable は入力の有限性しか見ない。×100 後の overflow は素通り。
   ============================================================ */
hdr('F-2  fmt.* が文字列 "Infinity" を返す');
for (const [n, f, v] of [['score', core.fmt.score, 1e307], ['weight', core.fmt.weight, 1e307],
                         ['weight6', core.fmt.weight6, 1e307], ['points', core.fmt.points, 1e307],
                         ['percent', core.fmt.percent, -1e307]]) {
  console.log('  fmt.' + n + '(' + v + ') = ' + J(f(v)) + '   ← 期待は "—"(design §4-14)');
}
hdr('F-2b 到達性: initialWeights 経由で画面に "Infinity%" が出る');
const stInf = DS1();
stInf.initialWeights = { c1: 1e307, c2: 0.3, c3: 0.2, c4: 0.15 };
const vInf = core.analyze(stInf);
console.log('  weights[0].displayInitial = ' + J(vInf.weights[0].displayInitial));
console.log('  TEXT.initialWeightLine → ' +
  J(core.TEXT.initialWeightLine('価格', vInf.weights[0].displayInitial, vInf.weights[0].displayWeight)));
console.log('  ↑ この文字列が index.html:2252 で <li>.textContent にそのまま入る');
const vsInf = core.validateState(JSON.parse(JSON.stringify(stInf)));
console.log('  validateState は initialWeights=1e307 を: ' + J(Object.keys(vsInf)) +
  ' → ' + J(vsInf.value.initialWeights.c1));

/* ============================================================
   F-3  reweight: x を [0,1] にクランプしない → 負の重みが作れる
   ============================================================ */
hdr('F-3  reweight が事前条件 x∈[0,1] を防御していない');
const w4 = core.normalizeWeights([35, 30, 20, 15]);
for (const x of [1.5, -0.5]) {
  const r = core.reweight(w4, 0, x);
  console.log('  reweight(w,0,' + x + ') = ' + J(r) + '  Σ=' + r.reduce((a, b) => a + b, 0));
}
console.log('  → 負の重み。以降 computeScores / criticality が負の重みで走る:');
const stNeg = DS1();
const rNeg = core.reweight(w4, 0, 1.5);
stNeg.criteria.forEach((c, j) => { c.rawWeight = rNeg[j] * 100; });
const vNeg = core.analyze(stNeg);
console.log('    rawWeight = ' + J(stNeg.criteria.map(c => c.rawWeight)));
console.log('    analyze → 重み表示 ' + J(vNeg.weights.map(x => x.displayWeight)) +
  '  (負の rawWeight は normalizeWeights が 0 に潰す)');
console.log('    ranking ' + J(vNeg.ranking.map(r => r.name + '=' + r.displayScore)) +
  ' label=' + (vNeg.robustness && vNeg.robustness.label));
console.log('  ※ 実際の UI(index.html:2714/2733/2766)は clamp してから呼ぶので');
console.log('    現行の到達経路は無い。コア単体の契約としては未防御。');

/* ============================================================
   F-4  L2 が「単独で逆転できるか」を自前で判定している(INV-2)
   ============================================================ */
hdr('F-4  L2(index.html:2180)の `v > 1` は EPS 無しの逆転可能性判定');
// g_j がちょうど 1 近傍になる入力を作る:w_k d_k = D0
function gOf(st) {
  const v = core.analyze(st);
  return v.winContrib.map(c => c.name + '=' + c.value);
}
const stG = mkState(
  [{ id: 'c1', name: 'A', rawWeight: 50 }, { id: 'c2', name: 'B', rawWeight: 50 }],
  [{ id: 'o1', name: 'W', scores: [6, 4] }, { id: 'o2', name: 'L', scores: [4, 5] }]
);
const vG = core.analyze(stG);
console.log('  g = ' + J(vG.winContrib.map(c => c.name + ':' + c.value)));
console.log('  L2 の判定 (v>1): ' + J(vG.winContrib.map(c => c.name + ':' + (c.value > 1))));
console.log('  L1 criticality の判定(下げて逆転可能=feasible かつ delta<0):');
console.log('    ' + J(vG.criticality.map(k => k.name + ':' + (k.infeasible ? '逆転不能' : k.displayDelta))));
// 境界のゆらぎ
console.log('  境界のゆらぎ:');
for (const eps of [0, 1e-16, -1e-16]) {
  const val = 1 + eps;
  console.log('    value=' + val + ' → crosses=' + (val > 1) + ' (EPS ヒステリシス無し)');
}

/* ============================================================
   F-5  性能: 上限 10×10 での analyze 1回あたりの実測
   ============================================================ */
hdr('F-5  性能実測(上限 10 選択肢 × 10 基準)');
function big1010() {
  const crits = [], opts = [];
  for (let j = 0; j < 10; j++) {
    crits.push({ id: 'c' + j, name: '基準' + j, direction: j % 2 ? 'cost' : 'benefit', rawWeight: 1 + j });
  }
  for (let i = 0; i < 10; i++) {
    const sc = [];
    for (let j = 0; j < 10; j++) { sc.push(Math.round(((i * 7 + j * 3) % 21)) / 2); }
    opts.push({ id: 'o' + i, name: '選択肢' + i, scores: sc });
  }
  return mkState(crits, opts);
}
const stBigG = big1010();
core.analyze(stBigG);
let t0 = process.hrtime.bigint();
const N = 2000;
for (let i = 0; i < N; i++) { core.analyze(stBigG); }
let t1 = process.hrtime.bigint();
const per = Number(t1 - t0) / N / 1e6;
console.log('  analyze × ' + N + ' 回 → 1回あたり ' + per.toFixed(4) + ' ms');
console.log('  16ms 予算に対する比率: ' + (per / 16 * 100).toFixed(2) + '%');
// UI 1打鍵あたりの analyze 呼び出し回数(重みスライダー)
console.log('  ※ 重みスライダー1回の input で analyze が何回走るか(index.html を読んだ結果):');
console.log('     beginEdit→currentLeader() 1回 + draw() 1回 = 打鍵ごと最大2回');
console.log('     change/blur では endEdit→recordWeightEdit→currentLeader() でさらに +1');
t0 = process.hrtime.bigint();
for (let i = 0; i < N; i++) { core.analyze(stBigG); core.analyze(stBigG); core.analyze(stBigG); }
t1 = process.hrtime.bigint();
console.log('  → 3回分 = ' + (Number(t1 - t0) / N / 1e6).toFixed(4) + ' ms/操作');

/* ============================================================
   F-6  足切りの尺度: cost 基準では「最低ライン3.0」= 生スコア7以下
   ============================================================ */
hdr('F-6  足切りの尺度(FR-20 は正規化後尺度と明記。UI に手掛かりが無い)');
const stCut = DS1();
stCut.criteria[3].cutoff = 3.0;   // 移行コスト = cost
const vCut = core.analyze(stCut);
console.log('  移行コスト(cost)に最低ライン 3.0 → 除外: ' + J(vCut.excluded.map(e => e.exclusionText)));
console.log('  生スコア: A=2, B=6, C=8 / 正規化後: A=8.0, B=4.0, C=2.0');
console.log('  → 生スコア 8(最悪)の C が落ち、生スコア 2(最良)の A が残る。');
console.log('  UI の入力欄(index.html:726)は min=0 max=10 step=0.5 で、');
console.log('  グリッドのセル(生スコア)と見た目が同一。尺度の説明文字列は無し。');

/* ============================================================
   F-7  §8-2 重み全ゼロ / §8-8 単独100% / §8-4 同点 / §8-9 未入力 の実測
   ============================================================ */
hdr('F-7  design §8 失敗モードの実測');
const st0 = DS1(); st0.criteria.forEach(c => { c.rawWeight = 0; });
const v0 = core.analyze(st0);
console.log('  §8-2 重み全0 → 警告=' + J(v0.warnings) + ' 重み=' + J(v0.weights.map(x => x.displayWeight)) +
  ' ok=' + v0.ok + ' label=' + (v0.robustness && v0.robustness.label));
const st100 = DS1();
st100.criteria.forEach((c, j) => { c.rawWeight = j === 0 ? 100 : 0; });
const v100 = core.analyze(st100);
console.log('  §8-8 単独100% → label=' + (v100.robustness && v100.robustness.label) +
  ' Δ*=' + (v100.robustness && v100.robustness.displayDelta) +
  ' caveat非null=' + (v100.robustness && v100.robustness.caveat !== null));
console.log('    reweight 恒等性: ' + J(core.reweight([1, 0, 0, 0], 0, 0.5)));
const v3 = core.analyze(DS3());
console.log('  §8-4 同点 → degenerate=' + v3.degenerate + ' robustness=' + v3.robustness +
  ' winContrib=' + v3.winContrib.length + ' ranking=' + J(v3.ranking.map(r => r.displayScore)));
const stU = DS1(); delete stU.options[0].scores.c2;
const vU = core.analyze(stU);
console.log('  §8-9 未入力 → degenerate=' + vU.degenerate + ' / ' + vU.message);
const stN = DS1(); stN.options[0].scores.c1 = NaN;
console.log('  §8-5 NaN 混入 → degenerate=' + core.analyze(stN).degenerate);
const stS = DS1(); stS.options[0].scores.c1 = 1e308;
const vS = core.analyze(stS);
console.log('  §8-6 スコア1e308 → クランプ後 a=' + vS.ranking.map(r => r.name + ':' + r.a[0]).join(',') +
  ' ok=' + vS.ok);
const stAll = DS1(); stAll.criteria[0].cutoff = 10;
const vAll = core.analyze(stAll);
console.log('  §8-7 全件足切り → degenerate=' + vAll.degenerate + ' 除外理由' + vAll.excluded.length + '件');
const stName = DS1(); stName.options[0].name = 'あ'.repeat(100000);
const vName = core.analyze(stName);
console.log('  §8-6 名前10万字 → analyze 完走 ' + vName.ok + ' / name長=' + vName.ranking[0].name.length +
  ' ← analyze はクランプしない(validateState は ' +
  core.validateState(JSON.parse(JSON.stringify(stName))).value.options[0].name.length + ' 字)');

/* ============================================================
   F-8  §8-10 ちらつき: 同値 |Δw| でのヒステリシス
   ============================================================ */
hdr('F-8  §8-10 同値 |Δw| のちらつき(対称データ)');
const stSym = mkState(
  [{ id: 'c1', name: 'X1', rawWeight: 25 }, { id: 'c2', name: 'X2', rawWeight: 25 },
   { id: 'c3', name: 'X3', rawWeight: 25 }, { id: 'c4', name: 'X4', rawWeight: 25 }],
  [{ id: 'o1', name: 'W', scores: [8, 8, 5, 5] },
   { id: 'o2', name: 'L1', scores: [5, 5, 8, 8] },
   { id: 'o3', name: 'L2', scores: [5, 5, 8, 8] }]
);
const s1 = core.analyze(stSym).criticality.map(k => k.name + '/' + k.opponentName);
stSym.options[2].scores.c1 = 5.0;   // 無関係セルを同値で書き換え
const s2 = core.analyze(stSym).criticality.map(k => k.name + '/' + k.opponentName);
console.log('  before: ' + J(s1));
console.log('  after : ' + J(s2) + ' → 一致 ' + (J(s1) === J(s2)));

/* ============================================================
   F-9  analyze の catch-all が "no-criteria" を返す(誤誘導)
   ============================================================ */
hdr('F-9  analyze の catch-all(index.html:1737-1742)');
const evil = { schemaVersion: 1, settings: {}, initialWeights: null, history: [],
  criteria: [{ id: 'c1', name: 'A', direction: 'benefit', rawWeight: 1, cutoff: null }],
  options: null };
Object.defineProperty(evil, 'options', { get() { return [{ id: 'o1', name: 'X', get scores() { throw new Error('boom'); } }, { id: 'o2', name: 'Y', scores: {} }]; } });
const vEvil = core.analyze(evil);
console.log('  例外を投げる state → 送出なし: ok=' + vEvil.ok + ' degenerate=' + vEvil.degenerate);
console.log('  message = ' + J(vEvil.message));
console.log('  ← 基準は1個ある。「基準を1つ以上足してください」は事実に反する。');
