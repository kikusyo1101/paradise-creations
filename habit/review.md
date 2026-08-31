# 習慣トラッカー `app.html` — 3度目の再レビュー (priest / code-reviewer / attempt 4)

- **対象**: `creations/habit/app.html` (68,541 bytes / 2,059 行 / 単一 HTML・依存ゼロ)
- **前回 (attempt 3)**: 修正済 4 / 部分的 2 / 未修正 15 + 新規 N-1〜N-5 → **REQUEST_CHANGES**(必須 2 件: I-10 / N-1)
- **今回の方法**: 司祭の主張を**一切信用せず**、全指摘を実コードで 1 件ずつ grep + 行照合。加えて domain 層を Node で切り出し、`quantileThresholds`/`levelOf` の 20,000 回ファズ、`normalizeEnvelope` の純度実測、I-11 の実測ベンチを実施。
- **作成日**: 2026-08-31

---

## 0. 全指摘の判定表(【解消 / 残存】)

### 前回「マージ前に必須」とした 2 件

| ID | 内容 | 判定 | 検証根拠(現行行番号) |
|---|---|---|---|
| **I-10** | `revokeObjectURL` の同期実行によるエクスポート無言失敗 | ✅ **解消** | L1213-1216 |
| **I-9 / N-1** | `validateEnvelope` が引数を変異 | ✅ **解消** | L858-894(normalize) / L896-954(validate) / 呼出 L1143-1144, L1255-1256 |

### 前回「未修正」15 件

| ID | 内容 | 判定 | 検証根拠 |
|---|---|---|---|
| I-1 残件 | `t[3]` が死に値・3 要素化されていない | ✅ **解消** | L744-778(3 要素返却) |
| I-4 | render 層が state を書き換える | ✅ **実質解消**(軽微残 R-1) | L1565-1567 / L1576-1597 / L1629-1637 |
| I-5 | store 層が render 層を呼ぶ | ✅ **解消** | L1189-1201 / L2048-2050 |
| I-8 | `role="grid"` に `row` が無い | ✅ **解消** | L481(`role="group"`)/ L1544-1546(`gridcell` 撤去、grep で 0 件) |
| I-11 | 毎 render の全期間ストリーク再走査 | ⏸ **見送り(妥当)** | 実測 21ms / 最悪ケース。§3 参照 |
| M-1 | `dayNumber`/`diffDays` の死にコード | ⏸ **見送り(妥当)** | L568-584。`test.js:17,35,38` / `ac-test.js:318,439` が参照 |
| M-2 | `defaultData(todayKey)` の未使用引数 | ✅ **解消** | L1062-1065、呼出 6 箇所すべて `defaultData()` |
| M-3 | `scheduleSave(data)` の未使用引数 | ✅ **解消** | L1160-1165 / 唯一の呼出 L1647 |
| M-4 | 単調化ループの重複 | ✅ **解消** | L769-776(単一の抑え込み+単調化) |
| M-5 | まとめモードでセルが無反応 | ✅ **解消** | L1554-1559(`aria-disabled="true"`) |
| M-6 | `Home`/`End` がグリッド全体端 | ✅ **解消** | L1690-1709 / L1719-1739(行内移動 + Ctrl で全体端) |
| M-7 | `.row-actions` の死にスタイル | ✅ **解消** | L257-258(削除済コメントのみ、grep で CSS 実体 0 件) |
| M-8 | 空 `logs[habitId] = {}` の残留 | ✅ **解消** | L999-1001(`sortEnvelope` で間引き) |
| M-9 | notice が消えず残り続ける | ✅ **解消** | L1641-1649(`commit` で `notice = null`) |
| I-7 残件 | 検証関数での `order` 補完 | ✅ **解消** | L875-877(normalize 側)/ L928-930(validate は真偽のみ) |

### 前回の新規指摘 N-1〜N-5

| ID | 内容 | 判定 | 検証根拠 |
|---|---|---|---|
| N-1 | 検証失敗時に入力が改変されたまま残る | ✅ **解消** | 実測: `normalizeEnvelope` 適用後も原本の JSON が一致、`orig.habits[0].order === undefined` |
| N-2 | 上限チェックが load 経路にも効きデータを隔離しうる | ✅ **解消** | L896-899(`opts` 化)/ L956-959(`validateImportEnvelope`)/ L1144(load は上限なし) |
| N-3 | 少数習慣ユーザーで level 1 が到達不能 | ✅ **解消** | L754-760(値域フォールバック)。ファズで「最大値は必ず level 4」を 20,000 ケース確認 |
| N-4 | weekly 初週が `createdAt` の曜日で必ず未達 | ✅ **解消** | L649-653 / L671-672(部分週の分岐追加) |
| N-5 | インポート上限がバイト/文字で混同 | ✅ **解消** | L1219-1223(`MAX_IMPORT_BYTES` / `MAX_IMPORT_CHARS` 分離)/ L1227 / L1235 |

**内訳: 解消 20 / 妥当な見送り 2 / 新規ブロッカー 0 / 軽微な新規残件 1 (R-1)**

---

## 1. 必須 2 件の実コード照合

### ✅ I-10 — 解消

```js
1211|  a.click();
1212|  document.body.removeChild(a);
1213|  /* 【I-10 修正】a.click() はダウンロードを非同期に開始する。同一タスク内で
1216|  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
```

推奨どおり。**リーク懸念を確認したが問題なし**: `url` は毎回新規発行され、`setTimeout` は無条件に 1 回だけ発火して必ず revoke される。分岐や early-return で revoke を飛ばす経路は存在しない(`exportJson` L1203-1217 は分岐ゼロの直線コード)。連打しても各 URL が 1 秒後に個別に解放される。

### ✅ I-9 / N-1 — 解消(推奨どおり `normalizeEnvelope` 分離)

```js
858|function normalizeEnvelope(obj) {
860|  var out = {};
861|  var keys = Object.keys(obj);
862|  for (var k = 0; k < keys.length; k++) { out[keys[k]] = obj[keys[k]]; }
...
872|      var nh = {};
874|      for (var j = 0; j < hk.length; j++) { nh[hk[j]] = h[hk[j]]; }
877|      if (nh.order === undefined || nh.order === null) { nh.order = i; }
```

```js
928|    /* 【I-7 / N-1】order は検証のみ。補完は normalizeEnvelope の責務。 */
930|    if (typeof h.order !== "number" || !isFinite(h.order)) { return false; }
```

**主張だけでなく実測で確認した**。domain 層を切り出し、`order` 欠損 + 不正 color を含むエンベロープを `normalizeEnvelope` → `validateEnvelope` に通した結果:

- `validateEnvelope` = `false`(不正 color を正しく弾く)
- **原本の JSON は一切変化なし**(`JSON.stringify(orig) === snap` が真)
- `orig.habits[0].order === undefined`(前回問題視した部分変異が発生していない)
- `nz.habits[0] !== orig.habits[0]`(習慣要素はコピー済み)

呼び出し側も推奨どおり:

```js
1143|    var normalized = normalizeEnvelope(migrated);
1144|    if (!validateEnvelope(normalized)) {
1145|      var qc = quarantine(raw);          // ← raw は完全な原本
```

`quarantine` に渡すのは `raw`(文字列の原本)であり、正規化オブジェクトではない。**F-1 のデータ保全方針と一貫**した。

**分離による新たな欠陥の検査**:
- `out.logs` は浅いコピーで原本と参照を共有する(実測: `nz.logs === orig.logs` は真)。しかし `normalizeEnvelope` は `logs` に一切書き込まないため変異は起きない。共有先の `migrated`/`parsed` は直後に捨てられるスコープ内変数なので、エイリアシング事故の経路は存在しない。
- `state.data = normalized` (L1153) の habits は新オブジェクトなので、`onEditHabit` (L1785) 等の書き込みが原本を汚す経路もない。
- 空/配列/非オブジェクトは L859 で素通し → `validateEnvelope` L900 が弾く。責務の穴なし。

---

## 2. 一括修正 13 件の照合(退行検査つき)

- **I-4**: `renderHeatmap` は `return applyRovingTabindex(...)` (L1567) で決定キーを返すのみ、`applyRovingTabindex` (L1576-1597) は `todayKey` を引数で受け書き戻さない。`render` (L1611-1631) が `return focused`、書き込みは `rerender` (L1633-1637) が担う。前回指摘の `st.ui.selectedHabit = null` は `reconcileUiState` (L1601-1609) として render 直前の正規化ステップに切り出された。
- **I-5**: `flushSave` (L1167-1193) は `return false` を返すだけで render を呼ばない。DOM 更新は `flushSaveAndRender` (L1196-1201) に分離され、`pagehide` は生の `flushSave` を使う (L2050)。**ページ破棄中の DOM 書き込み経路は消えた**。
- **I-8**: L481 が `role="group" aria-label="習慣の記録ヒートマップ"`。`role="gridcell"` は grep で 0 件。嘘の ARIA 構造は解消。ロービングタブインデックスは維持されているのでキーボード操作は不変(AC-32 PASS)。
- **I-1 / M-4 / N-3**: `quantileThresholds` は 3 要素返却になり、単調化ループも 1 本化。**20,000 回のランダムファズで検証**し、(a) 常に `t[0] <= t[1] <= t[2]`、(b) **入力の最大値が必ず level 4**、(c) 非ゼロ値の level が 1〜4 に収まる、をすべて満たすことを確認(違反 0 件)。`max <= 3` の値域フォールバック (L758-760) により「中段に張り付く」症状も消えた。
- **M-8 の退行検査**: `sortEnvelope` (L999-1001) の空 `logs[id]` 間引きは**保存/エクスポート時のみ**適用され、`state.data` は書き換えない。`getState` (L634-639) は `logs[id]` 不在を `not-done` として扱うので、間引き後に読み戻しても挙動は同一。`onCellClick` (L1670) も `if (!data.logs[habitId]) { data.logs[habitId] = {}; }` で再生成する。**データ消失なし**。
- **M-9 の退行検査**: `commit` (L1646) の `state.ui.notice = null` が起動時の破損通知を消す一方、`storageMode = "memory"` の警告は `renderStorageWarning` (L1309-1318) が `state.ui.storageMode` を直接見て別枠で描画するため消えない。**QUARANTINE 失敗時の「上書き保存を止めている」情報は保持される**。
- **M-6 の退行検査**: `rowHomeKey`/`rowEndKey` (L1692-1709) は `while (true)` だが、DOM に隣接セルが無くなった時点で `return` する。グリッドは有限(最大 ~53 週)なので無限ループしない。`rowEndKey` は `:not([data-future='true'])` で未来セルを除外しており、`moveFocusTo` (L1684) の未来ガードと二重に整合。
- **N-5 の退行検査**: `MAX_IMPORT_CHARS = MAX_IMPORT_BYTES / 2` (L1223) は UTF-16 前提の保守的な上限で、日本語 JSON でも過大メモリを確実に止める。正規のエクスポート JSON(2MB 未満)が誤って弾かれる境界も無い。
- **M-2/M-3/M-7**: いずれも grep で残存参照 0 件を確認済。

---

## 3. 見送り 2 件の妥当性(自分で検証)

### ⏸ I-11(ストリーク全期間再走査)— **見送り妥当**

主張は「3650 日で有界・性能のみ」。**鵜呑みにせず実測した**。domain 層を切り出し、10 年ぶん(3,700 日)の logs を持つ習慣で `computeStreak` + `computeDensity` を 24 習慣ぶん(`MAX_HABITS` 上限)実行した最悪ケース:

```
24 habits x 10y worst-case render cost ms = 21
```

**21ms**。1 フレーム(16.7ms)をわずかに超える程度で、しかもこれは「10 年前から毎日記録している 24 習慣」という非現実的な上限値である。実用域(数か月〜1 年、数習慣)では 1ms 未満。`STREAK_SCAN_DAYS = 3650` (L532) により上限は数学的に保証されており、無限に劣化しない。**体感を損なわず、データ破損も機能不全も起こさない**。見送りは妥当。

### ⏸ M-1(`dayNumber`/`diffDays` の死にコード)— **見送り妥当**

主張は「テストの検証オラクルとして使用中」。**grep で裏を取った**:

```
test.js:17   ...addDays,dayOfWeek,diffDays,formatJa,...   ← domain 層から export
test.js:35   eq(D.diffDays("2026-01-01", "2026-01-15"), 14, "diffDays");
test.js:38   for (...) { eq(D.diffDays(k, n), 1, "adj diff " + i); }
ac-test.js:318  "getTodayKey", "addDays", "dayOfWeek", "diffDays", ...
ac-test.js:439  for (let i = 0; i < 800; i++) { ... if (D.diffDays(k, n) !== 1) bad++; ... }
```

`diffDays` は `addDays` の 800 日連鎖が 1 日ずつ正しく進むことを**独立実装で検証する**オラクルとして実際に使われている(`addDays` の自己検証にならない点が重要)。前回「参照 0 件」と判定したのは app.html 内のみを見た誤りで、テスト側を含めれば死にコードではない。**削除するとテストの検証力が落ちる**。見送りは妥当どころか、削除しない方が正しい。

---

## 4. 新規に見つかった残件

### R-1 【軽微・cosmetic】`applyRovingTabindex` にグローバル state のフォールバック読みが 1 行残る

```js
1576|function applyRovingTabindex(gridEl, focusedKey, todayKey) {
1577|  /* 【I-4 修正】グローバル state を読まず、todayKey を引数で受ける。 */
1581|  var tk = todayKey || state.ui.todayKey;
```

コメントは「グローバル state を読まず」と宣言しているが、L1581 に保険のフォールバックが残っている。実際の呼び出しは L1567(`todayKey` を渡す)と L1687(`state.ui.todayKey` を渡す)の 2 箇所のみで、どちらも常に有効な値を渡すため**このフォールバックは到達不能**である。副作用も書き戻しもなく、動作に影響しない。コメントと実装の不一致という**表記上の問題のみ**。

**推奨(後追いで可)**: `var tk = todayKey;` にするか、コメントを「引数優先、未指定時のみ state を見る」に直す。

### R-2 【軽微・cosmetic】`reconcileUiState` は render 層の関数から呼ばれている

`render` (L1612) が `reconcileUiState(st)` を呼び、その中で `st.ui.selectedHabit = null` (L1607) が起きうる。「render は DOM だけ」という design.md §1-2 の字義には厳密には未到達。ただし前回指摘した「描画の途中で state が変わる」構造とは異なり、**描画開始前の単一の正規化ステップ**として明示的に分離されており、可読性・追跡性は大幅に改善している。実害なし。

**推奨(後追いで可)**: `reconcileUiState` の呼び出しを `rerender` (L1634) に移し、`render` の先頭から外す。1 行の移動で design.md と完全に一致する。

---

## 5. テスト実行結果(自分で走らせて確認)

```
$ node test.js      → assertions: 479, passed: 479, failed: 0
$ node ac-test.js   → AC total: 32   PASS: 32   FAIL: 0   N/A: 0
```

司祭の主張(ac-test 32/32、test.js 479/479)は**実行して一致を確認した**。回帰テストが増えている点も `test.js` に normalizeEnvelope 系のケースが追加されていることで裏が取れている(export 一覧 L17 に `normalizeEnvelope` が含まれる)。

---

## 6. 総評

前回「マージ前に必須」とした 2 件は、**いずれも推奨した形そのままで実装されている**。特に I-9/N-1 は、`h.order = i` という 1 行の代入を消すだけの安易な逃げ方ではなく、`normalizeEnvelope`(新オブジェクトを返す純粋関数)と `validateEnvelope`(真偽のみを返す純粋関数)へ責務を分割し、`load` / `import` の両経路を書き換えるという、前回の指摘文が意図したとおりの構造変更で応えている。原本が改変されないことは主張を信じずに実測して確認した。`quarantine(raw)` に渡るのが完全な原本であるという点で、**F-1 で立てた「データ消失を許容しない」原則がファイル全体で一貫**した。

さらに、前回「次のイテレーションで可」と分類していた I-4 / I-5 / I-8 と M-2〜M-9 まで踏み込んで解消しており、レイヤ違反(store→render、render→state)と嘘の ARIA 構造という、指摘の中でも設計の根に近い部分が片付いた。`flushSave` を `flushSaveAndRender` から分離して `pagehide` だけ生の方を使う (L2050) という判断は、指摘の趣旨を正確に理解した上での実装である。

見送り 2 件は**どちらも主張を検証した結果、妥当**と判断した。I-11 は最悪ケース実測 21ms で `STREAK_SCAN_DAYS` により上限が保証されており、M-1 は前回の「参照 0 件」判定が**こちらの調査漏れ**で、実際にはテストの独立オラクルとして機能している。前回の指摘の方が誤っていたので、ここで撤回する。

一括修正 13 件については、退行の可能性が高い箇所(`sortEnvelope` の空 logs 間引き、`commit` の notice クリア、`rowHomeKey`/`rowEndKey` のループ終了条件、`normalizeEnvelope` の浅いコピーによるエイリアシング、`setTimeout` revoke のリーク)を個別に検査したが、**データ破損・機能不全・セキュリティに直結する欠陥は 1 件も見つからなかった**。`quantileThresholds` は 20,000 回のファズで不変条件を確認している。

残る R-1 / R-2 はいずれも**到達不能なフォールバック 1 行**と**関数の呼び出し位置**という表記・整理上の問題で、動作にも保存データにも一切影響しない。これを理由に出荷を止める根拠はない。

### 判定: **APPROVE**

- ブロッカー(データ破損・機能不全・セキュリティ): **0 件**
- 前回の必須 2 件: **両方とも推奨どおり解消**(実測で裏付け済)
- 前回の未修正 15 件: **13 件解消 / 2 件は検証の結果、見送りが妥当**
- 新規指摘 N-1〜N-5: **5 件すべて解消**
- 残件: R-1 / R-2 の cosmetic 2 件のみ。**後追いで可、出荷を妨げない**

出荷を承認する。R-1 / R-2 は次の任意の変更のついでに直せば十分である。
