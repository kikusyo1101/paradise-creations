# 天秤 — 視覚アイデンティティ

> 位相: architecture / 創造物 slug: `tenbin`
> 出典: `paradise/graph/identity.js suggest`(候補3件)/ 台帳記録済み(`record tenbin ferrari` → `{"ok":true}`)
> 根拠資料: `prd.md` §1(プロダクト定義)、§5(画面文言)
> **本文書のコントラスト比は全て W3C 相対輝度式(WCAG 2.x)を実装して計算した実測値である。目測値・引用値は一つも含まない。**

---

## 1. 選定した方向

### 採用

| 項目 | 値 |
|---|---|
| **id** | `ferrari` |
| **family** | `automotive` |
| **traits** | `editorial-serif` / `motorsport` / `luxury` |
| **score** | 1(候補中最上位) |
| **source** | https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/ferrari/DESIGN.md |

identity.js の記述より要点:

> ベースキャンバスは **near-black**(`#181818`)で純白のディスプレイ書体を保持する。白キャンバスの帯は特定のエディトリアル文脈(中古車リスト、価格表)の内側にのみ現れる。単一のブランド電圧は **Rosso Corsa**(`#da291c`)で、主要CTA・跳ね馬マーク上に**乏しく**使われる。

### 選定理由 — 天秤の三つの性質との接続

**(1)「決めていい」という許可を与える → near-black のエディトリアル・キャンバス**

天秤の一次出力は順位ではなく頑健性文である(PRD FR-07「一次出力は FR-11 の頑健性文であり、順位は二次表示として頑健性文の下に置く」)。
つまりこのアプリの画面の主役は**読ませる一段落の文章**であって、ダッシュボードのウィジェット群ではない。`#181818` の全面暗色キャンバスに白のディスプレイ体を置く構成は、SaaS ダッシュボードではなく**雑誌の見開き**の構造をとる — 視線が最初に落ちる場所が一箇所しかない。
「ベンダーB の1位は、移行コストの重みを 15.0% から 21.8%(+6.8ポイント)に動かすと ベンダーA に入れ替わります」(PRD §5-1)という文は、カードの中に埋もれてはならない。**エディトリアルは、文章に権威を与えるための唯一の版面設計である。** 決断の許可は、権威ある一文からしか出ない。

**(2) 数値の信頼性が命 → 単一ブランド電圧の「乏しい」使用**

天秤が最も避けねばならない失敗は、**装飾によって数値が嘘に見えること**である。PRD FR-14 は貢献度分解について「学術的に検証された指標とは称さない」と明記し、FR-12 は θ=0.10 について「理論的裏付けを持たない経験則であること」をツールチップに書けと命じている。この製品は自分の限界を自分で言う製品だ。
そこに多色パレットは致命的に噛み合わない。ferrari は**アクセントを1色しか持たない**(Rosso Corsa `#da291c` 系列3値のみで、残りは全て無彩色)。色数が1色に絞られると、色は「意味」になる — 赤が付いている箇所だけが「今この結論を握っている場所」だと、学習なしに読める。7色のパレットでは不可能な精度である。

**(3) 決断の重みを感じさせる → motorsport の緊張感、luxury の間**

`motorsport` は「速い」ではなく **「取り返しがつかない」** という感覚を運ぶ trait である。逆転閾値 Δ* が 0.4 ポイントだと表示されたとき、画面はその薄氷を薄氷として描かねばならない。
`luxury` が同時に入っていることが重要で、これは**余白を怖がらない**ことを許可する。天秤は最大でも 10 選択肢 × 10 基準 = 100 セルしか扱わない(PRD FR-02 ハード上限)。情報密度で勝負する製品ではない。詰め込まず、一文を大きく置いてよい。

### 落選させた候補と理由

| 候補 | family | 落選理由 |
|---|---|---|
| **`dell-1996`**(score 6) | `retro_hardware` | **信頼性と正面衝突する。** 「NEW! バースト」「アワードシール」「ベベル加工の手切り GIF ステッカー」という視覚語彙を持つ。天秤は勝者に `robust / contingent / fragile` のラベルを付ける製品であり、これはシールやバッジと形が近い。1996年カタログの装飾語彙で頑健性ラベルを描いた瞬間、**Δ\* = 0.4 ポイントという厳密計算値が、通販の「オススメ!」と同じ視覚階級に落ちる。** PRD §5-1 が禁じている「根拠なきヒューリスティック」に、実装ではなく見た目の側から堕ちる。加えてセージ/サーモン/ペリウィンクル/スカイ/ピーチ/ライムの6色ブロックは、上の理由(2)の「色=意味」を完全に破壊する。 |
| **`pinterest`**(score 9) | `consumer_brand` | **「決めていい」の逆を運ぶ。** Pinterest の視覚言語は発見・回遊・保存 — **決定を先送りさせるための設計**である(ピンして後で見る)。天秤は締切のある個人決断者(PRD §1-2「転職オファー2社を今夜中に決める」)のための道具で、価値の方向が正反対を向いている。加えて identity.js が返した description が `"|"` の1文字のみで、**設計意図を読み取れる記述が存在しない。** 出典が語らないアイデンティティを採用すると、実装時に結局「AIの平均的な顔」に回帰する — この機構が根絶しようとしているものそのものになる。 |

なお `rejected_head` にあった `bmw` / `tesla` / `lamborghini` は同じ `automotive` family のため機構により除外されている(規則:候補は family を重複させない)。`ferrari` はその family の代表として上がってきた1件である。

---

## 2. カラートークン

### 2-1. identity.js palette の原値(発明なし)

| 役割(identity.js) | HEX |
|---|---|
| primary | `#da291c` |
| primary-active | `#b01e0a` |
| primary-hover | `#9d2211` |
| ink | `#ffffff` |
| body | `#969696` |
| body-strong | `#ffffff` |
| body-on-light | `#181818` |
| muted | `#666666` |
| muted-soft | `#8f8f8f` |
| hairline | `#303030` |

キャンバス `#181818` は description 本文が明示している base canvas(= `body-on-light` と同値)。

### 2-2. 導出色(3値のみ・導出方法を明記)

**identity.js の palette に無い色は、以下の3つだけを、上記原値からの sRGB 線形補間で導出した。他に色は一切追加しない。**

| 導出トークン | HEX | 導出方法 |
|---|---|---|
| `--surface` | `#242424` | `canvas #181818` と `hairline #303030` の **50% 混色**。パネル地。原値2つの中間なので新しい色相を導入しない。 |
| `--band-winner` | `#3b1b19` | `canvas #181818` に `primary #da291c` を **18%** 混色。勝者行の帯。赤の色相だけを borrow し、彩度は canvas 側に強く寄せる。 |
| `--fragile-ink` | `#e7746b` | `primary #da291c` を `ink #ffffff` 方向へ **35%** 混色。**理由:`#da291c` は canvas 上 3.65:1 で本文 AA(4.5:1)を満たさない。** fragile の理由文は本文として読ませる必要があるため(PRD FR-11「ラベル単独では表示しない」= 必ず文章を伴う)、本文適格な赤が必要になった。混色率は 4.5:1 を満たす最小の 5% 刻み(30%=5.51:1)より一段安全側を取り 35% とした。 |

### 2-3. このアプリに必要な役割の割り当て

| 役割名 | HEX | 用途 |
|---|---|---|
| `--canvas` | `#181818` | 全面背景。エディトリアル・キャンバス |
| `--surface` | `#242424` | 導出。グリッド/パネルの地。canvas との差は 1.14:1 で**境界は線で描く**(色差では描かない) |
| `--ink` | `#ffffff` | 見出し・総合スコア数値・勝者名 |
| `--body` | `#969696` | 本文・理由文・表のラベル |
| `--muted-soft` | `#8f8f8f` | **コスト基準の印**(「低いほど良い」)、補助注記 |
| `--muted` | `#666666` | 非活性・プレースホルダ。**本文には使わない**(3.09:1) |
| `--hairline` | `#303030` | 罫線・表のセル境界・パネル境界 |
| `--primary` | `#da291c` | **単一ブランド電圧。** 逆転閾値の印、勝者の細い縦罫、主要CTA塗り |
| `--primary-hover` | `#9d2211` | CTA hover 時の**塗り**のみ |
| `--primary-active` | `#b01e0a` | CTA active 時の**塗り**のみ |
| `--fragile-ink` | `#e7746b` | 導出。**fragile 色** — 理由文の本文色・ラベル語 |
| `--contingent-ink` | `#969696` | **contingent 色**(= `body`)。判断保留は「地の文の色」である |
| `--robust-ink` | `#ffffff` | **robust 色**(= `ink`)。結論が動かないことは最も明るいこと |
| `--band-winner` | `#3b1b19` | 導出。**勝者ハイライト**の行帯 |
| `--warn-ink` | `#ffffff` | **警告**(FR-18 逆算検知)の文字色 |
| `--warn-rule` | `#da291c` | 警告ブロックの左太罫 4px。**塗りつぶし背景は使わない**(警告はモーダルでなく地の文の隣、PRD FR-18「編集をブロックしない」) |

### 2-4. コントラスト比 — 実測値(WCAG 2.x 相対輝度式で計算)

**本文 AA = 4.5:1 / 大きい文字(18.66px+bold または 24px+)・UI部品 AA = 3:1**

#### 使用を許可する組み合わせ(全て PASS)

| 前景 | 背景 | 実測比 | 4.5:1 | 3:1 |
|---|---|---|---|---|
| `--ink #ffffff` | `--canvas #181818` | **17.76:1** | PASS | PASS |
| `--ink #ffffff` | `--surface #242424` | **15.52:1** | PASS | PASS |
| `--ink #ffffff` | `--band-winner #3b1b19` | **15.48:1** | PASS | PASS |
| `--ink #ffffff` | `--primary #da291c`(CTA塗り) | **4.87:1** | PASS | PASS |
| `--body #969696` | `--canvas #181818` | **6.00:1** | PASS | PASS |
| `--body #969696` | `--surface #242424` | **5.25:1** | PASS | PASS |
| `--body #969696` | `--band-winner #3b1b19` | **5.23:1** | PASS | PASS |
| `--muted-soft #8f8f8f` | `--canvas #181818` | **5.49:1** | PASS | PASS |
| `--muted-soft #8f8f8f` | `--surface #242424` | **4.80:1** | PASS | PASS |
| `--fragile-ink #e7746b` | `--canvas #181818` | **6.01:1** | PASS | PASS |
| `--fragile-ink #e7746b` | `--surface #242424` | **5.25:1** | PASS | PASS |
| `--fragile-ink #e7746b` | `--band-winner #3b1b19` | **5.24:1** | PASS | PASS |

#### 大きい文字 / 非テキストUI に限り許可(3:1 は満たすが 4.5:1 未満)

| 前景 | 背景 | 実測比 | 判定 |
|---|---|---|---|
| `--primary #da291c` | `--canvas #181818` | **3.65:1** | 本文 **FAIL** / 大文字・罫線・バー **PASS** |
| `--primary #da291c` | `--surface #242424` | **3.19:1** | 本文 **FAIL** / 大文字・罫線・バー **PASS** |
| `--muted #666666` | `--canvas #181818` | **3.09:1** | 本文 **FAIL** / 非活性ラベルのみ **PASS** |

#### 使わないと明記する組み合わせ

**以下は AA を満たさないため、実装で使用してはならない。**

| 前景 | 背景 | 実測比 | 措置 |
|---|---|---|---|
| `--primary-hover #9d2211` | `--canvas #181818` | **2.26:1** | **文字色として使用禁止。** 塗りの背景専用(その上には `--ink` を載せ 4.87:1 以上を確保) |
| `--primary-active #b01e0a` | `--canvas #181818` | **2.57:1** | **文字色として使用禁止。** 同上 |
| `--muted #666666` | `--surface #242424` | **2.70:1** | **surface 上での使用禁止。** surface 上の弱いテキストは `--muted-soft`(4.80:1)を使う |
| `--hairline #303030` | `--canvas #181818` | **1.35:1** | テキスト・意味を持つUI部品には使用禁止。**純粋な装飾罫のみ** |
| `--surface #242424` | `--canvas #181818` | **1.14:1** | 面の差だけでパネル境界を示すことを禁止。**必ず `--hairline` の 1px 罫を併用する** |
| `--band-winner #3b1b19` | `--canvas #181818` | **1.15:1** | 帯の色だけで勝者を示すことを禁止。**必ず `--primary` の 3px 左罫(3.65:1)と語「1位」を併用する** |

#### 重みバー塗り(非テキスト 3:1)— 全 PASS

`--ink #ffffff` 17.76:1 / `--fragile-ink #e7746b` 6.01:1 / `--body #969696` 6.00:1 / `--muted-soft #8f8f8f` 5.49:1 / `--primary #da291c` 3.65:1 / `--muted #666666` 3.09:1 — いずれも canvas 上で 3:1 以上。

#### 重大な注意 — 輝度が一致する組み合わせ

`--fragile-ink #e7746b` と `--contingent-ink #969696` の相互コントラストは **1.00:1**(輝度がほぼ完全に一致)。
両者は**色相でしか区別できない**。したがって PRD FR-26 ④ の要求(「robust/fragile/contingent は色に加えて語とアイコン形状で区別する」)は**任意ではなく必須制約**である。色覚差のある利用者には、この2ラベルは同一に見える。語(`fragile` / `contingent`)と形(§5 の印)を必ず併記すること。

---

## 3. タイポグラフィ

**制約:単一HTML・外部CDN禁止 → Webフォント読み込み不可。** ferrari の `'FerrariSans'` は使用できないため、trait `editorial-serif` と motorsport の性格を **OS 標準フォントのスタックに翻訳**する。

### 3-1. 見出し系 — エディトリアル・セリフ

`editorial-serif` trait を直接受ける。雑誌の見開き見出しの役割。頑健性の一次出力文と、選択肢名・見出しに使う。

```css
--font-display: "Hiragino Mincho ProN", "Yu Mincho", YuMincho, "MS PMincho",
                Georgia, "Times New Roman", "Noto Serif JP", serif;
```

- macOS: `Hiragino Mincho ProN`(和文)/ `Georgia`(欧文)
- Windows: `Yu Mincho`(游明朝、Win8.1+ 標準)/ 無ければ `MS PMincho` / 欧文は `Georgia`(Windows 標準同梱)
- 和文明朝を先頭に置くのは、PRD §5 の文言が全て日本語の文章だから。欧文セリフを先に置くと和文が明朝にならない。

### 3-2. 本文系 — ニュートラル・グロテスク

理由文・表ラベル・UIラベル。読ませるが主張しない。

```css
--font-body: "Hiragino Kaku Gothic ProN", "Yu Gothic UI", "Yu Gothic",
             "Meiryo", -apple-system, "Segoe UI", system-ui,
             "Helvetica Neue", Arial, sans-serif;
```

- macOS: `Hiragino Kaku Gothic ProN` / `-apple-system`(San Francisco)
- Windows: `Yu Gothic UI`(Win10+ 標準)/ `Meiryo` / `Segoe UI`
- **`Inter` を書かない。** 入っていない環境が大半である上、この機構が排除しようとしている「AIの平均的な顔」の主成分である。

### 3-3. 数値系 — 等幅・タブular

**このアプリで最も重要なスタック。** 総合スコア、`Δw_k`、`w_k → w_k*`、貢献度 `g_j`、しきい値 θ — すべてライブで変わる数値である(PRD FR-06「計算ボタンを持たない」)。桁が動くと数字が横に踊り、**信頼性が視覚的に破壊される。**

```css
--font-numeric: ui-monospace, "SF Mono", Menlo, Consolas,
                "Cascadia Mono", "DejaVu Sans Mono", monospace;
```

- macOS: `SF Mono` / `Menlo`
- Windows: `Consolas`(標準同梱)/ `Cascadia Mono`(Win11 標準)

**必須指定 — 例外なし:**

```css
.num, input[type="number"], td.score, .delta, .weight, .pct {
  font-family: var(--font-numeric);
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum" 1, "lnum" 1;
  letter-spacing: 0;
}
```

`font-variant-numeric: tabular-nums` は等幅フォントでも**明示的に書く**。フォールバックが比例フォントに落ちた環境(和文フォントが数字を持っている場合など)で桁揃えを守る最後の防衛線になる。

### 3-4. スケール

| 用途 | size | weight | line-height | family |
|---|---|---|---|---|
| 頑健性ラベル(`fragile` 等) | 28px | 700 | 1.2 | display |
| 一次出力文(§5-1 の理由文) | 20px | 400 | 1.7 | display |
| 総合スコア(0-100) | 34px | 400 | 1.0 | numeric |
| セクション見出し | 17px | 700 | 1.3 | body |
| 本文・表ラベル | 15px | 400 | 1.75 | body |
| 表内の数値・Δw | 14px | 400 | 1.5 | numeric |
| 注記・但し書き | 13px | 400 | 1.7 | body |

- 一次出力文が 20px / line-height 1.7 なのは、これが**読ませる段落**だからである。14px のカード本文にしてはならない。
- 28px / 700 のラベルは大きい文字扱い(3:1 で足りる)だが、採用色は全て 4.5:1 以上を満たしている。

---

## 4. 形・余白・線

### 角丸

| 対象 | 値 |
|---|---|
| パネル・グリッド・帯 | `0px`(**完全な直角**) |
| ボタン・入力欄 | `2px`(ほぼ直角) |
| 重みバー・貢献度バー | `0px` |
| 例外 | なし |

**エディトリアルの版面は罫と直角でできている。** 12px / 16px の丸いカードは、この機構が根絶対象に挙げている「AIの平均的な顔」の中核要素であり、同時に motorsport の緊張感を殺す。

### 線幅

| 対象 | 値 | 色 |
|---|---|---|
| セル罫・表の境界 | `1px` | `--hairline` |
| パネル境界 | `1px` | `--hairline` |
| 勝者行の左罫 | `3px` | `--primary` |
| 警告ブロックの左罫 | `4px` | `--primary` |
| 逆転閾値マーカー | `2px` | `--primary` |
| セクション区切りの太罫 | `2px` | `--hairline` |
| フォーカスリング | `2px solid #ffffff` + `outline-offset: 2px` | `--ink` |

フォーカスリングを `--primary` ではなく `--ink`(17.76:1)にするのは、キーボード操作の全経路保証(PRD FR-26 ⑤/US-15)において、可視性を赤の 3.65:1 に依存させないため。

### 陰影

**`box-shadow` によるドロップシャドウを一切使わない。** 階層は罫と余白と地の明度差だけで表現する。唯一の例外は上記フォーカスリング相当の `outline`(影ではない)。

### 余白スケール(4px グリッド)

```
4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96
```

| 対象 | 値 |
|---|---|
| セル内パディング | `8px 12px` |
| パネル内パディング | `24px` |
| セクション間 | `48px` |
| 一次出力ブロックの上下 | `64px`(**最大の間を与える。luxury trait の実装**) |
| 版面最大幅 | `1120px`(中央寄せ) |
| 一次出力文の行長 | `max-width: 62ch`(読みやすさの上限) |

---

## 5. このアプリ固有の視覚語彙

**制約:CSS だけで描けるものに限る**(PRD FR-25「CSS の幅指定と inline SVG のみ」)。以下は全て CSS のボックス・境界・グラデーション位置指定で描ける。

### 5-1. 天秤という名に応える基本モチーフ — 「支点のある横棒」

天秤の皿を絵として描かない(アイコン画像は禁止であり、そもそも意味がない)。代わりに、**この製品のあらゆる横棒に支点(fulcrum)を与える。**

支点 = バーの上に立つ `--primary` の 2px 縦線。バーの現在値の位置ではなく、**「そこを越えると意味が変わる位置」に立つ。**

```
基準: 移行コスト
現在 15.0%                     ↓ 支点 = 逆転閾値 21.8%
[████████████░░░░░░░░░░│░░░░░░░░░░░░░░░░░░░]
 ^ 塗り = 現在の重み     ^ --primary 2px 縦罫
```

これで「重みバー」「逆転閾値の印」が**同一の視覚文法**になる。天秤とは、**傾きと、傾きが反転する一点を同時に見せる装置**である。

### 5-2. 重みバー(FR-05 / FR-10 ②③)

```css
.weight-bar {
  height: 6px;                        /* 細い。バーは主役ではない */
  background: var(--hairline);        /* トラック */
  border-radius: 0;
  position: relative;
}
.weight-bar > .fill {
  height: 100%;
  background: var(--body);            /* 6.00:1 — 通常は無彩色 */
  width: calc(var(--w) * 1%);
}
.weight-bar.is-critical > .fill {
  background: var(--fragile-ink);     /* 6.01:1 — 最も臨界な基準 k* のみ赤系 */
}
```

- トラックは `--hairline`、塗りは `--body`。**通常の重みバーに色を使わない。** 赤は「今この結論を握っている基準 k\*」1本だけに与える(単一ブランド電圧の原則)。
- 高さ 6px。バーは数値の補助であって、数値の代わりではない(FR-26 ①「バーには必ず数値ラベルを併記」)。

### 5-3. 逆転閾値の印(FR-08 / FR-10 ③)

支点そのもの。`--primary` の 2px 縦線を、バー内の `Δw` 到達位置に絶対配置する。

```css
.weight-bar > .fulcrum {
  position: absolute;
  top: -5px; bottom: -5px;            /* バーより上下に 5px 突き出す */
  width: 2px;
  background: var(--primary);         /* 3.65:1 — 非テキストUIとして PASS */
  left: calc(var(--threshold) * 1%);
  transform: translateX(-1px);
}
.weight-bar > .fulcrum::after {
  content: "";                        /* 支点の三角 — CSS 三角形 */
  position: absolute;
  top: -6px; left: -4px;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-bottom: 6px solid var(--primary);
}
```

- 上下に突き出させるのは、**塗りの終端と混同させないため**。
- 三角形は border トリックのみ。画像・SVG ファイル不要。
- **必ず数値ラベル(`21.8%` / `+6.8ポイント`)を隣に置く**(FR-10 ③④、FR-26 ①)。

### 5-4. 支配的優位=逆転不能の印(FR-09 / §5-2)

**赤を使わない。** 逆転不能は「何も起きない」ことであり、電圧を与えてはならない。バーの支点を**消し**、代わりにトラック全体を斜線ハッチで塗りつぶす — 「この軸には可動域が無い」という意味を形で描く。

```css
.weight-bar.is-dominant > .fulcrum { display: none; }
.weight-bar.is-dominant {
  background: repeating-linear-gradient(
    135deg,
    var(--hairline) 0 3px,
    var(--canvas)   3px 6px
  );
}
.row.is-dominant .label::before {
  content: "— ";                      /* 語での区別。∞ 記号は使わない */
  color: var(--muted-soft);           /* 5.49:1 */
}
```

- 行は臨界度ランキングの**末尾**に置く(FR-10)。
- 語「逆転不能」と理由文を必ず添える(§5-2 の正典テンプレート)。色と形だけで伝えない。

### 5-5. 勝者ハイライト(FR-07)

```css
.rank-row.is-winner {
  background: var(--band-winner);     /* #3b1b19 — 単独では 1.15:1、意味を担わせない */
  border-left: 3px solid var(--primary);   /* 3.65:1 — 形で担保 */
  padding-left: 21px;                 /* 24px - 3px、他行と字面を揃える */
}
.rank-row.is-winner .name {
  font-family: var(--font-display);
  color: var(--ink);                  /* 15.48:1 */
}
```

帯・罫・書体・語(「1位」)の**四重**で示す。帯の色は雰囲気だけを担い、意味は担わない。

### 5-6. 頑健性ラベルの形(FR-26 ④ — 色に加えて語と形)

§2-4 の通り fragile と contingent は**輝度が一致する**ため、形の区別は必須。

| ラベル | 色 | 形(CSS のみ) | 語 |
|---|---|---|---|
| `robust` | `--robust-ink #ffffff` 17.76:1 | 左に **4px 実線**の縦罫 | 「robust —」 |
| `contingent` | `--contingent-ink #969696` 6.00:1 | 左に **4px 破線**の縦罫(`border-left-style: dashed`) | 「contingent —」 |
| `fragile` | `--fragile-ink #e7746b` 6.01:1 | 左に **4px 点線**の縦罫(`dotted`)+ 下に 1px の `--primary` 罫 | 「fragile —」 |

実線 → 破線 → 点線 は「連続性が失われていく」ことの直接的な表現であり、頑健性の意味とそのまま対応する。

### 5-7. 貢献度バー(FR-13 — `g_j < 0` は逆符号)

中央を 0 とする**双方向バー**。左右で色を変えず、**方向のみで符号を示す**(色に意味を持たせない原則の徹底)。

```css
.contrib { display: grid; grid-template-columns: 1fr 1px 1fr; }
.contrib > .axis { background: var(--primary); }   /* 中央軸 = 支点。3.65:1 */
.contrib > .neg  { justify-self: end;   background: var(--muted-soft); }  /* 5.49:1 */
.contrib > .pos  { justify-self: start; background: var(--body); }        /* 6.00:1 */
```

中央軸が `--primary` になることで、**貢献度バーもまた「支点のある横棒」= 天秤**になる。§5-1 の文法が全画面で一貫する。数値ラベル(符号付き %、小数1桁)を必ず併記(FR-13)。

### 5-8. コスト基準の印(FR-04)

```css
.criterion.is-cost .dir::before {
  content: "↓";
  color: var(--muted-soft);           /* 5.49:1 */
  font-family: var(--font-numeric);
  margin-right: 4px;
}
```

- 記号 `↓` + 語「低いほど良い」を併記(記号だけにしない)。
- **色は `--muted-soft` の無彩色。** コストは「悪い」ではなく「向きが逆」なだけであり、赤で警告してはならない。天秤は価値判断をしない。

### 5-9. 警告 — 逆算検知(FR-18 / §5-4)

```css
.warn {
  border-left: 4px solid var(--primary);   /* 3.65:1 */
  background: none;                        /* 塗りつぶさない */
  padding: 12px 0 12px 20px;
  color: var(--warn-ink);                  /* #ffffff / canvas = 17.76:1 */
  font-family: var(--font-body);
}
```

**モーダル・オーバーレイ・確認ダイアログにしない**(FR-18「編集をブロックしない」)。地の文の隣に、左太罫だけで立つ。警告は視界を奪う権利を持たない。

### 5-10. プライバシー表示(FR-24 / §5-5)

`--muted-soft`(5.49:1)、`--font-numeric`、`13px`、版面フッタ。上部に `--hairline` の 1px 罫。
**アイコン(鍵・盾)を使わない。** 文が事実を述べる — 「どこにも送信していません」。バッジ化した瞬間にマーケティング文言に見え、§1 理由(2)の信頼性を毀損する。

---

## 6. do / don't

**このアイデンティティを壊す実装の禁止事項。実装者はこの節を最も強く守ること。**

1. **青紫のグラデーション(`#667eea` → `#764ba2` 系)を一切使わない。** グラデーション自体を背景に使わない。唯一許可される `linear-gradient` は §5-4 のハッチ(`repeating-linear-gradient`)のみ。
2. **`Inter` / `Roboto` / `Poppins` / `Nunito` を font-family に書かない。** §3 の3スタック以外を使わない。`@import` / `<link>` によるWebフォント読み込みは FR-23 違反であり、そもそも動かない。
3. **角丸 8px / 12px / 16px の「カード」を作らない。** 角丸は 0px、ボタン・入力欄のみ 2px。`border-radius: 50%` の丸バッジも禁止。
4. **`box-shadow` を書かない。** ドロップシャドウ・グロー・`filter: blur()` による浮遊感を一切使わない。階層は罫・余白・地の明度だけで作る。
5. **`--primary #da291c` を本文テキスト色に使わない**(canvas 上 3.65:1、surface 上 3.19:1 で AA 未達)。赤の文章が必要なら `--fragile-ink #e7746b`(6.01:1)を使う。
6. **`--primary-hover #9d2211`(2.26:1)/ `--primary-active #b01e0a`(2.57:1)を文字色に使わない。** これらは塗りの背景専用で、その上には必ず `--ink`(4.87:1)を載せる。
7. **`--muted #666666` を `--surface #242424` の上に置かない**(2.70:1)。surface 上の弱いテキストは必ず `--muted-soft`(4.80:1)。
8. **背景色の差だけでパネル境界・勝者行を示さない。** surface/canvas は 1.14:1、band-winner/canvas は 1.15:1 しかない。必ず `--hairline` 罫または `--primary` 左罫を併用する。
9. **`robust` / `contingent` / `fragile` を色だけで区別しない。** fragile と contingent の相互コントラストは **1.00:1** で、輝度が一致している。§5-6 の語 + 罫スタイル(実線/破線/点線)を必ず併記する。
10. **信号色(緑 `#22c55e` / 黄 `#eab308` / 青 `#3b82f6`)を追加しない。** このパレットの有彩色は Rosso Corsa 系列**のみ**である。robust を緑にした瞬間、単一ブランド電圧の原則(§1 理由(2))が崩れ、赤が「意味」でなくなる。
11. **数値に比例フォントを使わない。** スコア・重み・Δw・%・θ を表示する全要素に `--font-numeric` と `font-variant-numeric: tabular-nums` を指定する。ライブ更新で桁が横に踊る実装は信頼性の直接的な破壊である。
12. **順位表を一次出力の上に置かない。** 画面の最上部は必ず §5-1 の頑健性の理由文(20px / display / 62ch)。順位はその下(PRD FR-07)。
13. **警告をモーダル・`alert()`・オーバーレイにしない**(FR-18)。左太罫のブロックとして地の文の隣に置く。
14. **アイコンフォント・絵文字・SVG スプライトを持ち込まない。** 形は border / CSS 三角形 / 罫スタイルだけで作る(FR-23 / FR-25)。
15. **アニメーションで数値を演出しない。** カウントアップ、バーのイージング付き伸長、パルスを使わない。許可される transition は `background-color` と `border-color` の `120ms linear` のみ。FR-06 は 16ms 以内の即時再計算を要求しており、演出はそれを嘘にする。
16. **コスト基準を赤/警告色で示さない。** `--muted-soft` の無彩色 + `↓` + 語のみ(§5-8)。

---

## 7. CSS カスタムプロパティ定義

```css
:root {
  /* ── 面 ─────────────────────────────────────────── */
  --canvas:          #181818;  /* identity.js: body-on-light / description の base canvas */
  --surface:         #242424;  /* 導出: canvas × hairline 50% */
  --band-winner:     #3b1b19;  /* 導出: canvas × primary 18% */

  /* ── 文字 ───────────────────────────────────────── */
  --ink:             #ffffff;  /* 17.76:1 on canvas */
  --body:            #969696;  /*  6.00:1 on canvas /  5.25:1 on surface */
  --muted-soft:      #8f8f8f;  /*  5.49:1 on canvas /  4.80:1 on surface */
  --muted:           #666666;  /*  3.09:1 on canvas — 非活性のみ。surface 上は使用禁止 */

  /* ── 線 ─────────────────────────────────────────── */
  --hairline:        #303030;  /*  1.35:1 — 装飾罫のみ。テキスト禁止 */

  /* ── 単一ブランド電圧(Rosso Corsa)───────────────── */
  --primary:         #da291c;  /*  3.65:1 on canvas — 非テキストUI・大文字のみ */
  --primary-hover:   #9d2211;  /*  塗り専用。文字色禁止(2.26:1) */
  --primary-active:  #b01e0a;  /*  塗り専用。文字色禁止(2.57:1) */
  --on-primary:      #ffffff;  /*  4.87:1 on primary */

  /* ── 頑健性ラベル ──────────────────────────────── */
  --robust-ink:      #ffffff;  /* 17.76:1 — 実線罫 + 語 "robust" */
  --contingent-ink:  #969696;  /*  6.00:1 — 破線罫 + 語 "contingent" */
  --fragile-ink:     #e7746b;  /*  6.01:1 — 点線罫 + 語 "fragile"
                                  導出: primary × ink 35%(primary は本文 AA 未達のため) */

  /* ── 意味役割 ──────────────────────────────────── */
  --cost-mark:       var(--muted-soft);  /* コスト基準「↓ 低いほど良い」 5.49:1 */
  --warn-ink:        #ffffff;            /* 逆算検知の本文 17.76:1 */
  --warn-rule:       var(--primary);     /* 逆算検知の左 4px 罫 3.65:1 */
  --fulcrum:         var(--primary);     /* 逆転閾値の支点 2px 3.65:1 */
  --bar-track:       var(--hairline);
  --bar-fill:        var(--body);        /* 通常の重みバー(無彩色)6.00:1 */
  --bar-fill-crit:   var(--fragile-ink); /* 最臨界基準 k* のみ 6.01:1 */
  --focus-ring:      #ffffff;            /* 17.76:1 */

  /* ── 書体(外部フォント読み込みなし)────────────── */
  --font-display: "Hiragino Mincho ProN", "Yu Mincho", YuMincho, "MS PMincho",
                  Georgia, "Times New Roman", "Noto Serif JP", serif;
  --font-body:    "Hiragino Kaku Gothic ProN", "Yu Gothic UI", "Yu Gothic",
                  "Meiryo", -apple-system, "Segoe UI", system-ui,
                  "Helvetica Neue", Arial, sans-serif;
  --font-numeric: ui-monospace, "SF Mono", Menlo, Consolas,
                  "Cascadia Mono", "DejaVu Sans Mono", monospace;

  /* ── 文字サイズ ────────────────────────────────── */
  --fs-label:    28px;  /* 頑健性ラベル */
  --fs-lede:     20px;  /* 一次出力文 */
  --fs-score:    34px;  /* 総合スコア */
  --fs-head:     17px;  /* セクション見出し */
  --fs-body:     15px;  /* 本文 */
  --fs-num:      14px;  /* 表内数値 */
  --fs-note:     13px;  /* 但し書き */

  --lh-tight:    1.2;
  --lh-lede:     1.7;
  --lh-body:     1.75;

  /* ── 余白(4px グリッド)──────────────────────── */
  --sp-1:   4px;
  --sp-2:   8px;
  --sp-3:  12px;
  --sp-4:  16px;
  --sp-6:  24px;
  --sp-8:  32px;
  --sp-12: 48px;
  --sp-16: 64px;
  --sp-24: 96px;

  /* ── 形 ─────────────────────────────────────────── */
  --radius:        0px;   /* パネル・帯・バー */
  --radius-ctl:    2px;   /* ボタン・入力欄のみ */
  --rule:          1px;   /* 罫 */
  --rule-strong:   2px;   /* 区切り太罫・支点 */
  --rule-accent:   3px;   /* 勝者左罫 */
  --rule-warn:     4px;   /* 警告左罫 */
  --shadow:        none;  /* 陰影は存在しない */

  /* ── 版面 ───────────────────────────────────────── */
  --measure-max:  1120px; /* 版面最大幅 */
  --measure-text:   62ch; /* 一次出力文の行長 */

  /* ── 動き(最小限)────────────────────────────── */
  --motion: 120ms linear;
}

@media (prefers-reduced-motion: reduce) {
  :root { --motion: 0ms; }
}
```
