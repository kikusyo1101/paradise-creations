# UX レビュー — 習慣トラッカー

対象: `creations/habit/app.html` (71,516 bytes / 単一HTML・依存ゼロ)
審査: ux-reviewer 司祭 (品質枢機卿 配下)
実施日: 2026-08-31
参照: `identity.md` / `requirements.md` / `review.md`

---

## 0. 実施した計測と目視の記録

### 0-1. 機械計測 (実出力・そのまま貼付)

```
$ node graph/visual-verify.js check creations/habit

═══════ 👁  VISUAL VERIFICATION ═══════
target: creations/habit
  ✓ [gap] identity-honoured: 31/57 declared colors present in the implementation
  ✓ [gap] contrast-aa: all resolvable fg/bg pairs meet WCAG AA
  ✓ [gap] no-default-palette: the palette is not the machine default
  ✓ [gap] states-covered: empty and error states are addressed
  ✓ [gap] responsive-declared: 1 width breakpoint(s) declared
  ✓ [gap] focus-visible: keyboard focus is styled
  ✓ [smell] touch-target: 1 interactive size floor(s) >= 32px declared
  🟠 [smell] motion-respected: the UI animates but ignores prefers-reduced-motion
───────────────────────────────────────
VISUAL: no gaps, 1 smell(s)
═══════════════════════════════════════
```

```
$ node graph/visual-verify.js evidence creations/habit

═══════ 📷 REQUIRED VISUAL EVIDENCE ═══════
  · theme=light  width=380px  state=first-run (no data)
  · theme=light  width=380px  state=populated
  · theme=light  width=1280px state=first-run (no data)
  · theme=light  width=1280px state=populated
  · theme=dark   width=380px  state=first-run (no data)
  · theme=dark   width=380px  state=populated
  · theme=dark   width=1280px state=first-run (no data)
  · theme=dark   width=1280px state=populated
  Open the file in a real browser and capture each combination. A combination you
  could not capture must be reported as "not seen", never as "fine".
  pitfall: The saved theme in localStorage can override the HTML attribute — if the
  theme will not switch, pin applyTheme() in a COPY, never in the artifact.
═══════════════════════════════════════════
```

**この機械検査は「合格」と言っているが、以下の目視と追加実測はそれを覆す。**
`contrast-aa` が緑なのは *解決できた前景/背景ペア* だけを見ているためで、
本レビューの致命的指摘 (F-1 / F-2) はいずれも機械検査の視野外にある。

### 0-2. 実ブラウザ目視 (Brave / 実機 Windows)

本体は改変せず、`%LOCALAPPDATA%\Temp\uxrev\` に **コピー4本** を生成して確認した。
`app.html` の md5 は計測前後で `4459185c04f15eff47f37e670cd247eb` のまま、`git status` もクリーン。

コピーには (a) `localStorage` をメモリ実装に差し替えてシードデータを注入、
(b) `applyTheme(st.data.settings.theme)` → `applyTheme("light"|"dark")` に固定、の2点のみを適用。

| # | テーマ | 幅 | 状態 | 見たか |
|---|---|---|---|---|
| 1 | light | 1280相当 | populated (習慣3件・330日分ログ) | ✅ 見た |
| 2 | light | 1280相当 | first-run (データ無し) | ✅ 見た |
| 3 | dark | 1280相当 | populated | ✅ 見た |
| 4 | dark | 1280相当 | first-run | ✅ 見た |
| 5 | light | 400px窓 (~380px相当) | populated | ✅ 見た (スクロール2画面分) |
| 6 | dark | 380px | first-run / populated | ⚠️ **見ていない** |
| 7 | light | 380px | first-run | ⚠️ **見ていない** |

> 正直な申告: evidence が要求する8通のうち **5通を目視、3通は未確認**。
> 未確認の3通は「狭い幅 × ダーク」「狭い幅 × 初回」の組合せである。
> 狭い幅ライト populated が破綻せず、テーマはトークン差替えのみで構造に触れていないため
> 崩れの可能性は低いと推測するが、**推測であって確認ではない。**

### 0-3. 追加の自前実測 (WCAG 相対輝度で算出)

`identity.md` が載せていない **非テキストコントラスト (WCAG 1.4.11 / 要 3:1)** と
**ヒートマップ隣接階調の分離** を独自に計算した:

```
=== 非テキスト / UI コントラスト (基準 3:1) ===
  LIGHT --line #D9D3CC vs card #FCFBFA     1.44:1   ✗
  LIGHT --line #D9D3CC vs page #F3F0EE     1.31:1   ✗
  LIGHT .check 枠 --line vs --bg-sunken    1.19:1   ✗✗
  DARK  --line #35322E vs card #1E1D1B     1.32:1   ✗
  DARK  .check 枠 --line vs --bg-sunken    1.39:1   ✗✗
  LIGHT focus #CF4500 vs page #F3F0EE      4.11:1   ✓
  DARK  focus #F37338 vs page #141413      6.43:1   ✓

=== ヒートマップ隣接階調の分離 ===
  LIGHT L0->L1 #E7E1DA/#F2DCC6   1.02:1   ✗✗✗
        L1->L2 #F2DCC6/#F0B183   1.40:1
        L2->L3 #F0B183/#EC7F3C   1.48:1
        L3->L4 #EC7F3C/#CF4500   1.70:1
        L0 vs ページ地            1.14:1
  DARK  L0->L1 #26231F/#57301A   1.37:1
        L1->L2 #57301A/#8C4310   1.59:1
        L2->L3 #8C4310/#CF4500   1.54:1
        L3->L4 #CF4500/#F37338   1.63:1
        L0 vs ページ地            1.18:1
```

テキストの AA は `identity.md` の主張どおり再現できた (`--fg` 17.84:1 / `--fg-muted` 7.10:1 /
`--fg-faint` 4.56:1 / `--accent-ui` 6.81:1 / 白 on `--signal` 4.66:1)。**問題はテキスト以外にある。**

---

## 1. 宣言と実装の照合 — 装飾的な宣言はあったか

結論: **`identity.md` は装飾的な宣言ではない。トークンは実装に届いている。**
ここは正当に評価する。

| 宣言 | 実装 | 判定 |
|---|---|---|
| putty-cream `#F3F0EE` を地に | `:root { --bg: #F3F0EE }` (L23) | ✅ 一致 |
| warm black `#141413` をダーク地に | `:root[data-theme="dark"] { --bg:#141413 }` (L80) | ✅ 一致 |
| Signal Orange 一色主義 / `--signal` 新設 | `--signal:#CF4500` を両テーマで定義 (L20/L51/L76) | ✅ 一致 |
| `--signal` を `.btn.primary` / `.check` / `.day-chip.on` へ | L165, L273, L317 で参照 | ✅ 一致 |
| GitHub Primer / 貢献グラフ緑を全廃 | `#58a6ff` `#3fb950` `#39d353` 等いずれも grep で 0 件 | ✅ 一致 |
| oversized radius (card 20 / pill 999 / row 16) | `--radius:20px --radius-row:16px --radius-pill:999px` (L39-41) | ✅ 一致 |
| 影は最小限・カードは hairline のみ | `section.card` に box-shadow 無し | ✅ 一致 |
| 一書体 (OS標準スタック) | `font-family` 1 箇所のみ (L104) | ✅ 一致 |
| Web フォント/CDN ゼロ | `@import` / `<link href>` / `http` いずれも 0 件 | ✅ 一致 |
| H1 は -0.02em | `letter-spacing:-.02em` (L132) | ✅ 一致 |
| sec-title は +0.10em | `letter-spacing:.10em` (L203) | ✅ 一致 |

ただし機械検査の `identity-honoured` は **31/57** — 宣言した色の約半分が実装に現れていない。
これは表 (却下候補の色・原典参照値) を含むためで直ちに欠陥ではないが、
「宣言 57 に対し実装 31」という比は、**identity.md が実装仕様書というより読み物に寄っている**ことを示す。

### 1-1. 宣言が届いていない箇所 (実装漏れ)

`identity.md` §5「地の色は**必ず色味を持つ**」という規律は CSS 変数には行き渡ったが、
**ブラウザのネイティブ UI (スクロールバー等) には及んでいない** — F-2 で詳述する。

---

## 2. 指摘事項

### 🔴 F-1 【重大度: 致命】ヒートマップの L0 と L1 が人間の目で区別できない

**【根拠 — 実測 + 目視】**
- 実測: light の `--level-0 #E7E1DA` と `--level-1 #F2DCC6` のコントラスト比は **1.02:1**。
  これは「ほぼ同一の色」を意味する数値である (1.00:1 が完全同一)。
- 目視: light populated (#1) のヒートマップ凡例「少ない ■■■■■ 多い」を拡大して確認したところ、
  **左端2つの四角が地続きに見え、5段階ではなく4段階にしか見えなかった。**
  グリッド本体でも「記録なしの日」と「最下位分位の日」が見分けられない。

**【該当箇所】**
`app.html` L14-15 (`--level-0: #E7E1DA;` / `--level-1: #F2DCC6;`)
凡例 DOM: L506-508 / セル: `.hm-cell[data-level="0"|"1"]` L365-366

**【なぜ致命か】**
本アプリの中心的価値は「続いた軌跡をヒートマップで眺める」(空状態の自己紹介文そのまま) である。
その主役 UI において **「やっていない日」と「少しやった日」が同じ色に見える** のは、
機能の中核が視覚的に成立していないということ。分位点算出ロジックがどれだけ正しくても、
出力が読めなければユーザーには届かない。`identity.md` §6 が「単一色相の焼き込みランプ」を
意図したのは正しいが、**cream 地から始めたため最初の一段が地に埋没した。**

**【推奨修正】**
`--level-1` を明確に彩度側へ振り、L0 との比を最低 1.25:1 以上確保する。例:
```css
--level-0: #E7E1DA;   /* 据置 */
--level-1: #F7C9A0;   /* #F2DCC6 → 橙を強め、L0 比 約1.25:1 */
```
ダーク側の L0→L1 は 1.37:1 で相対的にマシだが、同様に一段開けることを推奨する。
併せて **`--level-0` に `inset 0 0 0 1px` の淡い枠を与え「空きマス」であることを形でも示す**と、
色覚特性によらず読める (色だけに意味を負わせない / WCAG 1.4.1)。

---

### 🔴 F-2 【重大度: 致命】`color-scheme` 未宣言により、ダークテーマでネイティブ UI が明色のまま残る

**【根拠 — 目視 + grep】**
- 目視: dark populated (#3) のスクリーンショットを拡大したところ、
  **ヒートマップ直下の横スクロールバーが淡いグレーの明色トラック**として描画され、
  warm black `#141413` のカード上で明らかに浮いていた。
  暗い紙面に一本だけ白い帯が走っている状態で、identity が最も嫌う「地の一貫性」の破れである。
- grep: `color-scheme` は `app.html` 全体で **0 件**。`::-webkit-scrollbar` も 0 件。

**【該当箇所】**
`:root` ブロック (L12-41) — `color-scheme` 宣言が存在しない。
影響する要素: `.hm-scroll { overflow-x: auto }` (L325) のスクロールバー、
ページ本体のスクロールバー、`<select>` のドロップダウンパネル、`<input type="color">` のピッカー。

**【なぜ致命か】**
`identity.md` §7 Don't は「**暗い = 冷たい青に落ちない**」「地は必ず色味を持つ」と規律を立てた。
だが CSS 変数を完璧に塗り替えても、`color-scheme` を宣言しなければ
**ブラウザは「このページはライト」と判断し続け、ネイティブ描画部分だけがライトのまま残る。**
トークン設計の正しさが、たった1行の欠落で最後に破綻している。
しかもこれは identity フェーズが最も力を入れたダークテーマで起きる。

**【推奨修正】**
```css
:root { color-scheme: light; }
:root[data-theme="dark"] { color-scheme: dark; }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { color-scheme: dark; }
}
```
3ブロックのトークン定義と同じ場所に1行ずつ足すだけで、
スクロールバー・select・color ピッカーが一斉にテーマへ追従する。

---

### 🟠 F-3 【重大度: 重要】未達成のチェック丸が「押せる」ようにも「空である」ようにも見えない

**【根拠 — 実測 + 目視】**
- 実測: `.check` の枠線 `--line #D9D3CC` と、それが載る `--bg-sunken #EAE5E0` のコントラストは
  **1.19:1** (light)。ダークでも `#35322E` vs `#191817` = **1.39:1**。
  WCAG 1.4.11 が UI コンポーネントの境界に求める **3:1 を大幅に下回る**。
- 目視: light/dark populated (#1/#3) で「ジムへ行く」行 (未チェック) の丸は、
  **輪郭がほぼ溶けており、達成済み行のオレンジ丸と比べて「空の器」ではなく「何も無い」ように見えた。**

**【該当箇所】**
`.check { border: 1.5px solid var(--line) }` (L267)
`.row-main { background: var(--bg-sunken) }` (L245)

**【なぜ重要か】**
このアプリでユーザーが毎日行う操作は **ただ一つ「今日の丸を押す」** である。
その唯一の操作対象が、押せる的として認識されない。
達成済みは `--signal` で明快に光るので「済」は分かるが、**「まだ」が伝わらない**。
「やることが残っている」ことを示せない習慣トラッカーは、動機づけの装置として機能しない。

**【推奨修正】**
未チェック時の枠色を `--line` から専用トークンへ分離し、3:1 を確保する:
```css
.check { border: 1.5px solid var(--fg-faint); }  /* light: 対 sunken 約 4.0:1 */
```
`--fg-faint` は light `#767370` / dark `#8C857C` で既に AA テキスト水準にあり、
新トークンを増やさず解決できる。`.row-main` の枠 (`--line`) も同様に一段濃くすることを推奨。

---

### 🟠 F-4 【重大度: 重要】ヒートマップのセルが 13px — 触れる的として小さすぎる

**【根拠 — ソース実測】**
- `--cell: 13px` (L37)、狭い幅では `--cell: 12px` (L429)。
- `.hm-cell` は `document.createElement("button")` で生成される **本物のクリック可能ボタン** (L1563-1565)。
  クリックで記録をトグルする実操作を持つ。
- WCAG 2.5.8 (Target Size Minimum, AA) の下限は **24×24 CSS px**。13px はその **約半分**。
- 機械検査の `touch-target` が緑なのは「32px 以上の宣言が1つある」ことしか見ておらず、
  **最小のインタラクティブ要素を見ていない。検査の穴である。**

**【該当箇所】** `--cell` (L37 / L429)、`.hm-cell` (L356-363)

**【推奨修正】**
セルの見た目 13px は日付グリッドの走査性に必要なので維持しつつ、
**当たり判定だけを広げる**:
```css
.hm-cell { position: relative; }
.hm-cell::after {
  content: ""; position: absolute;
  inset: -6px;              /* 13 + 12 = 25px の判定域 */
}
```
`--cell-gap: 3px` があるため隣接セルと判定が重なるが、`::after` を持つ要素の
z-index 順で手前が勝つため実害は小さい。あるいは狭い幅で `--cell` を 15-16px へ上げる。

---

### 🟠 F-5 【重大度: 重要】初回起動で、説明より先に「入力フォーム」が出る

**【根拠 — 目視 + DOM 順序】**
- 目視: light first-run (#2) / dark first-run (#4) を確認。画面上から順に
  **「今日の記録」カード (空) → 習慣名/色/頻度の入力フォーム → 「まだ習慣がありません」の説明カード
  → 空のヒートマップ → 設定** の順で並んでいた。
- DOM: `<form id="habit-form">` (L462) が `<section id="empty-state">` (L484) **より前**にある。

**【なぜ重要か】**
初回のユーザーが最初に目にするのは「習慣名 / 色 / 頻度 / 追加する」という **記入を迫るフォーム**であり、
「これは何のアプリで、何をすればいいか」を語る文章はその **下** にある。
順序が逆。空状態カードの文面自体は良い
(「毎日の小さな行動を記録して、続いた軌跡をヒートマップで眺めるためのアプリです」
「欲張らず、まずは1〜3個から」「データはこの端末のブラウザにだけ保存されます」)
— **良い文章が、読まれない位置に置かれている**のがもったいない。

さらに first-run では **空のヒートマップ枠が最初から描画されている**。
記録ゼロで 52週分の灰色格子が広がるのは、達成感の器としては虚無に見える。

**【推奨修正】**
1. `#empty-state` を `#habit-form` の**前**、できれば「今日の記録」カードの位置に移す
   (DOM 移動のみ。JS の `renderEmptyState` は `hidden` の付け外しだけなのでロジック不変)。
2. 空状態カード内に **一次 CTA (`.btn.primary`「最初の習慣をつくる」)** を置き、
   押したらフォームの `#f-name` にフォーカスする。今は「次に何をするか」の指示が文章だけで、
   `--signal` が画面上に一点も存在しない = 進むべき先が色で示されていない。
3. 習慣が0件のときは `#heatmap-section` を隠すか、
   「記録がたまるとここに軌跡が現れます」のプレースホルダに差し替える。

---

### 🟡 F-6 【重大度: 軽微】`prefers-reduced-motion` を尊重していない

**【根拠 — 機械検査 + grep】**
- 機械検査: `🟠 [smell] motion-respected: the UI animates but ignores prefers-reduced-motion`
- grep: `prefers-reduced-motion` は 0 件。一方でトランジションは 2 箇所存在する:
  - `.btn { transition: border-color .15s ease, background .15s ease }` (L159)
  - `.row-main { transition: border-color .15s ease, transform .08s ease }` (L250)
  加えて `.btn:active` / `.row-main:active` に `transform: scale(.995)`。

**【該当箇所】** L159 / L250 / L162 / L253

**【推奨修正】** 末尾に4行:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    transition-duration: .01ms !important;
    animation-duration: .01ms !important;
  }
}
```
動きは `.995` の圧縮と 0.15s の色変化のみで元々控えめなため実害は小さく、軽微とした。
ただし **8つの機械検査で唯一赤い項目**であり、修正コストが4行である以上、放置する理由がない。

---

### 🟡 F-7 【重大度: 軽微】ヒートマップが「今日」ではなく52週前を映して開く

**【根拠 — 目視 + grep】**
- 目視: light/dark populated (#1/#3) いずれも、読み込み直後のヒートマップは
  **左端 (約1年前) を表示**しており、横スクロールバーは左端にあった。
  最新の記録・現在の連続日数に対応する右端は、**スクロールしないと見えない**。
- grep: `scrollLeft` は `app.html` 全体で **0 件**。初期スクロール位置の制御が存在しない。

**【該当箇所】** `.hm-scroll { overflow-x: auto }` (L325) / 描画関数 `renderHeatmap` 周辺 (L1560-)

**【なぜ問題か】**
習慣トラッカーを開く動機は「**今**どこまで続いているか」の確認である。
最も関心の低い1年前が既定表示で、最も関心の高い直近が隠れているのは、時間軸の向きが逆。
「現在 16日」という統計は上部に出ているので致命ではないが、
ヒートマップという主役 UI の初期状態としては誤っている。

**【推奨修正】** 描画完了後に1行:
```js
el.hmGrid.parentNode.scrollLeft = el.hmGrid.parentNode.scrollWidth;
```
(`.hm-scroll` を右端へ寄せる。既存のフォーカス制御 L1601-1613 とは独立。)

---

### 🟡 F-8 【重大度: 軽微】`text-transform: uppercase` が日本語見出しに対して死んだ宣言になっている

**【根拠 — ソース + 目視】**
- `h2.sec-title { text-transform: uppercase }` (L204) が宣言されているが、
  実際の見出しは「今日の記録」「記録のヒートマップ(直近52週)」「設定とデータ」「習慣の管理」
  といずれも日本語で、**uppercase は一切効かない**。
- 目視: light populated (#1) で見出しが大文字化されていないことを確認。

**【該当箇所】** L204

**【評価】**
`identity.md` §4 は「日本語見出しには大文字化が効かないため、字送り +0.10em と 700 ウェイトで
eyebrow の役を果たさせる」と **問題を正しく認識し、正しい代替策を書いている**。
その代替策 (letter-spacing .10em / font-weight 700) も実装されている。
にもかかわらず `text-transform: uppercase` が消し忘れられている。害はないが、
**「宣言はあるが効果はない」= 装飾的な宣言**の一例であり、identity の規律としては削るべき。

**【推奨修正】** L204 を削除する。将来英語ラベルが混じったとき、
意図しない大文字化で eyebrow の規律が崩れるのを防ぐ意味もある。

---

### 🟡 F-9 【重大度: 軽微】ブレークポイントが 520px の1点のみ / 940px〜表示幅の間が間延びする

**【根拠 — 機械検査 + 目視】**
- 機械検査: `responsive-declared: 1 width breakpoint(s) declared` — `@media (max-width: 520px)` (L428) のみ。
- 目視: 1280px 相当の広い窓 (#1/#3) では `max-width: 940px` のため中央に寄るが、
  **「今日の記録」の各行が940px 幅いっぱいに伸び、習慣名とその右の広大な余白の間が間延び**して見えた。
  行の情報 (名前・統計) は左端 1/3 に集中し、右 2/3 が空白になる。
- 狭い幅 (400px窓 / #5) は **崩れなし**。行・フォーム・ヒートマップいずれも折り返して収まっていた。
  この点は正当に評価する。

**【該当箇所】** `.wrap { max-width: 940px }` (L114) / `@media (max-width: 520px)` (L428)

**【推奨修正】**
致命ではない。行内の余白を活かすなら、広い幅でのみ
「連続日数」を右端に寄せた数値表示にする等の選択肢がある。
ただし `identity.md` は `max-width: 940px` を「機能不変」として据置と明記しているため、
本項は **後追いで良い提案** に留める。

---

## 3. 初見のユーザーの目で

### 最初の3秒で何のアプリか分かるか — △
`<title>` と H1 が「習慣トラッカー」なので **名前は分かる**。
だが H1 は **21px / weight 600** で、その左のブランドマークは **10px の丸** (L141)。
実際に見た印象は「小さく控えめな見出し」で、画面の主役になっていない。
editorial な抑制としては筋が通っているが、初回起動時 (#2/#4) はカードが空なので
**画面全体が「何も起きていない灰色の枠の集合」に見えた**。
「毎日の行動を記録して軌跡を眺める」という一番効く一文が、
スクロールしないと届かない位置にある (F-5)。

### 視覚的階層は正しいか — △
populated (#1/#3) では階層は概ね機能していた。
「今日の記録」の各行が最も大きな面積を占め、習慣名が weight 600、統計が 12.5px の `--fg-muted` で沈む。
`--signal` のオレンジが達成済み行にだけ乗るので **「今日やったもの」は一目で分かる**。
ここは identity の「攻撃色を達成に独占させる」という設計が正しく効いている。

**ただし逆が伝わらない** — 未達成が「押せる的」として立っていない (F-3)。
階層は「済」を持ち上げることには成功し、「未」を示すことに失敗している。
習慣トラッカーが毎朝伝えるべきなのは、むしろ後者である。

### 余白と情報密度 — ◯
カード padding 22px / カード間 20px / 本文 line-height 1.6 は息苦しくない。
`identity.md` §5 が「紙の余白を尊ぶ」として 18px→22px に上げた判断は、
実画面で見ても妥当だった。ヒートマップも `--cell-gap: 3px` で詰まりすぎていない。
**本レビューで唯一、宣言と実装と体感が完全に一致した領域。**

### 押せるものが押せると分かるか — ✕
- `.btn.primary`「追加する」はオレンジ塗り + pill で **明快に押せる** ✅
- `.btn`「編集」「削除」「JSON をエクスポート」は枠線 `--line` が **1.44:1** で、
  目視でも輪郭が弱く、pill 形状でかろうじてボタンと分かる程度 △
- `.check` の未達成丸は **1.19:1 で事実上見えない** ✕ (F-3)
- `.hm-cell` は 13px のボタンだが、見た目は完全に「図」であり、
  **クリックできることを示す手がかりが `cursor: pointer` (ホバー時) しかない** ✕ (F-4)

### 初回起動の空画面は寂しくないか — ✕ 寂しい
first-run (#2/#4) を実際に見た率直な印象は **「準備中の管理画面」**。
理由は3つ:
1. 説明文がフォームの下に追いやられている (F-5)
2. 記録ゼロなのに 52週分の空ヒートマップが描画され、灰色の格子が大面積を占める
3. **画面上に `--signal` が一点も存在しない。** identity が「唯一祝福すべき事象に独占させる」と決めた色が、
   まだ何も達成していない初回には当然ゼロ個で、結果として**進むべき方向を示す色が画面に無い**。
   一次 CTA を空状態に置けば、この矛盾は解ける。

---

## 4. 評価すべき点 (公平のため記録する)

指摘が務めだが、実測して確かに良かったものは記録しておく:

- **GitHub Primer への滑落は完全に断たれた。** 禁止色 11 種を grep したが検出 0 件。
  `identity.md` §0 が実測で告発した病は、実装で治っている。
- **テキストコントラストは宣言どおり再現された。** 自前計算で全ペアが AA 以上を確認 (§0-3)。
- **フォーカスリングが全インタラクティブ要素に通っている。**
  `outline: 2px solid var(--focus)` + `outline-offset`、ヒートマップセルにも個別に付与 (L375)。
  対地コントラストは light 4.11:1 / dark 6.43:1 で 3:1 を満たす。キーボード操作は見捨てられていない。
- **狭い幅 (400px) で崩れなかった。** 実際に見て確認した。
- **`--signal` トークンの分離判断が正しい。** `identity.md` §6 が指摘した
  「階調と操作色が同一トークンに縛られる」問題は、実装で解消されている。

---

## 5. 判定

# 🔴 REQUEST_CHANGES

**理由:**

機械検査は `no gaps, 1 smell` と告げ、`identity.md` の宣言はほぼ忠実に実装されている。
配色設計・タイポの規律・余白・フォーカス可視は、実測した限り確かに良い仕事である。
**しかしそれは「宣言したことを実装できたか」の検査であって、「使う人に届いたか」の検査ではない。**

出荷を止めるのは以下2点:

- **F-1 (致命)** — 主役であるヒートマップの L0/L1 が **1.02:1** で判別不能。
  「続いた軌跡を眺める」というアプリの中心的価値が、視覚的に成立していない。
- **F-2 (致命)** — `color-scheme` 未宣言により、ダークで明色スクロールバーが露出。
  ダークテーマに最も注力した identity が、1行の欠落で最後に破れている。

加えて **F-3 (未達成の丸が見えない)** は、毎日行う唯一の操作の的が認識されないという点で、
実質的に致命に近い。**F-4 / F-5** と併せ、いずれも修正コストは数行〜DOM 1ブロックの移動であり、
構造的な作り直しを要さない。

指摘は **9件 (致命2 / 重要3 / 軽微4)**。
本レビューの本質的な発見は、個別の欠陥そのものよりも
**「8つの機械検査を全て通過しながら、主役 UI が読めず、主操作の的が見えない状態が成立しうる」**
という事実である。F-1 は `contrast-aa` の検査対象外 (前景/背景ペアではないため)、
F-4 は `touch-target` が「32px以上の宣言が1つあるか」しか見ないため、いずれもすり抜けた。

> **検査への申し送り:** `visual-verify.js` に
> (a) 隣接する階調トークン間の最小分離比、
> (b) 非テキスト境界の 3:1 検査 (WCAG 1.4.11)、
> (c) 最小インタラクティブ要素サイズ (最大値でなく最小値)、
> (d) `color-scheme` 宣言の有無
> の4検査を追加することを、品質枢機卿に上申する。
> 今回この4つはいずれも **人間の目と手計算でしか見つからなかった。**

---

### 未確認事項 (再レビュー時に必ず見ること)

- 狭い幅 (380px) × ダークテーマ — **見ていない**
- 狭い幅 (380px) × 初回起動 — **見ていない**
- ツールチップの実表示 (ホバー/フォーカス時) — **見ていない**
- `#storage-warning` (localStorage 不可環境の警告帯) の実表示 — **見ていない**
- 習慣30件等の高密度状態 — **見ていない**

---

*審査中、`app.html` は一切改変していない (md5 `4459185c04f15eff47f37e670cd247eb` / `git status` クリーン)。*
*テーマ固定とデータ注入は `%LOCALAPPDATA%\Temp\uxrev\` 上のコピー4本に対してのみ行った。*
