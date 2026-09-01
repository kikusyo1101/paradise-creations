'use strict';
const { loadCore, mkState } = require('./harness');
const core = loadCore();
const J = (x) => JSON.stringify(x);
const hdr = (t) => console.log('\n──────── ' + t + ' ────────');

/* ============================================================
   K-1  L1 「逆転不能」 vs L2 「単独で覆せる」の決定的な再現例を探す
        整数重み・0.5刻みスコアのみ(= UI で実際に打てる入力)
   ============================================================ */
hdr('K-1  決定的再現例の探索(整数重み + 0.5刻みスコアのみ)');
const hits = [];
outer:
for (let n = 2; n <= 4; n++) {
  for (let t = 0; t < 400000; t++) {
    const crits = [], opts = [];
    for (let j = 0; j < n; j++) {
      crits.push({ id: 'c' + j, name: '基準' + (j + 1), direction: 'benefit',
                   rawWeight: 1 + Math.floor(Math.random() * 100) });
    }
    for (let i = 0; i < 2; i++) {
      const sc = []; for (let j = 0; j < n; j++) sc.push(Math.floor(Math.random() * 21) / 2);
      opts.push({ id: 'o' + i, name: i === 0 ? '案甲' : '案乙', scores: sc });
    }
    const st = mkState(crits, opts);
    const vm = core.analyze(st);
    if (!vm.ok || vm.winContrib.length === 0) continue;
    for (let k = 0; k < n; k++) {
      const g = vm.winContrib[k].value;
      const row = vm.criticality.find(r => r.criterionId === 'c' + k);
      const l1Down = !row.infeasible && row.delta < 0;
      if ((g > 1) !== l1Down) {
        hits.push({ crits: crits.map(c => c.rawWeight), scores: opts.map(o => o.scores),
                    k, g, row: { infeasible: row.infeasible, displayDelta: row.displayDelta } });
        if (hits.length >= 3) break outer;
      }
    }
  }
}
console.log('  見つかった件数: ' + hits.length);
hits.forEach(h => console.log('    ' + J(h)));

if (hits.length) {
  const h = hits[0];
  hdr('K-2  再現例の完全な再演(この入力は UI から実際に打てる)');
  const st = mkState(
    h.crits.map((w, j) => ({ id: 'c' + j, name: '基準' + (j + 1), direction: 'benefit', rawWeight: w })),
    h.scores.map((sc, i) => ({ id: 'o' + i, name: i === 0 ? '案甲' : '案乙', scores: sc }))
  );
  console.log('  重み(生値): ' + J(h.crits));
  console.log('  スコア: ' + J(h.scores));
  const vm = core.analyze(st);
  console.log('  ranking: ' + J(vm.ranking.map(r => r.name + '=' + r.displayScore)));
  console.log('  D₀ = ' + vm.d0 + ' (' + vm.displayD0 + ')');
  console.log('  --- L1 (criticality) の言い分 ---');
  vm.criticality.forEach(r => console.log('    ' + r.name + ': ' +
    (r.infeasible ? '逆転不能 / ' + r.text : r.displayDelta + 'pt → ' + r.opponentName)));
  console.log('  --- L2 (index.html:2180 / 2199) の言い分 ---');
  const crossed = vm.winContrib.filter(g => g.value > 1).map(g => g.name);
  vm.winContrib.forEach(g => console.log('    ' + g.name + ': g=' + g.value +
    ' display=' + g.display + '%  crosses(v>1)=' + (g.value > 1)));
  console.log('    → 画面の文言: "' + (crossed.length
    ? 'この線を越えた基準は、それ単独で結論をひっくり返せます。→ ' + crossed.join('、')
    : '100% の線を越えた基準はありません。') + '"');
  const contradicted = crossed.filter(nm => {
    const r = vm.criticality.find(x => x.name === nm); return r && r.infeasible;
  });
  console.log('  ★矛盾: L2 が「単独で覆せる」と名指しした ' + J(contradicted) +
    ' を、L1 は同一画面で「逆転不能」と表示している。');
  console.log('  同一画面での表示(Z3 の行文言): ' +
    J(vm.criticality.filter(r => contradicted.indexOf(r.name) >= 0).map(r => r.text)));
}

/* ============================================================
   K-3  fmt.percent が g=Infinity 近傍で桁あふれする経路(D₀ 極小)
   ============================================================ */
hdr('K-3  D₀ が EPS 直上のときの g_j 表示');
// D₀ > EPS だが極小 → g_j が巨大になる
for (const d of [2e-9, 1e-8, 1e-7]) {
  // 2基準・2選択肢で D₀ を直接作る
  const w = [0.5, 0.5];
  const A = [[0.5 + d, 0.5], [0.5, 0.5]];
  const s = core.computeScores(A, w);
  const d0 = s[0] - s[1];
  if (d0 <= core.EPS) { console.log('    d=' + d + ' → D₀=' + d0 + ' は EPS 以下、tie 扱い'); continue; }
  const g = core.winContribution(A, w, 0, 1, d0,
    [{ id: 'c0', name: 'A' }, { id: 'c1', name: 'B' }]);
  console.log('    D₀=' + d0.toExponential(3) + ' → g = ' + J(g.map(x => x.display)) +
    ' / Σg=' + g.reduce((a, b) => a + b.value, 0));
}

/* ============================================================
   K-4  design §5-4 の EPS 全11箇所と実装の突合(静的)
   ============================================================ */
hdr('K-4  EPS 使用箇所 E-1〜E-11 の実在確認');
const fs = require('fs');
const lines = fs.readFileSync(require('./harness').HTML, 'utf8').split('\n');
const epsLines = [];
lines.forEach((l, i) => { if (/\bEPS\b/.test(l) && i + 1 >= 749 && i + 1 <= 1758) epsLines.push([i + 1, l.trim()]); });
console.log('  コア領域内で EPS を含む行: ' + epsLines.length + ' 行');
epsLines.forEach(([n, l]) => console.log('    ' + n + ': ' + l));
console.log('\n  === 0 との厳密比較(=== 0 / !== 0)がコア領域にあるか ===');
lines.forEach((l, i) => {
  if (i + 1 >= 749 && i + 1 <= 1758 && /[!=]==\s*0\b/.test(l)) console.log('    ' + (i + 1) + ': ' + l.trim());
});
