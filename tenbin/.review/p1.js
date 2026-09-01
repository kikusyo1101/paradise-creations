'use strict';
const { loadCore, DS1, mkState } = require('./harness');
const core = loadCore();

console.log('=== P0: harness sanity (DS-1 / AC-01,02,05,08) ===');
const vm = core.analyze(DS1());
console.log('ok=', vm.ok, 'degenerate=', vm.degenerate);
console.log('ranking:', vm.ranking.map(r => r.name + '=' + r.displayScore).join(', '));
console.log('d0=', vm.d0, vm.displayD0);
console.log('criticality:', vm.criticality.map(r => `${r.name}:${r.displayDelta}/${r.displayWStar}/sens=${r.displaySens}/inf=${r.infeasible}/opp=${r.opponentName}`).join('\n              '));
console.log('robustness:', vm.robustness.label, vm.robustness.displayDelta, '| caveat=', vm.robustness.caveat);
console.log('winContrib:', vm.winContrib.map(c => c.name + '=' + c.display).join(', '));

console.log('\n=== P1: normalizeWeights overflow (design §4-2 postcondition |Σw-1|<=EPS) ===');
for (const rw of [[1e308, 1e308], [1e308, 1e308, 1], [1e307, 5e307, 1e307], [1e300,1,1]]) {
  const w = core.normalizeWeights(rw);
  const s = w.reduce((x, y) => x + y, 0);
  console.log('  raw=', JSON.stringify(rw), '-> w=', JSON.stringify(w), ' Σw=', s, ' |Σw-1|=', Math.abs(s - 1));
}

console.log('\n=== P2: analyze with huge rawWeights (reachable via validateState?) ===');
const st = mkState(
  [{ id: 'c1', name: 'A', rawWeight: 1e308 }, { id: 'c2', name: 'B', rawWeight: 1e308 }],
  [{ id: 'o1', name: 'X', scores: [10, 0] }, { id: 'o2', name: 'Y', scores: [0, 10] }]
);
const v2 = core.analyze(st);
console.log('  ok=', v2.ok, 'degenerate=', v2.degenerate, 'msg=', v2.message);
console.log('  weights=', v2.weights.map(x => x.weight + '/' + x.displayWeight));
console.log('  ranking=', v2.ranking.map(r => r.name + '=' + r.displayScore));
const vs = core.validateState(JSON.parse(JSON.stringify(st)));
console.log('  validateState verdict:', Object.keys(vs), 'rawWeights kept =', vs.value && vs.value.criteria.map(c=>c.rawWeight));

console.log('\n=== P3: fmt edge / signedFixed ===');
console.log('  points(1e-5)=', core.fmt.points(1e-5), ' points(-1e-5)=', core.fmt.points(-1e-5));
console.log('  points(-0)=', core.fmt.points(-0), ' points(0)=', core.fmt.points(0));
console.log('  percent(NaN)=', core.fmt.percent(NaN), ' percent(Infinity)=', core.fmt.percent(Infinity));
console.log('  sens(Infinity)=', core.fmt.sens(Infinity), ' sens(0)=', core.fmt.sens(0), ' sens(-0)=', core.fmt.sens(-0));
console.log('  score(1e308)=', core.fmt.score(1e308), ' weight(1e306)=', core.fmt.weight(1e306));
