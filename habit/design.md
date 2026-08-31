# 習慣トラッカー — design フェーズ 基本設計書 (design.md)

- **成果物**: 単一 HTML ファイル `index.html`(依存ゼロ・ビルド不要・オフライン動作・localStorage 永続化)
- **担当**: priest (設計)
- **作成日**: 2026-08-31
- **唯一の根拠**: `requirements.md`(specify フェーズ)。本書のすべての設計判断は FR-01〜FR-27 / NFR-01〜NFR-08 / AC-01〜AC-32 に紐づく。requirements.md に無い機能は設計しない。
- **本書のスコープ**: 設計まで。実装コード(実際に動く JS/CSS 本体)は本書には書かない。関数シグネチャと擬似コードのみを示す。

---

## 1. アーキテクチャ方針

### 1-1. 全体構造

NFR-02(単一ファイル)/ NFR-01(依存ゼロ)により、成果物は次の1ファイルのみ。

```
index.html
├── <head>
│   └── <style>            … CSS カスタムプロパティ、レイアウト、ヒートマップ Grid、テーマ
├── <body>
│   ├── <header>           … タイトル / 設定ボタン / テーマ切替
│   ├── <main>
│   │   ├── #storage-warning  … FR-18 の警告バナー(既定は hidden)
│   │   ├── #today-section    … 今日の一覧(FR-03)
│   │   ├── #empty-state      … 空状態(FR-25)
│   │   ├── #heatmap-section  … 対象セレクタ + ヒートマップ(FR-08/10)
│   │   └── #settings-section … 週開始曜日 / エクスポート / インポート
│   └── <div id="tooltip">   … 単一の使い回しツールチップ(FR-13)
└── <script>                … 以下の4レイヤ
```

### 1-2. `<script>` 内のレイヤ分割(4層 + 一方向データフロー)

NFR-06「単一 state → `render()` の一方向」を設計の中核に据える。レイヤは下から上へ一方向にのみ依存する(上位が下位を呼ぶ。下位は上位を知らない)。

| レイヤ | 責務 | 依存先 | 純粋性 |
|---|---|---|---|
| **store** | localStorage の安全な読み書き、スキーマ検証、マイグレーション、デバウンス、メモリフォールバック | なし(ブラウザ API のみ) | 副作用あり(I/O) |
| **domain** | 日付演算、頻度判定、ストリーク、密度、ヒートマップ level 算出 | なし | **純粋関数のみ**(引数だけで結果が決まる。`new Date()` を内部で呼ばない — `todayKey` は必ず引数で受ける) |
| **render** | state → DOM。全描画は `render()` を頂点とする関数群 | domain | 副作用は DOM のみ |
| **event** | ユーザー操作 → `mutate()` → `store.save()` + `render()` | store, domain, render | 副作用あり |

```
[ユーザー操作] → event層 → mutate(state) ─┬→ store.scheduleSave(state)   (デバウンス, FR-20)
                                          └→ render(state)               (全描画, NFR-06)
```

**設計原則**
1. **state は単一のオブジェクト**。部分更新の最適化はしない(NFR-06 / findings §6-3「365 セル規模では不要」)。
2. **domain 層は純粋**。これによりストリーク・level・巻き戻しをブラウザ無しで机上検証でき、AC-03/05/06/19/20 の検証コストが下がる。
3. **`new Date()` の呼び出し箇所は `getTodayKey()` ただ1つ**(FR-26 / AC-31)。他のすべての関数は日付キー文字列を受け取る。
4. **DOM 生成は `document.createElement` + `textContent`**。`innerHTML` に外部由来文字列(習慣名・インポート JSON)を渡さない(NFR-07)。

### 1-3. state の形(メモリ上)

```js
state = {
  data:      <永続化エンベロープ 本体>,   // §2 参照。これだけが保存対象
  ui: {                                   // 保存しない揮発状態
    todayKey:      "YYYY-MM-DD",          // FR-26 で再評価される
    selectedHabit: null | "<habitId>",    // null = 全習慣まとめ (FR-10)
    focusedCell:   "YYYY-MM-DD" | null,   // roving tabindex のフォーカス位置 (FR-23)
    storageMode:   "persistent" | "memory",// FR-18
    notice:        null | { kind, text }  // quota 超過などの一時通知
  }
}
```

---

## 2. データモデル(localStorage JSON スキーマ)

### 2-1. キー設計

| キー | 用途 | 根拠 |
|---|---|---|
| `paradise.habit.v1` | アプリデータの**唯一の**保存キー(バージョン付きエンベロープ) | FR-19 / AC-16(アプリ由来キーは1つのみ) |
| `paradise.habit.backup.<epochms>` | `JSON.parse` 失敗時に破損した**生文字列**を退避 | FR-17 / NFR-07 / AC-14(バックアップキーは AC-16 の計数対象外) |

キー名はハードコードせず定数 `STORAGE_KEY` / `BACKUP_KEY_PREFIX` として1箇所に置く。

### 2-2. エンベロープ JSON スキーマ

```jsonc
{
  "v": 1,                          // 数値。スキーマバージョン (FR-19 / AC-16)
  "settings": {
    "weekStart": 0,                // 0=日曜, 1=月曜 (FR-14)
    "theme": "system"              // "system" | "light" | "dark" (FR-22)
  },
  "habits": [
    {
      "id": "h_1756600000000_4f2a", // 生成: "h_" + Date.now() + "_" + 4桁ランダム。衝突回避のみが目的
      "name": "朝の散歩",            // 1〜40文字。必須 (FR-01)
      "color": "#3fb950",           // 6桁 HEX。必須 (FR-01)
      "freq": {                     // FR-05
        "type": "daily",            // "daily" | "weekdays" | "weekly"
        "days": [1,3,5],            // type==="weekdays" のときのみ有効。0=日..6=土
        "times": 3                  // type==="weekly" のときのみ有効。1..7
      },
      "createdAt": "2026-08-31",    // ローカル日付キー。これ以前はストリーク探索を打ち切る
      "order": 0                    // 表示順(初版では追加順固定。並べ替え UI は非スコープ)
    }
  ],
  "logs": {
    "h_1756600000000_4f2a": {       // habitId → 日付キー → 状態
      "2026-08-29": "done",
      "2026-08-30": "skip"
    }
  }
}
```

### 2-3. 3状態の表現(FR-04)

| 状態 | logs 上の表現 | 意味 |
|---|---|---|
| `done` | `"done"` | 達成 |
| `skip` | `"skip"` | 病気・旅行等による免除。ストリークを断絶させず、密度の分母から除外 |
| `not-done` | **キーが存在しない**(欠損) | 未達成 |

`not-done` を欠損で表す理由:
- 保存サイズが最小になる(NFR-04。習慣10個×10年でも数百KB以内に収まる根拠を維持)。
- 「明示的に未達成にした」と「まだ触っていない」を区別する要件が requirements.md に無い。
- トグルで `not-done` に戻す操作は `delete logs[habitId][dateKey]` で表現する(AC-23 の3クリック巡回が元に戻ることの保証)。

### 2-4. 日付キーの規約(FR-27 / AC-01, AC-02)

- 日付キーは **ローカル日付の `"YYYY-MM-DD"` 文字列**が唯一の真実。
- `Date` オブジェクト、UTC ISO 文字列、エポックミリ秒を**保存しない**。
- 例外: バックアップキー名の `<epochms>` のみ数値を使うが、これは localStorage のキー名であってデータ内容ではない。
- 正規表現 `/^\d{4}-\d{2}-\d{2}$/` をスキーマ検証にも使う(インポート時・読み込み時の両方)。

### 2-5. 検証スキーマ(インポート・読み込み共用)

`validateEnvelope(obj)` が真を返す条件:

1. `obj` がオブジェクトで `typeof obj.v === "number"`
2. `Array.isArray(obj.habits)`、各要素が `id`(非空文字列)・`name`(1〜40文字)・`color`(`/^#[0-9a-fA-F]{6}$/`)・`freq.type ∈ {daily, weekdays, weekly}` を持つ
3. `obj.logs` がプレーンオブジェクト。各キーが `habits[].id` のいずれかに一致し、各日付キーが `/^\d{4}-\d{2}-\d{2}$/`、各値が `"done" | "skip"`
4. `obj.settings.weekStart ∈ {0,1}`、`obj.settings.theme ∈ {system,light,dark}`(欠損時は既定値で補完)

検証は**全か無か**。1つでも壊れていればインポートを中止し、既存データを一切変更しない(AC-24 後段 / NFR-07)。

---

## 3. 主要モジュールと関数シグネチャ一覧

各関数が満たす FR / AC を明記する。

### 3-1. domain 層 — 日付ユーティリティ(純粋)

| シグネチャ | 概要 | 満たす FR / AC |
|---|---|---|
| `localDateKey(d: Date) -> string` | `d.getFullYear()` / `getMonth()+1` / `getDate()` をゼロ埋め連結して `"YYYY-MM-DD"` を返す。**`toISOString` を一切使わない**。日付キー生成はこの関数だけ | FR-26, FR-27 / **AC-01, AC-02** |
| `getTodayKey() -> string` | `localDateKey(new Date())` を返す。アプリ内で `new Date()` を引数なしで呼ぶ唯一の場所 | FR-26 / **AC-03, AC-31** |
| `parseKey(key: string) -> {y,m,d}` | `"YYYY-MM-DD"` を数値3つに分解(月は1始まりのまま保持) | FR-27 |
| `addDays(key: string, n: number) -> string` | `const {y,m,d} = parseKey(key); return localDateKey(new Date(y, m-1, d + n))`。**ミリ秒加算を使わない** | FR-27 / **AC-04** |
| `dayOfWeek(key: string) -> 0..6` | `new Date(y, m-1, d).getDay()`(0=日) | FR-14, FR-27 |
| `diffDays(a: string, b: string) -> number` | 両端を `new Date(y,m-1,d)` で正午(12:00)基準に構築して差分日数を求める。正午基準にすることで DST の ±1h が日数境界を跨がない | FR-27 / AC-04 |
| `weekdayLabel(key, weekStart) -> string` | `"月曜日"` などの日本語曜日名 | FR-23 / **AC-11** |
| `formatJa(key) -> string` | `"2026年1月15日"` | FR-23 / **AC-11** |
| `rowIndexOf(key, weekStart) -> 0..6` | `(dayOfWeek(key) - weekStart + 7) % 7`。ヒートマップの行位置 | FR-14 / **AC-05** |
| `rollbackToWeekStart(key, weekStart) -> string` | `addDays(key, -rowIndexOf(key, weekStart))` | FR-15 / **AC-06** |

### 3-2. domain 層 — 頻度・ストリーク・密度(純粋)

| シグネチャ | 概要 | 満たす FR / AC |
|---|---|---|
| `isTargetDay(habit, dateKey) -> boolean` | `daily`→常に true / `weekdays`→`freq.days.includes(dayOfWeek(dateKey))` / `weekly`→常に true(週単位で判定するため日単位では対象扱い) | FR-05 / **AC-19** |
| `getState(logs, habitId, dateKey) -> "done"\|"skip"\|"not-done"` | 欠損を `"not-done"` に正規化 | FR-04 |
| `computeStreak(habit, logs, todayKey) -> {current, longest}` | §4-1 の擬似コード。現在ストリークと最長ストリークを1回の走査で返す | FR-06 / **AC-19, AC-20, AC-21** |
| `computeWeeklyStreak(habit, logs, todayKey) -> {current, longest}` | `freq.type === "weekly"` 専用。週単位で `done 件数 >= times` を満たす連続週数 | FR-05, FR-06 / AC-19 |
| `computeDensity(habit, logs, todayKey, window=30) -> {done, denom, pct}` | §4-2。skip と非対象日を分母から除外 | FR-07 / **AC-20, AC-21** |
| `dailyCount(habits, logs, dateKey) -> number` | その日に `done` の習慣数(全習慣まとめヒートマップ用) | FR-10 / AC-32 |
| `quantileThresholds(counts: number[]) -> [t1,t2,t3,t4]` | §4-3。非ゼロカウントの分位点。線形正規化を使わない | FR-09 / **AC-08** |
| `heatmapLevels(cells, mode, thresholds) -> Map<dateKey, 0..4>` | §4-3。全体モードは分位点、個別モードは固定マッピング。返す値は必ず整数 0〜4 | FR-09 / **AC-07, AC-08, AC-09** |
| `buildDateRange(endKey, weekStart, days=364) -> string[]` | 巻き戻し済み開始日から `endKey` までの日付キー配列。**必ず7の倍数長**になる | FR-15 / **AC-06** |

### 3-3. store 層

| シグネチャ | 概要 | 満たす FR / AC |
|---|---|---|
| `storageAvailable(type="localStorage") -> boolean` | MDN の feature detection パターン。テスト用キーの `setItem`→`removeItem` を try/catch し、quota 0 の空ストレージ(Safari private)も false 判定する | FR-17, FR-18 / **AC-13** |
| `safeGet(key) -> string \| null` | `localStorage.getItem(key)` を try/catch。**プロパティアクセスを使わない** | FR-17 / **AC-15** |
| `safeSet(key, value) -> {ok: boolean, error?: string}` | `localStorage.setItem` を try/catch。`QuotaExceededError` / `NS_ERROR_DOM_QUOTA_REACHED` を名前とコードの両方で判定 | FR-17, NFR-04 / **AC-13, AC-15** |
| `safeRemove(key) -> void` | `removeItem` の try/catch ラッパ | FR-17 / AC-15 |
| `loadState() -> {data, mode}` | 読み込み → `JSON.parse` の `SyntaxError` 捕捉 → 破損時は `BACKUP_KEY_PREFIX + Date.now()` へ**生文字列のまま退避してから**既定値で起動 | FR-17, FR-19, NFR-07 / **AC-14, AC-16** |
| `migrate(obj) -> obj` | `obj.v` を見て順次変換。初版は `v===1` を素通しし、未知の `v` は「新しすぎる」として読み込み拒否+退避 | FR-19 / **AC-16** |
| `scheduleSave(data) -> void` | デバウンス(400ms、`setTimeout`/`clearTimeout`)。`visibilitychange`(hidden)と `pagehide` で即時 flush | FR-20, NFR-06 / **AC-30** |
| `flushSave() -> void` | 保留中のタイマをキャンセルして即時書き込み | FR-20 / AC-30 |
| `exportJson(data) -> void` | `JSON.stringify` → `Blob` → `URL.createObjectURL` → 一時 `<a download>` クリック → `revokeObjectURL` | FR-21 / **AC-24** |
| `importJson(file, onOk, onErr) -> void` | `FileReader.readAsText` → `JSON.parse` → `validateEnvelope` → `migrate`。失敗時は `onErr` のみ呼び、state を触らない | FR-21, NFR-07 / **AC-24** |
| `validateEnvelope(obj) -> boolean` | §2-5 の検証 | FR-21, NFR-07 / AC-24 |

**メモリフォールバック**: `storageAvailable()` が false、または `safeSet` が3回連続で失敗した場合、`state.ui.storageMode = "memory"` に落とし、以後の `scheduleSave` は no-op(メモリ上の `state.data` のみ正)になる。警告バナーを表示する(FR-18 / AC-13)。

### 3-4. render 層

| シグネチャ | 概要 | 満たす FR / AC |
|---|---|---|
| `render(state) -> void` | 描画のエントリポイント。以下をすべて呼ぶ | NFR-06 |
| `renderStorageWarning(state)` | `storageMode === "memory"` のとき「この変更はこのセッションでのみ保持されます」を表示 | FR-18 / **AC-13** |
| `renderEmptyState(state)` | `habits.length === 0` のとき目的説明+「まずは1〜3個から」案内を表示し、ヒートマップ節を隠す | FR-25 / **AC-27** |
| `renderTodayList(state)` | 今日の対象習慣を行として描画。行全体が1つの `<button>`。現在/最長ストリークと直近30日密度を同一行に併置 | FR-03, FR-06, FR-07 / **AC-21, AC-22** |
| `renderHabitLimitHint(state)` | `habits.length > 6` で注意ヒントを表示 | FR-02 / **AC-28** |
| `renderHeatmap(state)` | §5 の DOM 構造を生成。`buildDateRange` → `heatmapLevels` → セル生成 | FR-08〜FR-12, FR-15, FR-24 / **AC-05〜AC-11, AC-25, AC-32** |
| `cellAriaLabel(dateKey, mode, info) -> string` | 「2026年1月15日木曜日、3件達成」/「2026年1月15日木曜日、スキップ」等。年月日+曜日名+状態の3要素を必ず含む | FR-23 / **AC-11** |
| `applyRovingTabindex(gridEl, focusedKey)` | グリッド内で `tabindex="0"` を**ちょうど1つ**にする | FR-23 / **AC-12** |
| `showTooltip(cellEl, text)` / `hideTooltip()` | 単一の `#tooltip` を使い回し、位置を `getBoundingClientRect` で決める | FR-13 / **AC-26** |
| `applyTheme(theme)` | `<html data-theme>` を切り替える。`system` のときは属性を外して `prefers-color-scheme` に委ねる | FR-22 / **AC-29** |

### 3-5. event 層

| シグネチャ | 概要 | 満たす FR / AC |
|---|---|---|
| `commit(mutator) -> void` | `mutator(state.data)` を実行 → `scheduleSave` → `render`。**すべての状態変更はこの1関数を通す** | FR-16, FR-20 / AC-30 |
| `onTodayRowClick(habitId)` | `done ⇄ not-done` のトグル。モーダル・確認を挟まない | FR-03 / **AC-22** |
| `onCellClick(habitId, dateKey)` | `done → skip → not-done` の巡回。未来日は早期 return | FR-11, FR-12 / **AC-10, AC-23** |
| `onGridKeydown(e)` | `←→` = ±1日、`↑↓` = ∓1日(同一列内の上下移動 = 前後1日)、`Home/End` = 行頭/行末。フォーカス移動 + roving tabindex 更新 | FR-23 / **AC-12** |
| `onAddHabit(name, color, freq)` | 24個超は拒否して警告 | FR-01, FR-02 / **AC-28** |
| `onEditHabit(id, patch)` / `onDeleteHabit(id)` | 削除は `confirm` 相当の確認を挟み、`logs[id]` も削除 | FR-01 |
| `onWeekStartChange(v)` | `settings.weekStart` を更新 → 再描画 | FR-14 / **AC-05, AC-06** |
| `onVisibilityChange()` | `document.visibilityState === "visible"` のとき `getTodayKey()` を再評価し、変化していれば `state.ui.todayKey` を更新して再描画。hidden のときは `flushSave()` | FR-26 / **AC-31** |
| `onHabitSelectChange(id\|null)` | 全体/個別ヒートマップの切替 | FR-10 / **AC-32** |

---

## 4. アルゴリズム(擬似コード・境界条件込み)

### 4-1. ストリーク `computeStreak(habit, logs, todayKey)`

**方針**: 習慣の `createdAt` から `todayKey` まで**昇順に1回だけ**走査し、`longest` を更新しつつ、末尾側の連続を `current` として取り出す。逆順走査を2回するより境界条件が少ない。

```
function computeStreak(habit, logs, todayKey):
    if habit.freq.type == "weekly":
        return computeWeeklyStreak(habit, logs, todayKey)

    start = max(habit.createdAt, todayKey - 3650日)   # 上限10年でガード(NFR-06)
    if start > todayKey: return { current: 0, longest: 0 }

    run = 0; longest = 0; current = 0
    d = start
    while d <= todayKey:
        if not isTargetDay(habit, d):
            # 対象外日はストリークを断絶させない。カウントもしない (FR-05 / AC-19)
            d = addDays(d, 1); continue

        s = getState(logs, habit.id, d)
        if s == "done":
            run += 1
            longest = max(longest, run)
        else if s == "skip":
            # 赦し: 断絶させず、カウントもしない (FR-04 / AC-20)
            pass
        else:   # "not-done"
            if d == todayKey:
                # 【境界条件A】今日はまだ終わっていない。未達でも断絶させない。
                # ここで run を 0 にすると「朝アプリを開いた瞬間に連続0」になり、
                # findings §5-1 の離脱要因をアプリ自身が作ってしまう。
                pass
            else:
                run = 0
        d = addDays(d, 1)

    current = run
    return { current, longest }
```

**境界条件の明示**

| # | 条件 | 扱い | 根拠 |
|---|---|---|---|
| A | `todayKey` が対象日かつ未達 | 断絶させない(`current` は前日までの値を保つ) | FR-06 の意図(ストリークで脅さない) |
| B | 連続 done の途中の1日が `skip` | 前後が連結される | **AC-20** |
| C | 対象外曜日を放置 | `current` は減らない | **AC-19** |
| D | `habit.createdAt` より前の日 | 走査しない(過去無限に遡らない) | NFR-06 |
| E | 記録が1件も無い | `{current: 0, longest: 0}` | — |
| F | 全日が `skip` | `{current: 0, longest: 0}`(skip は加算しない) | FR-04(skip は達成ではない) |
| G | `longest` は `current` を必ず含む | `longest >= current` が不変条件 | **AC-21** |

**週N回 `computeWeeklyStreak`**

```
function computeWeeklyStreak(habit, logs, todayKey):
    weekStart = settings.weekStart
    curWeekStart = rollbackToWeekStart(todayKey, weekStart)
    firstWeek    = rollbackToWeekStart(max(habit.createdAt, todayKey - 3650日), weekStart)

    run = 0; longest = 0
    w = firstWeek
    while w <= curWeekStart:
        doneCount = count of d in [w .. addDays(w,6)] where getState(...) == "done"
        skipCount = count of d in [w .. addDays(w,6)] where getState(...) == "skip"
        required  = max(0, habit.freq.times - skipCount)   # skip は要求回数を減免 (FR-04)
        if w == curWeekStart and doneCount < required:
            # 【境界条件H】今週は進行中。未達でも断絶させない
            pass
        else if doneCount >= required:
            run += 1; longest = max(longest, run)
        else:
            run = 0
        w = addDays(w, 7)
    return { current: run, longest }
```

### 4-2. 密度 `computeDensity(habit, logs, todayKey, window=30)`

```
function computeDensity(habit, logs, todayKey, window=30):
    done = 0; denom = 0
    for i in 0 .. window-1:
        d = addDays(todayKey, -i)
        if d < habit.createdAt: continue          # 【境界I】作成前は分母に入れない
        if not isTargetDay(habit, d): continue    # 【境界J】対象外日は分母から除外 (FR-05)
        s = getState(logs, habit.id, d)
        if s == "skip": continue                  # 【境界K】skip は分母から除外 (FR-07 / AC-20)
        denom += 1
        if s == "done": done += 1
    pct = (denom == 0) ? null : round(done / denom * 100)
    return { done, denom, pct }
```

**表示規約**
- `denom > 0`: `"12/28 (43%)"` 形式(FR-07 の「X/30 形式および百分率」を、除外を反映した実分母で表示)。
- `denom == 0`(作成直後・全日 skip・対象日が窓内に無い): `"—"` と表示し、0% とは書かない。0% は「やっていない」と誤読されるため。
- `current == 0` でも `longest` と密度は独立に保持される(**AC-21**)。
- `freq.type === "weekly"` の場合も窓内の全日が対象日なので上記がそのまま成立する。

### 4-3. ヒートマップ level `heatmapLevels(...)`

**モード1: 全習慣まとめ(`selectedHabit === null`)** — 値は「その日 done の習慣数」

```
function quantileThresholds(counts):       # counts = 範囲内の「非ゼロ」カウントのみ
    if counts.length == 0: return [1, 2, 3, 4]          # 【境界L】データ皆無 → 固定閾値
    sorted = counts.sorted(ascending)
    q(p) = sorted[ clamp(floor(p * (sorted.length - 1)), 0, len-1) ]
    t = [ q(0.25), q(0.50), q(0.75), q(1.00) ]
    # 【境界M】単調増加を強制(全部同値なら 1,2,3,4 のように押し広げる)
    for i in 1..3:
        if t[i] <= t[i-1]: t[i] = t[i-1] + 1
    t[0] = max(1, t[0])                                  # level1 の下限は必ず 1 以上
    return t

function levelOf(count, t):
    if count <= 0: return 0        # 【境界N】0 は必ず level 0。透明にはしない (FR-09 / AC-09)
    if count <  t[1]: return 1
    if count <  t[2]: return 2
    if count <  t[3]: return 3
    return 4
```

- **線形正規化を使わない**(`Math.round(count / max * 4)` のような式はソース中に存在させない) → **AC-08**。
- 閾値は `quantileThresholds` という**明示的な関数**として存在し、フォールバックは定数配列 `[1,2,3,4]` として grep 可能な形で置く → **AC-08**。

**モード2: 習慣個別(`selectedHabit !== null`)** — 値は3状態。カウントではないので分位点は無意味。**ドメイン固定マッピング**を使う。

| 状態 | level | 補助属性 |
|---|---|---|
| `done` | **4** | `data-state="done"` |
| `skip` | **2** | `data-state="skip"` |
| `not-done`(対象日) | **0** | `data-state="not-done"` |
| 非対象日(FR-05) | **0** | `data-state="off"` + `data-offday="true"`(CSS で破線縁など、未達と視覚的に区別) |

いずれのモードでも `data-level` の取り得る値は `{0,1,2,3,4}` に閉じる → **AC-07**。

### 4-4. 描画範囲 `buildDateRange(endKey, weekStart, days=364)`

```
function buildDateRange(endKey, weekStart, days=364):
    rawStart = addDays(endKey, -(days - 1))              # 364日 = 52週分
    start    = rollbackToWeekStart(rawStart, weekStart)  # FR-15 / AC-06
    # 末尾も週末まで伸ばして、必ず7の倍数にする
    endRow   = rowIndexOf(endKey, weekStart)
    lastDay  = addDays(endKey, 6 - endRow)               # 今週の最終日(未来を含みうる)
    keys = []
    d = start
    while d <= lastDay: keys.push(d); d = addDays(d, 1)
    assert keys.length % 7 == 0                          # AC-06 の不変条件
    return keys
```

- 先頭が必ず週開始曜日、末尾が必ず週最終日 → セル総数は7の倍数、先頭列は必ず7セル → **AC-06**。
- 末尾に含まれる今日より後の日付は未来日として扱う(§5-3)→ **AC-10, AC-12**。
- 総セル数は 364〜371(52〜53列 × 7行)。過剰最適化しない(NFR-06)。

---

## 5. ヒートマップの DOM / CSS 設計

### 5-1. DOM 構造

```html
<section id="heatmap-section">
  <div class="hm-controls">
    <label for="hm-target">表示対象</label>
    <select id="hm-target">           <!-- 全習慣まとめ / 個別 (FR-10 / AC-32) -->
      <option value="">全習慣まとめ</option>
      <option value="h_...">朝の散歩</option>
    </select>
  </div>

  <div class="hm-scroll">             <!-- ★ overflow-x はこの要素だけ (FR-24 / AC-25) -->
    <div class="hm-inner">
      <div class="hm-months" aria-hidden="true"> … 月ラベル(列位置に合わせて配置) … </div>
      <div class="hm-body">
        <div class="hm-weekdays" aria-hidden="true"> … 曜日ラベル7行 … </div>
        <div class="hm-grid" role="grid" aria-label="習慣の記録ヒートマップ">
          <!-- 日付昇順に append するだけ。行列計算は JS で行わない (NFR-08) -->
          <button class="hm-cell" role="gridcell"
                  data-date="2026-01-15" data-level="3" data-state="done"
                  tabindex="-1"
                  aria-label="2026年1月15日木曜日、3件達成"></button>
          …
        </div>
      </div>
    </div>
  </div>

  <div class="hm-legend"> 少ない <i data-level="0"></i>…<i data-level="4"></i> 多い </div>
</section>
```

- セルは `<button>`。キーボード操作・フォーカス・クリックがネイティブに得られる(NFR-05)。
- 曜日ラベル列と月ラベル行は `aria-hidden="true"`。情報はすべて各セルの `aria-label` に含まれる(**AC-11**)。

### 5-2. CSS(NFR-08 準拠 — JS で行列を計算しない)

```css
.hm-grid {
  display: grid;
  grid-template-rows: repeat(7, var(--cell));   /* 7行固定 */
  grid-auto-flow: column;                       /* ★ 縦に7個埋まったら次の列へ */
  grid-auto-columns: var(--cell);
  gap: var(--cell-gap);
}
.hm-cell { width: var(--cell); height: var(--cell); border-radius: 2px; border: 0; padding: 0; }
```

- `--cell` は既定 `13px`(gap 3px)。モバイルでも **12px を下回らせない**(FR-24 / **AC-25**)。
- `grid-auto-flow: column` により、**日付昇順に append するだけで「列=週・行=曜日」が自動的に成立する**。JS 側の行/列計算はゼロ(NFR-08)。
- 週開始曜日オフセットは §4-4 の `rollbackToWeekStart` が吸収する。すなわち「先頭セルの行 = 週開始曜日」であることが Grid の充填順により保証される → **AC-05, AC-06**。
- 曜日ラベル列も同じ `grid-template-rows: repeat(7, var(--cell))` を使い、`weekStart` に応じて `["日",…,"土"]` を `weekStart` 分だけ回転させて描画する。これによりラベルと実セルの行が必ず一致する → **AC-05**。

### 5-3. 色と状態属性(FR-09, FR-22 / AC-07, AC-09, AC-29)

```css
:root {
  --level-0: #ebedf0; --level-1: #9be9a8; --level-2: #40c463;
  --level-3: #30a14e; --level-4: #216e39;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --level-0: #161b22; --level-1: #0e4429; --level-2: #006d32;
    --level-3: #26a641; --level-4: #39d353;
  }
}
:root[data-theme="dark"] { /* 同じダーク値。手動切替用 */ }

.hm-cell[data-level="0"] { background: var(--level-0); }  /* ★ transparent にしない (AC-09) */
.hm-cell[data-level="1"] { background: var(--level-1); }
.hm-cell[data-level="2"] { background: var(--level-2); }
.hm-cell[data-level="3"] { background: var(--level-3); }
.hm-cell[data-level="4"] { background: var(--level-4); }

.hm-cell[data-offday="true"] { box-shadow: inset 0 0 0 1px var(--offday-line); }  /* 非対象日 */
.hm-cell[data-state="skip"]  { background-image: repeating-linear-gradient(45deg, …); } /* 色以外の手掛かり */
.hm-cell[data-future="true"] { opacity: .35; cursor: default; }                   /* FR-12 / AC-10 */
.hm-cell:focus-visible       { outline: 2px solid var(--focus); outline-offset: 1px; }
```

- **JS から `style.backgroundColor` を設定しない**。色は必ず `data-level` 属性セレクタ経由 → **AC-07**。
- `skip` はハッチング、非対象日は内側枠線という**色以外の手掛かり**を併用 → FR-23 / NFR-05。
- 習慣個別モードでは `--level-4` 等を習慣色から派生させず、共通スケールを使う(初版の単純化。習慣色は今日の一覧の行アクセントに使う)。

### 5-4. 未来日(FR-12 / AC-10)

- `dateKey > todayKey` のセルは `data-future="true"` を付与し、`disabled` 属性も付ける。
- クリックハンドラ冒頭で `if (dateKey > state.ui.todayKey) return;`(文字列比較で日付比較が成立するのが `"YYYY-MM-DD"` 形式の利点)。
- roving tabindex の移動対象からも除外する。

### 5-5. ツールチップ(FR-13 / AC-26)

- `#tooltip` は**1つだけ**を使い回す。`role="tooltip"` を持ち、既定は `hidden`。
- 表示トリガは **3経路すべて**を登録する:
  1. `mouseenter` / `mouseleave`(ポインタ)
  2. `click`(タッチ・キーボード Enter の両方で発火する)
  3. `focus` / `blur`(キーボード移動時)
- タッチでは `click` でトグル表示し、グリッド外の `click` で閉じる。**hover 単独実装は禁止**(findings §5-16)。
- 表示テキストは `aria-label` と同じ文字列を使う(情報の二重管理を避ける)。

---

## 6. 永続化戦略

### 6-1. 起動シーケンス

```
1. storageAvailable() を判定 → false なら ui.storageMode = "memory"、警告バナー表示 (FR-18 / AC-13)
2. raw = safeGet(STORAGE_KEY)
3. raw == null            → 既定 state(habits: [], logs: {}, settings 既定値)で起動
4. JSON.parse(raw) を try/catch
     catch(SyntaxError)  → safeSet(BACKUP_KEY_PREFIX + Date.now(), raw)  ★捨てる前に退避 (AC-14)
                         → safeRemove(STORAGE_KEY) → 既定 state で起動 → 通知表示
5. migrate(obj) → v による変換。未知の未来バージョンは 4 と同じ退避経路へ
6. validateEnvelope() → false なら 4 と同じ退避経路へ
7. state.data = obj / state.ui.todayKey = getTodayKey()
8. render(state)
```

**未捕捉例外を出さないこと**が AC-13 / AC-14 の合否条件なので、上記 2〜6 は全体を try/catch で包み、最終フォールバックとして既定 state で必ず起動する。

### 6-2. 書き込み(デバウンス — FR-20 / AC-30)

```
SAVE_DEBOUNCE_MS = 400
let timer = null

function scheduleSave(data):
    if ui.storageMode == "memory": return      # メモリ運用時は書かない
    clearTimeout(timer)
    timer = setTimeout(flushSave, SAVE_DEBOUNCE_MS)

function flushSave():
    clearTimeout(timer); timer = null
    r = safeSet(STORAGE_KEY, JSON.stringify(state.data))
    if not r.ok:
        if r.error is Quota:  notify("保存容量の上限に達しました。エクスポートしてから古いデータを整理してください")
        else:                 ui.storageMode = "memory"; renderStorageWarning()
        # ★ 失敗しても state.data は絶対に壊さない (NFR-07)
```

- 100ms 以内に10回操作しても `setItem` は最終1回のみ → **AC-30**。
- `visibilitychange`(hidden)/ `pagehide` で `flushSave()` を呼び、タブを閉じても取りこぼさない。
- `beforeunload` は使わない(モバイルで発火が保証されないため `pagehide` を採用)。

### 6-3. quota / Safari private の throw ハンドリング(FR-17, FR-18 / AC-13, NFR-04)

| 事象 | 検出方法 | 挙動 |
|---|---|---|
| Safari private(14未満)で全 `setItem` が throw | `storageAvailable()` のテスト書き込みが throw | 起動時から `memory` モード + 警告バナー |
| quota 0 の空 localStorage を返す | 同上(テスト書き込みが失敗する) | 同上 |
| 使用中に容量超過 | `safeSet` の catch で `e.name === "QuotaExceededError"` または `e.name === "NS_ERROR_DOM_QUOTA_REACHED"` または `e.code === 22 / 1014` | 通知表示。データは破棄しない。エクスポートを促す |
| `file://` でストレージ不可 | `storageAvailable()` | `memory` モード + 警告バナー(NFR-03) |

警告文言は AC-13 の検証対象なので **「このセッションでのみ保持されます」** という語を必ず含める。

### 6-4. マイグレーション(FR-19 / AC-16)

```
CURRENT_VERSION = 1
MIGRATIONS = {
  # 1 → 2 のような変換関数を将来ここに追加する。初版は空。
}

function migrate(obj):
    if typeof obj.v != "number": throw new Error("invalid envelope")
    if obj.v > CURRENT_VERSION:  throw new Error("newer schema")   # 退避経路へ
    v = obj.v
    while v < CURRENT_VERSION:
        obj = MIGRATIONS[v](obj); v += 1
    obj.v = CURRENT_VERSION
    return obj
```

初版で `MIGRATIONS` が空でも**この骨格を最初から置く**ことが FR-19 の要求(後付けだと既存ユーザーのデータを移行できなくなる)。

### 6-5. エクスポート / インポート(FR-21 / AC-24)

- **エクスポート**: `JSON.stringify(state.data, null, 2)` → `new Blob([...], {type:"application/json"})` → `URL.createObjectURL` → 動的 `<a download="habit-YYYY-MM-DD.json">` を click → `URL.revokeObjectURL`。ファイル名の日付は `getTodayKey()` を使う(AC-02 の観点でも ISO datetime を混入させない)。
- **インポート**: `<input type="file" accept="application/json">` → `FileReader.readAsText` → `JSON.parse`(try/catch)→ `validateEnvelope` → `migrate` → **すべて成功して初めて** `state.data` を差し替えて `flushSave()`。
- 途中で失敗したら `state.data` に一切触れず、エラーメッセージのみ表示 → **AC-24 後段**。
- エクスポート → 全消去 → インポート → 再エクスポートで JSON が一致するよう、`habits` の配列順と `logs` のキー順を保存前に安定ソート(habits は `order` 昇順、logs は habitId・日付キーの辞書順)する。

---

## 7. アクセシビリティ設計(FR-23 / NFR-05 / AC-11, AC-12)

### 7-1. roving tabindex

- グリッド内の `tabindex="0"` は**常にちょうど1つ**。初期値は「今日」のセル(存在しなければ最終セル)。
- 他のすべてのセルは `tabindex="-1"`。
- `applyRovingTabindex(gridEl, focusedKey)` は、変更前のフォーカス保持セルを `-1` に落とし、新しいセルを `0` にしてから `.focus()` を呼ぶ。DOM 全走査は 371 セル規模なので単純ループでよい(NFR-06)。
- 再描画のたびに `state.ui.focusedCell` から復元する(再描画でフォーカスが body に飛ばないようにする)。

### 7-2. キーボード操作

| キー | 動作 |
|---|---|
| `←` / `→` | 前日 / 翌日(= 列をまたぐ移動になる場合もある。日付基準で一貫させる) |
| `↑` / `↓` | 同じ列内の1つ上 / 下(= 前日 / 翌日と同義。Grid の充填が縦方向のため) |
| `PageUp` / `PageDown` | −7日 / +7日(前週 / 翌週の同曜日) |
| `Home` / `End` | 範囲の先頭セル / 末尾セル(未来日を除く最終日) |
| `Enter` / `Space` | セルの状態を巡回トグル(`<button>` のネイティブ挙動) |

移動先が範囲外・未来日の場合は移動しない。

### 7-3. ARIA と代替手段

- 全セルに `aria-label = "{年}年{月}月{日}日{曜日名}、{状態文}"`。状態文は全体モードなら「N件達成」/「記録なし」、個別モードなら「達成」「スキップ」「未達成」「対象外」→ **AC-11**。
- グリッドは `role="grid"`、セルは `role="gridcell"`。
- 状態変化(トグル・保存失敗・インポート結果)は `aria-live="polite"` の通知領域で読み上げる。
- 今日の一覧の各行は `<button aria-pressed="true|false">` で done 状態を表現する。
- 色以外の手掛かり: `skip` はハッチング、非対象日は内枠線、未来日は不透明度低下 + `disabled`。数値(ストリーク・密度)は常にテキストで併記 → NFR-05。
- フォーカスリングは `:focus-visible` で必ず可視化する(`outline: none` を無条件に書かない)。

---

## 8. リスクと対策

| # | リスク | 影響 | 対策(設計上の担保) |
|---|---|---|---|
| R-01 | `toISOString()` の混入で JST 23時台の記録が前日になる | データが恒久的にずれる。最も致命的 | 日付キー生成を `localDateKey()` 1関数に集約。`toISOString` をソースから排除。AC-01/02/03 で機械検証 |
| R-02 | ミリ秒加算(`+86400000`)が DST で破綻 | 日付範囲の欠落・重複 | `addDays()` を `new Date(y, m-1, d+n)` のみで実装。ミリ秒定数をソースに置かない。AC-04 |
| R-03 | 週開始曜日の1日ずれ(Habit Heatmap の実バグ) | ヒートマップ全体が無意味になる | 行位置を `rowIndexOf()`、開始日を `rollbackToWeekStart()` の**同一式**から導出。曜日ラベルも同じ `weekStart` から回転生成。AC-05/06 |
| R-04 | 先頭列が欠けて列がずれる | 月ラベルと実データの対応が崩れる | `buildDateRange` が7の倍数長を返すことを不変条件にする。AC-06 |
| R-05 | Safari private / `file://` で `setItem` が throw し起動不能 | アプリが白画面 | `storageAvailable()` + 全 I/O の try/catch + メモリフォールバック + 警告バナー。AC-13 |
| R-06 | 破損データで `JSON.parse` が throw し、以後永久に起動不能 | データ消失 | 退避キーへ生文字列を保存してから既定 state で起動。AC-14 |
| R-07 | 線形スケールで level を出し、活動量が多い人ほど全部 level 4 になる | 可視化の情報量が消える | `quantileThresholds()` による分位点ビニング + 単調増加の強制。AC-08 |
| R-08 | level 0 を透明にしてグリッド形状が崩れる | 週の欠損に見える | `--level-0` を必ず不透明色で定義。CSS 属性セレクタで確実に適用。AC-09 |
| R-09 | ストリーク断絶で離脱(UCL 研究) | プロダクト価値そのものの毀損 | skip による赦し(境界B)、当日未達で断絶させない(境界A)、最長ストリーク・密度の併置(AC-21) |
| R-10 | 「今日」が古いままタブが放置される | 前日に記録してしまう | `visibilitychange` で `getTodayKey()` を再評価し差分があれば再描画。AC-31 |
| R-11 | インポートで壊れた JSON を読み既存データを上書き | データ消失 | `validateEnvelope` を全か無かで適用。成功時のみ差し替え。AC-24 |
| R-12 | 習慣の無制限追加で3週目に大半を無視 | 離脱 | 6個超でヒント、24個で上限拒否。AC-28 |
| R-13 | 習慣名に HTML を入れられる(自傷 XSS) | 表示崩れ | DOM 生成は `textContent` のみ。`innerHTML` に動的文字列を渡さない |
| R-14 | 過剰最適化(部分描画・仮想スクロール)で複雑化 | バグ温床・非スコープ違反 | 単一 state → `render()` 全描画を固定。371 セル規模では不要と明記(NFR-06) |
| R-15 | `--cell` を小さくしすぎてタッチできない | モバイルで操作不能 | `--cell` の下限を 12px とし、収まらない場合は `.hm-scroll` の横スクロールで解決。ページ自体は横スクロールさせない。AC-25 |
| R-16 | 頻度 `weekly` のストリーク定義が曖昧なまま実装され AC-19 を満たさない | 仕様不整合 | §4-1 で週単位アルゴリズムを別関数として明示的に分離 |

---

## 9. AC 対応表(AC-01 〜 AC-32 全件)

**未対応はゼロ。** 32件すべてについて、それを満たす設計要素を本書内の節・関数と対応付ける。

| AC | 満たす設計要素(本書の該当箇所) |
|---|---|
| **AC-01** | §3-1 `localDateKey()` が `getFullYear/getMonth/getDate` のみで組み立てる。日付キー生成関数はこれ1つ。`toISOString`/`toJSON` を設計上どこにも使わない(§2-4, R-01) |
| **AC-02** | §2-4 日付キー規約(`/^\d{4}-\d{2}-\d{2}$/`)。§2-5 検証スキーマ条件3が全日付キーを同正規表現で検証。`Date` オブジェクト・UTC 文字列を保存しない |
| **AC-03** | §3-1 `getTodayKey()` = `localDateKey(new Date())`。UTC 変換を経由しないためローカル 23:50 でも当日キーになる(R-01) |
| **AC-04** | §3-1 `addDays()` が `new Date(y, m-1, d+n)` 形式のみ。§3-1 `diffDays()` は正午基準。ミリ秒定数を設計上使わない(R-02) |
| **AC-05** | §3-1 `rowIndexOf(key, weekStart) = (dayOfWeek - weekStart + 7) % 7`。§5-2 曜日ラベルを同一 `weekStart` から回転生成し、実セルの行と同じ式で一致を保証(R-03) |
| **AC-06** | §4-4 `buildDateRange()` が `rollbackToWeekStart()` で先頭を巻き戻し、末尾を週末まで伸ばして長さを7の倍数にする(不変条件 `keys.length % 7 == 0`)。§3-1 `rollbackToWeekStart()` |
| **AC-07** | §4-3 `levelOf()` の返却値は整数 0〜4 のみ。§5-3 色は `data-level` 属性セレクタで指定し、JS から `style.backgroundColor` を設定しない |
| **AC-08** | §4-3 `quantileThresholds()`(分位点)+ フォールバック固定閾値配列 `[1,2,3,4]`。個別モードは固定マッピング表。線形正規化式を設計上持たない(R-07) |
| **AC-09** | §4-3 境界N「count<=0 は必ず level 0」+ §5-3 `--level-0` を不透明色で定義。セルは常に描画する(R-08) |
| **AC-10** | §5-4 未来日に `data-future="true"` + `disabled`。§3-5 `onCellClick` 冒頭で `dateKey > todayKey` を早期 return。§7-2 キーボード移動対象からも除外 |
| **AC-11** | §3-4 `cellAriaLabel()` が「年月日 + 曜日名 + 状態/件数」の3要素を必ず含む。§7-3 全セルに付与 |
| **AC-12** | §3-4 `applyRovingTabindex()` が `tabindex="0"` をちょうど1つに保つ。§7-1, §7-2 矢印キー移動でフォーカスと `tabindex="0"` を同時に移す |
| **AC-13** | §3-3 `storageAvailable()` / `safeSet()` の try/catch。§6-1 起動シーケンス全体の try/catch。§6-3 メモリフォールバック + 「このセッションでのみ保持されます」バナー(§3-4 `renderStorageWarning`) |
| **AC-14** | §6-1 手順4: `JSON.parse` の `SyntaxError` を捕捉し、**捨てる前に** `BACKUP_KEY_PREFIX + Date.now()` へ生文字列を退避してから既定 state で起動 |
| **AC-15** | §3-3 store 層の4関数(`safeGet`/`safeSet`/`safeRemove`/`storageAvailable`)のみが localStorage に触れ、`setItem`/`getItem`/`removeItem` だけを使う。プロパティアクセス代入を設計上持たない |
| **AC-16** | §2-1 アプリ由来キーは `paradise.habit.v1` の1つのみ(退避キーは例外)。§2-2 ルートに `v`(数値)/`habits`/`logs` を持つエンベロープ。§6-4 `migrate()` |
| **AC-17** | §1-1 単一ファイル構成。NFR-01 準拠でフォントはシステムフォントスタック。`fetch`/`XMLHttpRequest`/外部 `<script src>`/`<link stylesheet>`/`@import` を設計上一切持たない |
| **AC-18** | §1-1 成果物は `index.html` 1ファイル。§6-3 `file://` でストレージ不可なら FR-18 経路へ落ちるため、追加・チェック・描画・エクスポートは動作を継続する |
| **AC-19** | §4-1 `isTargetDay()` による非対象日スキップ(境界C)。§3-2 `computeStreak` は対象日のみで `run` を更新する |
| **AC-20** | §4-1 境界B(skip は断絶させない)+ §4-2 境界K(skip を分母から除外) |
| **AC-21** | §3-2 `computeStreak` が `{current, longest}` を同時に返す(不変条件 `longest >= current`、境界G)。§4-2 密度は current と独立。§3-4 `renderTodayList` が3値を同一行に併置 |
| **AC-22** | §3-5 `onTodayRowClick` が行クリック1回で `commit()` まで到達。§5 相当のモーダル・確認ダイアログを today セクションの導線に一切置かない(§1-1 の DOM 構成) |
| **AC-23** | §3-5 `onCellClick` の巡回 `done → skip → not-done`。§2-3 `not-done` は `delete` で表現するため3回目で完全に初期状態へ戻る |
| **AC-24** | §6-5 エクスポート(Blob + createObjectURL)/ インポート(FileReader + `validateEnvelope` + `migrate`)。安定ソートによりラウンドトリップで JSON が一致。失敗時は state 不変(§2-5 全か無か) |
| **AC-25** | §5-1 `overflow-x` は `.hm-scroll` のみが持つ。§5-2 `--cell` の下限 12px(R-15) |
| **AC-26** | §5-5 ツールチップを `mouseenter` / `click` / `focus` の3経路で表示。hover 単独実装を禁止 |
| **AC-27** | §3-4 `renderEmptyState()` が `habits.length === 0` で目的説明+「まずは1〜3個から」案内を表示し、ヒートマップ節を隠す |
| **AC-28** | §3-5 `onAddHabit` が24個超を拒否。§3-4 `renderHabitLimitHint` が6個超でヒント表示 |
| **AC-29** | §5-3 `--level-0..4` を CSS カスタムプロパティで定義し、`prefers-color-scheme: dark` と `[data-theme="dark"]` の両方でダーク値に差し替え。§3-4 `applyTheme()` |
| **AC-30** | §6-2 `scheduleSave()` の 400ms デバウンス。§3-5 全変更が `commit()` 1経路を通るため、連続10操作でも `setItem` は最終1回 |
| **AC-31** | §3-5 `onVisibilityChange()` が `getTodayKey()` を再評価し、変化時に `state.ui.todayKey` 更新 + 再描画。`visibilitychange` リスナを登録 |
| **AC-32** | §5-1 `#hm-target` セレクタで全体/個別を切替。§4-3 モード1(件数×分位点)とモード2(3状態固定マッピング)で `aria-label` の状態文が切り替わる(§3-4 `cellAriaLabel`) |

**カバレッジ**: AC-01 〜 AC-32 の **32/32(100%)** に対応する設計要素が本書内に存在する。未対応・保留・後回しの項目は **0件**。

---

## 10. 設計上の非スコープ再確認

requirements.md §1-3 の非スコープは本設計でも一切実装しない。特に以下は「設計しないことを設計判断として明記する」:

- 部分描画・差分レンダリング・仮想スクロール(NFR-06 / R-14)
- IndexedDB・複数キー分割(FR-19 / AC-16)
- 通知・ペナルティ・ゲーミフィケーション
- 複数タブ間のリアルタイム同期(`storage` イベント購読を行わない)
- 数値型/時間型の習慣、メモ、PWA、並べ替え/アーカイブ

---

## 11. 完了の定義(design フェーズ)

- [x] アーキテクチャ方針(store / domain / render / event の4層と一方向フロー)を定義した
- [x] localStorage の JSON スキーマ(バージョン付きエンベロープ・キー設計・日付キー規約)を定義した
- [x] 主要関数のシグネチャ一覧と、各関数が満たす FR / AC を明記した
- [x] ストリーク / スキップ / 密度 / level のアルゴリズムを境界条件込みの擬似コードで示した
- [x] ヒートマップの DOM / CSS 設計(`grid-auto-flow: column`・7行・週開始オフセット・分位点5段階)を定義した
- [x] 永続化戦略(デバウンス・quota / Safari private の throw ハンドリング・マイグレーション)を定義した
- [x] アクセシビリティ設計(roving tabindex・ARIA・色以外の手掛かり)を定義した
- [x] リスクと対策を16件洗い出した
- [x] AC-01 〜 AC-32 の全32件に設計要素を対応付けた(未対応ゼロ)
- [x] 実装コード本体は書いていない(擬似コードとシグネチャのみ)
