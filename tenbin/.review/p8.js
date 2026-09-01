'use strict';
const { loadCore, mkState } = require('./harness');
const core = loadCore();
const J = (x) => JSON.stringify(x);
const hdr = (t) => console.log('\n──────── ' + t + ' ────────');

hdr('N-1  発生頻度の正直な再測定(第2基準を固定しない全数探索)');
let total = 0, bad = 0, tiedOnSome = 0, badTied = 0, badUntied = 0;
for (let w1 = 1; w1 <= 40; w1 += 1) {
  for (let w2 = 1; w2 <= 40; w2 += 1) {
    for (let a1 = 0; a1 <= 20; a1 += 2) {
      for (let b1 = 0; b1 <= 20; b1 += 2) {
        for (let a2 = 0; a2 <= 20; a2 += 5) {
          for (let b2 = 0; b2 <= 20; b2 += 5) {
            const st = mkState(
              [{ id: 'c1', name: 'k1', direction: 'benefit', rawWeight: w1 },
               { id: 'c2', name: 'k2', direction: 'benefit', rawWeight: w2 }],
              [{ id: 'o1', name: 'W', scores: [a1 / 2, a2 / 2] },
               { id: 'o2', name: 'L', scores: [b1 / 2, b2 / 2] }]
            );
            const vm = core.analyze(st);
            if (!vm.ok || !vm.winContrib.length) continue;
            total++;
            const anyTie = (a1 === b1) || (a2 === b2);
            if (anyTie) tiedOnSome++;
            let mismatch = false;
            for (let k = 0; k < 2; k++) {
              const g = vm.winContrib[k].value;
              const r = vm.criticality.find(x => x.criterionId === 'c' + (k + 1));
              if ((g > 1) !== (!r.infeasible && r.delta < 0)) mismatch = true;
            }
            if (mismatch) { bad++; if (anyTie) badTied++; else badUntied++; }
          }
        }
      }
    }
  }
}
console.log('  検査した有効入力: ' + total);
console.log('  L1・L2 が矛盾する入力: ' + bad + ' 件 (' + (bad / total * 100).toFixed(3) + '%)');
console.log('    うち「どちらかの基準で2案が同点」の入力: ' + badTied);
console.log('    うち 完全に非同点の入力            : ' + badUntied);
console.log('  参考: 「どちらかの基準で同点」の入力は全体の ' +
  (tiedOnSome / total * 100).toFixed(1) + '%');

hdr('N-2  矛盾が起きる構造の説明(厳密検算)');
const st = mkState(
  [{ id: 'c1', name: '基準1', direction: 'benefit', rawWeight: 39 },
   { id: 'c2', name: '基準2', direction: 'benefit', rawWeight: 5 }],
  [{ id: 'o1', name: '案甲', scores: [6.5, 9.5] },
   { id: 'o2', name: '案乙', scores: [4.5, 9.5] }]
);
const vm = core.analyze(st);
console.log('  基準2 で両案とも 9.5 → d₂ = 0 → D₀ = w₁·d₁ ちょうど');
console.log('  厳密には g₁ = w₁d₁/D₀ = 1(境界)。float では ' + vm.winContrib[0].value);
console.log('  L1: down = (w·d > D₀ + EPS) → false → 逆転不能(EPS で境界を正しく吸収)');
console.log('  L2: crosses = (g > 1) → ' + (vm.winContrib[0].value > 1) + '(EPS なしで最下位ビットに敗北)');
console.log('  → design §5-4 が「=== 0 による比較を1箇所も書かない」と定めた規律が、');
console.log('    L2 の `v > 1` で破られている。EPS 抜きの境界比較そのもの。');

hdr('N-3  非同点でも矛盾するか(現実的な入力の代表例)');
let ex = null;
for (let t = 0; t < 300000 && !ex; t++) {
  const n = 3;
  const crits = [], opts = [];
  for (let j = 0; j < n; j++) crits.push({ id: 'c' + j, name: 'k' + j, direction: 'benefit', rawWeight: 1 + Math.floor(Math.random() * 60) });
  for (let i = 0; i < 2; i++) { const sc = []; for (let j = 0; j < n; j++) sc.push(Math.floor(Math.random() * 21) / 2); opts.push({ id: 'o' + i, name: i ? 'L' : 'W', scores: sc }); }
  const st2 = mkState(crits, opts);
  const v = core.analyze(st2);
  if (!v.ok || !v.winContrib.length) continue;
  // 全基準で非同点
  if (crits.some((c, j) => opts[0].scores[j] === opts[1].scores[j])) continue;
  for (let k = 0; k < n; k++) {
    const g = v.winContrib[k].value;
    const r = v.criticality.find(x => x.criterionId === 'c' + k);
    if ((g > 1) !== (!r.infeasible && r.delta < 0)) {
      ex = { w: crits.map(c => c.rawWeight), s: opts.map(o => o.scores), k, g, infeasible: r.infeasible };
      break;
    }
  }
}
console.log('  完全非同点での矛盾例: ' + (ex ? J(ex) : '見つからず(30万試行)'));
console.log('  → 矛盾は主に「ある基準で2案が並ぶ」入力で起きる。これは現実的な状況。');

hdr('N-4  DS-1 に「1基準だけ同点」を足した現実的な再現');
const st4 = mkState(
  [{ id: 'c1', name: '価格', direction: 'cost', rawWeight: 35 },
   { id: 'c2', name: '機能充足度', direction: 'benefit', rawWeight: 30 },
   { id: 'c3', name: 'サポート', direction: 'benefit', rawWeight: 20 },
   { id: 'c4', name: '移行コスト', direction: 'cost', rawWeight: 15 }],
  [{ id: 'o1', name: 'ベンダーA', scores: [7, 9, 7, 2] },
   { id: 'o2', name: 'ベンダーB', scores: [7, 8, 7, 2] }]   // 価格・サポート・移行コストが同点
);
const v4 = core.analyze(st4);
console.log('  入力: 2社。価格・サポート・移行コストが同点、機能充足度のみ A が上。');
console.log('  ranking: ' + J(v4.ranking.map(r => r.name + '=' + r.displayScore)) + ' D₀=' + v4.displayD0);
console.log('  winContrib: ' + J(v4.winContrib.map(g => g.name + '=' + g.value + '(' + g.display + '%)')));
console.log('  L2 crosses: ' + J(v4.winContrib.filter(g => g.value > 1).map(g => g.name)));
console.log('  L1 criticality: ' + J(v4.criticality.map(r => r.name + ':' + (r.infeasible ? '逆転不能' : r.displayDelta))));
const cr = v4.winContrib.filter(g => g.value > 1).map(g => g.name);
const contra = cr.filter(nm => { const r = v4.criticality.find(x => x.name === nm); return r && r.infeasible; });
console.log('  矛盾する基準: ' + J(contra) + (contra.length ? '  ★' : '  (この例では矛盾なし)'));
