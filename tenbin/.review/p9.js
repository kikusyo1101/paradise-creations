'use strict';
const { loadCore, DS1, mkState, html } = require('./harness');
const core = loadCore();
const J = (x) => JSON.stringify(x);
const hdr = (t) => console.log('\n──────── ' + t + ' ────────');

/* ============================================================
   R-1  overflow の到達経路を UI 側で検証(clamp があるか)
   ============================================================ */
hdr('R-1  巨大 rawWeight の到達経路(UI 入力 vs localStorage)');
console.log('  UI からの重み入力経路:');
console.log('    rail(range, min=0 max=100)  → index.html:2714 Math.max(0,Math.min(100,pct))/100');
console.log('    weight-num(number)          → index.html:2733 Math.max(0,Math.min(100,v))/100');
console.log('    to-threshold ボタン         → index.html:2766 Math.max(0,Math.min(1,row.wStar))');
console.log('  → いずれも clamp 済み。setWeight は reweight の出力×100 を書くので');
console.log('    rawWeight は [0,100] に収まる。UI からは到達しない。');
console.log('  localStorage 経由(DevTools / 別タブの旧版 / 手書き JSON):');
const raw = JSON.stringify({
  schemaVersion: 1,
  criteria: [
    { id: 'c1', name: '価格', direction: 'benefit', rawWeight: 1e308, cutoff: null },
    { id: 'c2', name: '品質', direction: 'benefit', rawWeight: 1e308, cutoff: null }],
  options: [
    { id: 'o1', name: '案X', scores: { c1: 10, c2: 0 } },
    { id: 'o2', name: '案Y', scores: { c1: 0, c2: 10 } }],
  settings: { theta: 0.1, flipThreshold: 3, challengerId: null },
  initialWeights: null, history: []
});
console.log('    localStorage["tenbin.v1.state"] = ' + raw.slice(0, 90) + '…');
const parsed = JSON.parse(raw);
const mig = core.migrateState(parsed);
const res = core.validateState(mig);
console.log('    migrateState → ok / validateState → ' + J(Object.keys(res)));
console.log('    → failed でも repaired でもない = 「正常データ」として起動する');
const vm = core.analyze(res.value);
console.log('    analyze → ok=' + vm.ok + ' degenerate=' + vm.degenerate);
console.log('    画面に出る重み: ' + J(vm.weights.map(x => x.displayWeight + '%')));
console.log('    画面に出るスコア: ' + J(vm.ranking.map(r => r.name + '=' + r.displayScore)));
console.log('    正しい答え: 重み 50%/50%、スコア 50.0/50.0 の同点');
console.log('    実際の答え: 重み 0.0%/0.0%、スコア 0.0/0.0 の同点 ← 数値が全部嘘');
console.log('  ※ design §3-6 は validateState を「意味が通るか」を見る段と定めている。');
console.log('    rawWeight ≥ 0 と有限性は見ているが、総和が overflow する組は見ていない。');

/* ============================================================
   R-2  同じ経路で "Infinity" という文字列が画面に出る
   ============================================================ */
hdr('R-2  画面に文字列 "Infinity" が出る到達経路(§5-6 D-10「1本も残さない」への反例)');
const raw2 = JSON.stringify({
  schemaVersion: 1,
  criteria: [
    { id: 'c1', name: '価格', direction: 'cost', rawWeight: 35, cutoff: null },
    { id: 'c2', name: '機能充足度', direction: 'benefit', rawWeight: 30, cutoff: null },
    { id: 'c3', name: 'サポート', direction: 'benefit', rawWeight: 20, cutoff: null },
    { id: 'c4', name: '移行コスト', direction: 'cost', rawWeight: 15, cutoff: null }],
  options: [
    { id: 'o1', name: 'ベンダーA', scores: { c1: 7, c2: 9, c3: 7, c4: 2 } },
    { id: 'o2', name: 'ベンダーB', scores: { c1: 4, c2: 8, c3: 8, c4: 6 } },
    { id: 'o3', name: 'ベンダーC', scores: { c1: 6, c2: 8, c3: 5, c4: 8 } }],
  settings: { theta: 0.1, flipThreshold: 3, challengerId: null },
  initialWeights: { c1: 1e307, c2: 0.3, c3: 0.2, c4: 0.15 },
  history: []
});
const r2 = core.validateState(core.migrateState(JSON.parse(raw2)));
console.log('  validateState → ' + J(Object.keys(r2)) + ' (initialWeights.c1 = ' + r2.value.initialWeights.c1 + ')');
const v2 = core.analyze(r2.value);
console.log('  weights[0].displayInitial = ' + J(v2.weights[0].displayInitial));
const line = core.TEXT.initialWeightLine(v2.weights[0].name, v2.weights[0].displayInitial, v2.weights[0].displayWeight);
console.log('  Z5 に出る <li> の textContent(index.html:2252):');
console.log('    ' + J(line));
console.log('  → design §4-14「NaN/Infinity を渡された場合は — を返す」の反例。');
console.log('    isShowable(index.html:770)は引数の有限性しか見ず、×100 後の overflow を見ていない。');
console.log('  最小修正例の確認: (v*100) の有限性も見れば防げる:');
const safe = (v, d) => (typeof v === 'number' && Number.isFinite(v) && Number.isFinite(v * 100)) ? (v * 100).toFixed(d) : '—';
console.log('    safeWeight(1e307) = ' + J(safe(1e307, 1)) + ' / safeWeight(0.35) = ' + J(safe(0.35, 1)));

/* ============================================================
   R-3  「同点」表示なのに勝者ハイライトが出るか(L2 の整合)
   ============================================================ */
hdr('R-3  tie のときの winner 表示(L2 の分岐)');
const { DS3 } = require('./harness');
const v3 = core.analyze(DS3());
console.log('  degenerate=' + v3.degenerate + ' / vm.winner = ' + (v3.winner && v3.winner.name) +
  ' (rank=' + (v3.winner && v3.winner.rank) + ')');
console.log('  renderRanking(index.html:1994): isWinner = (rank===1 && !tied && length>=2) → ' +
  '同点時は勝者ハイライトなし ✓');
console.log('  renderGrid(index.html:2361): winnerId = vm.winner ? vm.winner.id : null');
console.log('    → tie でも vm.winner は非 null(' + (v3.winner && v3.winner.id) + ')。');
console.log('    index.html:2366 cls(tr,"is-winner", o.id===winnerId) は tied を見ていない。');
console.log('  ★ 同点なのにグリッドの1行だけが勝者としてハイライトされる。');
console.log('  該当行の実際のコード:');
const lines = html().split('\n');
[1994, 2361, 2366].forEach(n => console.log('    ' + n + ': ' + lines[n - 1].trim()));

/* ============================================================
   R-4  is-winner の CSS が実在し視覚差を作るか
   ============================================================ */
hdr('R-4  .is-winner の CSS 定義');
lines.forEach((l, i) => { if (/is-winner/.test(l)) console.log('  ' + (i + 1) + ': ' + l.trim()); });

/* ============================================================
   R-5  challenger 選択が「除外された選択肢」を指せるか
   ============================================================ */
hdr('R-5  足切りで除外された選択肢を挑戦者に指定した場合');
const stX = DS1();
stX.criteria[3].cutoff = 3.0;         // ベンダーC が除外される
stX.settings.challengerId = 'o3';     // 除外された C を挑戦者に指定
const vX = core.analyze(stX);
console.log('  除外: ' + J(vX.excluded.map(e => e.name)));
console.log('  challengerId=o3(除外済) → 実際の challenger = ' + (vX.challenger && vX.challenger.name));
console.log('  d0 = ' + vX.displayD0 + ' / winContrib = ' + J(vX.winContrib.map(g => g.name + '=' + g.display)));
console.log('  → 除外された選択肢は optInc に居ないので既定(2位)に落ちる ✓');
console.log('  validateState は存在する id なので解除しない: ' +
  J(Object.keys(core.validateState(JSON.parse(JSON.stringify(stX))))));

/* ============================================================
   R-6  history 上限 500 の UI 側切り詰めと validateState の一貫性
   ============================================================ */
hdr('R-6  history 500 件上限');
const stH = DS1();
for (let i = 0; i < 600; i++) {
  stH.history.push({ at: i, criterionId: 'c1', criterionName: '価格', before: 0.3, after: 0.4,
                     leaderBefore: 'o1', leaderAfter: i % 2 ? 'o2' : 'o1' });
}
const rH = core.validateState(JSON.parse(JSON.stringify(stH)));
console.log('  600件 → validateState 後 ' + rH.value.history.length + ' 件 (' + J(rH.notes) + ')');
const vH = core.analyze(rH.value);
console.log('  anchoring: edits=' + vH.anchoring.edits + ' flips=' + vH.anchoring.flips +
  ' warn=' + vH.anchoring.warn);
console.log('  → 切り詰めは新しい方を残す(splice(0, len-500))✓');
