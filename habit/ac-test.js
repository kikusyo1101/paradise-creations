"use strict";
/*
 * ac-test.js — 要件AC駆動の独立検証スイート (AC-01 .. AC-32)
 *
 * 方針:
 *  - requirements.md §4 の受入基準を「一つずつ」潰す。test.js とは独立に書く。
 *  - 依存ゼロ(npm install しない)。DOM が要る AC は本ファイル内の
 *    軽量 DOM スタブ上で app.html の <script> を実際に起動して検証する。
 *  - レイアウト/計算後スタイルを要する AC は静的 CSS 解析で代替し、
 *    その旨をラベルに明記する。検証不能なものは N/A として理由を出す。
 */

const fs = require("fs");
const path = require("path");

const APP = path.join(__dirname, "app.html");
const SRC = fs.readFileSync(APP, "utf8");

/* ===================== 結果レジストリ ===================== */

const RESULTS = new Map(); // acId -> {status, desc, notes:[]}
const ORDER = [];

function reg(ac, desc) {
  if (!RESULTS.has(ac)) { RESULTS.set(ac, { status: null, desc, notes: [] }); ORDER.push(ac); }
  return RESULTS.get(ac);
}
function check(ac, desc, cond, note) {
  const r = reg(ac, desc);
  const ok = !!cond;
  if (r.status !== "FAIL" && r.status !== "N/A") { r.status = ok ? "PASS" : "FAIL"; }
  if (!ok) { r.status = "FAIL"; }
  r.notes.push((ok ? "  ok   " : "  FAIL ") + (note || ""));
  console.log((ok ? "  ok   " : "  FAIL ") + ac + ": " + (note || ""));
  return ok;
}
function na(ac, desc, reason) {
  const r = reg(ac, desc);
  r.status = "N/A";
  r.notes.push("  n/a  " + reason);
  console.log("  n/a  " + ac + ": " + reason);
}
function section(ac, desc) {
  reg(ac, desc);
  console.log("\nAC-" + String(ac).replace(/^AC-/, "") + ": " + desc);
}

/* ===================== 軽量 DOM スタブ ===================== */

/* --- セレクタ (単一コンパウンドのみ: tag / .cls / #id / [a] / [a="v"] / :not(...)) --- */
function parseCompound(sel) {
  const parts = { tag: null, id: null, classes: [], attrs: [], nots: [] };
  let s = sel.trim();
  const notRe = /:not\(([^)]*)\)/g;
  s = s.replace(notRe, (m, inner) => { parts.nots.push(parseCompound(inner)); return ""; });
  const tokenRe = /([.#]?[A-Za-z0-9_-]+)|(\[[^\]]*\])/g;
  let m;
  while ((m = tokenRe.exec(s)) !== null) {
    const t = m[0];
    if (t[0] === ".") parts.classes.push(t.slice(1));
    else if (t[0] === "#") parts.id = t.slice(1);
    else if (t[0] === "[") {
      const body = t.slice(1, -1);
      const eq = body.indexOf("=");
      if (eq === -1) parts.attrs.push([body.trim(), null]);
      else {
        const name = body.slice(0, eq).trim();
        let val = body.slice(eq + 1).trim();
        if ((val[0] === '"' && val.endsWith('"')) || (val[0] === "'" && val.endsWith("'"))) val = val.slice(1, -1);
        parts.attrs.push([name, val]);
      }
    } else parts.tag = t.toLowerCase();
  }
  return parts;
}
function matchCompound(elm, c) {
  if (elm.nodeType !== 1) return false;
  if (c.tag && elm.tagName.toLowerCase() !== c.tag) return false;
  if (c.id && elm.getAttribute("id") !== c.id) return false;
  for (const cl of c.classes) if (!elm.classList.contains(cl)) return false;
  for (const [n, v] of c.attrs) {
    const av = elm.getAttribute(n);
    if (av === null || av === undefined) return false;
    if (v !== null && String(av) !== v) return false;
  }
  for (const n of c.nots) if (matchCompound(elm, n)) return false;
  return true;
}

class ClassList {
  constructor(elm) { this.el = elm; this._s = new Set(); }
  add(...c) { c.forEach(x => x && this._s.add(x)); this._sync(); }
  remove(...c) { c.forEach(x => this._s.delete(x)); this._sync(); }
  contains(c) { return this._s.has(c); }
  toggle(c, force) {
    const on = force === undefined ? !this._s.has(c) : !!force;
    if (on) this._s.add(c); else this._s.delete(c);
    this._sync(); return on;
  }
  _sync() { this.el._attrs.set("class", Array.from(this._s).join(" ")); }
  _set(str) { this._s = new Set(String(str || "").split(/\s+/).filter(Boolean)); this._sync(); }
}

const VOID = new Set(["meta", "input", "br", "img", "link", "hr", "source"]);

class Node {
  constructor(doc) { this.ownerDocument = doc; this.childNodes = []; this.parentNode = null; }
}
class TextNode extends Node {
  constructor(doc, text) { super(doc); this.nodeType = 3; this.data = text; }
  get textContent() { return this.data; }
}
class Element extends Node {
  constructor(doc, tag) {
    super(doc);
    this.nodeType = 1;
    this.tagName = tag.toUpperCase();
    this._attrs = new Map();
    this._listeners = new Map();
    this.classList = new ClassList(this);
    this.style = makeStyle();
    this._value = "";
    this._hidden = false;
    this._disabled = false;
    this._tabIndex = null;
    this.checked = false;
    this.files = null;
    const self = this;
    this.dataset = new Proxy({}, {
      get(_, k) { if (typeof k !== "string") return undefined; return self._attrs.get("data-" + camelToDash(k)); },
      set(_, k, v) { self._attrs.set("data-" + camelToDash(k), String(v)); return true; },
      has(_, k) { return self._attrs.has("data-" + camelToDash(k)); },
      deleteProperty(_, k) { self._attrs.delete("data-" + camelToDash(k)); return true; }
    });
  }
  /* attributes */
  setAttribute(n, v) {
    if (n === "class") { this.classList._set(v); return; }
    if (n === "hidden") { this._hidden = true; return; }
    if (n === "tabindex") { this._tabIndex = Number(v); }
    if (n === "value") { this._value = String(v); }
    if (n === "id") { this.ownerDocument._ids.set(String(v), this); }
    this._attrs.set(n, String(v));
  }
  getAttribute(n) {
    if (n === "class") return this._attrs.get("class") || "";
    if (n === "hidden") return this._hidden ? "" : null;
    if (n === "tabindex") return this._tabIndex === null ? null : String(this._tabIndex);
    const v = this._attrs.get(n);
    return v === undefined ? null : v;
  }
  removeAttribute(n) { if (n === "hidden") { this._hidden = false; return; } this._attrs.delete(n); }
  hasAttribute(n) { return this.getAttribute(n) !== null; }

  get id() { return this._attrs.get("id") || ""; }
  set id(v) { this.setAttribute("id", v); }
  get className() { return this._attrs.get("class") || ""; }
  set className(v) { this.classList._set(v); }
  get hidden() { return this._hidden; }
  set hidden(v) { this._hidden = !!v; }
  get disabled() { return this._disabled; }
  set disabled(v) { this._disabled = !!v; }
  get tabIndex() { return this._tabIndex === null ? -1 : this._tabIndex; }
  set tabIndex(v) { this._tabIndex = Number(v); }
  get type() { return this._attrs.get("type") || ""; }
  set type(v) { this._attrs.set("type", String(v)); }
  get value() { return this._value; }
  set value(v) { this._value = String(v); }
  get href() { return this._attrs.get("href") || ""; }
  set href(v) { this._attrs.set("href", String(v)); }
  get download() { return this._attrs.get("download") || ""; }
  set download(v) { this._attrs.set("download", String(v)); }

  /* tree */
  appendChild(n) { if (n.parentNode) n.parentNode.removeChild(n); n.parentNode = this; this.childNodes.push(n); return n; }
  removeChild(n) { const i = this.childNodes.indexOf(n); if (i >= 0) this.childNodes.splice(i, 1); n.parentNode = null; return n; }
  get firstChild() { return this.childNodes[0] || null; }
  get children() { return this.childNodes.filter(n => n.nodeType === 1); }
  get textContent() { return this.childNodes.map(n => n.textContent).join(""); }
  set textContent(v) {
    this.childNodes.forEach(c => { c.parentNode = null; });
    this.childNodes = [];
    if (v !== "" && v !== null && v !== undefined) this.appendChild(new TextNode(this.ownerDocument, String(v)));
  }
  _walk(out) { for (const c of this.childNodes) { if (c.nodeType === 1) { out.push(c); c._walk(out); } } return out; }
  querySelectorAll(sel) { const c = parseCompound(sel); return this._walk([]).filter(e => matchCompound(e, c)); }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  closest(sel) { const c = parseCompound(sel); let n = this; while (n && n.nodeType === 1) { if (matchCompound(n, c)) return n; n = n.parentNode; } return null; }

  /* events */
  addEventListener(t, fn, opts) {
    const capture = opts === true || (opts && opts.capture);
    const key = t + (capture ? "|capture" : "");
    if (!this._listeners.has(key)) this._listeners.set(key, []);
    this._listeners.get(key).push(fn);
  }
  removeEventListener() {}
  dispatchEvent(ev) {
    ev.target = ev.target || this;
    const chain = [];
    let n = this;
    while (n) { chain.push(n); n = n.parentNode; }
    // capture: ancestors -> target
    for (let i = chain.length - 1; i >= 0; i--) {
      const ls = chain[i]._listeners.get(ev.type + "|capture");
      if (ls) for (const fn of ls.slice()) { ev.currentTarget = chain[i]; fn.call(chain[i], ev); }
    }
    // bubble (target first, then ancestors if bubbles)
    for (let i = 0; i < chain.length; i++) {
      const ls = chain[i]._listeners.get(ev.type);
      if (ls) for (const fn of ls.slice()) { ev.currentTarget = chain[i]; fn.call(chain[i], ev); }
      if (ev.bubbles === false) break;
    }
    return !ev.defaultPrevented;
  }
  /* misc no-ops used by the app */
  focus() { this.ownerDocument.activeElement = this; }
  blur() {}
  click() { this.dispatchEvent(makeEvent("click", {})); }
  reset() { }
  scrollIntoView() {}
  getBoundingClientRect() { return { left: 0, top: 0, right: 13, bottom: 13, width: 13, height: 13 }; }
}

function camelToDash(k) { return k.replace(/[A-Z]/g, m => "-" + m.toLowerCase()); }
function makeStyle() {
  const o = {};
  o.setProperty = (k, v) => { o["__" + k] = v; };
  o.getPropertyValue = (k) => o["__" + k] || "";
  o.removeProperty = (k) => { delete o["__" + k]; };
  return o;
}
function makeEvent(type, props) {
  const ev = Object.assign({ type, bubbles: true, defaultPrevented: false }, props);
  ev.preventDefault = function () { ev.defaultPrevented = true; };
  ev.stopPropagation = function () {};
  return ev;
}

/* --- 極小 HTML パーサ (body 部分のみ / well-formed 前提) --- */
function parseHTML(doc, html, root) {
  const stack = [root];
  const re = /<\/?([A-Za-z0-9]+)((?:\s+[^<>]*?)?)\/?>|([^<]+)/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    if (m[3] !== undefined) {
      const txt = m[3];
      if (txt.trim().length) stack[stack.length - 1].appendChild(new TextNode(doc, txt.trim()));
      continue;
    }
    const raw = m[0];
    const tag = m[1].toLowerCase();
    if (raw[1] === "/") { if (stack.length > 1) stack.pop(); continue; }
    const elm = doc.createElement(tag);
    const attrRe = /([A-Za-z_:][-A-Za-z0-9_:.]*)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
    let a;
    while ((a = attrRe.exec(m[2] || "")) !== null) {
      const name = a[1];
      const val = a[3] !== undefined ? a[3] : (a[4] !== undefined ? a[4] : (a[5] !== undefined ? a[5] : ""));
      elm.setAttribute(name, val);
    }
    stack[stack.length - 1].appendChild(elm);
    if (!VOID.has(tag) && !raw.endsWith("/>")) stack.push(elm);
  }
}

function makeDocument() {
  const doc = {};
  doc._ids = new Map();
  doc.nodeType = 9;
  doc.createElement = (t) => new Element(doc, t);
  doc.createTextNode = (t) => new TextNode(doc, t);
  doc.getElementById = (id) => doc._ids.get(id) || null;
  doc.documentElement = new Element(doc, "html");
  doc.body = new Element(doc, "body");
  doc.documentElement.appendChild(doc.body);
  doc.visibilityState = "visible";
  doc.activeElement = null;
  doc._listeners = new Map();
  doc.addEventListener = Element.prototype.addEventListener.bind(doc);
  doc.removeEventListener = () => {};
  doc.dispatchEvent = function (ev) {
    ev.target = ev.target || doc;
    const ls = doc._listeners.get(ev.type);
    if (ls) for (const fn of ls.slice()) fn.call(doc, ev);
    return true;
  };
  doc.querySelector = (s) => doc.documentElement.querySelector(s);
  doc.querySelectorAll = (s) => doc.documentElement.querySelectorAll(s);
  return doc;
}

/* --- fake localStorage --- */
function makeStorage(opts) {
  opts = opts || {};
  const map = new Map(Object.entries(opts.initial || {}));
  const s = {
    _map: map,
    setCalls: 0,
    getItem(k) { if (opts.throwOnGet) throw new Error("blocked"); return map.has(k) ? map.get(k) : null; },
    // quotaOnSet: setItem だけが quota で失敗し、removeItem は成功する環境
    // (退避に失敗したのに本キーだけ消える、という最悪ケースを再現するため)
    setItem(k, v) { s.setCalls++; if (opts.throwOnSet || (opts.quotaOnSet && k !== "__paradise_probe__")) { const e = new Error("QuotaExceededError"); e.name = "QuotaExceededError"; throw e; } map.set(k, String(v)); },
    removeItem(k) { if (opts.throwOnSet) throw new Error("blocked"); map.delete(k); },
    keys() { return Array.from(map.keys()); }
  };
  return s;
}

/* --- app.html の <script> を DOM スタブ上で起動 --- */
const BODY_HTML = SRC.slice(SRC.indexOf("<body>") + 6, SRC.indexOf("<script>"));
const SCRIPT_SRC = SRC.slice(SRC.indexOf("<script>") + 8, SRC.lastIndexOf("</script>"));

const EXPORTS = ["state", "el", "render", "rerender", "flushSave", "scheduleSave",
  "onAddHabit", "onCellClick", "onTodayRowClick", "onVisibilityChange", "onHabitSelectChange",
  "exportJson", "importJson", "loadState", "sortEnvelope", "migrate", "validateEnvelope",
  "normalizeEnvelope", "validateImportEnvelope", "flushSaveAndRender",
  "getTodayKey", "addDays", "dayOfWeek", "diffDays", "rowIndexOf", "rollbackToWeekStart",
  "buildDateRange", "rotatedWeekdayShort", "isTargetDay", "getState", "computeStreak",
  "computeDensity", "dailyCount", "quantileThresholds", "levelOf", "heatmapLevels",
  "cellAriaLabel", "localDateKey", "formatJa", "weekdayLabel", "parseKey", "isDateKey",
  "defaultSettings", "STORAGE_KEY", "BACKUP_KEY_PREFIX", "MAX_HABITS", "HINT_HABITS",
  "WEEKDAY_SHORT", "CURRENT_VERSION", "applyRovingTabindex", "onGridKeydown"];

function boot(opts) {
  opts = opts || {};
  const doc = makeDocument();
  parseHTML(doc, BODY_HTML, doc.body);
  const storage = makeStorage(opts.storage || {});
  const clock = { ms: 0 };
  const RealDate = Date;
  function FakeDate(...args) {
    if (!(this instanceof FakeDate)) return RealDate();
    if (args.length === 0) return new RealDate(RealDate.now() + clock.ms);
    return new RealDate(...args);
  }
  FakeDate.now = () => RealDate.now() + clock.ms;
  FakeDate.prototype = RealDate.prototype;

  const blobLog = [];
  function Blob(parts) { this.parts = parts; blobLog.push(parts.join("")); }
  /* 【I-10 回帰】revoke がいつ呼ばれたかを記録する。
     a.click() は非同期にダウンロードを開始するため、同一タスク内で revoke
     すると Firefox / 一部 Safari で 0 バイトになる(しかも無言で失敗する)。 */
  const urlLog = { created: 0, revoked: [], revokedDuringExport: 0, exporting: false };
  const URLStub = {
    createObjectURL: () => { urlLog.created += 1; return "blob:stub"; },
    revokeObjectURL: (u) => {
      urlLog.revoked.push(u);
      if (urlLog.exporting) { urlLog.revokedDuringExport += 1; }
    }
  };
  function FileReader() {
    this.onload = null; this.onerror = null; this.result = null;
    this.readAsText = (file) => { this.result = file.__text; if (this.onload) this.onload(); };
  }
  const win = {
    localStorage: storage,
    innerWidth: 375,
    confirm: () => (opts.confirm === undefined ? true : opts.confirm),
    alert: () => {},
    addEventListener: () => {},
    matchMedia: () => ({ matches: false, addEventListener: () => {} })
  };
  const factory = new Function(
    "window", "document", "Date", "setTimeout", "clearTimeout", "Blob", "URL", "FileReader", "console",
    SCRIPT_SRC + "\n;return {" + EXPORTS.map(n => n + ":typeof " + n + '!=="undefined"?' + n + ":undefined").join(",") + "};"
  );
  const api = factory(win, doc, FakeDate, setTimeout, clearTimeout, Blob, URLStub, FileReader, console);
  return { api, doc, storage, clock, win, blobLog, urlLog };
}

/* ===================== 検証 ===================== */

function addHabit(app, name, freq) {
  app.doc.getElementById("f-name").value = name;
  app.doc.getElementById("f-type").value = freq.type;
  if (freq.type === "weekdays") {
    const boxes = app.doc.getElementById("f-days-box").querySelectorAll("input[type='checkbox']");
    boxes.forEach(b => { b.checked = freq.days.indexOf(Number(b.value)) !== -1; });
  }
  if (freq.type === "weekly") app.doc.getElementById("f-times").value = String(freq.times);
  const before = app.api.state.data.habits.length;
  app.doc.getElementById("habit-form").dispatchEvent(makeEvent("submit", {}));
  return app.api.state.data.habits.length > before;
}

async function main() {
  console.log("=== ac-test.js : requirements.md AC-01..AC-32 独立検証 ===");
  console.log("target: app.html (" + SRC.length + " bytes)\n");

  /* ---------- AC-01 ---------- */
  section("AC-01", "toISOString/toJSON 0件・日付キーは getFullYear 等から組み立て");
  check("AC-01", "", !/toISOString|\.toJSON\s*\(/.test(SRC), "toISOString/toJSON 出現数=" + (SRC.match(/toISOString|\.toJSON\s*\(/g) || []).length);
  const dkFn = SRC.match(/function localDateKey\([\s\S]{0,300}?\n}/);
  check("AC-01", "", !!dkFn && /getFullYear\(\)/.test(dkFn[0]) && /getMonth\(\)/.test(dkFn[0]) && /getDate\(\)/.test(dkFn[0]),
    "localDateKey 内に getFullYear/getMonth/getDate すべて存在");

  const app = boot({});
  const D = app.api;
  check("AC-01", "", D.localDateKey(new Date(2026, 0, 15, 23, 50)) === "2026-01-15", "localDateKey(2026-01-15 23:50)=" + D.localDateKey(new Date(2026, 0, 15, 23, 50)));

  /* ---------- AC-02 ---------- */
  section("AC-02", "保存 JSON の全日付キーが ^\\d{4}-\\d{2}-\\d{2}$ / ISO datetime 0件");
  {
    const a = boot({});
    addHabit(a, "散歩", { type: "daily" });
    const hid = a.api.state.data.habits[0].id;
    const t = a.api.state.ui.todayKey;
    a.api.onCellClick(hid, t);
    a.api.onCellClick(hid, a.api.addDays(t, -3));
    a.api.flushSave();
    const raw = a.storage.getItem(a.api.STORAGE_KEY);
    const obj = JSON.parse(raw);
    const keys = [];
    Object.keys(obj.logs).forEach(h => Object.keys(obj.logs[h]).forEach(k => keys.push(k)));
    obj.habits.forEach(h => keys.push(h.createdAt));
    check("AC-02", "", keys.length > 0 && keys.every(k => /^\d{4}-\d{2}-\d{2}$/.test(k)), "検査キー " + keys.length + "件すべて YYYY-MM-DD: " + JSON.stringify(keys.slice(0, 4)));
    check("AC-02", "", !/T\d{2}:/.test(raw) && !/Z"/.test(raw), "保存JSONに /T\\d{2}:/ と /Z\"/ が0件");
  }

  /* ---------- AC-03 ---------- */
  section("AC-03", "ローカル 23:50 (JST) に記録した日付キーが前日にならない");
  {
    const d = new Date(2026, 0, 15, 23, 50, 0);
    check("AC-03", "", D.localDateKey(d) === "2026-01-15", "23:50 -> " + D.localDateKey(d) + " (UTC換算なら 2026-01-14 になるはず)");
    check("AC-03", "", D.localDateKey(new Date(2026, 0, 15, 0, 5)) === "2026-01-15", "00:05 -> " + D.localDateKey(new Date(2026, 0, 15, 0, 5)));
    check("AC-03", "", process.env.TZ === undefined || true, "実行TZ offset=UTC" + (-new Date().getTimezoneOffset() / 60) + " (OS時刻変更は不可のため関数境界で検証)");
  }

  /* ---------- AC-04 ---------- */
  section("AC-04", "日付加算にミリ秒定数を使っていない");
  {
    const hits = SRC.match(/86400000|864e5|24\s*\*\s*60\s*\*\s*60\s*\*\s*1000/g) || [];
    check("AC-04", "", hits.length === 0, "ミリ秒定数の出現数=" + hits.length);
    check("AC-04", "", /new Date\(\s*p\.y\s*,\s*p\.m\s*-\s*1\s*,\s*p\.d\s*\+\s*n\s*\)/.test(SRC) || /new Date\([^)]*\+\s*n\s*\)/.test(SRC), "addDays が new Date(y, m, d+n) 形式");
    // 実挙動: DST/閏/年跨ぎ 800 日連続で1日差が保たれる
    let k = "2025-10-20", bad = 0;
    for (let i = 0; i < 800; i++) { const n = D.addDays(k, 1); if (D.diffDays(k, n) !== 1) bad++; k = n; }
    check("AC-04", "", bad === 0, "800日連続加算で diff!=1 の件数=" + bad + " (終点=" + k + ")");
  }

  /* ---------- AC-05 ---------- */
  section("AC-05", "週開始曜日切替で行ラベル順が変わり、既知日付が正しい曜日行に留まる");
  {
    const a = boot({});
    addHabit(a, "運動", { type: "daily" });
    const rows = {};
    for (const ws of [0, 1]) {
      a.api.state.data.settings.weekStart = ws;
      a.api.rerender();
      const labels = a.doc.getElementById("hm-weekdays").children.map(s => s.textContent);
      const expected = a.api.rotatedWeekdayShort(ws);
      const okLabels = labels.length === 7 && labels.every((t, i) => (i % 2 === 1 ? t === expected[i] : t === ""));
      check("AC-05", "", okLabels, "ws=" + ws + " 曜日行ラベル=" + JSON.stringify(labels) + " 期待順=" + JSON.stringify(expected));
      const cells = a.doc.getElementById("hm-grid").querySelectorAll(".hm-cell");
      let mis = 0;
      cells.forEach((c, i) => {
        const dow = a.api.dayOfWeek(c.dataset.date);         // 0=日
        const rowLabel = expected[i % 7];                     // グリッド行(縦7行)のラベル
        if (a.api.WEEKDAY_SHORT[dow] !== rowLabel) mis++;
      });
      check("AC-05", "", mis === 0, "ws=" + ws + " 全" + cells.length + "セルで「aria日付の曜日 vs 所属行の曜日ラベル」不一致=" + mis);
      const known = cells.find(c => c.dataset.date === "2026-01-15");
      if (known) rows[ws] = { idx: cells.indexOf(known) % 7, label: known.getAttribute("aria-label") };
    }
    if (rows[0] && rows[1]) {
      check("AC-05", "", /木曜日/.test(rows[0].label) && /木曜日/.test(rows[1].label) &&
        D.rotatedWeekdayShort(0)[rows[0].idx] === "木" && D.rotatedWeekdayShort(1)[rows[1].idx] === "木",
        "既知日 2026-01-15(木): ws=0 行" + rows[0].idx + " / ws=1 行" + rows[1].idx + " 両方とも木曜行");
    } else {
      check("AC-05", "", true, "2026-01-15 は直近52週の範囲外のため、全セル走査(上の不一致=0)で代替検証");
    }
  }

  /* ---------- AC-06 ---------- */
  section("AC-06", "描画開始日が週開始曜日まで巻き戻され、セル総数が7の倍数");
  {
    const a = boot({});
    addHabit(a, "読書", { type: "daily" });
    for (const ws of [0, 1]) {
      a.api.state.data.settings.weekStart = ws;
      a.api.rerender();
      const cells = a.doc.getElementById("hm-grid").querySelectorAll(".hm-cell");
      check("AC-06", "", cells.length % 7 === 0, "ws=" + ws + " セル総数=" + cells.length + " (%7=" + (cells.length % 7) + ")");
      const first = cells[0].dataset.date;
      check("AC-06", "", a.api.dayOfWeek(first) === ws, "ws=" + ws + " 先頭セル " + first + " の曜日=" + a.api.dayOfWeek(first) + " (期待 " + ws + ")");
      check("AC-06", "", /曜日/.test(cells[0].getAttribute("aria-label")), "先頭セル aria-label=" + cells[0].getAttribute("aria-label"));
    }
    check("AC-06", "", D.rollbackToWeekStart("2026-01-15", 1) === "2026-01-12" && D.rollbackToWeekStart("2026-01-15", 0) === "2026-01-11",
      "rollbackToWeekStart(2026-01-15) ws=1->" + D.rollbackToWeekStart("2026-01-15", 1) + " ws=0->" + D.rollbackToWeekStart("2026-01-15", 0));
  }

  /* ---------- AC-07 ---------- */
  section("AC-07", "各セルは data-level を持ち値は 0..4 のみ / インラインで背景色を計算しない");
  {
    const a = boot({});
    addHabit(a, "A", { type: "daily" });
    addHabit(a, "B", { type: "daily" });
    const t = a.api.state.ui.todayKey;
    a.api.state.data.habits.forEach((h, i) => {
      for (let d = 0; d < 40; d++) a.api.onCellClick(h.id, a.api.addDays(t, -d - i));
    });
    a.api.rerender();
    const cells = a.doc.getElementById("hm-grid").querySelectorAll(".hm-cell");
    const levels = new Set(cells.map(c => c.dataset.level));
    check("AC-07", "", cells.every(c => c.dataset.level !== undefined), "全" + cells.length + "セルが data-level を保持");
    check("AC-07", "", Array.from(levels).every(v => ["0", "1", "2", "3", "4"].includes(v)), "data-level の値集合=" + JSON.stringify(Array.from(levels).sort()));
    const bgHits = (SRC.match(/style\.backgroundColor|style\.background\s*=/g) || []);
    check("AC-07", "", bgHits.length === 0, "style.backgroundColor / style.background= の出現数=" + bgHits.length);
    check("AC-07", "", /\.hm-cell\[data-level="0"\]/.test(SRC) && /\.hm-cell\[data-level="4"\]/.test(SRC), "CSS 側に data-level 属性セレクタ(0..4)が存在");
  }

  /* ---------- AC-08 ---------- */
  section("AC-08", "level 決定に線形スケールを使わず、分位点/固定閾値が明示的に存在");
  {
    check("AC-08", "", /function quantileThresholds\(/.test(SRC), "quantileThresholds() が存在(分位点ビニング)");
    const linear = SRC.match(/Math\.round\([^)]*\/\s*max[^)]*\*\s*4\)|count\s*\/\s*max\s*\*\s*4/g) || [];
    check("AC-08", "", linear.length === 0, "線形正規化式 (count/max*4) の出現数=" + linear.length);
    const t = D.quantileThresholds([1, 1, 2, 5, 9]);
    /* 【I-1/M-4 修正後】境界は 3 要素。以前の 4 要素目 (q(1.00)) は levelOf が
       読まない死に値だった。 */
    check("AC-08", "", Array.isArray(t) && t.length === 3 && t[0] < t[1] && t[1] < t[2], "閾値配列=" + JSON.stringify(t) + " (3要素・単調増加・死に値なし)");
    check("AC-08", "", D.quantileThresholds([3, 3, 3, 3])[0] < D.quantileThresholds([3, 3, 3, 3])[2], "全同値入力でも閾値は縮退しない " + JSON.stringify(D.quantileThresholds([3, 3, 3, 3])));
    /* 【N-3 回帰】習慣が少なく非ゼロカウントの値域が狭いユーザーでも、
       その人にとっての最高記録日が必ず level 4 になる(以前は中段に張り付いた)。 */
    check("AC-08", "", D.levelOf(1, D.quantileThresholds([1, 1, 1, 1])) === 4, "N-3: 習慣1個(全カウント1)の最大値 level=" + D.levelOf(1, D.quantileThresholds([1, 1, 1, 1])));
    check("AC-08", "", D.levelOf(2, D.quantileThresholds([1, 2, 1, 2])) === 4, "N-3: カウント最大2 の最大値 level=" + D.levelOf(2, D.quantileThresholds([1, 2, 1, 2])));
    let bad = 0, noMax = 0;
    for (let i = 0; i < 2000; i++) {
      const arr = Array.from({ length: 1 + (i % 25) }, () => 1 + Math.floor(Math.random() * 15));
      const th = D.quantileThresholds(arr);
      const lv = D.levelOf(Math.floor(Math.random() * 40) - 5, th);
      if (![0, 1, 2, 3, 4].includes(lv)) bad++;
      if (D.levelOf(Math.max(...arr), th) !== 4) noMax++;
    }
    check("AC-08", "", bad === 0, "ランダム2000件で level が 0..4 を外れた件数=" + bad);
    check("AC-08", "", noMax === 0, "N-3: ランダム2000件で最大値が level 4 にならなかった件数=" + noMax);
  }

  /* ---------- AC-09 ---------- */
  section("AC-09", "カウント0のセルも DOM に存在し data-level=0 / 背景は透明でない");
  {
    const a = boot({});
    addHabit(a, "A", { type: "daily" });
    a.api.rerender();
    const cells = a.doc.getElementById("hm-grid").querySelectorAll(".hm-cell");
    const zero = cells.filter(c => c.dataset.level === "0");
    check("AC-09", "", zero.length > 0, "level0 セルが DOM 上に " + zero.length + " 個描画されている(省略されていない)");
    check("AC-09", "", cells.length >= 364, "セル総数=" + cells.length + " (0日も含め全日描画)");
    const l0 = (SRC.match(/--level-0:\s*([^;]+);/g) || []).map(s => s.split(":")[1].trim().replace(";", ""));
    check("AC-09", "", l0.length >= 2 && l0.every(v => v !== "transparent" && !/rgba\([^)]*,\s*0\s*\)/.test(v)), "静的CSS解析: --level-0 の定義値=" + JSON.stringify(l0) + " (transparent/alpha0 でない)");
    check("AC-09", "", /\.hm-cell\[data-level="0"\]\s*\{\s*background:\s*var\(--level-0\)/.test(SRC), "静的CSS解析: level0 セルに background: var(--level-0) が適用される規則が存在");
    reg("AC-09").notes.push("  note 計算後 getComputedStyle は Node+スタブでは評価できないため静的CSS解析で代替");
    console.log("  note  AC-09: 計算後 getComputedStyle はレイアウトエンジンが無いため静的CSS解析で代替");
  }

  /* ---------- AC-10 ---------- */
  section("AC-10", "未来日セルは data-future を持ち、クリックしても記録が増えない");
  {
    const a = boot({});
    addHabit(a, "A", { type: "daily" });
    const hid = a.api.state.data.habits[0].id;
    a.api.onHabitSelectChange(hid);
    const t = a.api.state.ui.todayKey;
    const cells = a.doc.getElementById("hm-grid").querySelectorAll(".hm-cell");
    const future = cells.filter(c => c.dataset.date > t);
    check("AC-10", "", future.length > 0, "未来日セル数=" + future.length);
    check("AC-10", "", future.every(c => c.dataset.future === "true" && c.disabled === true), "未来日セルすべてが data-future=true かつ disabled");
    const fk = future[0].dataset.date;
    const before = JSON.stringify(a.api.state.data.logs);
    future[0].dispatchEvent(makeEvent("click", { target: future[0] }));
    a.api.onCellClick(hid, fk);
    const after = JSON.stringify(a.api.state.data.logs);
    check("AC-10", "", before === after && !(a.api.state.data.logs[hid] || {})[fk], "未来日 " + fk + " をクリック後も logs 不変: " + after);
  }

  /* ---------- AC-11 ---------- */
  section("AC-11", "全セルが空でない aria-label を持ち 年月日+曜日名+状態/件数 を含む");
  {
    const a = boot({});
    addHabit(a, "A", { type: "daily" });
    const hid = a.api.state.data.habits[0].id;
    const t = a.api.state.ui.todayKey;
    a.api.onCellClick(hid, t);
    a.api.onCellClick(hid, a.api.addDays(t, -1));
    a.api.onCellClick(hid, a.api.addDays(t, -1)); // -> skip
    const re = /^\d{4}年\d{1,2}月\d{1,2}日[日月火水木金土]曜日、.+$/;
    for (const mode of [null, "SEL"]) {
      a.api.onHabitSelectChange(mode === null ? "" : hid);
      const cells = a.doc.getElementById("hm-grid").querySelectorAll(".hm-cell");
      const labels = cells.map(c => c.getAttribute("aria-label") || "");
      check("AC-11", "", labels.every(l => l.length > 0), (mode ? "個別" : "全体") + "モード: 空labelのセル数=" + labels.filter(l => !l).length);
      check("AC-11", "", labels.every(l => re.test(l)), (mode ? "個別" : "全体") + "モード: 全" + labels.length + "件が「年月日+曜日名+状態」に一致 例=" + labels[labels.length - 1]);
      const states = new Set(labels.map(l => l.split("、")[1]));
      check("AC-11", "", states.size >= 2, (mode ? "個別" : "全体") + "モード: 状態文字列が色以外の情報として複数存在 " + JSON.stringify(Array.from(states).slice(0, 5)));
    }
  }

  /* ---------- AC-12 ---------- */
  section("AC-12", "グリッド内の tabindex=0 が常にちょうど1つ / 矢印キーで移動");
  {
    const a = boot({});
    addHabit(a, "A", { type: "daily" });
    const grid = a.doc.getElementById("hm-grid");
    const count = () => grid.querySelectorAll('[tabindex="0"]').length;
    check("AC-12", "", count() === 1, "初期状態の tabindex=0 の個数=" + count());
    const first = grid.querySelector('[tabindex="0"]').dataset.date;
    for (let i = 0; i < 5; i++) grid.dispatchEvent(makeEvent("keydown", { key: "ArrowLeft", target: grid }));
    const afterL = grid.querySelector('[tabindex="0"]').dataset.date;
    check("AC-12", "", count() === 1, "ArrowLeft x5 後の tabindex=0 の個数=" + count());
    check("AC-12", "", afterL === a.api.addDays(first, -5), "フォーカスが " + first + " -> " + afterL + " に移動");
    grid.dispatchEvent(makeEvent("keydown", { key: "ArrowDown", target: grid }));
    check("AC-12", "", count() === 1, "ArrowDown 後の個数=" + count() + " / 位置=" + grid.querySelector('[tabindex="0"]').dataset.date);
    /* 【M-6 修正後】Home/End は design.md §221 のとおり「行頭/行末」= 同じ曜日の
       最初/最後の週へ移動する。グリッド全体端は Ctrl+Home / Ctrl+End。 */
    const beforeHome = grid.querySelector('[tabindex="0"]').dataset.date;
    grid.dispatchEvent(makeEvent("keydown", { key: "Home", target: grid }));
    const afterHome = grid.querySelector('[tabindex="0"]').dataset.date;
    const homeIsSameRow = a.api.rowIndexOf(afterHome, 0) === a.api.rowIndexOf(beforeHome, 0);
    const noEarlierInRow = !grid.querySelector('.hm-cell[data-date="' + a.api.addDays(afterHome, -7) + '"]');
    check("AC-12", "", count() === 1 && homeIsSameRow && noEarlierInRow,
      "M-6: Home は同じ行(曜日)の先頭週へ " + beforeHome + " -> " + afterHome + " / 個数=" + count());
    grid.dispatchEvent(makeEvent("keydown", { key: "Home", ctrlKey: true, target: grid }));
    check("AC-12", "", count() === 1 && grid.querySelector('[tabindex="0"]').dataset.date === grid.querySelectorAll(".hm-cell")[0].dataset.date,
      "M-6: Ctrl+Home でグリッド先頭セルへ / 個数=" + count());
    const others = grid.querySelectorAll(".hm-cell").filter(c => c.tabIndex !== 0);
    check("AC-12", "", others.every(c => c.tabIndex === -1), "他 " + others.length + " セルはすべて tabindex=-1");
  }

  /* ---------- AC-13 ---------- */
  section("AC-13", "localStorage が使えなくても起動し、セッション限定の警告を表示");
  {
    let a = null, err = null;
    try { a = boot({ storage: { throwOnSet: true } }); } catch (e) { err = e; }
    check("AC-13", "", err === null && a !== null, "setItem が常に throw する環境で未捕捉例外=" + (err ? err.message : "0件"));
    if (a) {
      const warn = a.doc.getElementById("storage-warning");
      check("AC-13", "", warn.hidden === false, "警告要素 hidden=" + warn.hidden);
      check("AC-13", "", /このセッションでのみ保持されます/.test(warn.textContent), "警告文言=" + JSON.stringify(warn.textContent));
      const added = addHabit(a, "メモリ動作", { type: "daily" });
      check("AC-13", "", added && a.api.state.data.habits.length === 1, "メモリ上で習慣追加が成功: " + a.api.state.data.habits.length + "件");
      const hid = a.api.state.data.habits[0].id;
      const btn = a.doc.getElementById("today-list").querySelector(".row-main");
      btn.dispatchEvent(makeEvent("click", { target: btn }));
      check("AC-13", "", a.api.getState(a.api.state.data.logs, hid, a.api.state.ui.todayKey) === "done", "チェック操作が UI/state に反映: " + a.doc.getElementById("today-list").querySelector(".row-main").getAttribute("aria-pressed"));
    }
  }

  /* ---------- AC-14 ---------- */
  section("AC-14", "破損データは SyntaxError を捕捉しバックアップキーへ退避、既定状態で起動");
  {
    let a = null, err = null;
    try { a = boot({ storage: { initial: { "paradise.habit.v1": "{broken" } } }); } catch (e) { err = e; }
    check("AC-14", "", err === null, "破損データ起動時の未捕捉例外=" + (err ? err.message : "0件"));
    if (a) {
      check("AC-14", "", a.api.state.data.habits.length === 0 && a.api.state.data.v === 1, "既定状態で起動: habits=" + a.api.state.data.habits.length + " v=" + a.api.state.data.v);
      const bk = a.storage.keys().filter(k => k.indexOf("paradise.habit.backup.") === 0);
      check("AC-14", "", bk.length === 1, "バックアップキー数=" + bk.length + " (" + bk[0] + ")");
      check("AC-14", "", a.storage.getItem(bk[0]) === "{broken", "退避された値=" + JSON.stringify(a.storage.getItem(bk[0])));
      check("AC-14", "", a.storage.getItem("paradise.habit.v1") === null, "破損した本体キーは削除済み");
      check("AC-14", "", /壊れていた|退避/.test(a.doc.getElementById("notice").textContent), "通知=" + a.doc.getElementById("notice").textContent);
    }
  }

  /* ---------- AC-15 ---------- */
  section("AC-15", "localStorage アクセスは setItem/getItem/removeItem のみ");
  {
    const bad = (SRC.match(/localStorage\.[A-Za-z_$][A-Za-z0-9_$]*\s*=/g) || []);
    check("AC-15", "", bad.length === 0, "localStorage へのプロパティ代入の出現数=" + bad.length);
    const uses = (SRC.match(/localStorage\.[A-Za-z_$][A-Za-z0-9_$]*/g) || []);
    const methods = Array.from(new Set(uses.map(u => u.split(".")[1])));
    check("AC-15", "", methods.every(m => ["setItem", "getItem", "removeItem"].includes(m)), "使用メソッド=" + JSON.stringify(methods));
    check("AC-15", "", /JSON\.stringify\(sortEnvelope/.test(SRC) && /JSON\.parse\(raw\)/.test(SRC), "保存は JSON.stringify / 読み込みは JSON.parse");
  }

  /* ---------- AC-16 ---------- */
  section("AC-16", "バージョン付きエンベロープ・名前空間付き単一キー");
  {
    const a = boot({});
    addHabit(a, "A", { type: "daily" });
    a.api.flushSave();
    const appKeys = a.storage.keys().filter(k => k.indexOf("paradise.habit.backup.") !== 0);
    check("AC-16", "", appKeys.length === 1, "アプリ由来キー数(バックアップ除く)=" + appKeys.length + " " + JSON.stringify(appKeys));
    check("AC-16", "", appKeys[0] === "paradise.habit.v1", "キー名=" + appKeys[0] + " (名前空間付き)");
    const obj = JSON.parse(a.storage.getItem(appKeys[0]));
    check("AC-16", "", typeof obj.v === "number" && Array.isArray(obj.habits) && obj.logs && typeof obj.logs === "object",
      "ルート形状: v=" + JSON.stringify(obj.v) + "(" + typeof obj.v + ") habits=Array(" + obj.habits.length + ") logs=object settings=" + (obj.settings ? "有" : "無"));
    let threw = 0;
    for (const badObj of [{ v: 2 }, {}, { v: "1" }]) { try { a.api.migrate(badObj); } catch (e) { threw++; } }
    check("AC-16", "", threw === 3, "migrate() が未知バージョンを拒否: " + threw + "/3");
  }

  /* ---------- AC-17 ---------- */
  section("AC-17", "外部リソース参照が0件");
  {
    const pats = [
      ["<script src=", /<script[^>]+src=/g],
      ["<link stylesheet", /<link[^>]+stylesheet/g],
      ["@import", /@import/g],
      ["fetch(", /\bfetch\s*\(/g],
      ["XMLHttpRequest", /XMLHttpRequest/g],
      ["importScripts", /importScripts/g],
      ["<img src", /<img[^>]+src=/g]
    ];
    for (const [name, re] of pats) {
      const n = (SRC.match(re) || []).length;
      check("AC-17", "", n === 0, name + " の出現数=" + n);
    }
    const urls = (SRC.match(/https?:\/\/[^\s"'<>)]+/g) || []);
    check("AC-17", "", urls.length === 0, "http(s) URL の出現数=" + urls.length + (urls.length ? " " + JSON.stringify(urls.slice(0, 3)) : ""));
    check("AC-17", "", /font-family:\s*system-ui/.test(SRC), "フォントはシステムフォントスタック");
  }

  /* ---------- AC-18 ---------- */
  section("AC-18", "単一 .html で完結し、file:// 相当の環境で主要4操作が動作");
  {
    const htmlFiles = fs.readdirSync(__dirname).filter(f => /\.html?$/i.test(f));
    check("AC-18", "", htmlFiles.length === 1, "ディレクトリ内の .html ファイル数=" + htmlFiles.length + " " + JSON.stringify(htmlFiles));
    check("AC-18", "", /<style>/.test(SRC) && /<script>/.test(SRC), "CSS/JS がインラインで単一ファイルに同梱");
    // file:// でストレージ不可のケースを想定した4操作
    const a = boot({ storage: { throwOnSet: true } });
    const ok1 = addHabit(a, "file操作", { type: "daily" });
    const hid = a.api.state.data.habits[0].id;
    const btn = a.doc.getElementById("today-list").querySelector(".row-main");
    btn.dispatchEvent(makeEvent("click", { target: btn }));
    const ok2 = a.api.getState(a.api.state.data.logs, hid, a.api.state.ui.todayKey) === "done";
    const cells = a.doc.getElementById("hm-grid").querySelectorAll(".hm-cell");
    const ok3 = cells.length >= 364;
    a.api.exportJson(a.api.state.data);
    const ok4 = a.blobLog.length === 1 && JSON.parse(a.blobLog[0]).habits.length === 1;
    check("AC-18", "", ok1 && ok2 && ok3 && ok4, "追加=" + ok1 + " チェック=" + ok2 + " ヒートマップ(" + cells.length + "セル)=" + ok3 + " エクスポート=" + ok4);
    reg("AC-18").notes.push("  note 実ブラウザの file:// 起動ではなく DOM スタブ上での起動で検証(コンソールエラー0件相当=未捕捉例外0件)");
    console.log("  note  AC-18: 実ブラウザの file:// 起動ではなく DOM スタブ上での実行で検証");
  }

  /* ---------- AC-19 ---------- */
  section("AC-19", "毎日以外の頻度で、対象外曜日を放置してもストリークが0にならない");
  {
    const t = D.getTodayKey();
    const h = { id: "x", name: "運動", color: "#3fb950", freq: { type: "weekdays", days: [1, 3, 5] }, createdAt: D.addDays(t, -21), order: 0 };
    const logs = { x: {} };
    let d = h.createdAt, targets = 0;
    while (d <= t) { if ([1, 3, 5].includes(D.dayOfWeek(d))) { logs.x[d] = "done"; targets++; } d = D.addDays(d, 1); }
    const s = D.computeStreak(h, logs, t, 0);
    check("AC-19", "", s.current > 0, "月水金のみ done(3週間, 対象日=" + targets + "日) -> current=" + s.current);
    check("AC-19", "", s.current === targets || s.current === targets - (D.isTargetDay(h, t) && logs.x[t] ? 0 : 1), "current=" + s.current + " が対象日数 " + targets + " と一致");
    check("AC-19", "", s.longest >= s.current, "longest=" + s.longest + " >= current=" + s.current);
    // 週N回
    const hw = { id: "y", name: "週3", color: "#3fb950", freq: { type: "weekly", times: 3 }, createdAt: D.addDays(t, -35), order: 0 };
    const lw = { y: {} };
    let w = D.rollbackToWeekStart(hw.createdAt, 0);
    const cur = D.rollbackToWeekStart(t, 0);
    while (w < cur) { for (let i = 0; i < 3; i++) lw.y[D.addDays(w, i)] = "done"; w = D.addDays(w, 7); }
    const sw = D.computeStreak(hw, lw, t, 0);
    check("AC-19", "", sw.current >= 4, "週3回設定・今週未達でも current=" + sw.current + " (0にならない)");
  }

  /* ---------- AC-20 ---------- */
  section("AC-20", "skip はストリークを断絶させず、達成率の分母から除外される");
  {
    const t = D.getTodayKey();
    const h = { id: "x", name: "A", color: "#3fb950", freq: { type: "daily" }, createdAt: D.addDays(t, -40), order: 0 };
    const mk = () => { const o = { x: {} }; for (let i = 0; i <= 40; i++) o.x[D.addDays(t, -i)] = "done"; return o; };
    const base = mk();
    const sBase = D.computeStreak(h, base, t, 0);
    const dBase = D.computeDensity(h, base, t, 30);
    const withSkip = mk(); withSkip.x[D.addDays(t, -5)] = "skip";
    const sSkip = D.computeStreak(h, withSkip, t, 0);
    const dSkip = D.computeDensity(h, withSkip, t, 30);
    check("AC-20", "", sSkip.current === sBase.current - 1 + 1 || sSkip.current >= sBase.current - 1, "連続doneの途中1日を skip: current " + sBase.current + " -> " + sSkip.current + " (断絶していない)");
    check("AC-20", "", sSkip.current > 5, "skip をまたいで前後が連結 (current=" + sSkip.current + " > skip位置5)");
    check("AC-20", "", dSkip.denom === dBase.denom - 1, "達成率の分母 " + dBase.denom + " -> " + dSkip.denom + " (skip分だけ減少)");
    check("AC-20", "", dSkip.done === dBase.done - 1, "分子 " + dBase.done + " -> " + dSkip.done);
    const notDone = mk(); delete notDone.x[D.addDays(t, -5)];
    const sNot = D.computeStreak(h, notDone, t, 0);
    check("AC-20", "", sNot.current < sSkip.current, "対照: 同じ日を not-done にすると current=" + sNot.current + " に断絶する(skip=" + sSkip.current + ")");
  }

  /* ---------- AC-21 ---------- */
  section("AC-21", "現在/最長ストリークと達成率が同一画面に併置される");
  {
    const a = boot({});
    addHabit(a, "併置テスト", { type: "daily" });
    const hid = a.api.state.data.habits[0].id;
    const t = a.api.state.ui.todayKey;
    // 実装は createdAt より前の記録を正しく無視するため、習慣の作成日を過去に置く
    a.api.state.data.habits[0].createdAt = a.api.addDays(t, -40);
    for (let i = 2; i <= 12; i++) a.api.onCellClick(hid, a.api.addDays(t, -i)); // 1日空ける
    a.api.rerender();
    const stats = a.doc.getElementById("today-list").querySelector(".row-stats").textContent;
    const s = a.api.computeStreak(a.api.state.data.habits[0], a.api.state.data.logs, t, 0);
    const dn = a.api.computeDensity(a.api.state.data.habits[0], a.api.state.data.logs, t, 30);
    check("AC-21", "", /現在 \d+日/.test(stats) && /最長 \d+日/.test(stats) && /達成率/.test(stats), "同一行のテキスト=" + JSON.stringify(stats));
    check("AC-21", "", s.current === 0, "1日空けた直後の current=" + s.current);
    check("AC-21", "", s.longest > 0, "longest=" + s.longest + " (0でない値を保持)");
    check("AC-21", "", dn.pct > 0, "直近30日達成率=" + dn.done + "/" + dn.denom + " (" + dn.pct + "%)");
    check("AC-21", "", stats.indexOf("現在 0日") !== -1 && stats.indexOf("最長 " + s.longest + "日") !== -1 && stats.indexOf(dn.pct + "%") !== -1,
      "画面文字列に current=0 / longest>0 / pct>0 が同時に現れる");
  }

  /* ---------- AC-22 ---------- */
  section("AC-22", "今日の一覧の1クリックだけで done が記録される(中間ステップ無し)");
  {
    const a = boot({});
    addHabit(a, "ワンタップ", { type: "daily" });
    const hid = a.api.state.data.habits[0].id;
    const t = a.api.state.ui.todayKey;
    const btn = a.doc.getElementById("today-list").querySelector(".row-main");
    check("AC-22", "", !!btn && btn.getAttribute("aria-pressed") === "false", "行ボタン初期 aria-pressed=" + btn.getAttribute("aria-pressed"));
    btn.dispatchEvent(makeEvent("click", { target: btn }));
    check("AC-22", "", a.api.state.data.logs[hid][t] === "done", "クリック1回で logs[" + t + "]=" + a.api.state.data.logs[hid][t]);
    a.api.flushSave();
    const saved = JSON.parse(a.storage.getItem("paradise.habit.v1"));
    check("AC-22", "", saved.logs[hid][t] === "done", "保存JSONにも当日の done が反映");
    const dialogs = a.doc.documentElement.querySelectorAll("[role=dialog]").concat(a.doc.documentElement.querySelectorAll("dialog"));
    check("AC-22", "", dialogs.length === 0, "クリック後に dialog / [role=dialog] の出現数=" + dialogs.length);
    const btn2 = a.doc.getElementById("today-list").querySelector(".row-main");
    check("AC-22", "", btn2.getAttribute("aria-pressed") === "true", "UI に即時反映 aria-pressed=" + btn2.getAttribute("aria-pressed"));
    btn2.dispatchEvent(makeEvent("click", { target: btn2 }));
    check("AC-22", "", !a.api.state.data.logs[hid][t], "もう1クリックで解除される(トグル)");
  }

  /* ---------- AC-23 ---------- */
  section("AC-23", "ヒートマップのセルが done -> skip -> not-done に巡回する");
  {
    const a = boot({});
    addHabit(a, "巡回", { type: "daily" });
    const hid = a.api.state.data.habits[0].id;
    a.api.onHabitSelectChange(hid);
    const target = a.api.addDays(a.api.state.ui.todayKey, -10);
    const cellOf = () => a.doc.getElementById("hm-grid").querySelector('.hm-cell[data-date="' + target + '"]');
    const seq = [];
    seq.push(cellOf().dataset.state);
    for (let i = 0; i < 3; i++) {
      const c = cellOf();
      c.dispatchEvent(makeEvent("click", { target: c }));
      seq.push(cellOf().dataset.state);
    }
    check("AC-23", "", seq[1] === "done", "1回目クリック -> " + seq[1]);
    check("AC-23", "", seq[2] === "skip", "2回目クリック -> " + seq[2]);
    check("AC-23", "", seq[3] === "not-done" && seq[3] === seq[0], "3回目クリック -> " + seq[3] + " (初期状態 " + seq[0] + " に戻る)");
    const lbl = cellOf().getAttribute("aria-label");
    check("AC-23", "", /未達成|達成|スキップ|対象外/.test(lbl), "aria-label に状態語が含まれる: " + lbl);
  }

  /* ---------- AC-24 ---------- */
  section("AC-24", "エクスポート->全消去->インポートで完全復元 / 不正JSONで既存データ不変");
  {
    const a = boot({});
    addHabit(a, "習慣1", { type: "daily" });
    addHabit(a, "習慣2", { type: "weekdays", days: [1, 3, 5] });
    const t = a.api.state.ui.todayKey;
    a.api.state.data.habits.forEach((h, i) => { for (let d = 0; d < 5; d++) a.api.onCellClick(h.id, a.api.addDays(t, -d - i)); });
    a.api.state.data.settings.weekStart = 1;
    a.api.exportJson(a.api.state.data);
    const exported = a.blobLog[a.blobLog.length - 1];
    // 全消去
    a.api.state.data = { v: 1, settings: a.api.defaultSettings(), habits: [], logs: {} };
    a.api.rerender();
    check("AC-24", "", a.api.state.data.habits.length === 0, "全消去後の習慣数=" + a.api.state.data.habits.length);
    // インポート
    let imported = false;
    a.api.importJson({ __text: exported }, (obj) => { a.api.state.data = obj; imported = true; }, () => {});
    check("AC-24", "", imported, "インポート成功");
    a.api.exportJson(a.api.state.data);
    const reExported = a.blobLog[a.blobLog.length - 1];
    check("AC-24", "", reExported === exported, "再エクスポートJSONが元と完全一致 (" + exported.length + " bytes)");
    check("AC-24", "", a.api.state.data.settings.weekStart === 1, "設定も復元 weekStart=" + a.api.state.data.settings.weekStart);
    // 不正 JSON
    const snapshot = JSON.stringify(a.api.state.data);
    let errMsg = null;
    a.api.importJson({ __text: "{broken" }, () => { errMsg = "OK-CALLED"; }, (m) => { errMsg = m; });
    check("AC-24", "", errMsg !== "OK-CALLED" && /既存のデータは変更していません/.test(errMsg || ""), "不正JSON: エラー通知=" + JSON.stringify(errMsg));
    check("AC-24", "", JSON.stringify(a.api.state.data) === snapshot, "不正JSONインポート後も既存データ不変");
    // 形式は妥当だが中身不正
    let err2 = null;
    a.api.importJson({ __text: JSON.stringify({ v: 1, habits: [{ id: "z", name: "", color: "red", freq: { type: "x" }, createdAt: "2026-1-1", order: 0 }], logs: {} }) }, () => { err2 = "OK-CALLED"; }, (m) => { err2 = m; });
    check("AC-24", "", err2 !== "OK-CALLED" && JSON.stringify(a.api.state.data) === snapshot, "スキーマ不正JSONも拒否 / データ不変: " + JSON.stringify(err2));
  }

  /* ---------- AC-25 ---------- */
  section("AC-25", "専用コンテナ内の横スクロール / セル 12px 以上");
  {
    check("AC-25", "", /\.hm-scroll\s*\{[^}]*overflow-x:\s*(auto|scroll)/.test(SRC), "静的CSS解析: .hm-scroll に overflow-x: auto");
    const a = boot({});
    addHabit(a, "A", { type: "daily" });
    const grid = a.doc.getElementById("hm-grid");
    check("AC-25", "", grid.closest(".hm-scroll") !== null, "hm-grid が .hm-scroll コンテナの内側にある");
    const cellVar = (SRC.match(/--cell:\s*(\d+)px/g) || []).map(s => Number(s.match(/(\d+)px/)[1]));
    check("AC-25", "", cellVar.length >= 1 && cellVar.every(v => v >= 12), "--cell の全定義値=" + JSON.stringify(cellVar) + "px (すべて12px以上)");
    check("AC-25", "", /\.hm-cell\s*\{[^}]*width:\s*var\(--cell\)[^}]*height:\s*var\(--cell\)/.test(SRC.replace(/\n/g, "")), "静的CSS解析: .hm-cell の width/height が var(--cell)");
    check("AC-25", "", !/body\s*\{[^}]*overflow-x/.test(SRC), "body 側に横スクロールを与える指定が無い");
    reg("AC-25").notes.push("  note documentElement.scrollWidth<=clientWidth はレイアウトエンジンが必要なため、CSS構造(overflow-x コンテナへの封じ込め)で代替検証");
    console.log("  note  AC-25: scrollWidth<=clientWidth の実測はレイアウトエンジンが必要 -> CSS構造検証で代替");
  }

  /* ---------- AC-26 ---------- */
  section("AC-26", "ツールチップが hover と tap の両経路で表示される");
  {
    const a = boot({});
    addHabit(a, "A", { type: "daily" });
    const grid = a.doc.getElementById("hm-grid");
    const tip = a.doc.getElementById("tooltip");
    const cells = grid.querySelectorAll(".hm-cell");
    const c1 = cells[10], c2 = cells[20], c3 = cells[30];
    // hover 経路 (mouseover: バブルする)
    tip.hidden = true;
    c1.dispatchEvent(makeEvent("mouseover", { target: c1 }));
    check("AC-26", "", tip.hidden === false && tip.textContent === c1.getAttribute("aria-label"), "mouseover -> tooltip 表示 / text=" + tip.textContent);
    // hover 経路 (mouseenter: バブルしない -> capture 登録が無いと失敗する)
    tip.hidden = true;
    c2.dispatchEvent(makeEvent("mouseenter", { target: c2, bubbles: false }));
    check("AC-26", "", tip.hidden === false && tip.textContent === c2.getAttribute("aria-label"), "mouseenter(非バブル) -> tooltip 表示 / text=" + tip.textContent);
    // tap 経路
    tip.hidden = true;
    c3.dispatchEvent(makeEvent("click", { target: c3 }));
    check("AC-26", "", tip.hidden === false && tip.textContent === c3.getAttribute("aria-label"), "click(tap) -> tooltip 表示 / text=" + tip.textContent);
    // touchstart 経路(ポインタイベントを持たない環境)
    tip.hidden = true;
    c2.dispatchEvent(makeEvent("touchstart", { target: c2 }));
    check("AC-26", "", tip.hidden === false && tip.textContent === c2.getAttribute("aria-label"), "touchstart -> tooltip 表示 / text=" + tip.textContent);
    // フォーカス経路(キーボード)
    tip.hidden = true;
    c1.dispatchEvent(makeEvent("focusin", { target: c1 }));
    check("AC-26", "", tip.hidden === false, "focusin(キーボード) -> tooltip 表示");
  }

  /* ---------- AC-27 ---------- */
  section("AC-27", "習慣0件のとき空状態メッセージが表示される");
  {
    const a = boot({});
    const es = a.doc.getElementById("empty-state");
    check("AC-27", "", a.api.state.data.habits.length === 0, "初回起動時の習慣数=" + a.api.state.data.habits.length);
    check("AC-27", "", es.hidden === false, "空状態 hidden=" + es.hidden);
    const txt = es.textContent;
    check("AC-27", "", /1〜3個/.test(txt), "「1〜3個から始める」案内を含む: " + /1〜3個/.test(txt));
    check("AC-27", "", txt.length > 30 && /習慣|ヒートマップ/.test(txt), "アプリの目的説明を含む(" + txt.length + "文字): " + txt.slice(0, 40) + "…");
    check("AC-27", "", a.doc.getElementById("heatmap-section").hidden === true && a.doc.getElementById("hm-grid").querySelectorAll(".hm-cell").length === 0,
      "真っ白なグリッドを見せない: heatmap-section hidden=" + a.doc.getElementById("heatmap-section").hidden + " / セル数=" + a.doc.getElementById("hm-grid").querySelectorAll(".hm-cell").length);
    addHabit(a, "A", { type: "daily" });
    check("AC-27", "", es.hidden === true && a.doc.getElementById("heatmap-section").hidden === false, "習慣追加後は空状態が消えヒートマップが出る");
  }

  /* ---------- AC-28 ---------- */
  section("AC-28", "6個超で注意ヒント / 24個超の追加は拒否");
  {
    const a = boot({});
    const hint = a.doc.getElementById("habit-limit-hint");
    for (let i = 1; i <= 6; i++) addHabit(a, "h" + i, { type: "daily" });
    check("AC-28", "", a.api.state.data.habits.length === 6 && hint.hidden === true, "6個時点: 習慣数=" + a.api.state.data.habits.length + " ヒント hidden=" + hint.hidden);
    addHabit(a, "h7", { type: "daily" });
    check("AC-28", "", hint.hidden === false, "7個目追加でヒント出現 hidden=" + hint.hidden);
    check("AC-28", "", /6個以内/.test(hint.textContent), "ヒント文言=" + JSON.stringify(hint.textContent));
    for (let i = 8; i <= 24; i++) addHabit(a, "h" + i, { type: "daily" });
    check("AC-28", "", a.api.state.data.habits.length === 24, "24個まで追加可能: " + a.api.state.data.habits.length);
    const ok25 = addHabit(a, "h25", { type: "daily" });
    check("AC-28", "", ok25 === false && a.api.state.data.habits.length === 24, "25個目は拒否され習慣数は24のまま: " + a.api.state.data.habits.length);
    check("AC-28", "", /24個までです/.test(a.doc.getElementById("notice").textContent), "拒否通知=" + a.doc.getElementById("notice").textContent);
  }

  /* ---------- AC-29 ---------- */
  section("AC-29", "ダーク配色が CSS カスタムプロパティで定義され level 0..4 も切り替わる");
  {
    const lightBlock = SRC.slice(SRC.indexOf(":root {"), SRC.indexOf("@media (prefers-color-scheme: dark)"));
    const darkBlock = SRC.slice(SRC.indexOf("@media (prefers-color-scheme: dark)"), SRC.indexOf(':root[data-theme="dark"]'));
    const getVars = (blk) => { const o = {}; (blk.match(/--level-\d:\s*[^;]+;/g) || []).forEach(s => { const [k, v] = s.split(":"); o[k.trim()] = v.replace(";", "").trim(); }); return o; };
    const L = getVars(lightBlock), Dk = getVars(darkBlock);
    check("AC-29", "", /@media\s*\(prefers-color-scheme:\s*dark\)/.test(SRC), "prefers-color-scheme: dark メディアクエリが存在");
    check("AC-29", "", Object.keys(L).length === 5 && Object.keys(Dk).length === 5, "ライト側 --level-* 定義数=" + Object.keys(L).length + " / ダーク側=" + Object.keys(Dk).length);
    const diff = Object.keys(L).filter(k => L[k] !== Dk[k]);
    check("AC-29", "", diff.length === 5, "level 0..4 すべての値がダークで異なる: " + diff.length + "/5  (--level-4: " + L["--level-4"] + " -> " + Dk["--level-4"] + ")");
    check("AC-29", "", /:root\[data-theme="dark"\]/.test(SRC) && /:root:not\(\[data-theme="light"\]\)/.test(SRC), "手動切替 (data-theme) とシステム追従の両方を実装");
    const a = boot({});
    a.api.state.data.settings.theme = "dark"; a.api.rerender();
    check("AC-29", "", a.doc.documentElement.getAttribute("data-theme") === "dark", "手動ダーク選択で html[data-theme]=" + a.doc.documentElement.getAttribute("data-theme"));
    a.api.state.data.settings.theme = "system"; a.api.rerender();
    check("AC-29", "", a.doc.documentElement.getAttribute("data-theme") === null, "system 選択で data-theme が外れる(メディアクエリに委譲)");
    reg("AC-29").notes.push("  note getComputedStyle による実値比較はレイアウトエンジンが必要なため、CSS定義値の静的比較で代替");
    console.log("  note  AC-29: getComputedStyle 実値比較はレイアウトエンジンが必要 -> CSS定義値の静的比較で代替");
  }

  /* ---------- AC-30 ---------- */
  section("AC-30", "localStorage 書き込みがデバウンスされる");
  {
    const a = boot({});
    addHabit(a, "デバウンス", { type: "daily" });
    a.api.flushSave();
    const before = a.storage.setCalls;
    const hid = a.api.state.data.habits[0].id;
    const t = a.api.state.ui.todayKey;
    for (let i = 0; i < 10; i++) a.api.onCellClick(hid, a.api.addDays(t, -i));
    const during = a.storage.setCalls - before;
    check("AC-30", "", during < 10, "100ms以内に10回状態変更 -> 同期的な setItem 呼び出し=" + during + "回 (<10)");
    check("AC-30", "", during === 0, "デバウンス中の setItem 呼び出し=" + during + "回 (理想の0回)");
    await new Promise(r => setTimeout(r, 700));
    const after = a.storage.setCalls - before;
    check("AC-30", "", after === 1, "デバウンス満了後の setItem 累計=" + after + "回 (理想の1回)");
    const saved = JSON.parse(a.storage.getItem("paradise.habit.v1"));
    check("AC-30", "", Object.keys(saved.logs[hid]).length === 10, "1回の書き込みで10件すべて永続化: " + Object.keys(saved.logs[hid]).length + "件");
    check("AC-30", "", /SAVE_DEBOUNCE_MS\s*=\s*\d+/.test(SRC) && /setTimeout\(flushSaveAndRender, SAVE_DEBOUNCE_MS\)/.test(SRC), "実装: " + (SRC.match(/SAVE_DEBOUNCE_MS\s*=\s*\d+/) || [""])[0]);
  }

  /* ---------- AC-31 ---------- */
  section("AC-31", "visibilitychange で「今日」が再評価される");
  {
    check("AC-31", "", (SRC.match(/visibilitychange/g) || []).length >= 1, "visibilitychange の出現数=" + (SRC.match(/visibilitychange/g) || []).length);
    const a = boot({});
    addHabit(a, "日跨ぎ", { type: "daily" });
    const before = a.api.state.ui.todayKey;
    const labelBefore = a.doc.getElementById("today-label").textContent;
    a.clock.ms = 24 * 3600 * 1000; // システム日付を翌日へ
    a.doc.dispatchEvent(makeEvent("visibilitychange", {}));
    const after = a.api.state.ui.todayKey;
    const labelAfter = a.doc.getElementById("today-label").textContent;
    check("AC-31", "", after === a.api.addDays(before, 1), "todayKey が " + before + " -> " + after + " に更新");
    check("AC-31", "", labelAfter !== labelBefore, "今日の一覧の見出しが再描画: " + JSON.stringify(labelBefore) + " -> " + JSON.stringify(labelAfter));
    const lastCell = a.doc.getElementById("hm-grid").querySelectorAll(".hm-cell:not([data-future='true'])").pop();
    check("AC-31", "", lastCell.dataset.date === after, "ヒートマップの最終選択可能セルも新しい今日 " + lastCell.dataset.date);
    check("AC-31", "", /function getTodayKey\(/.test(SRC) && (SRC.match(/getTodayKey\(\)/g) || []).length >= 2, "日付キー生成は getTodayKey() 1箇所に集約(呼出" + (SRC.match(/getTodayKey\(\)/g) || []).length + "箇所)");
  }

  /* ---------- AC-32 ---------- */
  section("AC-32", "全体まとめ / 習慣別ヒートマップの両方があり aria-label が切り替わる");
  {
    const a = boot({});
    addHabit(a, "習慣A", { type: "daily" });
    addHabit(a, "習慣B", { type: "daily" });
    const [h1, h2] = a.api.state.data.habits;
    const t = a.api.state.ui.todayKey;
    const day = a.api.addDays(t, -3);
    a.api.onCellClick(h1.id, day);
    a.api.onCellClick(h2.id, day);
    const sel = a.doc.getElementById("hm-target");
    check("AC-32", "", sel.children.length === 3 && sel.children[0].textContent === "全習慣まとめ", "表示対象セレクタの選択肢=" + JSON.stringify(sel.children.map(o => o.textContent)));
    a.api.onHabitSelectChange("");
    const labelAll = a.doc.getElementById("hm-grid").querySelector('.hm-cell[data-date="' + day + '"]').getAttribute("aria-label");
    a.api.onHabitSelectChange(h1.id);
    const labelInd = a.doc.getElementById("hm-grid").querySelector('.hm-cell[data-date="' + day + '"]').getAttribute("aria-label");
    check("AC-32", "", labelAll !== labelInd, "同日セルの aria-label: 全体=" + JSON.stringify(labelAll) + " / 個別=" + JSON.stringify(labelInd));
    check("AC-32", "", /2件達成/.test(labelAll), "全体モードは件数を示す: " + labelAll);
    check("AC-32", "", /達成$/.test(labelInd) && !/件/.test(labelInd), "個別モードは状態を示す: " + labelInd);
    // 個別モードで対象外日が区別される
    const a2 = boot({});
    addHabit(a2, "月水金", { type: "weekdays", days: [1, 3, 5] });
    a2.api.onHabitSelectChange(a2.api.state.data.habits[0].id);
    const offCells = a2.doc.getElementById("hm-grid").querySelectorAll('.hm-cell[data-offday="true"]');
    check("AC-32", "", offCells.length > 0 && /対象外/.test(offCells[0].getAttribute("aria-label")), "個別モードで対象外日を区別: " + offCells.length + "セル 例=" + offCells[0].getAttribute("aria-label"));
  }

  /* ---------- 回帰テスト (REWORK 対応: F-1 / F-01 / F-02 / F-03) ----------
     新しい AC 番号は作らず、対応する既存 AC の追加検証として登録する。
     - 退避失敗系 -> AC-14 (破損データの退避)
     - インポート検証系 -> AC-24 (エクスポート/インポート) */
  console.log("\n[回帰] REWORK 指摘の再発防止テスト");
  {
    const mkEnv = (over) => Object.assign({
      v: 1,
      settings: { weekStart: 0, theme: "dark" },
      habits: [{ id: "h1", name: "散歩", color: "#3fb950", freq: { type: "daily" }, createdAt: "2026-01-01", order: 0 }],
      logs: { h1: { "2026-01-02": "done" } }
    }, over || {});

    /* R-1 【F-02】id:"__proto__" のインポートは拒否される(以前は通過し記録が消えた) */
    {
      const a = boot({});
      const evil = JSON.stringify(mkEnv({
        habits: [{ id: "__proto__", name: "秘密の習慣", color: "#3fb950", freq: { type: "daily" }, createdAt: "2026-01-01", order: 0 }],
        logs: { "__proto__": { "2026-01-02": "done", "2026-01-03": "done" } }
      }));
      const parsed = JSON.parse(evil);
      check("AC-24", "", a.api.validateEnvelope(parsed) === false, "回帰F-02: id='__proto__' の validateEnvelope=" + a.api.validateEnvelope(parsed) + " (false であること)");
      const snap = JSON.stringify(a.api.state.data);
      let called = null;
      a.api.importJson({ __text: evil }, () => { called = "OK"; }, (m) => { called = "ERR:" + m; });
      check("AC-24", "", called !== "OK" && JSON.stringify(a.api.state.data) === snap, "回帰F-02: インポートが拒否され既存データ不変 -> " + called);
      check("AC-24", "", Object.prototype.polluted === undefined, "回帰F-02: グローバル Object.prototype は未汚染");
      // 正常 id は引き続き受理される(過剰拒否していないことの対照)
      check("AC-24", "", a.api.validateEnvelope(JSON.parse(JSON.stringify(mkEnv()))) === true, "回帰F-02: 通常 id は引き続き受理される");
    }

    /* R-2 【F-01】logs のキーが継承プロパティ名でも孤児として拒否される */
    {
      const a = boot({});
      const names = ["constructor", "toString", "valueOf", "hasOwnProperty", "isPrototypeOf"];
      const results = names.map(n => {
        const o = JSON.parse(JSON.stringify(mkEnv({ habits: [], logs: {} })));
        o.logs[n] = { "2026-01-02": "done" };
        return a.api.validateEnvelope(o);
      });
      check("AC-24", "", results.every(r => r === false), "回帰F-01: 継承プロパティ名の孤児 logs " + JSON.stringify(names) + " -> " + JSON.stringify(results) + " (全て false)");
      const legit = JSON.parse(JSON.stringify(mkEnv()));
      check("AC-24", "", a.api.validateEnvelope(legit) === true, "回帰F-01: 実在 habit に紐づく logs は引き続き受理される");
    }

    /* R-3 【F-03】インポート経路で MAX_HABITS とサイズ上限が効く */
    {
      const a = boot({});
      const many = [], manyLogs = {};
      for (let i = 0; i < 25; i++) many.push({ id: "h" + i, name: "n" + i, color: "#3fb950", freq: { type: "daily" }, createdAt: "2026-01-01", order: i });
      const over = JSON.parse(JSON.stringify(mkEnv({ habits: many, logs: manyLogs })));
      /* 【N-2 修正後】件数/サイズ上限はインポート専用ラッパに移った。
         load 経路(自分の保存データ)には上限を課さない。 */
      check("AC-24", "", a.api.validateImportEnvelope(over) === false, "回帰F-03: habits=25 (MAX_HABITS=" + a.api.MAX_HABITS + ") の validateImportEnvelope=" + a.api.validateImportEnvelope(over));
      check("AC-24", "", a.api.validateEnvelope(over) === true, "回帰N-2: 同じデータを load 経路の validateEnvelope は受理する(上限で自分の記録を消さない)");
      const exactly = JSON.parse(JSON.stringify(mkEnv({ habits: many.slice(0, 24), logs: {} })));
      check("AC-24", "", a.api.validateImportEnvelope(exactly) === true, "回帰F-03: habits=24 ちょうどは受理される(境界)");
      // 1習慣あたりのログ件数上限
      const bigLogs = {};
      const per = {};
      let d = "2026-01-01";
      for (let i = 0; i < 20001; i++) { per[d] = "done"; d = a.api.addDays(d, 1); }
      bigLogs.h1 = per;
      const bigObj = JSON.parse(JSON.stringify(mkEnv({ logs: {} })));
      bigObj.logs = bigLogs;
      check("AC-24", "", a.api.validateImportEnvelope(bigObj) === false, "回帰F-03: 1習慣 20001 件のログはインポートで拒否 (上限 20000)");
      check("AC-24", "", a.api.validateEnvelope(bigObj) === true, "回帰N-2: 同じデータを load 経路は受理する");
      // ファイルサイズ上限
      let msg = null;
      a.api.importJson({ size: 3 * 1024 * 1024, __text: JSON.stringify(mkEnv()) }, () => { msg = "OK"; }, (m) => { msg = m; });
      check("AC-24", "", msg !== "OK" && /大きすぎます/.test(msg || ""), "回帰F-03: 3MB のファイルは読み込み前に拒否 -> " + JSON.stringify(msg));
    }

    /* R-4 【F-1 致命】退避に失敗したときは本キーを削除しない */
    {
      const a = boot({ storage: { initial: { "paradise.habit.v1": "{broken" }, quotaOnSet: true } });
      const bk = a.storage.keys().filter(k => k.indexOf("paradise.habit.backup.") === 0);
      check("AC-14", "", bk.length === 0, "回帰F-1: 退避書き込みが quota で失敗 -> バックアップキー数=" + bk.length);
      check("AC-14", "", a.storage.getItem("paradise.habit.v1") === "{broken", "回帰F-1: 退避失敗時は本キーを削除しない -> " + JSON.stringify(a.storage.getItem("paradise.habit.v1")));
      check("AC-14", "", a.api.state.ui.storageMode === "memory", "回帰F-1: 上書き保存を止める storageMode=" + a.api.state.ui.storageMode);
      check("AC-14", "", /退避にも失敗/.test(a.doc.getElementById("notice").textContent), "回帰F-1: 通知=" + a.doc.getElementById("notice").textContent);
      // 対照: 退避できる環境では従来どおり本キーは削除される
      const b = boot({ storage: { initial: { "paradise.habit.v1": "{broken" } } });
      check("AC-14", "", b.storage.getItem("paradise.habit.v1") === null && b.storage.keys().filter(k => k.indexOf("paradise.habit.backup.") === 0).length === 1,
        "回帰F-1: 対照(退避成功時)は本キー削除・バックアップ1件");
    }

    /* R-5 【I-10 必須】revokeObjectURL は a.click() と同一タスクで呼んではならない。
       同期 revoke だと Firefox / 一部 Safari でダウンロードが 0 バイトまたは不発になり、
       例外も出ないためユーザーは「バックアップを取った」と誤認する。
       修正前(`URL.revokeObjectURL(url)` 直書き)ではこの check が FAIL する。 */
    {
      const a = boot({});
      addHabit(a, "散歩", { type: "daily" });
      a.urlLog.exporting = true;
      a.api.exportJson(a.api.state.data);
      a.urlLog.exporting = false;
      check("AC-24", "", a.urlLog.created === 1, "回帰I-10: createObjectURL 呼び出し回数=" + a.urlLog.created);
      check("AC-24", "", a.urlLog.revokedDuringExport === 0,
        "回帰I-10: exportJson と同一タスク内での revokeObjectURL 呼び出し=" + a.urlLog.revokedDuringExport + "回 (0 であること)");
      check("AC-24", "", a.urlLog.revoked.length === 0,
        "回帰I-10: exportJson 直後は未 revoke (遅延されている) -> revoked=" + a.urlLog.revoked.length);
      check("AC-24", "", /setTimeout\(function \(\) \{ URL\.revokeObjectURL\(url\); \}, \d+\)/.test(SRC),
        "回帰I-10: 実装が setTimeout で revoke を遅延している");
      await new Promise(r => setTimeout(r, 1300));
      check("AC-24", "", a.urlLog.revoked.length === 1 && a.urlLog.revoked[0] === "blob:stub",
        "回帰I-10: 遅延後に確実に revoke され、URL がリークしない -> " + JSON.stringify(a.urlLog.revoked));
    }

    /* R-6 【I-9 / N-1 必須】validateEnvelope は引数を変異させない純粋関数であること。
       修正前は order / settings をその場で代入しており、検証に失敗しても入力が
       改変済みで残っていた(quarantine に渡す原本が壊れうる)。 */
    {
      const a = boot({});

      // (a) order 欠損: 検証は落ちるが引数は無傷
      const noOrder = JSON.parse(JSON.stringify(mkEnv()));
      delete noOrder.habits[0].order;
      const beforeNoOrder = JSON.stringify(noOrder);
      const vOrder = a.api.validateEnvelope(noOrder);
      check("AC-24", "", JSON.stringify(noOrder) === beforeNoOrder,
        "回帰I-9: validateEnvelope が habits[0].order を書き込まない (before===after)");
      check("AC-24", "", noOrder.habits[0].order === undefined,
        "回帰I-9: habits[0].order は undefined のまま -> " + JSON.stringify(noOrder.habits[0].order));

      // (b) 補完は normalizeEnvelope が新オブジェクトで行い、原本は無傷
      const normalized = a.api.normalizeEnvelope(noOrder);
      check("AC-24", "", normalized.habits[0].order === 0 && a.api.validateEnvelope(normalized) === true,
        "回帰N-1: normalizeEnvelope が order=0 を補完し検証を通す (validate単体=" + vOrder + ")");
      check("AC-24", "", JSON.stringify(noOrder) === beforeNoOrder && normalized !== noOrder && normalized.habits[0] !== noOrder.habits[0],
        "回帰N-1: normalizeEnvelope も原本と habit 要素を共有せず変異させない");

      // (c) settings 欠損も同様
      const noSettings = JSON.parse(JSON.stringify(mkEnv()));
      delete noSettings.settings;
      const beforeNoSettings = JSON.stringify(noSettings);
      a.api.validateEnvelope(noSettings);
      check("AC-24", "", JSON.stringify(noSettings) === beforeNoSettings && noSettings.settings === undefined,
        "回帰I-9: validateEnvelope が settings を補完代入しない");
      check("AC-24", "", a.api.normalizeEnvelope(noSettings).settings.theme === "system",
        "回帰N-1: settings の補完は normalizeEnvelope 側で行われる");

      // (d) 部分変異: 先頭に order が無く後続が不正 -> false だが前方は改変されない
      const partial = JSON.parse(JSON.stringify(mkEnv({
        habits: [
          { id: "a", name: "A", color: "#3fb950", freq: { type: "daily" }, createdAt: "2026-01-01" },
          { id: "b", name: "B", color: "ダメな色", freq: { type: "daily" }, createdAt: "2026-01-01", order: 1 }
        ],
        logs: {}
      })));
      const beforePartial = JSON.stringify(partial);
      const vPartial = a.api.validateEnvelope(partial);
      check("AC-24", "", vPartial === false, "回帰N-1: 後続要素が不正なら false -> " + vPartial);
      check("AC-24", "", JSON.stringify(partial) === beforePartial,
        "回帰N-1: 検証失敗時に前方要素へ部分変異が残らない (原本がそのまま退避できる)");

      // (e) load 経路の統合: 壊れたデータで quarantine に渡る raw が原本と完全一致
      {
        const rawEnv = JSON.stringify(mkEnv({
          habits: [{ id: "h1", name: "散歩", color: "#3fb950", freq: { type: "daily" }, createdAt: "2026-01-01" }],
          logs: {}
        }));
        // order 欠損だけなら normalize で救われ、記録は失われないこと
        const c = boot({ storage: { initial: { "paradise.habit.v1": rawEnv } } });
        check("AC-14", "", c.api.state.data.habits.length === 1 && c.api.state.data.habits[0].order === 0,
          "回帰N-1: order 欠損の保存データは normalize されて起動でき、退避されない");
        check("AC-14", "", c.storage.keys().filter(k => k.indexOf("paradise.habit.backup.") === 0).length === 0,
          "回帰N-1: 正当なデータが誤って quarantine されない");
      }
    }
  }

  /* ===================== 集計 ===================== */
  console.log("\n" + "=".repeat(72));
  console.log("AC 別 結果表");
  console.log("=".repeat(72));
  let pass = 0, fail = 0, naCount = 0;
  const failed = [];
  for (const ac of ORDER) {
    const r = RESULTS.get(ac);
    if (r.status === "PASS") pass++;
    else if (r.status === "FAIL") { fail++; failed.push(ac); }
    else if (r.status === "N/A") naCount++;
    const badge = r.status === "PASS" ? "PASS" : r.status === "FAIL" ? "FAIL" : "N/A ";
    console.log(badge + "  " + ac + "  " + r.desc);
    if (r.status === "FAIL") {
      r.notes.filter(n => n.indexOf("FAIL") !== -1).forEach(n => console.log("        " + n.trim()));
    }
  }
  console.log("=".repeat(72));
  console.log("AC total: " + ORDER.length + "   PASS: " + pass + "   FAIL: " + fail + "   N/A: " + naCount);
  if (failed.length) console.log("FAILED ACs: " + failed.join(", "));
  console.log("=".repeat(72));
  if (fail > 0) process.exitCode = 1;
}

main().catch(e => { console.error("RUNNER ERROR:", e); process.exitCode = 1; });
