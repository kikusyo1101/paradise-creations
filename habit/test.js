"use strict";
const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(path.join(__dirname, "app.html"), "utf8");
const m = src.match(/\/\* *DOMAIN:START *\*\/([\s\S]*?)\/\* *DOMAIN:END *\*\//);
if (!m) { console.error("DOMAIN block not found"); process.exit(1); }
const body = m[1];

for (const forbidden of ["document", "window", "localStorage"]) {
  if (new RegExp("\\b" + forbidden + "\\b").test(body)) {
    console.error("FAIL: domain block references " + forbidden);
    process.exit(1);
  }
}

const D = new Function(body + "\n; return {localDateKey,getTodayKey,parseKey,addDays,dayOfWeek,diffDays,formatJa,weekdayLabel,rotatedWeekdayShort,rowIndexOf,rollbackToWeekStart,buildDateRange,isTargetDay,getState,computeStreak,computeWeeklyStreak,computeDensity,dailyCount,quantileThresholds,levelOf,heatmapLevels,cellAriaLabel,validateEnvelope,normalizeEnvelope,migrate,sortEnvelope};")();

let pass = 0, failed = 0;
function eq(a, e, label) {
  const ok = JSON.stringify(a) === JSON.stringify(e);
  if (ok) { pass++; } else { failed++; console.log("FAIL " + label + ": got " + JSON.stringify(a) + " want " + JSON.stringify(e)); }
}
function ok(c, label) { eq(!!c, true, label); }

// --- 日付 ---
eq(D.localDateKey(new Date(2026, 0, 15, 23, 50)), "2026-01-15", "localDateKey 23:50");
eq(D.addDays("2026-02-28", 1), "2026-03-01", "addDays 平年");
eq(D.addDays("2024-02-28", 1), "2024-02-29", "addDays 閏年");
eq(D.addDays("2025-12-31", 1), "2026-01-01", "addDays 年跨ぎ");
eq(D.addDays("2026-01-01", -1), "2025-12-31", "addDays 逆年跨ぎ");
eq(D.dayOfWeek("2026-01-15"), 4, "dayOfWeek 木");
eq(D.formatJa("2026-01-15"), "2026年1月15日", "formatJa");
eq(D.weekdayLabel("2026-01-15"), "木曜日", "weekdayLabel");
eq(D.diffDays("2026-01-01", "2026-01-15"), 14, "diffDays");
{
  const set = new Set(); let k = "2026-03-01";
  for (let i = 0; i < 400; i++) { set.add(k); const n = D.addDays(k, 1); eq(D.diffDays(k, n), 1, "adj diff " + i); k = n; }
  eq(set.size, 400, "400日ユニーク");
}
// --- 週配置 ---
eq(D.rollbackToWeekStart("2026-01-15", 1), "2026-01-12", "rollback 月曜");
eq(D.rollbackToWeekStart("2026-01-15", 0), "2026-01-11", "rollback 日曜");
for (const ws of [0, 1]) {
  const r = D.buildDateRange("2026-01-15", ws, 364);
  eq(r.length % 7, 0, "range%7 ws=" + ws);
  ok(r.length >= 364 && r.length <= 371, "range len ws=" + ws);
  eq(D.rowIndexOf(r[0], ws), 0, "range head row ws=" + ws);
}
eq(D.rotatedWeekdayShort(1), ["月","火","水","木","金","土","日"], "曜日回転 ws=1");
eq(D.rotatedWeekdayShort(0), ["日","月","火","水","木","金","土"], "曜日回転 ws=0");

// --- ストリーク ---
const daily = { id: "h1", name: "a", color: "#3fb950", freq: { type: "daily" }, createdAt: "2026-01-01", order: 0 };
const today = "2026-01-15";
function logsRange(from, to, v) { const o = {}; let d = from; while (d <= to) { o[d] = v; d = D.addDays(d, 1); } return { h1: o }; }
{ // E
  eq(D.computeStreak(daily, {}, today, 0), { current: 0, longest: 0 }, "境界E 記録皆無");
}
{ // F
  eq(D.computeStreak(daily, logsRange("2026-01-01", "2026-01-15", "skip"), today, 0), { current: 0, longest: 0 }, "境界F 全skip");
}
{ // A
  const l = logsRange("2026-01-01", "2026-01-14", "done");
  eq(D.computeStreak(daily, l, today, 0), { current: 14, longest: 14 }, "境界A 今日未達で断絶しない");
}
{ // B
  const l = logsRange("2026-01-01", "2026-01-15", "done");
  l.h1["2026-01-08"] = "skip";
  eq(D.computeStreak(daily, l, today, 0), { current: 14, longest: 14 }, "境界B skip連結");
}
{ // C weekdays
  const h = { id: "h1", name: "b", color: "#3fb950", freq: { type: "weekdays", days: [1, 3, 5] }, createdAt: "2025-12-25", order: 0 };
  const l = { h1: {} };
  let d = "2025-12-25";
  while (d <= today) { if ([1, 3, 5].includes(D.dayOfWeek(d))) l.h1[d] = "done"; d = D.addDays(d, 1); }
  const r = D.computeStreak(h, l, today, 0);
  ok(r.current >= 8, "境界C 非対象日で0にならない (current=" + r.current + ")");
  eq(r.current, r.longest, "境界C longest==current");
}
{ // D
  const l = logsRange("2026-01-01", "2026-01-15", "done");
  const base = D.computeStreak(daily, l, today, 0);
  l.h1["2020-05-05"] = "done";
  eq(D.computeStreak(daily, l, today, 0), base, "境界D createdAt前無視");
}
{ // H weekly
  const h = { id: "h1", name: "w", color: "#3fb950", freq: { type: "weekly", times: 3 }, createdAt: "2025-12-01", order: 0 };
  const l = { h1: {} };
  let w = D.rollbackToWeekStart("2025-12-01", 0);
  const curW = D.rollbackToWeekStart(today, 0);
  while (w < curW) { for (let i = 0; i < 3; i++) l.h1[D.addDays(w, i)] = "done"; w = D.addDays(w, 7); }
  l.h1[curW] = "done"; // 今週1件のみ
  const r = D.computeStreak(h, l, today, 0);
  ok(r.current >= 5, "境界H 今週未達でも保持 (current=" + r.current + ")");
  ok(r.longest >= r.current, "境界G weekly longest>=current");
}
/* 【N-4 回帰】週の途中で作った weekly 習慣の初週が必ず未達扱いになり、
   run が 0 にリセットされていた(作った週はストリークが動かない)。 */
{
  const ws = 0;
  const curW = D.rollbackToWeekStart(today, ws);          // today=2026-01-15
  const firstW = D.addDays(curW, -14);                    // 2週前の週頭
  const createdAt = D.addDays(firstW, 6);                 // その週の最終日に作成(部分週)
  const h = { id: "h1", name: "w", color: "#3fb950", freq: { type: "weekly", times: 3 }, createdAt, order: 0 };
  const l = { h1: {} };
  l.h1[createdAt] = "done";                               // 作成日に1回だけ実行 (3回には届かない)
  const midW = D.addDays(curW, -7);
  for (let i = 0; i < 3; i++) l.h1[D.addDays(midW, i)] = "done";  // 先週は達成
  for (let i = 0; i < 3; i++) l.h1[D.addDays(curW, i)] = "done";  // 今週も達成
  const r = D.computeStreak(h, l, today, ws);
  ok(r.current >= 2, "N-4: 作成週(部分週)が断絶させず、以降の週が積み上がる (current=" + r.current + ")");
}
/* 【M-8 回帰】記録を全消去した習慣の空 logs[id] = {} が保存 JSON に残っていた */
{
  const h = { id: "h1", name: "a", color: "#3fb950", freq: { type: "daily" }, createdAt: "2026-01-01", order: 0 };
  const out = D.sortEnvelope({ v: 1, settings: { weekStart: 0, theme: "dark" }, habits: [h], logs: { h1: {} } });
  eq(Object.keys(out.logs).length, 0, "M-8: 空の logs[id] は保存前に間引かれる");
  const out2 = D.sortEnvelope({ v: 1, settings: { weekStart: 0, theme: "dark" }, habits: [h], logs: { h1: { "2026-01-02": "done" } } });
  eq(Object.keys(out2.logs), ["h1"], "M-8: 記録がある習慣は残る(過剰間引きなし)");
}
// AC-21
{
  const l = logsRange("2026-01-01", "2026-01-13", "done");
  const r = D.computeStreak(daily, l, today, 0);
  const dn = D.computeDensity(daily, l, today, 30);
  eq(r.current, 0, "AC-21 current 0");
  ok(r.longest > 0, "AC-21 longest > 0");
  ok(dn.pct > 0, "AC-21 pct > 0");
}
// 密度
{
  const l = logsRange("2026-01-01", "2026-01-15", "done");
  const a = D.computeDensity(daily, l, today, 30);
  l.h1["2026-01-10"] = "skip";
  const b = D.computeDensity(daily, l, today, 30);
  eq(b.denom, a.denom - 1, "境界K skipで分母-1");
  eq(b.done, a.done - 1, "skip日はdoneから外れる");
  const fresh = { id: "h1", name: "n", color: "#3fb950", freq: { type: "daily" }, createdAt: today, order: 0 };
  eq(D.computeDensity(fresh, {}, today, 30), { done: 0, denom: 1, pct: 0 }, "境界I 作成当日");
  const off = { id: "h1", name: "n", color: "#3fb950", freq: { type: "weekdays", days: [] }, createdAt: "2026-01-01", order: 0 };
  eq(D.computeDensity(off, {}, today, 30).pct, null, "境界J denom0 -> pct null");
}
// level
// 【I-1/M-4 修正後】quantileThresholds は 3 要素(levelOf が読む境界の数)を返す
eq(D.quantileThresholds([]), [1, 2, 3], "境界L");
{
  const t = D.quantileThresholds([3, 3, 3, 3]);
  ok(t[0] < t[1] && t[1] < t[2], "境界M 単調増加 " + JSON.stringify(t));
  const t2 = D.quantileThresholds([1, 1, 2, 5, 9]);
  ok(t2.every(Number.isInteger), "閾値は整数");
  ok(t2.length === 3, "閾値は3要素(死に値なし)");
  ok(t2[0] >= 1, "t[0]>=1");
  eq(D.levelOf(0, t2), 0, "境界N levelOf(0)");
  // 【N-3 回帰】非ゼロカウントの最大値は必ず level 4 になる
  eq(D.levelOf(9, t2), 4, "N-3: 最大値は level 4");
  eq(D.levelOf(1, D.quantileThresholds([1, 1, 1])), 4, "N-3: 習慣1個(全カウント1)でも最大値は level 4");
  let bad = 0;
  for (let i = 0; i < 1000; i++) {
    const arr = Array.from({ length: 1 + (i % 20) }, () => Math.floor(Math.random() * 12));
    const nz = arr.filter(x => x > 0);
    const tt = D.quantileThresholds(nz);
    const lv = D.levelOf(Math.floor(Math.random() * 30) - 5, tt);
    if (![0, 1, 2, 3, 4].includes(lv)) bad++;
    if (nz.length && D.levelOf(Math.max(...nz), tt) !== 4) bad++;
  }
  eq(bad, 0, "ランダム1000件 level∈0..4 かつ最大値=level4");
}
{
  const out = D.heatmapLevels([
    { date: "2026-01-01", target: true, state: "done" },
    { date: "2026-01-02", target: true, state: "skip" },
    { date: "2026-01-03", target: true, state: "not-done" },
    { date: "2026-01-04", target: false, state: "not-done" }
  ], "individual", [1, 2, 3, 4]);
  eq(out.map(o => o.level), [4, 2, 0, 0], "個別モード固定マッピング");
  eq(out[3].off, true, "非対象日 off フラグ");
  eq(D.cellAriaLabel("2026-01-15", "overall", { count: 3 }), "2026年1月15日木曜日、3件達成", "aria全体");
  eq(D.cellAriaLabel("2026-01-15", "individual", { state: "skip" }), "2026年1月15日木曜日、スキップ", "aria個別");
}
// エンベロープ
{
  const good = () => ({ v: 1, settings: { weekStart: 0, theme: "dark" }, habits: [daily], logs: { h1: { "2026-01-01": "done" } } });
  eq(D.validateEnvelope(good()), true, "正常エンベロープ");
  const cases = [
    ["v文字列", o => { o.v = "1"; }], ["habits非配列", o => { o.habits = {}; }],
    ["name0文字", o => { o.habits[0] = { ...daily, name: "" }; }],
    ["name41文字", o => { o.habits[0] = { ...daily, name: "あ".repeat(41) }; }],
    ["color red", o => { o.habits[0] = { ...daily, color: "red" }; }],
    ["freq未知", o => { o.habits[0] = { ...daily, freq: { type: "x" } }; }],
    ["日付キー不正", o => { o.logs = { h1: { "2026-1-5": "done" } }; }],
    ["値DONE", o => { o.logs = { h1: { "2026-01-01": "DONE" } }; }],
    ["未知habitId", o => { o.logs = { zzz: { "2026-01-01": "done" } }; }],
    ["weekStart2", o => { o.settings.weekStart = 2; }],
    ["theme不正", o => { o.settings.theme = "blue"; }]
  ];
  for (const [label, mut] of cases) { const o = good(); mut(o); eq(D.validateEnvelope(o), false, "異常系 " + label); }

  /* 【I-9 / N-1 回帰】validateEnvelope は引数を一切変異させない純粋関数であること。
     補完は normalizeEnvelope の責務。以前は order / settings をその場で代入しており、
     検証に失敗しても入力が改変済みで残っていた。 */
  {
    const noSettings = good(); delete noSettings.settings;
    const beforeNoSettings = JSON.stringify(noSettings);
    eq(D.validateEnvelope(noSettings), false, "N-1: settings欠損は validateEnvelope 単体では不合格(補完しない)");
    eq(JSON.stringify(noSettings), beforeNoSettings, "N-1: validateEnvelope は settings を変異させない");
    const n = D.normalizeEnvelope(noSettings);
    eq(D.validateEnvelope(n), true, "N-1: normalizeEnvelope 経由なら合格");
    eq(n.settings.weekStart, 0, "補完既定 weekStart");
    eq(n.settings.theme, "system", "補完既定 theme");
    eq(JSON.stringify(noSettings), beforeNoSettings, "N-1: normalizeEnvelope も原本を変異させない");

    // order 欠損: 検証は落ちるが原本は無傷、normalize は添字で補完する
    const noOrder = good();
    delete noOrder.habits[0].order;
    const beforeNoOrder = JSON.stringify(noOrder);
    eq(D.validateEnvelope(noOrder), false, "N-1: order 欠損は validateEnvelope 単体では不合格");
    eq(JSON.stringify(noOrder), beforeNoOrder, "N-1: validateEnvelope は habits[0].order を書き込まない");
    eq(D.normalizeEnvelope(noOrder).habits[0].order, 0, "N-1: normalizeEnvelope が order を添字補完");
    eq(JSON.stringify(noOrder), beforeNoOrder, "N-1: normalize 後も原本は無傷");

    /* 部分変異の再現ケース: habits[0] に order が無く habits[1] が不正。
       以前は false を返しつつ habits[0].order = 0 が書き込まれていた。 */
    const partial = {
      v: 1, settings: { weekStart: 0, theme: "dark" },
      habits: [
        { id: "a", name: "A", color: "#3fb950", freq: { type: "daily" }, createdAt: "2026-01-01" },
        { id: "b", name: "B", color: "not-a-color", freq: { type: "daily" }, createdAt: "2026-01-01", order: 1 }
      ],
      logs: {}
    };
    const beforePartial = JSON.stringify(partial);
    eq(D.validateEnvelope(partial), false, "N-1: 後続要素が不正なエンベロープは不合格");
    eq(JSON.stringify(partial), beforePartial, "N-1: 検証失敗時に前方要素へ部分変異が残らない");
    eq(partial.habits[0].order, undefined, "N-1: habits[0].order は未定義のまま");
  }

  eq(D.migrate({ v: 1, habits: [], logs: {} }).v, 1, "migrate v1 素通し");
  let threw = 0;
  for (const bad of [{ v: 2 }, {}, { v: "1" }]) { try { D.migrate(bad); } catch (e) { threw++; } }
  eq(threw, 3, "migrate 拒否3件");
}
console.log("assertions: " + (pass + failed) + ", passed: " + pass + ", failed: " + failed);
if (failed > 0) process.exitCode = 1;
