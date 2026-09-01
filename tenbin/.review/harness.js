'use strict';
const fs = require('fs');
const path = require('path');
const HTML = path.join(__dirname, '..', 'index.html');
const BEGIN = '/*===TENBIN-CORE-BEGIN===*/';
const END = '/*===TENBIN-CORE-END===*/';

function loadCore() {
  const html = fs.readFileSync(HTML, 'utf8');
  const b = html.indexOf(BEGIN);
  const e = html.indexOf(END);
  if (b < 0 || e < 0 || b >= e) throw new Error('markers');
  const src = html.slice(b + BEGIN.length, e);
  const f = new Function('"use strict";\n' + src + '\nreturn TenbinCore;');
  return f();
}
function coreSrc() {
  const html = fs.readFileSync(HTML, 'utf8');
  const b = html.indexOf(BEGIN), e = html.indexOf(END);
  return html.slice(b + BEGIN.length, e);
}
function html() { return fs.readFileSync(HTML, 'utf8'); }

// ---- state builders ----
function mkState(critSpecs, optSpecs, settings) {
  const criteria = critSpecs.map((c, j) => ({
    id: c.id || ('c' + (j + 1)),
    name: c.name !== undefined ? c.name : ('基準' + (j + 1)),
    direction: c.direction || 'benefit',
    rawWeight: c.rawWeight,
    cutoff: c.cutoff === undefined ? null : c.cutoff
  }));
  const options = optSpecs.map((o, i) => {
    const scores = {};
    criteria.forEach((c, j) => { scores[c.id] = o.scores[j]; });
    return { id: o.id || ('o' + (i + 1)), name: o.name !== undefined ? o.name : ('選択肢' + (i + 1)), scores };
  });
  return {
    schemaVersion: 1, criteria, options,
    settings: Object.assign({ theta: 0.10, flipThreshold: 3, challengerId: null }, settings || {}),
    initialWeights: null, history: []
  };
}

// DS-1 (prd §4-0): 4 criteria x 3 options  [canonical, copied from tests/]
function DS1() {
  return mkState(
    [
      { id: 'c1', name: '価格', direction: 'cost', rawWeight: 35 },
      { id: 'c2', name: '機能充足度', direction: 'benefit', rawWeight: 30 },
      { id: 'c3', name: 'サポート', direction: 'benefit', rawWeight: 20 },
      { id: 'c4', name: '移行コスト', direction: 'cost', rawWeight: 15 }
    ],
    [
      { id: 'o1', name: 'ベンダーA', scores: [7, 9, 7, 2] },
      { id: 'o2', name: 'ベンダーB', scores: [4, 8, 8, 6] },
      { id: 'o3', name: 'ベンダーC', scores: [6, 8, 5, 8] }
    ]
  );
}
function DS2() {
  return mkState(
    [
      { id: 'c1', name: '家賃', direction: 'cost', rawWeight: 40 },
      { id: 'c2', name: '通勤時間', direction: 'cost', rawWeight: 35 },
      { id: 'c3', name: '環境', direction: 'benefit', rawWeight: 25 }
    ],
    [
      { id: 'o1', name: '物件P', scores: [4, 3, 8] },
      { id: 'o2', name: '物件Q', scores: [6, 7, 5] }
    ]
  );
}
function DS3() {
  return mkState(
    [
      { id: 'c1', name: '価格', direction: 'cost', rawWeight: 50 },
      { id: 'c2', name: '品質', direction: 'benefit', rawWeight: 50 }
    ],
    [
      { id: 'o1', name: '案X', scores: [4, 6] },
      { id: 'o2', name: '案Y', scores: [6, 8] }
    ]
  );
}
module.exports = { loadCore, coreSrc, html, mkState, DS1, DS2, DS3, HTML };
