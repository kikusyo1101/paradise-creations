# セキュリティレビュー報告書(再スキャン / attempt 3) — 習慣トラッカー

| 項目 | 内容 |
|---|---|
| 対象ファイル | `creations/habit/app.html` |
| 行数 / サイズ | 1,895 行 / 58,755 bytes(前回 1,817 行 / 54,789 bytes) |
| SHA-256 | `20ac04b56bb4879d68ea4053747593299dfa00fbc4df98714fb3c1ca0174fdf8`(前回 `75eec75e…`) |
| レビュー日 | 2026-08-31 |
| 担当 | priest (security-reviewer) / Paradise |
| 種別 | **再スキャン(attempt 3)** — 前回 PASS_WITH_NOTES で指摘した Medium 3件の修正検証 |
| 手法 | 実装の主張を信じず、**攻撃ペイロードを作成して Node.js で検証関数を実起動**。加えて jsdom による実 DOM E2E、grep による機械検査 |
| 検証スクリプト | `_sec_attack3.js`(境界・型・プロトタイプ攻撃 78 ケース)/ `_sec_attack3b.js`(誤検出切り分け + `importJson` 実起動)/ `_sec_e2e3.js`(jsdom E2E) |

---

## 総合判定

### **PASS_WITH_NOTES**

**前回指摘の Medium 3件は、実際に攻撃を通して塞がったことを確認しました。** 主張の追認ではなく、拒否リストの抜け・大文字小文字・前後空白・Unicode・深い入れ子・数値キー・型混入を含む攻撃を新規に作成して実行し、いずれも設計意図どおりに拒否または無害化されることを実測しています。

XSS・外部通信・コード実行は再スキャンでも **0 件**。プロトタイプ汚染も **グローバル・ローカルの双方で不成立**を実証しました。

一方、**F-03 は「部分的に修正済」と判定します。** 上限そのものは正しく機能しますが、上限内で構築可能な最悪ケース(24習慣 × 3,800日 = 91,200件、保存 1.74MB)が localStorage クォータの約 35% を消費できることを実測しました。また前回 Low で指摘した F-04(CSP)/ F-06(バックアップ世代管理)/ F-05 の一部(`createdAt` の暦妥当性)は未着手です。

**リスクはゼロではありません。** §7 の残存リスクを必ずお読みください。

---

## 前回指摘の修正判定表

| # | 前回指摘 | 重大度 | 判定 | 根拠 |
|---|---|---|---|---|
| **F-01** | 継承プロパティ名の孤児ログが検証通過 | Medium | **【修正済】** | §2-2 攻撃 10 種すべて `false` |
| **F-02** | `id:"__proto__"` でのサイレントなデータ消失 | Medium | **【修正済】** | §2-1 拒否 + 二重防御を実測 |
| **F-03** | インポートに件数/サイズ上限なし | Medium | **【部分的】** | §2-3 上限は機能。上限内の最悪ケースが残存 |
| F-04 | CSP 未適用 | Low | **【未修正】** | §5 grep で `<meta>` は 2 件のみ |
| F-05 | `order` / 重複 `id` / 不正 `createdAt` の未検証 | Low | **【部分的】** | `order`・重複 `id` は修正済。暦妥当性は未修正(§3-4) |
| F-06 | 隔離バックアップの無制限増殖 | Low | **【部分的】** | 世代管理は未実装。ただし退避失敗時の挙動は改善(§6) |
| F-07 | localStorage キーの衝突可能性 | Info | 受容可(変更なし) | — |

---

## 1. 修正コードの所在確認(grep 実行結果)

```
$ grep -n "FORBIDDEN_IDS\|MAX_HABITS\|MAX_LOG\|MAX_IMPORT\|Object.create(null)\|hasOwnProperty" app.html
530:var MAX_HABITS = 24;
820:var FORBIDDEN_IDS = ["__proto__", "constructor", "prototype"];
826:  return Object.prototype.hasOwnProperty.call(obj, key);
834:  if (obj.habits.length > MAX_HABITS) { return false; }
837:  var ids = Object.create(null);
842:    if (FORBIDDEN_IDS.indexOf(h.id) !== -1) { return false; }
872:    /* 【F-01】hasOwnProperty 経由で孤児判定する */
873:    if (!hasOwn(ids, logKeys[a])) { return false; }
878:    if (dates.length > MAX_LOG_DAYS_PER_HABIT) { return false; }
930:  var logs = Object.create(null);
935:    var np = Object.create(null);
1131:var MAX_IMPORT_BYTES = 2 * 1024 * 1024;
1135:  if (file && typeof file.size === "number" && file.size > MAX_IMPORT_BYTES) {
1143:    if (text.length > MAX_IMPORT_BYTES) {
```

主張された修正はすべて実在します。以下、**実際に動くかを攻撃で確かめます。**

---

## 2. Medium 3件の攻撃検証

DOMAIN ブロック(424 行)を Node.js の `vm` に切り出し、検証関数を実起動しました。

```
DOMAIN LOC: 424 | MAX_HABITS=24 | FORBIDDEN_IDS=["__proto__","constructor","prototype"] | MAX_LOG_DAYS_PER_HABIT=20000
```

### 2-1. F-02(`__proto__` id によるデータ消失)— 【重大度: Medium → 修正済】

**基本攻撃(3種すべて拒否):**

```
########## X-1: F-02 __proto__ 系 id 攻撃 ##########
  [OK]   habit id='__proto__' -> false (期待 false)
  [OK]   habit id='constructor' -> false (期待 false)
  [OK]   habit id='prototype' -> false (期待 false)
```

**拒否リストの抜けを攻める(本再スキャンの主眼):**

`FORBIDDEN_IDS` は 3 要素の単純な文字列一致です。大文字化・空白・NUL 付加・類似名で回避できないかを 20 パターン投入し、**通過した場合に本当に害が出るか**まで追跡しました。

```
-- 拒否リストの抜けを攻める(大文字/前後空白/類似名/Unicode) --
  id="__PROTO__"                validate=true   logs own keys=1 kept proto=clean
  id="__Proto__"                validate=true   logs own keys=1 kept proto=clean
  id="__proto__ "               validate=true   logs own keys=1 kept proto=clean
  id=" __proto__"               validate=true   logs own keys=1 kept proto=clean
  id="__proto__\u0000"          validate=true   logs own keys=1 kept proto=clean
  id="Constructor"              validate=true   logs own keys=1 kept proto=clean
  id="PROTOTYPE"                validate=true   logs own keys=1 kept proto=clean
  id="__defineGetter__"         validate=true   logs own keys=1 kept proto=clean
  id="__defineSetter__"         validate=true   logs own keys=1 kept proto=clean
  id="__lookupGetter__"         validate=true   logs own keys=1 kept proto=clean
  id="__proto__"                validate=false  ← 拒否
  id="toString"                 validate=true   logs own keys=1 kept proto=clean
  id="valueOf"                  validate=true   logs own keys=1 kept proto=clean
  id="hasOwnProperty"           validate=true   logs own keys=1 kept proto=clean
  id="isPrototypeOf"            validate=true   logs own keys=1 kept proto=clean
  id="propertyIsEnumerable"     validate=true   logs own keys=1 kept proto=clean
  id="toLocaleString"           validate=true   logs own keys=1 kept proto=clean
  id="0"                        validate=true   logs own keys=1 kept proto=clean
  id="1e3"                      validate=true   logs own keys=1 kept proto=clean
  id="-0"                       validate=true   logs own keys=1 kept proto=clean
```

**この結果の読み方が重要です。** `__PROTO__` や `toString` は検証を通過します(`validate=true`)。しかし追跡した結果、**`logs own keys=1` / `kept` / `proto=clean`** — すなわち記録は 1 件保持され、消失せず、プロトタイプ汚染も発生していません。往復シリアライズ後もキー数は一致しました(`ROUNDTRIP-LOSS` の検出 0 件)。

理由は `sortEnvelope`(930/935行)の `logs = Object.create(null)` です。プロトタイプを持たないオブジェクトへの代入は、**キー名が何であれ常に own プロパティを作ります**。`__proto__` すら特別扱いされません。

```js
930:  var logs = Object.create(null);
935:    var np = Object.create(null);
937:    logs[hids[i]] = np;
```

つまり本修正は **二重防御(defense in depth)** になっています:

1. `FORBIDDEN_IDS` による入口での拒否(第一線)
2. `Object.create(null)` による代入セマンティクスの無害化(**実質的な本命の防御**)

`FORBIDDEN_IDS` が大文字小文字を区別する点は「リストの抜け」ですが、**第二の防御が全ケースを吸収するため実害はありません。** リストは冗長な保険として機能しています。

**保存往復の実測(F-02 の本丸):**

```
########## X-5: 保存往復の完全性 ##########
  validate=true
  保存文字列={"v":1,"settings":{"weekStart":0,"theme":"dark"},"habits":[…],"logs":{"h1":{"2026-01-02":"done"},"h2":{"2026-01-03":"skip"}}}
  [OK]   往復後 logs キー数 -> 2 (期待 2)
  [OK]   往復後 logs.h1["2026-01-02"] -> "done" (期待 "done")
  logs の prototype = null (安全)
```

前回は `"logs":{}` となり記録 2 件が消失していました。**今回は 2 件とも保存されています。データ消失は解消されました。**

### 2-2. F-01(継承プロパティ名の孤児ログ)— 【重大度: Medium → 修正済】

`Object.prototype` から継承されるあらゆる名前を孤児ログのキーとして投入しました。

```
########## X-2: F-01 孤児ログ攻撃 ##########
  [OK]   孤児 logs key='constructor' -> false (期待 false)
  [OK]   孤児 logs key='toString' -> false (期待 false)
  [OK]   孤児 logs key='valueOf' -> false (期待 false)
  [OK]   孤児 logs key='hasOwnProperty' -> false (期待 false)
  [OK]   孤児 logs key='isPrototypeOf' -> false (期待 false)
  [OK]   孤児 logs key='propertyIsEnumerable' -> false (期待 false)
  [OK]   孤児 logs key='toLocaleString' -> false (期待 false)
  [OK]   孤児 logs key='__defineGetter__' -> false (期待 false)
  [OK]   孤児 logs key='__proto__' -> false (期待 false)
  [OK]   孤児 logs key='zzz' -> false (期待 false)
```

前回 `constructor` / `toString` / `valueOf` / `hasOwnProperty` は **すべて `true` で素通り**していました。**10/10 で拒否に転じています。**

特筆すべきは、`hasOwn` が `Object.prototype.hasOwnProperty.call(...)` という**シャドウイング耐性のある形**で書かれている点です(826行)。`ids.hasOwnProperty(...)` と書いていれば、`ids` が `Object.create(null)` である以上 `TypeError` でクラッシュしていました。正しい実装です。

**logs 内側の日付キーへの攻撃:**

```
-- logs 内側の日付キーに継承名/__proto__ --
  logs.h1['constructor'] -> false
  logs.h1['toString']    -> false
  logs.h1['2026-01-02']  -> true   ← 正常系
```

`__proto__` については、JS リテラル記法では代入自体が無視されるため測定が成立しません。**実インポートと同じ `JSON.parse` 経由で再測定**しました:

```
=== Y-1: 切り分け(logs.h1["__proto__"]) ===
  JS リテラル代入 per["__proto__"]="done" → own keys = []  (キーが作られない=空の per)
  JSON.parse 経由 per own keys = ["__proto__","2026-01-02"]
  validateEnvelope(実インポートと同じ経路) -> false  ← 正しく拒否
```

初回テストで `true` と出たのは **テストハーネス側の記述に起因する誤検出**であり、実経路では正しく拒否されます(`isDateKey("__proto__")` が `false` を返すため)。

**プロトタイプ汚染の最終確認:**

```
-- logs の値に __proto__ 注入 --
  [OK]   per に __proto__ own key -> false (期待 false)
  グローバル Object.prototype.polluted = 汚染なし(undefined)

-- 4e: settings 汚染 --
  settings に __proto__ own key -> true
    → sortEnvelope で weekStart/theme のみ抽出。Object.prototype.x = 汚染なし
```

`settings` に `__proto__` を含む JSON は検証を通過しますが、`sortEnvelope`(941行)が `{ weekStart, theme }` のみを明示的にコピーするホワイトリスト方式のため、**汚染は伝播しません。**

### 2-3. F-03(件数・サイズ上限)— 【重大度: Medium → 部分的に修正済】

**件数上限は正しく機能します:**

```
########## X-3: F-03 件数・サイズ上限攻撃 ##########
  [OK]   habits.length=24 -> true (期待 true)
  [OK]   habits.length=25 -> false (期待 false)
  [OK]   habits.length=100 -> false (期待 false)
  [OK]   habits.length=500 -> false (期待 false)   ← 前回は true(素通り)
  [OK]   habits.length=5000 -> false (期待 false)
  [OK]   1習慣あたり logs 20000日 (3ms) -> true (期待 true)
  [OK]   1習慣あたり logs 20001日 (1ms) -> false (期待 false)  ← 境界値が正確
  [OK]   1習慣あたり logs 50000日 (7ms) -> false (期待 false)
```

**`importJson` の 2MB ガードを実起動して検証**(`FileReader` をスタブ化し、実際の非同期経路を通しました):

```
=== Y-4: importJson の 2MB ガード実起動 ===
  [0] 正常 JSON (size 小)                  -> onOk 呼出(受理)
  [1] file.size = 3MB (メタデータ経路)      -> onErr: ファイルが大きすぎます(2MBまで)。既存のデータは変更していません。
  [2] file.size 偽装(0)+本文 3MB (内容長)  -> onErr: ファイルが大きすぎます(2MBまで)。…
  [3] file.size 未定義 + 本文 3MB           -> onErr: ファイルが大きすぎます(2MBまで)。…
  [4] 壊れた JSON                           -> onErr: JSON として解析できませんでした。…
  [5] habits 25個                           -> onErr: データ形式が不正です。…
  [6] id=__proto__                          -> onErr: データ形式が不正です。…
  [7] v=999 (未来バージョン)                -> onErr: バージョンを解釈できませんでした。…
  → 拒否時はいずれも onOk 未呼出 = 既存データ不変(アトミック性維持)
```

**`file.size` の偽装に対して二重にチェックしている点が優れています。** `file.size` は攻撃者が制御しうるメタデータですが、1143 行で `reader.result` の実際の長さも検査するため、サイズ偽装では迂回できません(ケース [2][3])。

**しかし、上限内の最悪ケースが残ります — ここが「部分的」と判定する理由です:**

```
-- 上限の積み上げ: 24習慣 x 20000日 = 480,000件 --
  validate=true 73ms  JSONサイズ=9.16MB  (importJson 上限 2MB を超過→インポート不可)

=== Y-3: 2MB 制限内で構築可能な最悪ケース(実際にインポート可能)===
  24習慣 x 3800日 = 91,200件, 入力 1.74MB (2MB以内)
  validate=true 11ms / sortEnvelope 9ms / 保存文字列 1.74MB
  → localStorage 5MB クォータに対し 35% を消費
```

`MAX_LOG_DAYS_PER_HABIT = 20000` は単独では緩すぎ(24習慣分で 9.16MB)ですが、**実効的な上限は 2MB のファイルサイズ制限**が担っています。その 2MB 制限内でも 91,200 件・保存 1.74MB(クォータの 35%)が受理されます。

**影響:** 前回の「無制限」から「クォータの約 35%」へ大幅に縮小されました。処理時間も 11ms と実用範囲で、ハングは発生しません。残るのは自傷的な容量圧迫のみで、コード実行・情報漏洩には至りません。**Medium → Low へ格下げします。**

---

## 3. 新規検証コード自体への攻撃

修正で入ったコードが新たな穴を作っていないかを攻めました。

### 3-1. 重複 id・`order` の型検証 — 【重大度: Info】良好

```
-- 4a: 重複 id --
  [OK]   重複 id (h1,h1) -> false (期待 false)   ← 前回は true

-- 4b: order 型攻撃 --
  [OK]   order=undefined  -> true   (添字で補完)
  [OK]   order=null       -> true   (添字で補完)
  [OK]   order=0 / -1 / 1e+308 -> true (有限数)
  [OK]   order=Infinity   -> false
  [OK]   order=-Infinity  -> false
  [OK]   order=NaN        -> false
  [OK]   order="1" (文字列) -> false
  [OK]   order={} / [1] / true -> false
```

`isFinite` を使うことで `NaN` / `Infinity` を確実に排除しており、`sortedHabits` の比較が `NaN` になる経路(ソート結果が不定になる ECMAScript 未定義動作)が塞がれています。前回 F-05 で指摘した `order` は**修正済**です。

### 3-2. 型混入・構造攻撃 — 【重大度: Info】良好

```
-- 4c: habits/logs の細工 --
  [OK]   habits が Array-like オブジェクト -> false
  [OK]   logs が配列       -> false
  [OK]   logs.h1 が配列    -> false
  [OK]   logs.h1 が文字列  -> false
  [OK]   logs.h1 が null   -> false

-- 4d: habits 要素の細工 --
  [OK]   habit が null        -> false
  habit が配列 `[[]]`         -> false  (id が string でないため)
  [OK]   habit が文字列       -> false
  [OK]   id が空文字          -> false
  [OK]   id が数値            -> false
```

`Array.isArray` によるチェックが `obj` / `habits` / `logs` / 各 `per` の 4 箇所すべてに入っており、配列を使った型混同攻撃は成立しません。

### 3-3. 深い入れ子・巨大構造 — 【重大度: Low】一部残存

```
-- 4f: 深い入れ子 / 巨大構造 --
  freq 5万段ネスト -> validate=true 0ms (クラッシュせず)
  20万段ネスト JSON.parse -> parsed (importJson の try/catch が捕捉する経路)
  freq.days 20万要素 -> validate=true 1ms 【上限なし=残存】
```

- 深い入れ子は `validateEnvelope` が再帰しない(`freq.type` のみを見る)ため、**スタックオーバーフローは発生しません。** 0ms で処理されました。
- `freq.days` の要素数に上限がありません。ただし 20 万要素でも 1ms で、`indexOf` は 0–6 の 7 値しか探さないため実害は軽微です。**【残存: Low】**

### 3-4. `isDateKey` の暦妥当性 — 【重大度: Low】未修正

```
-- 4g: isDateKey の暦妥当性 --
  isDateKey("2026-01-01")   -> true
  isDateKey("2026-13-45")   -> true   ← 13月45日が通過
  isDateKey("2026-02-30")   -> true   ← 2月30日が通過
  isDateKey("0000-00-00")   -> true
  isDateKey("9999-12-31")   -> true
  isDateKey("2026-1-1")     -> false  (桁数不足は正しく拒否)
  isDateKey("２０２６-０１-０１") -> false  (全角は正しく拒否)
```

前回 F-05 で指摘した暦妥当性は **未修正**です。`/^\d{4}-\d{2}-\d{2}$/` の書式検査のみです。全角数字が拒否されるのは `\d` が ASCII のみに一致するためで、正しい挙動です。

**影響:** 存在しない日付の記録がヒートマップに表示されない、統計に反映されないなどの表示不整合。セキュリティ境界の突破には至りません。

### 3-5. `validateEnvelope` の入力ミューテーション — 【重大度: Low】設計上の注意(新規指摘)

```
-- 4h: 入力ミューテーション(副作用)--
  before: {"v":1,"habits":[{…"createdAt":"2026-01-01"}],"logs":{}}
  after : {"v":1,"habits":[{…"createdAt":"2026-01-01","order":0}],"logs":{},"settings":{"weekStart":0,"theme":"system"}}
```

`validateEnvelope` は名前に反して**引数オブジェクトを書き換えます**(861–862行の `order` 補完、886–891行の `settings` 補完)。検証が途中で `false` を返した場合も、それ以前の要素への書き込みは残ります。

**現状で実害はありません。** `importJson` は `false` のとき `onOk` を呼ばず、変更されたオブジェクトは捨てられるためです。ただし将来「検証失敗したオブジェクトを再利用する」コードが加わると、部分的に書き換わったデータを扱うことになります。

**推奨:** 関数名を `validateAndNormalizeEnvelope` にするか、正規化を別関数へ分離。

---

## 4. XSS 経路の再検査 — 【重大度: Info】0 件を再確認

### 4-1. 危険シンクの grep(実行結果)

```
$ grep -n -E "innerHTML|outerHTML|insertAdjacentHTML|document\.write|[^a-zA-Z.]eval\(|new Function|setTimeout\(\s*[\"'\`]|setInterval\(\s*[\"'\`]|createContextualFragment|srcdoc|dangerouslySet" app.html
(exit=1 : 0 hits)
```

件数の内訳:

```
innerHTML              0        textContent            24
outerHTML              0        createElement          24
insertAdjacentHTML     0        setAttribute            5
document.write         0        appendChild            24
new Function           0
srcdoc                 0
eval(                  0
```

**行数が 78 行増えたにもかかわらず、危険シンクは 0 件を維持しています。** 修正によるリグレッションはありません。

### 4-2. jsdom による実 DOM E2E(修正後 app.html を実起動)

```
=== E1: XSS 実行フラグ(すべて undefined なら未実行)===
  __XSS1: undefined | __XSS2: undefined | __XSS3: undefined | __XSS4: undefined

=== E2: 注入要素の有無 ===
  script 要素数(期待 1): 1
  img 要素数(期待 0): 0
  onerror/onmouseover 属性を持つ要素数(期待 0): 0

=== E3: 習慣名の描画形態 ===
  描画行数: 4
  [0] childNodes types=[3] (3のみ=テキストノード)
      outerHTML = <span class="row-name">&lt;img src=x onerror=window.__XSS1=1&gt;</span>
  [1] childNodes types=[3]
      outerHTML = <span class="row-name">&lt;/span&gt;&lt;script&gt;window.__XSS2=1&lt;/script&gt;</span>
  [2] childNodes types=[3]
      outerHTML = <span class="row-name">" onmouseover="window.__XSS3=1</span>
  [3] childNodes types=[3]
      outerHTML = <span class="row-name">javascript:window.__XSS4=1</span>

=== E4: Object.prototype 汚染 ===
  ({}).polluted = undefined | w.Object.prototype.polluted = undefined

=== E6: 保存 JSON に logs が保持されているか(F-02 リグレッション確認)===
  habits=4 logs keys=["h1"]

=== E7: dot の style 属性 ===
  --accent: #3fb950; | --accent: #ff0000; | --accent: #0000ff; | --accent: #00ff00;

=== E8: a[href] ===
  a 要素数: 0 | javascript: を値に持つ属性数: 0
```

4 種の XSS ペイロードはすべて **単一テキストノード(nodeType=3)** として描画され、JavaScript は実行されませんでした。E6 で **記録が保存 JSON に保持されている**(前回は消失していた)ことも E2E レベルで確認しています。E8 の `javascript:` 属性は前回「あり」でしたが、判定ロジックを属性値の実検査に厳密化した結果 **0 件**であることを確定しました。

---

## 5. 外部通信・URL・CSP の再検査

```
$ grep -n -E "fetch\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|importScripts|<script[^>]+src|<link[^>]+href|@import|url\(\s*http|https?://|//[a-z0-9-]+\.(com|net|org|io|jp)" app.html
(exit=1 : 0 hits)

$ grep -c "<script" app.html
1

$ grep -n -E "\.href\s*=|location\.|window\.open|\.src\s*=|createObjectURL|javascript:" app.html
1121:  var url = URL.createObjectURL(blob);
1123:  a.href = url;
```

**外部通信 0 件を再確認しました。** `href` への代入は `blob:` URL のみで、利用者入力の流入経路はありません。

### F-04: CSP 未適用 — 【重大度: Low】未修正

```
$ grep -n -E "<meta|Content-Security-Policy|sandbox|integrity=" app.html
4:<meta charset="utf-8">
5:<meta name="viewport" content="width=device-width, initial-scale=1">
```

CSP は未導入です。§4 で XSS 0 件を実証済みのため現状のリスクは低いですが、多層防御として `connect-src 'none'; img-src 'none'` だけでも先行導入する価値があります(現状の挙動を一切変えずに適用可能で、外部通信ゼロをブラウザに強制させられます)。

---

## 6. localStorage とバックアップ

```
$ grep -n -E "localStorage|sessionStorage|document\.cookie|indexedDB" app.html
956:    var ls = window.localStorage;
968:    return window.localStorage.getItem(key);
976:    window.localStorage.setItem(key, value);
988:    window.localStorage.removeItem(key);
```

`document.cookie` / `sessionStorage` / `indexedDB` は 0 件。E2E での保存内容は `paradise.habit.v1` の 1 キーのみ(624 bytes)。認証情報・端末識別子の類は保存されていません。

### F-06: バックアップの世代管理 — 【重大度: Low】未修正(ただし別途改善あり)

```
$ grep -n "BACKUP_KEY_PREFIX" app.html
951:var BACKUP_KEY_PREFIX = "paradise.habit.backup.";
1022:  var res = safeSet(BACKUP_KEY_PREFIX + Date.now(), raw);
```

古いバックアップを削除するコードは依然ありません。**ただし `quarantine` 自体には重要な改善が入っています**(1017–1028行):

```js
function quarantine(raw) {
  if (typeof raw !== "string") { safeRemove(STORAGE_KEY); return true; }
  var res = safeSet(BACKUP_KEY_PREFIX + Date.now(), raw);
  if (!res || !res.ok) { return false; }   // ← 退避に失敗したら元データを消さない
  safeRemove(STORAGE_KEY);
  return true;
}
```

前回は退避の成否にかかわらず `STORAGE_KEY` を削除していました。現在は **退避失敗時に元データを保持し `false` を返す**ため、クォータ枯渇時に全記録を失う経路が塞がれています。これは前回指摘していなかった箇所の自主的な改善であり、評価できます。

---

## 7. 残存リスクと受容理由

**本レビューはリスクがゼロであることを主張しません。**

### R-1: 実ブラウザでの検証は未実施 — 残存

検証は Node.js(`vm` による DOMAIN 層の直接起動)と jsdom に依存します。Chrome / Firefox / Safari の実機での実行検証は行っていません。使用 API が `createElement` / `textContent` / `setAttribute` / `style.setProperty` という基本的なものに限られるため乖離の余地は小さいと判断しますが、**保証はできません。**

### R-2: `FORBIDDEN_IDS` は大文字小文字を区別する — 受容

§2-1 のとおり `__PROTO__` / `toString` 等は入口を通過します。**現状は `Object.create(null)` が全ケースを吸収するため無害**ですが、**将来 `sortEnvelope` の `Object.create(null)` を `{}` に戻すと、F-02 が即座に再発します。** この 2 行(930/935行)を変更禁止として扱ってください。同様に、色の正規表現(845/1763行)も唯一の CSS インジェクション防御線です。

### R-3: 上限内での容量圧迫 — 受容(Low)

§2-3 のとおり、2MB 以内の JSON で 91,200 件・保存 1.74MB(クォータの 35%)を押し込めます。自傷的であり他者への強制はできません。より厳格にするなら「総ログ件数 50,000 件」といった横断的上限が有効です。

### R-4: 利用者自身によるインポートが起点 — 受容

すべてのインポート系リスクは「利用者が悪意ある JSON を自ら選択する」ことを前提とします。帰結は自データの容量圧迫に留まり、**データ消失(前回の F-02)は解消済み**であることを実証しました。

### R-5: 同一オリジンの他スクリプト・ブラウザ拡張・物理アクセス — 受容不可避

localStorage は同一オリジンの任意スクリプトと拡張機能から読み書き可能で、平文保存です。アプリ側で防ぐ手段はありません。習慣名に機微な内容(通院・服薬等)を入力した場合はプライバシー情報になりえます。

### R-6: 手法上の限界

SAST ツール(Semgrep / CodeQL)は未使用。攻撃ケースは 78 件で網羅的ではありません。本評価は SHA-256 `20ac04b5…` の 1 時点のスナップショットに対するものであり、**形式的な安全性証明ではありません。**

---

## 8. 残る推奨事項(優先順)

| 優先 | 対象 | 内容 | 見積 |
|---|---|---|---|
| 1 | F-05 残 (Low) | `isDateKey` に暦妥当性検査(`localDateKey(new Date(y,m-1,d)) === key`)を追加 | 数行 |
| 2 | F-06 (Low) | `quarantine` でバックアップを最新 3 件に世代管理 | 十数行 |
| 3 | F-03 残 (Low) | 総ログ件数の横断上限(例 50,000 件)、`freq.days` の要素数上限 | 数行 |
| 4 | F-04 (Low) | `connect-src 'none'; img-src 'none'` から段階的に CSP 導入 | 数行 |
| 5 | 新規 (Low) | `validateEnvelope` の副作用を分離、または名前を実態に合わせる | 十数行 |
| — | 変更禁止 | 930/935行 `Object.create(null)`、845/1763行 色の正規表現、826行 `hasOwn` | — |

---

## 付録: 実行した検証の一覧

| # | 目的 | 手法 | 結果 |
|---|---|---|---|
| X-1 | F-02 `__proto__` 系 id 攻撃(23 パターン) | `vm` で DOMAIN 層を実起動 | 3/3 拒否、残りは無害化を実測 |
| X-2 | F-01 孤児ログ攻撃(14 パターン) | 同上 | 14/14 拒否 |
| X-3 | F-03 件数・サイズ上限(11 パターン) | 同上 | 境界値まで正確に動作 |
| X-4 | 新規検証コードへの攻撃(30 パターン) | 同上 | 重複 id / order は修正済、暦は未修正 |
| X-5 | 保存往復の完全性 | 同上 | データ消失なし |
| Y-1/Y-2 | 初回 FAIL 2 件の切り分け | `JSON.parse` 経由で再測定 | いずれもハーネス側の誤検出と確定 |
| Y-3 | 2MB 制限内の最悪ケース構築 | 同上 | 91,200 件 / 1.74MB が受理 |
| Y-4 | `importJson` の実起動(8 ケース) | `FileReader` スタブ | 全ガードが機能、アトミック性維持 |
| E1–E8 | 実 DOM での XSS 実行検証 | jsdom (`runScripts:"dangerously"`) | XSS 実行 0 件 |
| grep [1]–[7] | シンク / 通信 / CSP / ストレージ | `grep -n -E` / `grep -c` | 危険シンク 0 件、外部通信 0 件 |

検証スクリプトは同ディレクトリに残置しています(`_sec_attack3.js` / `_sec_attack3b.js` / `_sec_e2e3.js`、および前回分の `_sec_probe*.js` / `_sec_e2e.js`)。`node_modules/`(jsdom)も監査用の一時成果物であり、アプリ本体とは無関係です。再現後は削除して差し支えありません。

---

## 最終判定: **PASS_WITH_NOTES**

- **Medium 3件のうち F-01・F-02 は完全に塞がりました。** 攻撃を実際に流し込んで拒否・無害化を確認しています。特に F-02 は `FORBIDDEN_IDS` と `Object.create(null)` の二重防御となっており、リストの抜け(大文字小文字)があっても実害が出ない構造です。
- **F-03 は「部分的」です。** 上限は正しく機能し前回の「無制限」から大幅に改善しましたが、2MB 以内で 91,200 件・クォータ 35% の消費が残ります。**Medium → Low へ格下げします。**
- **Medium 以上の未修正指摘は 0 件**となりました。残るのは Low 4件(F-03 残 / F-04 / F-05 残 / F-06)と新規 Low 1件です。
- XSS・外部通信・コード実行・プロトタイプ汚染はいずれも実測で 0 件です。

`PASS` ではなく `PASS_WITH_NOTES` とする理由は、(a) Low の未修正が 5 件残ること、(b) 実ブラウザでの検証が未実施であること(R-1)、(c) F-02 の防御が `Object.create(null)` という 2 行に依存しており将来のリグレッション余地があること(R-2)の 3 点です。**リスクはゼロではなく、§7 の残存リスクを受容したうえでの判定です。**
