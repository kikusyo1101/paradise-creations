'use strict';
const fs = require('fs');
const { loadCore, coreSrc, html, mkState, DS1, HTML } = require('./harness');
const core = loadCore();
const J = (x) => JSON.stringify(x);
const hdr = (t) => console.log('\n──────── ' + t + ' ────────');

/* ============================================================
   M-1  BLOCKER 再現例の確定・決定的再演(5回連続で同一)
   ============================================================ */
hdr('M-1  L1「逆転不能」 vs L2「単独で覆せる」— 決定的再現');
function repro() {
  return mkState(
    [{ id: 'c1', name: '基準1', direction: 'benefit', rawWeight: 39 },
     { id: 'c2', name: '基準2', direction: 'benefit', rawWeight: 5 }],
    [{ id: 'o1', name: '案甲', scores: [6.5, 9.5] },
     { id: 'o2', name: '案乙', scores: [4.5, 9.5] }]
  );
}
for (let i = 0; i < 3; i++) {
  const vm = core.analyze(repro());
  const g0 = vm.winContrib[0];
  const r0 = vm.criticality.find(r => r.criterionId === 'c1');
  console.log('  試行' + (i + 1) + ': g_基準1 = ' + g0.value + ' (>1: ' + (g0.value > 1) + ') / ' +
    'criticality[基準1].infeasible = ' + r0.infeasible);
}
const vmR = core.analyze(repro());
console.log('  入力: 重み 39 / 5、案甲=[6.5, 9.5]、案乙=[4.5, 9.5](すべて UI で打てる値)');
console.log('  順位: ' + J(vmR.ranking.map(r => r.name + '=' + r.displayScore)) + '  D₀=' + vmR.displayD0);
console.log('  厳密値の検算: w1 = 39/44, d1 = (6.5-4.5)/10 = 0.2, D₀ = w1*d1 = 39/44*0.2');
console.log('    w1*d1 = ' + (39 / 44 * 0.2) + '   D₀(実測) = ' + vmR.d0);
console.log('    差 w1*d1 − D₀ = ' + (39 / 44 * 0.2 - vmR.d0).toExponential(3) +
  '  ← 厳密には 0(境界ちょうど)');
console.log('  L1 の判定: down = (w·d > D₀+EPS) = ' + (39 / 44 * 0.2 > vmR.d0 + core.EPS) +
  ' → 逆転不能(正しい。境界は逆転不能側)');
console.log('  L2 の判定: g = w·d/D₀ = ' + vmR.winContrib[0].value + ' > 1 = ' +
  (vmR.winContrib[0].value > 1) + ' → 「単独で覆せる」(誤り)');
console.log('  同一画面に同時に出る2つの文言:');
console.log('    Z3 行: ' + J(vmR.criticality.find(r => r.criterionId === 'c1').text));
console.log('    Z4 帯: "この線を越えた基準は、それ単独で結論をひっくり返せます。→ 基準1"');

/* ============================================================
   M-2  この現象が「境界ちょうど」入力でどの程度起きるか
   ============================================================ */
hdr('M-2  発生頻度(整数重み・0.5刻み・2選択肢の全数探索の一部)');
let total = 0, bad = 0;
for (let w1 = 1; w1 <= 60; w1++) {
  for (let w2 = 1; w2 <= 60; w2++) {
    for (let s = 0; s <= 20; s += 1) {
      for (let d = 1; d <= 8; d++) {
        const A = s / 2, B = (s - d) / 2;
        if (B < 0) continue;
        const st = mkState(
          [{ id: 'c1', name: 'k1', direction: 'benefit', rawWeight: w1 },
           { id: 'c2', name: 'k2', direction: 'benefit', rawWeight: w2 }],
          [{ id: 'o1', name: 'W', scores: [A, 5] }, { id: 'o2', name: 'L', scores: [B, 5] }]
        );
        const vm = core.analyze(st);
        if (!vm.ok || !vm.winContrib.length) continue;
        total++;
        const g = vm.winContrib[0].value;
        const r = vm.criticality.find(x => x.criterionId === 'c1');
        if ((g > 1) !== (!r.infeasible && r.delta < 0)) bad++;
      }
    }
  }
}
console.log('  検査した入力: ' + total + ' 件 / L1・L2 が矛盾する入力: ' + bad + ' 件 (' +
  (bad / total * 100).toFixed(2) + '%)');
console.log('  ※ 2基準の場合、g_1 = w1·d1/D₀ で D₀ = w1·d1 + w2·d2。');
console.log('    d2 = 0(2つの選択肢が基準2で同点)なら常に g_1 = 1 の境界に乗る。');
console.log('    「ある基準で完全に並んでいる」は現実の比較で普通に起きる。');

/* ============================================================
   M-3  契約 C-1〜C-7 の実測
   ============================================================ */
hdr('M-3  CONTRACT-CORE C-1〜C-7 の実測');
const H = html(), SRC = coreSrc();
const BEGIN = '/*===TENBIN-CORE-BEGIN===*/', END = '/*===TENBIN-CORE-END===*/';
const count = (h, n) => { let c = 0, i = 0; for (;;) { const j = h.indexOf(n, i); if (j < 0) return c; c++; i = j + n.length; } };
console.log('  C-1 BEGIN 出現回数=' + count(H, BEGIN) + ' / END 出現回数=' + count(H, END) +
  ' / 順序 b<e: ' + (H.indexOf(BEGIN) < H.indexOf(END)) + '  → ' +
  (count(H, BEGIN) === 1 && count(H, END) === 1 && H.indexOf(BEGIN) < H.indexOf(END) ? '合格' : '不合格'));
const sOpen = H.indexOf('<script id="tenbin-core">');
const sClose = H.indexOf('</script>', sOpen);
console.log('  C-2 <script id="tenbin-core"> at ' + sOpen + ' / </script> at ' + sClose +
  ' / 内包: ' + (sOpen < H.indexOf(BEGIN) && H.indexOf(END) < sClose ? '合格' : '不合格'));
let c3 = '合格';
try { new Function('"use strict";\n' + SRC + '\nreturn TenbinCore;'); } catch (e) { c3 = '不合格: ' + e.message; }
console.log('  C-3 構文的完結性: ' + c3);
const tail = SRC.trimEnd();
console.log('  C-4 最後の文が const TenbinCore = Object.freeze({…}); : ' +
  (/const TenbinCore = Object\.freeze\(\{[\s\S]*\}\);$/.test(tail) ? '合格' : '不合格'));
console.log('      Object.isFrozen(core) = ' + Object.isFrozen(core) + ' / typeof = ' + typeof core);
const FORB = ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'fetch',
  'XMLHttpRequest', 'alert', 'Date', 'globalThis'];
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const hitsC5 = FORB.filter(t => new RegExp('\\b' + esc(t) + '\\b').test(SRC));
console.log('  C-5 禁止識別子ヒット: ' + (hitsC5.length ? J(hitsC5) : 'なし → 合格') +
  ' / Math.random: ' + (SRC.indexOf('Math.random') >= 0 ? 'あり' : 'なし'));
console.log('      (参考)console の出現: ' + (SRC.indexOf('console') >= 0 ? 'あり' : 'なし → §2-5 の申し送りも守られている'));
console.log('  C-6 "</script" の出現: ' + (SRC.indexOf('</script') >= 0 ? 'あり → 不合格' : 'なし → 合格'));
const between = H.slice(H.indexOf(END) + END.length, sClose);
console.log('  C-7 END 外側の1行: ' + J(between.trim()) + ' → ' +
  (between.trim() === 'globalThis.TenbinCore = TenbinCore;' ? '合格' : '不合格'));

/* ============================================================
   M-4  純粋性の実測(同一入力→同一出力 / 引数非破壊)
   ============================================================ */
hdr('M-4  純粋性の実測');
const st = DS1();
const before = JSON.stringify(st);
const r1 = JSON.stringify(core.analyze(st));
const r2 = JSON.stringify(core.analyze(st));
console.log('  同一入力2回の出力が完全一致: ' + (r1 === r2));
console.log('  引数 state が破壊されていない: ' + (JSON.stringify(st) === before));
// ranking[].a が内部配列の参照でないか
const vmA = core.analyze(DS1());
vmA.ranking[0].a[0] = 999;
console.log('  ViewModel の a を書き換えても次回に影響しない: ' +
  (core.analyze(DS1()).ranking[0].a[0] !== 999));
// TenbinCore の凍結が深いか
console.log('  Object.isFrozen(core.fmt) = ' + Object.isFrozen(core.fmt) +
  ' / Object.isFrozen(core.TEXT) = ' + Object.isFrozen(core.TEXT));
console.log('  core.TEXT.degenerate が凍結されているか = ' + Object.isFrozen(core.TEXT.degenerate));

/* ============================================================
   M-5  L2 が計算していないか(INV-2)— コア外での算術を静的に洗う
   ============================================================ */
hdr('M-5  INV-2: L2(1887-2427)に現れる算術');
const lines = H.split('\n');
for (let i = 1886; i < 2427; i++) {
  const l = lines[i];
  if (/toFixed|Math\.round|Math\.abs|[^/*]\*\s*100|\/\s*(scale|maxAbs|40)|>\s*1\b/.test(l)) {
    console.log('  ' + (i + 1) + ': ' + l.trim());
  }
}

/* ============================================================
   M-6  外部送信ゼロ / CDN ゼロ(AC-24 / AC-25)
   ============================================================ */
hdr('M-6  AC-24 / AC-25 の静的検査');
for (const tok of ['<script src', '<link rel="stylesheet"', '@import', 'fetch(', 'XMLHttpRequest',
                   'sendBeacon', 'WebSocket', 'EventSource', '<form action']) {
  console.log('  "' + tok + '" 出現回数: ' + count(H, tok));
}
console.log('  Blob/URL.createObjectURL(エクスポート用、送信ではない): ' +
  count(H, 'createObjectURL') + ' 箇所');
