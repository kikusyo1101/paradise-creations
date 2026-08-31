# 視覚アイデンティティ — 習慣トラッカー

対象: `creations/habit/app.html`
選定日: 2026-08-31 / 決定者: 教主(Pontiff)
選定 engine: `node graph/identity.js suggest "毎日の習慣を記録し、連続日数とヒートマップで可視化する習慣トラッカー" --slug habit`

---

## 0. なぜこのフェーズが要るのか(問題の実測)

本創造物の初版は、誰も指定していないのに **GitHub Primer ダークの配色**へ落ちていた。実測値:

| トークン | 初版の値 | 出典 |
|---|---|---|
| `--accent-ui` / `--focus` | `#58a6ff` | GitHub Primer `accent.fg` (dark) |
| `--fg` | `#e6edf3` | Primer `fg.default` (dark) |
| `--danger` | `#f85149` | Primer `danger.fg` (dark) |
| `--level-0` | `#161b22` | GitHub 貢献グラフ |
| `--level-1..4` | `#0e4429 / #006d32 / #26a641 / #39d353` | GitHub 貢献グラフ **そのまま** |
| 既定の習慣色 | `#3fb950` | Primer `success.fg` |

critic の `visual-identity-declared` は「13 default dev-tool palette hits」と警告していた。
ヒートマップという UI を選んだ瞬間に「GitHub の草」の配色を丸ごと引き写していたわけで、
これは設計ではなく **既定値への無自覚な滑落**である。identity フェーズはこれを構造的に断つ。

---

## 1. 採択した方向: **mastercard**

- family: `finance`
- traits: `editorial-serif` / `warm-organic` / `luxury` / `soft-pastel`
- 原典: <https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/mastercard/DESIGN.md>

原典から引いた本質(実際に読んで確認した記述):

- キャンバスは白でも灰でもない **putty-cream `#F3F0EE`** — 「プレミアムな年次報告書の紙の色」。
  *"not white, not gray, but a color that feels like the paper of a premium annual report"*
- 支配的ジェスチャは **oversized radius**(40px / 99px / 1000px)。*"There are almost no sharp corners anywhere on the page."*
- 一次 CTA は **warm near-black `#141413`**。純黒でないのは暖色の地に対して硬すぎないため。
- 攻撃色は **Signal Orange `#CF4500`** ただ一色。*"the page's single aggressive color and must be used sparingly"*
- 見出しは -2% の詰めたトラッキング、本文は 450 という半端ウェイト。大文字トラッキングは eyebrow スケールのみ。

### 習慣アプリとして何故これが適うか

1. **紙の比喩が習慣記録の比喩と一致する。** 習慣トラッカーは本質的に「手帳に丸をつける」行為の電子化である。
   putty-cream の地は、白い蛍光板ではなく **紙**を想起させる。毎日開く道具として疲れにくい。
2. **一色の signal を「達成」に独占させられる。** mastercard は攻撃色を1つに絞る規律を持つ。
   本アプリで唯一祝福すべき事象は「今日やった」であり、orange をそこに独占的に割り当てると
   画面の意味構造とカラー構造が一致する。GitHub 緑は「差分が入った」の色であって「習慣が続いた」の色ではない。
3. **oversized radius が chip / cell / pill という既存 DOM に自然に載る。**
   曜日チップ、習慣行、ボタンはすべて既に丸みを持つ要素であり、
   DOM を一切変えずに radius と地の色だけで別人格にできる(=機能不変の制約と両立する)。
4. **finance family は「継続と記録」の語彙を持つ。** 連続日数(streak)は口座残高と同じ「積み上げ」の表現であり、
   institutional かつ editorial なトーンが誇張なく似合う。

---

## 2. 却下した候補と却下理由(必須記録)

engine が提示した候補は `intercom` / `uber` / `hp` の3件。うち上位2件の却下理由:

### ✗ intercom (family: tech_saas, score -122)

cream 地(`#f5f1ec`)+ Fin Orange(`#ff5600`)一点賭けという構成は mastercard と極めて近く、
実際いちばん惜しい候補だった。却下理由は3つ。

1. **family が tech_saas である。** 楽園が是正したい病はまさに「開発者向け SaaS の見た目に無自覚に寄る」ことであり、
   その病巣の family から救済を求めるのは筋が悪い。engine の -40 ペナルティもこれを表している。
2. **薄いヘアライン境界 + 8〜16px の控えめな radius**という語彙が、初版の GitHub 風カード積みと
   **構造的に見分けがつかない**。色だけ変えても「同じ形の別の色」にしかならず、識別の獲得に至らない。
3. **`#ff5600` は蛍光寄りで、ヒートマップの5段階に展開すると上位2段が潰れる。**
   mastercard の `#CF4500`(burnt/rust)は暗部に余裕があり、5階調に割りやすい。

### ✗ uber (family: consumer_brand, score -60)

1. **白黒の二重奏に「達成」を表す色が存在しない。** 原典は *"a black-and-white duet"* と明言し、
   彩色は編集イラストに委ねている。ヒートマップは階調が意味を持つ UI なので、
   無彩色だけでは「濃い灰=よくやった」という不自然な符号化を強いる。
2. **依存ゼロ制約と衝突する。** uber の identity の中心は 4:3 の編集イラストとカスタム display sans である。
   画像 URL も Web フォントも禁止の本創造物では、残るのは「黒い pill」だけになり、
   結果として *identity 未満の無印* に落ちる。
3. `radius: 999px` を全インタラクティブ要素へ強制する規律は、13px のヒートマップセルと相性が悪い
   (セルが円になり日付グリッドの読み取りが崩れる)。

> 参考: `hp` は engine の3番目だが `dark-canvas` + electric blue `#024ad8` であり、
> 「青いアクセント + 暗い地」という初版の失敗パターンへ戻るため検討段階で除外した。

---

## 3. カラートークン表

役割名は既存 CSS カスタムプロパティ名を保持する(DOM/ロジック不変の制約)。値のみを差し替える。

### ライト(既定)

| 役割 (token) | 値 | 由来 | 用途 |
|---|---|---|---|
| `--bg` | `#F3F0EE` | Canvas Cream(原典) | ページの地。紙 |
| `--bg-elev` | `#FCFBFA` | Lifted Cream(原典) | カード。紙の上の紙 |
| `--bg-sunken` | `#EAE5E0` | cream を一段沈めた派生 | 行・チップの窪み |
| `--fg` | `#141413` | Ink Black(原典) | 本文・見出し |
| `--fg-muted` | `#565656` | Graphite(原典) | 副次テキスト |
| `--fg-faint` | `#767370` | Slate Gray `#696969` を cream 側へ寄せた派生 | 月ラベル・曜日ラベル |
| `--line` | `#D9D3CC` | Dust Taupe `#D1CDC7` 系 | 境界線 |
| `--accent-ui` | `#9A3A0A` | Clay Brown(原典) | 通知テキスト・hover 境界 |
| `--focus` | `#CF4500` | Signal Orange(原典) | フォーカスリング |
| `--offday-line` | `#C4BAB0` | taupe 派生 | 休息日の枠 |
| `--danger` | `#A3231A` | 暖色側へ寄せた rust red | 削除操作 |
| `--warn-bg` | `#FAEBDD` | cream の暖側派生 | 警告帯の地 |
| `--warn-fg` | `#7A3E00` | clay 系深色 | 警告帯の字 |
| 既定の習慣色 | `#CF4500` | Signal Orange | `<input type="color">` 初期値 |

コントラスト実測(WCAG 相対輝度で算出。対 `--bg-elev` = `#FCFBFA`):
`--fg` **17.84:1** / `--fg-muted` **7.10:1** / `--fg-faint` **4.56:1** /
`--accent-ui` **6.81:1** / `--danger` **7.22:1** /
`--warn-fg` on `--warn-bg` **7.15:1** / `--on-signal`(白)on `--signal` **4.66:1**。
すべて AA(4.5:1)以上。

### ダーク

原典の footer surface(`#141413` の warm black)をそのままページの地に昇格させる。
**冷たい青みの暗色(`#0d1117` 系)は使わない**。

| 役割 (token) | 値 | 用途 |
|---|---|---|
| `--bg` | `#141413` | Ink Black を地に |
| `--bg-elev` | `#1E1D1B` | カード |
| `--bg-sunken` | `#191817` | 行・チップ |
| `--fg` | `#F3F0EE` | 反転:cream が字になる |
| `--fg-muted` | `#B4ADA5` | 副次テキスト |
| `--fg-faint` | `#8C857C` | ラベル |
| `--line` | `#35322E` | 境界線 |
| `--accent-ui` | `#F37338` | Light Signal Orange(暗地で読める側) |
| `--focus` | `#F37338` | フォーカスリング |
| `--offday-line` | `#4A453F` | 休息日の枠 |
| `--danger` | `#EF8A7A` | 暖色系の警告赤 |
| `--warn-bg` | `#3A2A18` | 警告帯の地 |
| `--warn-fg` | `#F2C08A` | 警告帯の字 |

コントラスト実測(対 `--bg-elev` = `#1E1D1B`):
`--fg` **14.85:1** / `--fg-muted` **7.59:1** / `--fg-faint` **4.62:1** /
`--accent-ui` **5.87:1** / `--danger` **6.89:1** /
`--warn-fg` on `--warn-bg` **8.32:1**。すべて AA 以上。

---

## 4. タイポグラフィ — OS 標準フォントのみ

**Web フォント読込は依存ゼロ違反であり禁止**(`@import` / `<link rel=preload|stylesheet>` / CDN 一切不可)。
原典の MarkForMC も Sofia Sans も **使わない**。代わりに原典の *規律* だけを移植する。

```css
font-family: system-ui, -apple-system, "Segoe UI", "Hiragino Kaku Gothic ProN",
             "Noto Sans JP", Meiryo, sans-serif;
```

この 1 スタックのみ。**二書体目を足さない**(原典の "One-font system" をそのまま守る)。
コントラストは書体でなく **スケール・ウェイト・字送り**で作る。

| 役割 | サイズ | ウェイト | 字送り | 備考 |
|---|---|---|---|---|
| H1(アプリ名) | 21px | 600 | **-0.02em** | 原典の -2% を移植。詰めて editorial な密度を出す |
| セクション見出し `.sec-title` | 12px | 700 | **+0.10em / uppercase 相当の大文字送り** | 原典の eyebrow スケール。大文字送りはここ**だけ** |
| 空状態見出し | 18px | 600 | -0.01em | |
| 本文 | 15px | 400 | normal | 原典の 450 は可変フォント前提。OS 標準では 400 + わずかな字送り詰めで代替 |
| 数値・統計 `.row-stats` | 12.5px | 400 | +0.01em | |
| ボタンラベル | 15px | 500〜600 | -0.01em | 原典 "Nav link / Button label: -3%" を緩めて移植 |

原則:
- **行高はサイズが大きいほど詰める。** 見出し 1.15〜1.25、本文 1.6。原典の "Line-height ratio drops with size"。
- **大文字化は eyebrow(セクション見出し)のみ。** 他所で `text-transform: uppercase` を使わない。
- 日本語見出しには大文字化が効かないため、**字送り +0.10em と 700 ウェイト**で eyebrow の役を果たさせる。

---

## 5. 質感・余白・角丸・影

### 角丸(最重要のジェスチャ)
原典は *"There are almost no sharp corners anywhere"* と言い切る。本アプリでの割り当て:

| 要素 | radius | 根拠 |
|---|---|---|
| カード `section.card` | **20px** | 原典の body CTA/カードの 20px 系 |
| ボタン・入力・セレクト | **999px (pill)** | 原典 "buttons either complete the pill" |
| 行 `.row-main` / 管理行 | **16px** | カードより一段小さい |
| 曜日チップ `.day-chip` | **999px** | pill |
| チェック `.check` | **50%(円)** | 原典の circular gesture |
| ブランドマーク `.brand-mark` | **50%(円)** | 同上 |
| ヒートマップセル | **3px** | **例外**:13px の格子は円にすると日付グリッドの走査が壊れる。丸めは最小限に留める |
| ツールチップ | **12px** | |

### 余白
紙の余白を尊ぶ。カード内 padding は 18px → **22px**。カード間 18px → **20px**。
本文 `max-width: 940px` は変えない(機能不変)。

### 影
原典は *"Deep card shadows … `rgba(0,0,0,0.08) 0px 24px 48px`"*。
ただし本アプリはツール用途なので **常時の浮遊を避け、影は最小限**にする:
- カードは影なし、hairline 境界のみ(紙が紙の上に置かれている表現)
- 例外はツールチップの `0 18px 40px rgba(20,20,19,.22)` のみ

### 質感
- グラデーション禁止(原典も *"uses no programmatic gradients in the core UI"*)。
- 地の色は**必ず色味を持つ**。`#ffffff` と `#000000` をページの地として使わない。
- 押下は `transform: scale(.995)` の圧縮のみ。hover で色を跳ねさせない。

---

## 6. ヒートマップ 5 段階の再定義

**分位点による5段階という算出ロジックは一切変えない。色だけを差し替える。**
GitHub 貢献グラフの緑(`#9be9a8 / #40c463 / #30a14e / #216e39` と暗色版)は全廃。

cream の地から Signal Orange を経て Clay Brown の深部へ落ちる、**単一色相の焼き込みランプ**とする。
「続けるほど紙が焦げていく」という比喩であり、finance/editorial のトーンと矛盾しない。

### ライト(地: `#F3F0EE`)

| level | 値 | 意味 |
|---|---|---|
| `--level-0` | `#E7E1DA` | 記録なし。地よりわずかに沈む taupe |
| `--level-1` | `#F2DCC6` | 最下位分位。cream に橙が滲む |
| `--level-2` | `#F0B183` | soft-pastel 帯 |
| `--level-3` | `#EC7F3C` | Light Signal Orange `#F37338` の一段深い側 |
| `--level-4` | `#CF4500` | **Signal Orange 原典値**。最上位分位のみが到達する |

### ダーク(地: `#141413`)

| level | 値 | 意味 |
|---|---|---|
| `--level-0` | `#26231F` | 記録なし。warm black より一段明るい |
| `--level-1` | `#57301A` | 焼けはじめ |
| `--level-2` | `#8C4310` | |
| `--level-3` | `#CF4500` | Signal Orange |
| `--level-4` | `#F37338` | Light Signal Orange。暗地では**明るい側**が頂点 |

### `--level-3` の二重の役目について
初版の CSS は `--level-3`(ヒートマップの中間階調)をチェック済み行・一次ボタン・ON のチップにも
流用していた。階調と操作色が同じトークンに縛られると、片方を最適化するともう片方が壊れる。

そこで **`--signal`(= `#CF4500`、両テーマ共通)を新設**し、
`.btn.primary` / `.check` / `.day-chip.on` / `.brand-mark` / チェック済み行の枠と地は
すべて `--signal` を参照するよう付け替えた。ヒートマップのセルは `--level-0..4` のみを見る。

これで「セルの階調」と「操作の signal」が分離される。
`--signal` 上の白文字は **4.66:1** で AA を満たす(実測)。

---

## 7. Do / Don't

### Do
- ✅ 地は必ず暖色の紙(`#F3F0EE` / `#141413`)。白と純黒をページ地にしない。
- ✅ 攻撃色は orange 一色。`#CF4500` を「達成」にだけ使い、乱用しない。
- ✅ 角は丸める。ボタンと入力は pill(999px)、カードは 20px。
- ✅ 書体は 1 スタック(OS 標準)。差は scale / weight / letter-spacing で作る。
- ✅ 見出しは負の字送り(-0.02em)、セクション見出しだけ正の字送り(+0.10em)。
- ✅ 本文コントラストは WCAG AA 4.5:1 以上を実測で確保する。
- ✅ ヒートマップは分位点5段階のまま、色だけ差し替える。

### Don't
- ❌ **`#58a6ff` / `#1f6feb` / `#0d1117` / `#161b22` / `#30363d` / `#3fb950` / `#238636` /
  `#f85149` / `#8b949e` / `#c9d1d9` / `#e6edf3` — GitHub Primer 既定配色を一切使わない。**
- ❌ GitHub 貢献グラフの緑ランプ(`#9be9a8` / `#40c463` / `#30a14e` / `#216e39` /
  `#0e4429` / `#006d32` / `#26a641` / `#39d353`)を使わない。
- ❌ Web フォント・CDN・外部画像 URL を読み込まない(`https?://` / `@import` / `<script src>` / `<link href>` はゼロ)。
- ❌ プログラム的グラデーションを敷かない。
- ❌ 二書体目(セリフ見出し等)を足さない。原典は one-font system。
- ❌ 青を UI アクセントに使わない(原典の Link Blue `#3860BE` は本アプリに該当箇所が無い)。
- ❌ 「暗い = 冷たい青」に落ちない。ダークは warm black `#141413` を基点にする。
- ❌ DOM 構造・クラス名・JS ロジックを identity 適用の口実で変えない。CSS 変数と CSS 規則の範囲に留める。

---

## 8. 適用範囲(第2部で実際に行ったこと)

- `:root` / `@media (prefers-color-scheme: dark)` / `:root[data-theme="dark"]` の
  3ブロックのトークン値を全面差し替え(`--signal` を追加)。
- radius / padding / letter-spacing / 影の CSS 規則を上記方針に合わせて更新。
- `<input type="color">` の既定値と JS のフォールバック既定色 `#3fb950` → `#CF4500`。
  (値の文字列置換のみで、検証ロジックの正規表現は不変。)
- **DOM 構造・ID・クラス名・イベント・状態機械・分位点算出は一切変更していない。**
