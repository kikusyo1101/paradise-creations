'use strict';
const { loadCore, DS1, mkState } = require('./harness');
const core = loadCore();
const J = (x) => JSON.stringify(x);
const hdr = (t) => console.log('\n──────── ' + t + ' ────────');

/* ============================================================
   H-1  weightsBroken 経路で「未入力のセルが 0 個あります」と出るか
   ============================================================ */
hdr('H-1  analyze:1621-1623 — weightsBroken だけが真のとき unfilled=0');
// w に非有限が入る = normalizeWeights の出力が非有限。overflow で 0 になるだけなので
// weightsBroken を真にできるか総当りで探す
let broke = null;
const trials = [[1e308, 1e308], [Number.MAX_VALUE, Number.MAX_VALUE], [1e308, -1]];
for (const rw of trials) {
  const w = core.normalizeWeights(rw);
  if (w.some(v => !Number.isFinite(v))) { broke = { rw, w }; break; }
}
console.log('  normalizeWeights が非有限を返す入力: ' + (broke ? J(broke) : '見つからず(常に有限)'));
console.log('  → weightsBroken は現状到達不能。だが到達すれば message は');
console.log('    ' + J(core.TEXT.unfilledCells(0)) + ' となり、事実に反する誘導になる。');

/* ============================================================
   H-2  AC-12 の相互整合 g_k ≤ 1 ⟺ 下方向逆転不能 を大量実測
        L2:2180 の `v > 1` は EPS 無し。L1 の feasible は EPS 付き。
   ============================================================ */
hdr('H-2  AC-12 相互整合の実測 + L1/L2 判定の食い違い探索(20000 試行)');
let checked = 0, disagree = 0, samples = [];
for (let t = 0; t < 20000; t++) {
  const n = 2 + (t % 5), m = 2 + (t % 4);
  const crits = [], opts = [];
  for (let j = 0; j < n; j++) {
    crits.push({ id: 'c' + j, name: 'c' + j, direction: (t + j) % 2 ? 'cost' : 'benefit',
                 rawWeight: 1 + Math.floor(Math.random() * 100) });
  }
  for (let i = 0; i < m; i++) {
    const sc = []; for (let j = 0; j < n; j++) sc.push(Math.floor(Math.random() * 21) / 2);
    opts.push({ id: 'o' + i, name: 'o' + i, scores: sc });
  }
  const vm = core.analyze(mkState(crits, opts));
  if (!vm.ok || vm.winContrib.length === 0) continue;
  // 挑戦者は既定(2位)。criticality は全挑戦者対象なので、
  // 2位に限定した tippingPoint を独立に計算して突き合わせる
  const w = core.normalizeWeights(crits.map(c => c.rawWeight));
  const A = core.normalizeMatrix(mkState(crits, opts).options, mkState(crits, opts).criteria);
  const st = mkState(crits, opts);
  const wIdx = st.options.findIndex(o => o.id === vm.winner.id);
  const cIdx = st.options.findIndex(o => o.id === vm.challenger.id);
  const d0 = vm.d0;
  for (let k = 0; k < n; k++) {
    const dk = A[wIdx][k] - A[cIdx][k];
    const tp = core.tippingPoint(d0, dk, w[k]);
    const g = vm.winContrib[k].value;
    const downFeasible = tp.feasible && tp.delta < 0;     // L1 の「下げて逆転可能」
    const l2Crosses = g > 1;                              // L2:2180 の判定
    checked++;
    if (downFeasible !== l2Crosses) {
      disagree++;
      if (samples.length < 4) samples.push({ k, g, dk, wk: w[k], d0, tp, downFeasible, l2Crosses });
    }
  }
}
console.log('  検査した (基準×試行) 組: ' + checked + ' / L1 と L2 の判定が食い違った件数: ' + disagree);
if (samples.length) { samples.forEach(s => console.log('    ' + J(s))); }
console.log('  → 食い違い 0 なら、通常入力の範囲では L2 の自前判定は L1 と一致している。');

/* ============================================================
   H-3  L1/L2 が食い違う具体例を「実際の analyze 入力」で構成できるか
        (reweight で重みを無理数化した後なら境界に乗せられる)
   ============================================================ */
hdr('H-3  reweight 後の重みで L1(EPS 付) と L2(EPS 無) を食い違わせる');
// 2 基準 2 選択肢。w1 を動かして w1*d1 − D0 を EPS 未満の正の値に合わせる
function build(w1) {
  const st = mkState(
    [{ id: 'c1', name: 'A', rawWeight: w1 * 100 }, { id: 'c2', name: 'B', rawWeight: (1 - w1) * 100 }],
    [{ id: 'o1', name: 'W', scores: [8, 3] }, { id: 'o2', name: 'L', scores: [3, 6] }]
  );
  return st;
}
// 二分探索: g_1 = 1 となる w1 を求める
let lo = 0.01, hi = 0.99, mid;
for (let i = 0; i < 200; i++) {
  mid = (lo + hi) / 2;
  const vm = core.analyze(build(mid));
  if (!vm.ok) { lo = mid; continue; }
  const g1 = vm.winContrib[0].value;
  if (g1 > 1) { hi = mid; } else { lo = mid; }
}
console.log('  g_1 = 1 となる w1 ≈ ' + mid);
for (const dw of [0, 1e-12, 5e-12, 1e-11, 1e-10, 1e-9, 1e-8]) {
  const vm = core.analyze(build(mid + dw));
  if (!vm.ok) { console.log('    w1=' + (mid + dw) + ' → ' + vm.degenerate); continue; }
  const g1 = vm.winContrib[0].value;
  const row = vm.criticality.find(k => k.name === 'A');
  const l1Down = !row.infeasible && row.delta < 0;
  const l2Cross = g1 > 1;
  console.log('    w1=' + (mid + dw).toFixed(18) + ' g_A=' + g1.toFixed(15) +
    ' | L1 下げて逆転可=' + l1Down + ' (' + row.displayDelta + ')' +
    ' | L2 crosses=' + l2Cross + (l1Down !== l2Cross ? '   ★食い違い' : ''));
}

/* ============================================================
   H-4  scheduleLive の modeChanged 判定(index.html:2650)
   ============================================================ */
hdr('H-4  scheduleLive:2650 の modeChanged が「—」の有無に依存している');
function modeChanged(vmOk, lastLive) { return (vmOk !== (lastLive !== '' && lastLive.indexOf('—') >= 0)); }
const okText = core.analyze(DS1()).robustness.labelLine;
const degText = core.TEXT.degenerate['no-criteria'];
const tieText = core.TEXT.degenerate['tie'];
const unfText = core.TEXT.unfilledCells(3);
console.log('  ok の live 文言に "—" が含まれるか: ' + (okText.indexOf('—') >= 0) + '  (' + okText.slice(0, 30) + '…)');
for (const [name, txt] of [['no-criteria', degText], ['tie', tieText], ['unfilled', unfText],
                           ['all-excluded', core.TEXT.degenerate['all-excluded']]]) {
  console.log('    退化文言 "' + name + '" に "—" が含まれるか: ' + (txt.indexOf('—') >= 0));
}
console.log('  遷移 ok→退化: modeChanged=' + modeChanged(false, okText) + ' → 即時発火(意図通り)');
console.log('  遷移 退化→退化(別種): modeChanged=' + modeChanged(false, degText) +
  ' → 700ms 待たされる');
console.log('  ※ vm.ok(真偽値)と「直前文言に em-dash が入っているか」を等値比較している。');
console.log('    labelLine から "—" を外した瞬間に、この分岐は静かに逆転する。');

/* ============================================================
   H-5  「単独で覆せる」文言と AC-12 の意味の一致
   ============================================================ */
hdr('H-5  L2:2199 の文言 vs L1 の逆転可能性(DS-1)');
const v = core.analyze(DS1());
const crossed = v.winContrib.filter(g => g.value > 1).map(g => g.name);
console.log('  winContrib: ' + J(v.winContrib.map(g => g.name + '=' + g.value)));
console.log('  L2 が「単独で結論をひっくり返せます」と名指しする基準: ' + J(crossed));
console.log('  L1 criticality の実行可能な基準: ' +
  J(v.criticality.filter(k => !k.infeasible).map(k => k.name + '(' + k.displayDelta + ')')));
console.log('  → g>1 は「下げて逆転可能」のみを表す。上げて逆転可能な移行コスト(+6.8pt、Δ*!)は');
console.log('    この文からも「線を越えた基準」からも漏れる。実際 Δ* を与えるのは移行コスト。');

/* ============================================================
   H-6  D-11 違反: 打鍵ごとに DOM を作り直している箇所の実測(静的)
   ============================================================ */
hdr('H-6  D-11「DOM 生成は構造変化のときだけ」に反する再生成箇所');
const fs = require('fs');
const src = fs.readFileSync(require('./harness').HTML, 'utf8').split('\n');
[[1989, 'renderRanking: ol.textContent=""'], [2010, 'renderRanking: 除外 ul'],
 [2164, 'renderContrib: gbars'], [2188, 'renderContrib: gaxis'],
 [2207, 'renderStacks: stacks'], [2245, 'renderWeights: weight-history']].forEach(([ln, what]) => {
  console.log('  index.html:' + ln + '  ' + what + '  →  ' + src[ln - 1].trim());
});
console.log('  これらは draw() から毎フレーム呼ばれる(index.html:2574/2601/2602)。');
console.log('  1打鍵ごとに <li>/<div> を全廃棄・全再生成する。');

/* ============================================================
   H-7  重み・スコアの実測パフォーマンス(DOM 抜き / 上限規模)
   ============================================================ */
hdr('H-7  上限規模(10×10)での analyze 実測');
function big() {
  const crits = [], opts = [];
  for (let j = 0; j < 10; j++) crits.push({ id: 'c' + j, name: '基準' + j, direction: j % 2 ? 'cost' : 'benefit', rawWeight: 1 + j });
  for (let i = 0; i < 10; i++) { const sc = []; for (let j = 0; j < 10; j++) sc.push(((i * 7 + j * 3) % 21) / 2); opts.push({ id: 'o' + i, name: '選択肢' + i, scores: sc }); }
  return mkState(crits, opts);
}
const B = big();
for (let i = 0; i < 5000; i++) core.analyze(B);
let t0 = process.hrtime.bigint();
for (let i = 0; i < 20000; i++) core.analyze(B);
let t1 = process.hrtime.bigint();
console.log('  analyze 1回 = ' + (Number(t1 - t0) / 20000 / 1e6).toFixed(4) + ' ms  (16ms 予算の ' +
  (Number(t1 - t0) / 20000 / 1e6 / 16 * 100).toFixed(3) + '%)');
console.log('  スライダー 1 input あたりの analyze 呼び出し: ');
console.log('    draw() 1回 + (初回のみ)currentLeader() 1回 → 定常 1回/フレーム');
console.log('    change/blur 時: currentLeader() 1 + draw() 1 = 2回');
console.log('  → 計算は問題なし。ボトルネックは H-6 の DOM 再生成側。');
