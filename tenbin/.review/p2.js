'use strict';
const { loadCore, DS1, DS2, DS3, mkState } = require('./harness');
const core = loadCore();
const J = (x) => JSON.stringify(x);

function hdr(t) { console.log('\n=== ' + t + ' ==='); }

hdr('A. DS-1 sanity (AC-01/02/05/08)');
const vm = core.analyze(DS1());
console.log('ranking:', vm.ranking.map(r => r.name + '=' + r.displayScore).join(', '), '| d0=', vm.displayD0);
console.log('crit:', vm.criticality.map(r => `${r.name}:${r.displayDelta}(sens ${r.displaySens})`).join(' | '));
console.log('label:', vm.robustness.label, vm.robustness.displayDelta);

hdr('B. BUG? normalizeWeights: Σŵ overflow → w が全て 0 (design §4-2 事後条件 |Σw−1|≤EPS 違反)');
for (const rw of [[1e308, 1e308], [1e308, 1e308, 1e308, 1]]) {
  const w = core.normalizeWeights(rw);
  const s = w.reduce((a, b) => a + b, 0);
  console.log('  ŵ=' + J(rw), '→ w=' + J(w), 'Σw=' + s, '(事後条件 |Σw−1|≤1e-9 は', Math.abs(s - 1) <= 1e-9, ')');
}

hdr('C. BUG? analyze: 巨大 rawWeight が validateState を素通りし、結論が壊れる');
const stBig = mkState(
  [{ id: 'c1', name: '価格', rawWeight: 1e308 }, { id: 'c2', name: '品質', rawWeight: 1e308 }],
  [{ id: 'o1', name: 'X', scores: [10, 0] }, { id: 'o2', name: 'Y', scores: [0, 10] }]
);
const vs = core.validateState(JSON.parse(JSON.stringify(stBig)));
console.log('  validateState →', Object.keys(vs).join(','), '/ rawWeight 保持:', vs.value.criteria.map(c => c.rawWeight));
const vBig = core.analyze(vs.value);
console.log('  analyze → ok=', vBig.ok, 'degenerate=', vBig.degenerate, '/ message=', vBig.message);
console.log('  weights 表示:', vBig.weights.map(x => x.displayWeight + '%'), '← 合計 0.0% と表示される');
console.log('  ranking:', vBig.ranking.map(r => r.name + '=' + r.displayScore));

hdr('D. BUG? fmt が Infinity/1e+308 を画面に出す(§4-14「NaN/Infinity は — 」の砦を抜ける)');
console.log('  fmt.score(1e308) =', J(core.fmt.score(1e308)));
console.log('  fmt.weight(1e307) =', J(core.fmt.weight(1e307)));
console.log('  fmt.points(1e307) =', J(core.fmt.points(1e307)));
console.log('  fmt.percent(1e308) =', J(core.fmt.percent(1e308)));
console.log('  fmt.weight6(1e308) =', J(core.fmt.weight6(1e308)));

hdr('E. 到達性: initialWeights 経由で displayInitial に巨大値が出るか');
const st5 = DS1();
st5.initialWeights = { c1: 1e308, c2: 0, c3: 0, c4: 0 };
const v5 = core.analyze(st5);
console.log('  displayInitial:', v5.weights.map(x => x.displayInitial));
const vsr = core.validateState(JSON.parse(JSON.stringify(st5)));
console.log('  validateState は initialWeights=1e308 を:', Object.keys(vsr).join(','), '→', vsr.value.initialWeights);

hdr('F. fmt.points の符号: |v*100| < 0.05 で "+0.0"/"-0.0" が出る');
console.log('  points(1e-9) =', J(core.fmt.points(1e-9)), ' points(-1e-9) =', J(core.fmt.points(-1e-9)));
console.log('  percent(-1e-12) =', J(core.fmt.percent(-1e-12)));

hdr('G. reweight: x が範囲外/非数のときの事後条件');
const w0 = core.normalizeWeights([35, 30, 20, 15]);
for (const x of [1.5, -0.5, NaN, undefined, 2]) {
  const r = core.reweight(w0, 0, x);
  const s = r.reduce((a, b) => a + b, 0);
  console.log('  x=' + String(x), '→ Σw=' + s, ' w=' + J(r));
}

hdr('H. reweight: w[k] が僅かに 1 を超える(数値誤差)ときの符号反転');
const wq = [1 + 1e-12, -1e-12];
console.log('  w=' + J(wq), '→', J(core.reweight(wq, 0, 0.5)));

hdr('I. tippingPoint の事後条件 wStar ∈ [0,1] を破る入力は存在するか(総当り探索)');
let worst = null;
for (let i = 0; i < 200000; i++) {
  const d0 = Math.random() * 1;
  const dk = Math.random() * 2 - 1;
  const wk = Math.random() * 0.999;
  const r = core.tippingPoint(d0, dk, wk);
  if (r.feasible && (r.wStar < -1e-9 || r.wStar > 1 + 1e-9)) {
    if (!worst || Math.abs(r.wStar - 0.5) > Math.abs(worst.r.wStar - 0.5)) worst = { d0, dk, wk, r };
  }
}
console.log('  区間外の例:', worst ? J(worst) : '見つからず(0件)');

hdr('J. 同点判定 E-1: rank().tied は order[0] と order[1] のみ');
const v3 = core.analyze(DS3());
console.log('  DS-3 →', v3.degenerate, '| robustness=', v3.robustness, '| winContrib.length=', v3.winContrib.length);

hdr('K. 挑戦者を3位に指定したときの d0 と tie の整合');
const stC = DS1(); stC.settings.challengerId = 'o3';
const vC = core.analyze(stC);
console.log('  challenger=', vC.challenger && vC.challenger.name, ' d0=', vC.d0, vC.displayD0);
console.log('  Σg =', vC.winContrib.reduce((a, b) => a + b.value, 0), '(design §4-8 事後条件 |Σg−1|≤1e-12)');
console.log('  winContrib:', vC.winContrib.map(c => c.name + '=' + c.display).join(', '));

hdr('L. criticality は挑戦者指定に影響されないか (FR-15)');
const base = core.analyze(DS1()).criticality.map(r => r.name + ':' + r.displayDelta);
const alt = vC.criticality.map(r => r.name + ':' + r.displayDelta);
console.log('  既定:', J(base)); console.log('  o3指定:', J(alt), '→ 一致:', J(base) === J(alt));
