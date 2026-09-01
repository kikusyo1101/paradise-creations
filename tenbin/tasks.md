# 天秤 — 詳細設計と実装タスク

> 位相: architecture(詳細設計)/ 創造物 slug: `tenbin`
> 入力: `prd.md`(643行、FR-01〜FR-26 / AC-01〜AC-26)、`design.md`(1547行)、`ux.md`(916行)、`identity.md`(561行)
> **本文書は実装タスクへの分解と署名の確定のみを行う。`index.html` の実装コードは含まない。**
> 本文書の §1 に載せた入出力例は、すべて実際に計算して得た値である(推定値・引用値を含まない)。計算は binary64(Python `float` = JS `Number` と同一表現)で行い、`Fraction` による厳密値と突き合わせた。
> 数式(逆転閾値 `Δw_k = D₀(1−w_k)/(D₀−d_k)`、`w_k* = w_k + Δw_k`)は変更していない。

---

## 0. この文書の使い方

- **§1** は関数の契約表である。実装者は §1 の「入出力例」をそのままテストの1本目に書ける。
- **§2** は `index.html` の物理配置である。上から順に書けば依存が解決する。
- **§3** が本体。T-01 から T-34 まで、依存順に並んでいる。**上から順に着手すれば、先行タスクが常に完了している。**
- **§5** に位相間の矛盾と裁定を書いた。**実装者は §5 を着手前に読むこと。** 読まずに ux.md と identity.md を素直に実装すると衝突する。
- **§6** が完成判定である。

---

## 1. インターフェース確定

`design.md` §4 の全関数について、実装者が迷わない粒度まで固める。
**全関数は純粋である。** 引数を破壊せず、外部を読まず、例外を投げず、事前条件を破った呼び出しには定義された縮退値を返す(design.md §4-0)。

内部表現の約束(design.md §4-0):
- 重み・スコアは**内部では常に [0,1]**。ポイント(%)表記は `fmt.*` が文字列を作る一瞬にのみ 100 倍する。
- `Infinity` は「逆転不能」を表す正当な値として流通させる。`null` で代用しない。
- `const EPS = 1e-9;`(design.md §5-4 D-9)。`const VERSION = "1.0.0";`

### 1-0. コア公開面(`TenbinCore` の全メンバ)

```js
const TenbinCore = Object.freeze({
  VERSION, EPS,
  normalize, normalizeMatrix, normalizeWeights, reweight, computeScores, rank,
  tippingPoint, criticality, scoreContribution, winContribution,
  robustness, anchoringDetect, applyCutoffs,
  analyze, validateState, migrateState, createInitialState,
  fmt, TEXT
});
```

> design.md §2-2 のリストには `normalizeMatrix` が抜けているが、同 §4-1 が署名を明示的に定めている。**§5-2 の裁定 X-9 により `normalizeMatrix` を公開面に含める。**

---

### 1-1. `normalize` — スコア正規化

| | |
|---|---|
| **名前** | `normalize(raw, direction)` |
| **引数** | `raw: number \| null`(生スコア 0〜10)、`direction: "benefit" \| "cost"` |
| **戻り値** | `number \| null` — `[0,1]`。`raw` が `null` / 非有限なら `null` |
| **縮退** | `raw` が `[0,10]` の外 → クランプしてから変換。`Number.isFinite(raw)` が偽 → `null` |
| **不変** | 他の選択肢に一切依存しない(FR-21 / AC-20 の集合非依存性の根拠) |
| **参照** | design.md §4-1 / prd FR-03, FR-04 |

**入出力例(AC-14 のセル単位検証値):**
```
normalize(7,  "cost")    → 0.3    (表示 0-10 尺度では 3.0)
normalize(4,  "cost")    → 0.6                        6.0
normalize(6,  "cost")    → 0.4                        4.0
normalize(2,  "cost")    → 0.8                        8.0
normalize(9,  "benefit") → 0.9
normalize(null,"benefit")→ null
normalize(1e308,"benefit")→ 1.0   (クランプ)
```

---

### 1-2. `normalizeMatrix` — 正規化行列

| | |
|---|---|
| **名前** | `normalizeMatrix(options, criteria)` |
| **引数** | `options: Option[]`、`criteria: Criterion[]` |
| **戻り値** | `(number \| null)[][]` — `options.length × criteria.length`。行=選択肢、列=基準。**順序は引数の配列順** |
| **実装** | `a[i][j] = normalize(options[i].scores[criteria[j].id] ?? null, criteria[j].direction)` |
| **縮退** | `options` または `criteria` が空 → `[]` / 各行 `[]` |
| **参照** | design.md §4-1 |

**入出力例(DS-1):**
```
入力: criteria = [価格(cost), 機能充足度(benefit), サポート(benefit), 移行コスト(cost)]
      options  = [ベンダーA{7,9,7,2}, ベンダーB{4,8,8,6}, ベンダーC{6,8,5,8}]
出力: [[0.3, 0.9, 0.7, 0.8],
       [0.6, 0.8, 0.8, 0.4],
       [0.4, 0.8, 0.5, 0.2]]
```

---

### 1-3. `normalizeWeights` — 重み正規化

| | |
|---|---|
| **名前** | `normalizeWeights(rawWeights)` |
| **引数** | `rawWeights: number[]`(各 `≥ 0`) |
| **戻り値** | `number[]` — 同じ長さ。`\|Σ − 1\| ≤ EPS` |
| **縮退** | `Σŵ ≤ EPS`(E-9)→ **等重み `1/n`**。長さ0 → `[]` |
| **参照** | design.md §4-2, §8-2 / prd FR-05, AC-03, AC-04 |

**入出力例(AC-03 / AC-04):**
```
normalizeWeights([35,30,20,15])
  → [0.35, 0.3, 0.2, 0.15]              Σ−1 = -1.110223e-16
    表示 ["35.0","30.0","20.0","15.0"]

normalizeWeights([5,3,2,2])                            ← 合計 12
  → [0.4166666666666667, 0.25, 0.16666666666666666, 0.16666666666666666]
    Σ−1 = 0.0
    表示 ["41.7","25.0","16.7","16.7"]   ← 表示合計は 100.1%(AC-04 の明文どおり。仕様であって不具合ではない)

normalizeWeights([0,0,0,0]) → [0.25,0.25,0.25,0.25]   ← 等重み + 警告(§8-2)
```

---

### 1-4. `reweight` — 比例再正規化

| | |
|---|---|
| **名前** | `reweight(w, k, x)` |
| **引数** | `w: number[]`(`\|Σw−1\| ≤ EPS`)、`k: number`(基準 index)、`x: number ∈ [0,1]`(**正規化後の目標値**) |
| **戻り値** | `number[]` — `w'[k] = x`、`j≠k` は `w[j](1−x)/(1−w[k])`。`\|Σw'−1\| ≤ EPS` |
| **縮退** | `w[k] ≥ 1−EPS`(E-6)→ **`w` のコピーをそのまま返す**。`n = 1` → `[1]` |
| **禁止** | `tippingPoint` と**別実装にしてはならない**。AC-10 はこの2つが同一の写像であることを検証している |
| **参照** | design.md §4-3, §3-3(D-4) / prd FR-05, AC-10, AC-15, AC-21 |

**入出力例(AC-10 — 移行コストを閾値へ):**
```
reweight([0.35,0.3,0.2,0.15], 3, 0.218390804597701)
  → [0.3218390804597701, 0.2758620689655173, 0.18390804597701157, 0.218390804597701]
    Σ−1 = 0.0
    表示 ["32.2","27.6","18.4","21.8"]                 ← AC-10 の期待表示と一致
  この w' で computeScores すると S = [0.6482758620689655, 0.6482758620689656, 0.4850574712643679]
    表示 ["64.8","64.8","48.5"]、残差 S_B − S_A = 1.110223e-16 ≤ EPS  ← AC-10 成立
```

**入出力例(AC-15 — 価格 35% → 50%):**
```
reweight([0.35,0.3,0.2,0.15], 0, 0.5)
  → [0.5, 0.23076923076923075, 0.15384615384615385, 0.11538461538461538]
    Σ−1 = 0.0
    小数6桁表示 ["50.000000","23.076923","15.384615","11.538462"]   ← AC-15 と一致
```

---

### 1-5. `computeScores` — 加重和

| | |
|---|---|
| **名前** | `computeScores(a, w)` |
| **引数** | `a: number[][]`(m×n、**`null` を含まない**)、`w: number[]`(長さ n) |
| **戻り値** | `number[]` — 長さ m、各要素 `∈ [0,1]` |
| **総和順序** | **`j` の昇順で単純に `reduce`。** Kahan 加算は使わない(design.md §4-4) |
| **縮退** | `a[i][j]` が `null` → 防御的に `0` として扱うが、**この経路に入ること自体が呼び出し側のバグ**(`analyze` が先に `unfilled-cells` で弾く) |
| **参照** | design.md §4-4 / prd FR-06, AC-01 |

**入出力例(AC-01):**
```
computeScores([[0.3,0.9,0.7,0.8],[0.6,0.8,0.8,0.4],[0.4,0.8,0.5,0.2]],
              [0.35,0.3,0.2,0.15])
  → [0.635, 0.6699999999999999, 0.51]
    厳密値 [127/200, 67/100, 51/100] との誤差 ≤ 1.11e-16
    表示 ["63.5","67.0","51.0"]
```

---

### 1-6. `rank` — 順位付け

| | |
|---|---|
| **名前** | `rank(scores, options)` |
| **引数** | `scores: number[]`、`options: Option[]`(同長) |
| **戻り値** | `{ order: number[]; winnerIndex: number; tied: boolean }` |
| **`order`** | `scores` 降順の index 配列(`scores` の順列) |
| **`winnerIndex`** | `order[0]`。長さ0なら `-1` |
| **`tied`** | `scores[order[0]] − scores[order[1]] ≤ EPS`(E-1)。長さ<2 なら `false` |
| **ソート** | **安定であること。** 同スコアは入力順を保つ(ES2019 以降の `Array.prototype.sort` は安定) |
| **禁止** | 比較関数に `NaN` を渡さない。`analyze` の入口で遮断済みであることが前提 |
| **参照** | design.md §4-5, §5-6 / prd FR-07, AC-02, AC-20 |

**入出力例(AC-02 / AC-18):**
```
rank([0.635, 0.6699999999999999, 0.51], [A,B,C])
  → { order: [1,0,2], winnerIndex: 1, tied: false }
    順位名 ["ベンダーB","ベンダーA","ベンダーC"]、D₀ = 0.03499999999999992(表示 "3.5")

rank([0.6, 0.6000000000000001], [X,Y])           ← DS-3、厳密には同点
  → { order: [1,0], winnerIndex: 1, tied: true }
    差 = -1.110223e-16 ≠ 0 だが |差| ≤ EPS のため tied。`=== 0` では AC-18 が通らない
```

---

### 1-7. `tippingPoint` — 逆転閾値 ★中核

| | |
|---|---|
| **名前** | `tippingPoint(d0, dk, wk)` |
| **引数** | `d0: number`(`S_W − S_i`)、`dk: number`(`a_Wk − a_ik`)、`wk: number`(`w_k ∈ [0,1)`) |
| **戻り値** | `{ feasible: boolean; delta: number; wStar: number; reason: "up"\|"down"\|"dominant" }` |
| **`delta`** | `Δw_k = D₀(1−w_k)/(D₀−d_k)`。infeasible なら `Infinity` |
| **`wStar`** | `w_k + Δw_k`。infeasible なら `NaN` |
| **判定順序** | **下記の1〜7をこの順で必ず守る。順序が安全性の根拠(D-7)** |
| **クランプ禁止** | `wStar` を `[0,1]` にクランプ**しない**。クランプすると AC-10 の厳密同点が壊れる |
| **参照** | design.md §4-6, §4-6-1, §4-6-2 / prd FR-08, FR-09, AC-05, AC-07 |

```
1. IF d0 <= EPS          → {false, Infinity, NaN, "dominant"}
2. IF wk >= 1 - EPS      → {false, Infinity, NaN, "dominant"}
3. up   ← (dk < -EPS)                 (E-3)
   down ← (wk * dk > d0 + EPS)        (E-4)
4. IF NOT up AND NOT down → {false, Infinity, NaN, "dominant"}      ← FR-09
5. den ← d0 - dk
6. IF |den| <= EPS       → {false, Infinity, NaN, "dominant"}       ← E-5、数値的安全弁
7. delta ← d0 * (1 - wk) / den
   → { true, delta, wk + delta, up ? "up" : "down" }
```

**入出力例(AC-05 — DS-1 の移行コスト vs ベンダーA):**
```
入力: d0 = 0.03499999999999992   (= S_B − S_A)
      dk = -0.4                 (= a_B移行 − a_A移行 = 0.4 − 0.8)
      wk = 0.15
出力: { feasible: true,
        delta:  0.068390804597701,      厳密 119/1740 = 0.06839080459770115、誤差 1.5e-16
        wStar:  0.218390804597701,      厳密 19/87    = 0.21839080459770116
        reason: "up" }
      表示 delta = "+6.8"、wStar = "21.8"、sens = 1/0.068390804597701 = 14.62184873949583 → "14.6"
```

**入出力例(AC-07 — サポートの逆転不能):**
```
tippingPoint(0.03499999999999992, 0.10000000000000009, 0.2)   ← vs ベンダーA
  up:   0.100… < -EPS        → false
  down: 0.2 × 0.100… = 0.020… > 0.035 + EPS  → false
  → { feasible:false, delta:Infinity, wStar:NaN, reason:"dominant" }   手順4で確定、除算に到達しない
```

---

### 1-8. `criticality` — 臨界度ランキング

| | |
|---|---|
| **名前** | `criticality(a, w, scores, criteria, options, winnerIndex)` |
| **引数** | `a: number[][]`、`w: number[]`、`scores: number[]`、`criteria: Criterion[]`、`options: Option[]`、`winnerIndex: number` |
| **戻り値** | `CriticalityRow[]`(design.md §3-1)。長さ = `criteria.length` |
| **並び** | `infeasible ? +Infinity : \|delta\|` の昇順。同値なら**基準の入力順**(安定ソート)。`Infinity` の昇順ソートで逆転不能が自動的に末尾に来る — **末尾に置くための分岐を書かない** |
| **走査** | **全挑戦者**(`i ≠ winnerIndex`、`d0 > EPS` の者のみ)を走査し `argmin \|Δw\|` を採る。FR-15 の挑戦者選択は臨界度に影響しない |
| **ヒステリシス** | 更新条件は `\|r.delta\| < \|best.delta\| − EPS`(E-10)。同値なら**先に見つかった挑戦者を保持**する |
| **`sens`** | `1/\|Δw_k\|`(**Δw_k は重み単位。ポイント単位ではない** — design.md §4-6-1)。infeasible なら `0` |
| **参照** | design.md §4-7 / prd FR-08, FR-10, AC-05, AC-06, AC-07 |

**入出力例(AC-05 / AC-06 — DS-1、全行の逆転相手はベンダーA):**
```
出力順(|Δw| 昇順、逆転不能は末尾):
 # name        weight  delta                  wStar                 opponent  sens          display
 1 移行コスト   0.15    +0.068390804597701     0.218390804597701     ベンダーA  14.6218…     "+6.8"  "21.8"  "14.6"
 2 価格         0.35    -0.08584905660377336   0.26415094339622663   ベンダーA  11.6483…     "-8.6"  "26.4"  "11.6"
 3 機能充足度   0.30    +0.1814814814814812    0.4814814814814812    ベンダーA   5.5102…     "+18.1" "48.1"  "5.5"
 4 サポート     0.20    Infinity               NaN                   null        0           "—"     "—"     "0"

★ 重み最小の「移行コスト」(15%)が重み最大の「価格」(35%)より上位に来る。
   これは式から自動的に出る。特別扱いのコードを1行も書かない(AC-06 の反直感的洞察)。
```

---

### 1-9. `winContribution` — 勝敗貢献度 `g_j`

| | |
|---|---|
| **名前** | `winContribution(a, w, winnerIndex, challengerIndex, d0, criteria)` |
| **引数** | `a`、`w`、`winnerIndex: number`、`challengerIndex: number`、`d0: number`、`criteria: Criterion[]` |
| **戻り値** | `Contribution[]` — `value = w_j(a_Wj − a_Lj)/D₀`、`\|Σ value − 1\| ≤ 1e-12`、`negative = (value < 0)` |
| **縮退** | **`d0 ≤ EPS` → 空配列 `[]`**(Z-3。`analyze` が `tie` に切り替える。この関数の中でゼロ除算を起こさない) |
| **参照** | design.md §4-8 / prd FR-13, AC-11, AC-12, AC-18 |

**入出力例(AC-11 — DS-1、W=ベンダーB、L=ベンダーA、d0=0.03499999999999992):**
```
→ [ {価格,       value:  3.0000000000000067, display: "+300.0",  negative:false},
    {機能充足度, value: -0.8571428571428589, display:  "-85.7",  negative:true },
    {サポート,   value:  0.5714285714285733, display:  "+57.1",  negative:false},
    {移行コスト, value: -1.7142857142857182, display: "-171.4",  negative:true } ]
  Σ − 1 = 2.886580e-15   厳密 3 − 6/7 + 4/7 − 12/7 = 1

AC-12 の相互整合(テストとしてのみ書き、実装では使わない):
  g_価格 = 3.0 > 1  ⟺  価格は Δw < 0(下げて逆転)  ✓
  他3基準は g ≤ 1   ⟺  下方向には逆転不能            ✓
```

---

### 1-10. `scoreContribution` — スコア貢献度 `c_ij`

| | |
|---|---|
| **名前** | `scoreContribution(a, w, scores, optionIndex, criteria)` |
| **戻り値** | `Contribution[]` — `value = w_j a_ij / S_i`、`\|Σ value − 1\| ≤ 1e-12` |
| **縮退** | **`S_i ≤ EPS`(E-8)→ 全要素 `{ value: null, display: "—", negative: false }`。** 判定は**除算より前**に行い、`0/0 = NaN` を一度も生成しない |
| **参照** | design.md §4-9 / prd FR-14, AC-13, AC-19 |

**入出力例(AC-13 — ベンダーB / AC-19 — 案Z):**
```
scoreContribution(a, w, S, 1, criteria)      ← ベンダーB(S = 0.6699999999999999)
  → values  [0.31343283582089554, 0.35820895522388063, 0.2388059701492538, 0.08955223880597016]
    display ["31.3", "35.8", "23.9", "9.0"]      Σ − 1 = 2.220446e-16

scoreContribution(a, w, S, z, criteria)      ← 案Z(a = [0,0,0,0]、S = 0.0)
  → [{value:null, display:"—"}, ×4]            数値・"0%"・"NaN" のいずれも出さない(AC-19)
```

---

### 1-11. `robustness` — 頑健性ラベル

| | |
|---|---|
| **名前** | `robustness(rows, theta, winnerName, challengerName)` |
| **引数** | `rows: CriticalityRow[]`(**`criticality` の出力。昇順済み**)、`theta: number ∈ [0,1]`、`winnerName: string`、`challengerName: string` |
| **戻り値** | `Robustness`(design.md §3-1) |
| **判定** | `deltaStar = rows[0].infeasible ? Infinity : \|rows[0].delta\|`<br>`Infinity → "robust"` / `≤ theta + EPS → "fragile"`(E-7、境界は fragile 側)/ それ以外 `"contingent"` |
| **事後条件** | `verdict` は必ず非空文字列(FR-11「ラベル単独では表示しない」)。**`label === "robust"` なら `caveat` は必ず非 null**(FR-22) |
| **文言** | prd §5-1 / §5-2 の正典テンプレート。`{}` のみ置換。**言い換えない** |
| **参照** | design.md §4-10 / prd FR-11, FR-12, FR-22, AC-08, AC-09, AC-17 |

**入出力例(AC-08 — DS-1、θ = 0.10):**
```
deltaStar = 0.068390804597701 ≤ 0.10 + EPS  →  label = "fragile"
{ label: "fragile",
  deltaStar: 0.068390804597701, displayDelta: "6.8",
  kStarName: "移行コスト",
  labelLine: "fragile — 結論はごく僅かな重みの差で崩れます(Δ* = 6.8ポイント ≤ しきい値 10.0ポイント)",
  verdict:   "ベンダーB の1位は、移行コストの重みを 15.0% から 21.8%(+6.8ポイント)に動かすと "
           + "ベンダーA に入れ替わります。他の 1 個の基準では単独で逆転しません。"
           + "価格を 26.4% まで下げても同じことが起きます。"
           + "機能充足度を 48.1% まで上げても同じことが起きます。"
           + "サポートの重みは単独では結論を変えません。",
  caveat: null }
```

**入出力例(AC-09 — 同じ DS-1、θ = 0.05):**
```
0.068390804597701 > 0.05 + EPS かつ有限  →  label = "contingent"
deltaStar と kStarName は θ に依らず不変(0.068390804597701 / "移行コスト")
labelLine = "contingent — 結論は重みの置き方に依存します(Δ* = 6.8ポイント > しきい値 5.0ポイント)"
verdict は fragile と同一文面(prd §5-1 が両状態に同じテンプレートを与えているため。意図的)
```

**入出力例(AC-17 — DS-2、robust):**
```
S = [0.685, 0.39]、d0 = 0.29500000000000004(表示 "29.5")
全3基準で up=false / down=false → 全て dominant → deltaStar = Infinity
{ label: "robust", displayDelta: "逆転不能", kStarName: null,
  labelLine: "robust — どの単一基準の重みを動かしても結論は変わりません(Δ* = 逆転不能)",
  verdict:   "物件P の1位は、どの単一基準の重みを 0% から 100% のどこに動かしても入れ替わりません。"
           + "家賃 — 逆転不能。物件P がこの基準でも勝っている(または差が僅少)ため、"
           + "重みを上げても 物件P のリードが広がるだけです。"(通勤時間・環境も同文)
  caveat:    "基準そのものが抜けている可能性は、この分析では検出できません。" }   ← 非 null が事後条件
```

**文言生成の順序(design.md §4-10):** ① ラベル本体 → ② 1番目の逆転文(または robust 総括文)→ ③ 2番目以降の逆転可能基準の列挙 → ④ 逆転不能基準の列挙 → ⑤ robust のみ caveat。
`{r}` = 逆転不能な基準の個数。`{上げて/下げて}` は `delta > 0` なら「上げて」、`< 0` なら「下げて」。

---

### 1-12. `anchoringDetect` — 結論ありき逆算の検知

| | |
|---|---|
| **名前** | `anchoringDetect(history, threshold)` |
| **引数** | `history: WeightEdit[]`(時刻昇順)、`threshold: number ≥ 1` |
| **戻り値** | `{ edits: number; flips: number; warn: boolean; message: string \| null }` |
| **計算** | `edits = history.length`、`flips = count(e => e.leaderBefore !== e.leaderAfter)`、`warn = flips >= threshold` |
| **縮退** | 空 → `{0, 0, false, null}`。`warn` が偽なら `message` は必ず `null` |
| **禁止** | **時計を読まない。** `at` は既に履歴に焼かれている(C-5: `Date` はコア領域で禁止) |
| **影響** | 返り値は `Analysis` に**混ぜるだけ**。他のどの値にも影響しない(FR-18: 編集をブロックしない) |
| **参照** | design.md §4-11 / prd FR-18, AC-21 |

**入出力例(AC-21 — 移行コストを 15%→25%→15%→30%):**
```
実測した各編集後の1位と重み(小数6桁):
  x=0.25 → S = [65.441176, 63.823529, 47.352941]  leader=ベンダーA
           w = [30.882353, 26.470588, 17.647059, 25.000000]   ← AC-21 と完全一致
  x=0.15 → S = [63.500000, 67.000000, 51.000000]  leader=ベンダーB
  x=0.30 → S = [66.411765, 62.235294, 45.529412]  leader=ベンダーA
           w = [28.823529, 24.705882, 16.470588, 30.000000]   ← AC-21 と完全一致

history = [ {leaderBefore:"B", leaderAfter:"A"},
            {leaderBefore:"A", leaderAfter:"B"},
            {leaderBefore:"B", leaderAfter:"A"} ]
anchoringDetect(history, 3)
  → { edits: 3, flips: 3, warn: true,
      message: "重みを 3 回編集する間に1位が 3 回入れ替わっています。\n"
             + "結論に合わせて重みを調整していないか確認してください。" }
```

---

### 1-13. `applyCutoffs` — 足切り

| | |
|---|---|
| **名前** | `applyCutoffs(a, criteria, options)` |
| **引数** | `a: (number\|null)[][]`(**正規化済み 0-1**)、`criteria: Criterion[]`(`cutoff` は **0-10 尺度**)、`options: Option[]` |
| **戻り値** | `{ includedIndices: number[]; excluded: { index: number; text: string }[] }` |
| **判定** | 選択肢 `i` は、ある基準 `j` で `a[i][j] * 10 < cutoff_j − EPS`(E-11)なら除外 |
| **事後条件** | `includedIndices ∪ excluded.index` = 全 index、交差は空。両者とも入力順を保つ |
| **縮退** | 全 `cutoff` が `null` → 全件 included、`excluded = []` |
| **文言** | prd §5-8: `"{選択肢名} — {基準}が最低ライン{v}を下回るため除外"` |
| **順序** | **加重和の前段。** `applyCutoffs → computeScores → rank → criticality`。除外された選択肢は**挑戦者としても数えない** |
| **参照** | design.md §4-12 / prd FR-20, AC-16 |

**入出力例(AC-16 — 移行コストに最低ライン 3.0):**
```
a×10 の移行コスト列 = [A: 8.0, B: 4.0, C: 2.0]
applyCutoffs(a, criteria(移行コスト.cutoff = 3.0), options)
  → { includedIndices: [0, 1],
      excluded: [ { index: 2,
                    text: "ベンダーC — 移行コストが最低ライン3.0を下回るため除外" } ] }
  残る2件で再計算 → S = ["63.5", "67.0"] ← AC-01 と厳密に同一(固定尺度による集合非依存性)
  Δ* = 6.8pt、k* = 移行コスト、ラベル fragile ← AC-08 と一致
```

---

### 1-14. `analyze` — 単一の入口

| | |
|---|---|
| **名前** | `analyze(state)` |
| **引数** | `state: AppState`(`validateState` を通過済み) |
| **戻り値** | `Analysis`(design.md §3-1)。**いかなる入力に対しても例外を投げない** |
| **事後条件** | `ok === false` のとき `degenerate !== null` かつ `message !== null` |
| **NaN 遮断** | 先頭で `a` と `w` の全要素に `Number.isFinite` を掛け、1つでも偽なら `"unfilled-cells"` 相当に落として計算を打ち切る(D-10 の第3段) |
| **参照** | design.md §4-13, §5-6, §8-3〜§8-9 / prd FR-06, FR-19 |

**退化判定の順序(この順で最初に当たったものを返す):**

| # | 条件 | `degenerate` | `message`(prd §5-3 正典) |
|---|---|---|---|
| 1 | `criteria.length === 0` | `"no-criteria"` | 何で比べるかを決めてください。基準を1つ以上足してください。 |
| 2 | `options.length === 0` | `"no-options"` | まず、比べたいものを2つ以上足してください。 |
| 3 | `options.length === 1` | `"one-option"` | 比べる相手がいません。選択肢をもう1つ足してください。 |
| 4 | 未入力セルが `c` 個 (`c > 0`) | `"unfilled-cells"` | 未入力のセルが {c} 個あります。埋めるまで結論は出せません。 |
| 5 | 足切り後 残0件 | `"all-excluded"` | すべての選択肢が最低ラインで除外されました。最低ラインを見直してください。 |
| 6 | 足切り後 残1件 | `"one-option"` | 比べる相手がいません。選択肢をもう1つ足してください。 |
| 7 | `rank().tied`(`D₀ ≤ EPS`) | `"tie"` | 同点です。基準またはスコアを見直してください。 |
| 8 | それ以外 | `null` | `ok = true` |

**7 のとき `robustness = null`、`winContrib = []` とする(AC-18)。** 順位表とスコアは `ok = false` でも埋めてよい(AC-18 が禁じているのはラベルと `g_j` のみ)。
**`Σŵ ≤ EPS` は退化ではない**(§8-2)。等重みで計算を続行し、`warnings` に「全ての基準の重みが 0 です。等分として計算しています。」を積む。

**入出力例(DS-1、既定設定):**
```
analyze(DS1State) →
{ ok: true, degenerate: null, message: null,
  weights: [{価格,0.35,"35.0"},{機能充足度,0.3,"30.0"},{サポート,0.2,"20.0"},{移行コスト,0.15,"15.0"}],
  ranking: [ {ベンダーB, score:0.6699999999999999, displayScore:"67.0", rank:1},
             {ベンダーA, score:0.635,              displayScore:"63.5", rank:2},
             {ベンダーC, score:0.51,               displayScore:"51.0", rank:3} ],
  winner: ベンダーB, challenger: ベンダーA,
  d0: 0.03499999999999992, displayD0: "3.5",
  criticality: [移行コスト "+6.8", 価格 "-8.6", 機能充足度 "+18.1", サポート "—"],
  winContrib:  ["+300.0", "-85.7", "+57.1", "-171.4"],
  robustness:  { label: "fragile", displayDelta: "6.8", kStarName: "移行コスト", caveat: null },
  anchoring:   { edits: 0, flips: 0, warn: false, message: null },
  excluded: [], warnings: [] }
```

**入出力例(DS-3、同点):**
```
analyze(DS3State) →
{ ok: false, degenerate: "tie", message: "同点です。基準またはスコアを見直してください。",
  ranking: [{案Y, "60.0"}, {案X, "60.0"}],       ← 出してよい
  d0: -1.1102230246251565e-16, displayD0: "0.0",
  robustness: null,                              ← AC-18: ラベルを一切出さない
  winContrib: [],                                ← AC-18: g_j を出さない
  criticality: [] }
```

---

### 1-15. `fmt` — フォーマッタ群

| | |
|---|---|
| **名前** | `fmt.{score,weight,weight6,points,percent,sens,dash}` |
| **戻り値** | すべて `string` |
| **共通縮退** | **`NaN` / `±Infinity` を渡されたら `"—"` を返す**(画面に `NaN` を出さない最後の砦) |
| **符号** | `points` と `percent` は**必ず符号を付ける**(FR-10④ / FR-13)。`+0.0` にならないよう、`[-0.05, 0.05)` の値の符号は元の値の符号で決める |
| **丸め** | `toFixed(n)` 相当。**丸めた値を計算に戻さない**(D-8) |
| **参照** | design.md §4-14, §5-3 / prd AC-01, AC-04, AC-05, AC-11, AC-13, AC-15, AC-21 |

| 関数 | 変換 | 入出力例(実測) |
|---|---|---|
| `fmt.score(s)` | `×100`、小数1桁 | `0.6699999999999999 → "67.0"` / `0.635 → "63.5"` / `0.51 → "51.0"` |
| `fmt.weight(w)` | `×100`、小数1桁 | `0.35 → "35.0"` / `0.4166666666666667 → "41.7"` / `0.11538461538461538 → "11.5"` |
| `fmt.weight6(w)` | `×100`、小数6桁 | `0.30882352941176472 → "30.882353"` / `0.23076923076923075 → "23.076923"` |
| `fmt.points(d)` | `×100`、小数1桁、**必ず符号** | `0.068390804597701 → "+6.8"` / `-0.08584905660377336 → "-8.6"` / `Infinity → "—"` |
| `fmt.percent(g)` | `×100`、小数1桁、**必ず符号** | `3.0000000000000067 → "+300.0"` / `-1.7142857142857182 → "-171.4"` |
| `fmt.sens(s)` | 小数1桁(**重み単位の逆数**、×100 しない) | `14.62184873949583 → "14.6"` / `11.64835164835168 → "11.6"` / `5.510204081632662 → "5.5"` / `0 → "0"` |
| `fmt.dash()` | 定数 | `→ "—"` |

> **`sens` の単位を取り違えないこと(design.md §4-6-1 が「設計時に実際に1度取り違えた」と明記している)。** ポイント単位の逆数だと `0.146 / 0.116 / 0.055` になり AC-05 と合わない。

---

### 1-16. `validateState` / `migrateState` / `createInitialState` / `TEXT`

| 名前 | 引数 | 戻り値 | 参照 |
|---|---|---|---|
| `createInitialState()` | なし | `AppState`(`schemaVersion:1`、`criteria:[]`、`options:[]`、`settings:{theta:0.10, flipThreshold:3, challengerId:null}`、`initialWeights:null`、`history:[]`) | design.md §3-1 |
| `migrateState(raw)` | `unknown` | `unknown` — `schemaVersion` を見て段階的に持ち上げる。v1 では恒等変換だが**関数と分岐は最初から置く** | design.md §3-5 |
| `validateState(parsed)` | `unknown` | `{ ok:true, value:AppState } \| { repaired:true, value:AppState, notes:string[] } \| { failed:true }` | design.md §3-6 |
| `TEXT` | — | prd §5-1〜§5-8 の全正典文字列を保持する凍結オブジェクト。`{}` プレースホルダを含んだテンプレート文字列と、それを埋める小さな関数群 | design.md §2-2, prd §5 |

**`validateState` の3値応答と `repaired` で救う異常の全列挙**(design.md §3-6 の表をそのまま実装契約とする):

| 異常 | 修復 |
|---|---|
| `rawWeight` が負 / NaN / 非数 | `0` |
| `rawWeight` の合計が 0 | 全基準を等重み(全て `1`) |
| 生スコアが `[0,10]` の外 | クランプ |
| 生スコアが 0.5 の倍数でない | 最近接の 0.5 倍数に丸める |
| 生スコアが数値でない | `null` |
| `direction` が2値以外 | `"benefit"` |
| `theta` が `[0,1]` の外 / 非数 | `0.10` |
| `flipThreshold` が 1 未満 / 非数 | `3` |
| 基準/選択肢が上限10超 | 先頭10件で切る |
| 名前が200文字超 | 200文字で切る(§8-6) |
| `Option.scores` の未知の基準 id | 捨てる |
| `Option.scores` に不足する基準 id | `null` を補う |
| `challengerId` が存在しない選択肢を指す | `null` |
| `initialWeights` のキーが現在の基準と不一致 | `null` |
| `history` の要素が壊れている | **その要素だけ**捨てる |
| `id` の重複 | 後勝ちで1つに寄せ、他方に新 id |

`failed` は「構造そのものが違う」場合のみ(配列であるべき所がオブジェクト等)。

**入出力例:**
```
validateState({criteria:[{id:"c1",name:"価格",direction:"cost",rawWeight:"abc",cutoff:null}], ...})
  → { repaired:true, value:{...rawWeight:0...}, notes:["価格の重みを 0 に修復しました"] }

validateState({criteria:{}, options:{}})            ← 配列であるべき所がオブジェクト
  → { failed:true }
```

---

## 2. ファイル内の配置図(`index.html`)

**上から順にこの構成で書く。classic script は上から評価されるので、依存の逆順に置く(design.md §1-3)。`type="module"` は使わない**(`file://` から開いたとき CORS で失敗するブラウザがあり「ダブルクリックで動く」FR-23 を壊すため)。

```
┌ 行ブロック ─────────────────────────────────────────────────────────────────┐

 B-01  <!DOCTYPE html>
       <html lang="ja">

 B-02  <head>
         <meta charset="utf-8">
         <meta name="viewport" content="width=device-width, initial-scale=1">
         <title>天秤 — 決断支援</title>
         ★ <link> / @import / <script src> を1つも置かない(AC-24)

 B-03    <style>
           /* 2-1. :root — identity.md §7 の CSS カスタムプロパティ定義を
                   一字一句そのまま貼る(色・書体・寸法・余白・動き) */
           /* 2-2. @media (prefers-reduced-motion: reduce) { :root { --motion: 0ms; } } */
           /* 2-3. リセット + 版面(--measure-max 1120px 中央寄せ、--canvas 全面) */
           /* 2-4. タイポ基底(.num / input[type=number] / td.score / .delta /
                   .weight / .pct に --font-numeric + tabular-nums、identity §3-3) */
           /* 2-5. ゾーン別スタイル Z0〜Z6(identity §5 の視覚語彙) */
           /* 2-6. sr-only ユーティリティ(#verdict-live 用) */
           /* 2-7. @media (max-width: 720px) — 単一カラム + Z6 の選択肢別2列テーブル */
           /* 2-8. :focus-visible — outline: 2px solid var(--focus-ring);
                   outline-offset: 2px。★ outline:none を1箇所も書かない(AC-26) */
         </style>
       </head>

 B-04  <body>
         <a class="skip" href="#z1">結論へ移動</a>

 B-05    <header id="z0">                                    ── Z0 ヘッダ
           製品名「天秤」/ [θ ▾] ポップオーバー / [出力 ▾] / [全消去](2段階)
           <p id="save-status" role="status"></p>
         </header>

 B-06    <main>
 B-07      <section id="z1" aria-labelledby="z1-h">           ── Z1 結論帯 ★一次出力
             <h2 id="z1-h">結論</h2>
             <div id="verdict" aria-hidden="true">            視覚用・即時更新
               ① labelLine(記号罫 + 語 + 判定式)
               ② verdict(理由文。--fs-lede 20px / 62ch / display 書体)
               ③ caveat(robust のときのみ)
               ④ Δ* 数直線(0〜40pt 固定軸、●Δ* と |θ)+ [しきい値を変える]
             </div>
             <p id="verdict-live" class="sr-only"
                aria-live="polite" aria-atomic="true"></p>    読み上げ用・デバウンス更新
           </section>

 B-08      <section id="z2" aria-labelledby="z2-h">           ── Z2 順位ストリップ
             <h2>順位</h2> 勝ち幅 D₀ / <ol> 順位カード / 除外リスト(FR-20)
           </section>

 B-09      <div class="cols">                                  ── Z3|Z4 2カラム
 B-10        <section id="z3" aria-labelledby="z3-h">         ── Z3 基準・臨界度 ★主操作
               <h2>基準 — 崩れやすい順</h2>
               <ol id="criticality">   ← 行要素は基準 Id をキーに使い回す(D-13)
                 各行: 名前<input> / 向きトグル / 重みスライダー+数値入力 /
                       支点(逆転閾値)/ Δw と逆転相手 / [{w*}% へ][元に戻す] /
                       [⋯](削除・最低ライン)
               </ol>
               [+ 基準を足す]
             </section>
 B-11        <section id="z4" aria-labelledby="z4-h">         ── Z4 貢献度
               <h2>なぜ勝ったか</h2>
               挑戦者<select>(FR-15)+ 独立性の注記
               (B) 勝敗貢献度 g_j — 中心0軸バー + 100% 基準線 + prd §5-7 の但し書き
               (A) スコア貢献度 c_ij — 100%積み上げ帯
             </section>
 B-12      </div>

 B-13      <section id="z5" aria-labelledby="z5-h">           ── Z5 重み履歴
             <h2>重みの動き</h2>
             最初の重み w⁰ との並記(prd §5-4)/ <div class="warn" role="status">
           </section>

 B-14      <section id="z6" aria-labelledby="z6-h">           ── Z6 スコアグリッド
             <h2>採点</h2>
             <table>(<th scope="col"> 基準名+向き / <th scope="row"> 選択肢名 /
                     <td> <input type="number" min="0" max="10" step="0.5"
                                 aria-label="{選択肢}の{基準}のスコア"> + ゴースト値)
             [+ 選択肢を足す] / prd §5-6 の rank invariance 説明文(常時表示)
           </section>
 B-15    </main>

 B-16    <footer id="privacy">   prd §5-5 のプライバシー文(常時表示。AC-25)   </footer>

 B-17    <template id="tpl-crit-row"> … </template>
         <template id="tpl-grid-row"> … </template>
         <template id="tpl-contrib-row"> … </template>
                  ↑ DOM 生成を「構造変化のときだけ」に閉じ込めるための型紙(D-11)

 B-18    <script id="tenbin-core">                            ── L1 計算コア ★純粋
         /*===TENBIN-CORE-BEGIN===*/
           EPS / VERSION / TEXT
           fmt.*                                    (§1-15)
           normalize / normalizeMatrix / normalizeWeights / reweight   (§1-1〜1-4)
           computeScores / rank                     (§1-5, §1-6)
           tippingPoint / criticality               (§1-7, §1-8)
           winContribution / scoreContribution      (§1-9, §1-10)
           robustness / anchoringDetect / applyCutoffs (§1-11〜1-13)
           createInitialState / migrateState / validateState (§1-16)
           analyze                                  (§1-14)
           const TenbinCore = Object.freeze({ … });   ← コア領域の最後の文(C-4)
         /*===TENBIN-CORE-END===*/
         globalThis.TenbinCore = TenbinCore;          ← END の外側(C-7)
         </script>

 B-19    <script id="tenbin-persist">                         ── L4 永続化
           capability probe / load / save(300ms デバウンス)/ quarantine /
           clearAll(tenbin.v1. 前置の全キー走査削除)/ visibilitychange フラッシュ
         </script>

 B-20    <script id="tenbin-render">                          ── L2 レンダリング
           領域別の差分描画関数群。**toFixed を1回も呼ばない**(INV-2)
           renderVerdict / renderRanking / renderCriticality / renderContrib /
           renderWeights / renderGrid / renderWarnings / renderLive
         </script>

 B-21    <script id="tenbin-store">                           ── L3 状態管理・起動
           AppState の単一保持 / id カウンタ復元 / コマンド群 /
           入力イベント束ね / requestAnimationFrame での1回描画 /
           重み編集履歴の採取(ここだけが Date を読む)/ エクスポート生成 /
           起動(load → migrate → validate → 初回描画)
         </script>
       </body>
       </html>
└──────────────────────────────────────────────────────────────────────────┘
```

**責務の境界(design.md §1-2 の依存の向き。逆流させない):**

```
L1 core     ──▶ (なし)                    document / window / localStorage /
                                          navigator / Date / Math.random /
                                          globalThis を1つも参照しない(C-5)
L4 persist  ──▶ L1(validateState/migrateState/createInitialState のみ)
L2 render   ──▶ L1(fmt のみ。ただし ViewModel が既に文字列を持つので実質不要)
L3 store    ──▶ L1, L2, L4
L3 store    ──通知──▶ L2 render
```

---

## 3. 実装タスク一覧 ★本体

**総数 34 本(T-01 〜 T-34)。依存順に並んでいる。**
規模: **S** = 半日未満 / **M** = 半日〜1日 / **L** = 1〜2日。

### 3-0. 骨組みとテスト土台(先に立てないと以降が検証不能)

---

#### T-01 — HTML 骨格と抽出マーカの設置
- **何を作るか**: §2 の B-01〜B-21 の**外枠だけ**を持つ `index.html`。`<style>` は空、4つの `<script>` ブロックは空(コアだけは `/*===TENBIN-CORE-BEGIN===*/` と `/*===TENBIN-CORE-END===*/` と `const TenbinCore = Object.freeze({});` と `globalThis.TenbinCore = TenbinCore;` を持つ)。各セクションの `<h2>` と空の器を置く。
- **依存**: なし
- **完了条件**:
  - `node -e` で HTML を読み、BEGIN / END マーカがそれぞれ**ちょうど1回**出現し `<script id="tenbin-core">` と直後の `</script>` の間にあること
  - ブラウザで `file://` から開いて JS エラーが0件、`window.TenbinCore` がオブジェクトであること
  - `<script src=` / `<link rel="stylesheet"` / `@import` / `http://` / `https://` の出現回数がすべて 0
- **FR/AC**: FR-23 / AC-24
- **規模**: S

---

#### T-02 — `tests/tenbin.test.js` の骨格と `loadCore`
- **何を作るか**: §4 の設計に従い、`loadCore(htmlPath)`(マーカ検査 → 純粋性ガード → `new Function` 評価)、`assertEqual` / `assertClose(actual, exact, 1e-9)` / `assertThrowsNot`、テストランナー(登録・実行・緑赤集計・終了コード)。外部依存ゼロ、Node 標準ライブラリのみ。
- **依存**: T-01
- **完了条件**:
  - `node tests/tenbin.test.js` が終了コード0で走り、「マーカ C-1/C-2 検査」「純粋性ガード C-5/C-6」「`Object.isFrozen(core)` C-4」の3ケースが緑
  - コア領域に試しに `document` の1語を混ぜると、純粋性ガードのケースだけが赤くなる(実験後に戻す)
- **FR/AC**: design.md §2 の CONTRACT-CORE / INV-1
- **規模**: M

---

#### T-03 — 静的検査テスト(AC-24 / AC-25 の機械検査)
- **何を作るか**: `index.html` をテキストとして読み、禁止トークンの出現回数を数えるテスト群。`<script src=` / `<link rel="stylesheet"` / `@import` / `http://` / `https://` / `fetch(` / `XMLHttpRequest` / `sendBeacon` / `new WebSocket` / `new EventSource` / `<form action=` / `outline: none` / `outline:none` がすべて 0 であることを表明する。
- **依存**: T-02
- **完了条件**: `node tests/tenbin.test.js` の「静的検査」ブロックが緑。禁止トークンを1つ仕込むと該当ケースだけが赤くなる
- **FR/AC**: FR-23, FR-24, FR-26 / **AC-24, AC-25, AC-26(末尾)**
- **規模**: S

---

### 3-1. 計算コア群(L1)

---

#### T-04 — `EPS` / `VERSION` / `fmt` / `TEXT`
- **何を作るか**: `EPS = 1e-9`、`VERSION`、§1-15 の `fmt` 7関数、prd §5-1〜§5-8 の全正典文字列を保持する `TEXT`(テンプレートと置換関数)。`fmt.*` は `NaN` / `±Infinity` に `"—"` を返す。`points` / `percent` は必ず符号を付ける。
- **依存**: T-02
- **完了条件**: §1-15 の表にある**入出力例12件がすべて完全一致**でテスト緑。`fmt.points(Infinity) === "—"`、`fmt.sens(14.62184873949583) === "14.6"`(ポイント単位でないこと)が緑
- **FR/AC**: FR-10④, FR-13 / AC-01, AC-04, AC-05, AC-11, AC-13, AC-15, AC-21
- **規模**: S

---

#### T-05 — `normalize` / `normalizeMatrix`
- **何を作るか**: §1-1 / §1-2 の2関数。クランプと `null` 分岐を除算より前に置く。
- **依存**: T-04
- **完了条件**:
  - `normalizeMatrix(DS-1)` が `[[0.3,0.9,0.7,0.8],[0.6,0.8,0.8,0.4],[0.4,0.8,0.5,0.2]]` に厳密一致
  - **AC-14 のセル単位検証**: 価格 `A=3.0 / B=6.0 / C=4.0`、移行コスト `A=8.0 / B=4.0 / C=2.0`(`a*10`)が緑
  - `normalize(1e308,"benefit") === 1.0`、`normalize(NaN,"benefit") === null` が緑
- **FR/AC**: FR-03, FR-04, FR-21 / **AC-14**(セル単位の半分)
- **規模**: S

---

#### T-06 — `normalizeWeights`
- **何を作るか**: §1-3。`Σŵ ≤ EPS`(E-9)で等重み `1/n` に落とす分岐を除算より前に置く(Z-1)。
- **依存**: T-04
- **完了条件**: **AC-03**(`[35,30,20,15]` → `Σ−1 = -1.11e-16`、表示 `["35.0","30.0","20.0","15.0"]`)と **AC-04**(`[5,3,2,2]` → 表示 `["41.7","25.0","16.7","16.7"]`、`Σ−1 = 0.0`)が緑。`[0,0,0,0]` で `[0.25,0.25,0.25,0.25]` を返し `NaN` を1つも生成しないことが緑
- **FR/AC**: FR-05 / **AC-03, AC-04**、design.md §8-2
- **規模**: S

---

#### T-07 — `computeScores`
- **何を作るか**: §1-5。`j` 昇順の単純 `reduce`。総和順序を固定する。
- **依存**: T-05, T-06
- **完了条件**: **AC-01** が緑 — 値 `[0.635, 0.6699999999999999, 0.51]`、厳密値との差 `≤ 1e-9`、表示 `["63.5","67.0","51.0"]` が完全一致。**AC-17** の `S = [0.685, 0.39]`、**AC-19** の `S_案Z = 0.0`、**AC-20** の `S_D = 0.86` が緑
- **FR/AC**: FR-06 / **AC-01, AC-17, AC-19, AC-20**
- **規模**: S

---

#### T-08 — `rank`
- **何を作るか**: §1-6。安定ソート、`tied` は `≤ EPS` 判定(E-1)。**`=== 0` を書かない。**
- **依存**: T-07
- **完了条件**: **AC-02**(順位 `["ベンダーB","ベンダーA","ベンダーC"]`、`D₀ = 0.03499999999999992` → `"3.5"`)が緑。**AC-18**(DS-3 で差 `-1.11e-16` に対し `tied === true`)が緑。**AC-20** の「既存3件の相対順序が追加前と同一」が緑。同スコア2件で入力順が保たれることが緑
- **FR/AC**: FR-07 / **AC-02, AC-18, AC-20**
- **規模**: S

---

#### T-09 — `tippingPoint` ★中核
- **何を作るか**: §1-7。**判定順序1〜7を厳密に守る。** `wStar` にクランプを入れない。
- **依存**: T-08
- **完了条件**:
  - **AC-05** の4行が緑 — 移行コスト `delta = 0.068390804597701`(厳密 119/1740 との差 `1.53e-16 ≤ 1e-9`)、価格 `-0.08584905660377336`、機能充足度 `0.1814814814814812`、サポート `feasible === false`
  - **AC-07** が緑 — サポートは vs ベンダーA / vs ベンダーC の両方で `reason === "dominant"`
  - `d_k === D₀` の入力(`tippingPoint(0.2, 0.2, 0.1)`)で**手順4で `dominant` を返し、手順5〜7に到達しない**ことが緑(D-7 の到達不能性の表明)
  - `wStar ∈ [−EPS, 1+EPS]` の事後条件表明が全 feasible ケースで緑
- **FR/AC**: FR-08, FR-09 / **AC-05, AC-07**
- **規模**: M

---

#### T-10 — `reweight`(`tippingPoint` との一致検証つき)
- **何を作るか**: §1-4。E-6 の恒等写像分岐を除算より前に置く(Z-5)。
- **依存**: T-09
- **完了条件**:
  - **AC-15** が緑 — `reweight(w,0,0.5)` の6桁表示が `["50.000000","23.076923","15.384615","11.538462"]`、`Σ−1 = 0.0`、新スコア表示 `["55.8","65.4","48.5"]`、順位不変
  - **AC-10 の一致検証**が緑 — DS-1 の3基準それぞれについて `reweight(w, k, wStar_k)` → `computeScores` の結果、`|S_W − S_L| ≤ EPS`。移行コストの実測残差は `1.110223e-16`。表示重みは `["32.2","27.6","18.4","21.8"]`、スコア表示は `["64.8","64.8","48.5"]`
  - `w[k] = 1` の入力で `w` のコピーがそのまま返り `NaN` が出ないことが緑(§8-8)
- **FR/AC**: FR-05 / **AC-10, AC-15**
- **規模**: M

---

#### T-11 — `criticality`
- **何を作るか**: §1-8。全挑戦者走査、E-10 のヒステリシス、`Infinity` の昇順ソートで逆転不能を末尾へ(**分岐を書かない**)。`sens = 1/|Δw|`(重み単位)。
- **依存**: T-09
- **完了条件**:
  - **AC-06** が緑 — 並び順が `["移行コスト","価格","機能充足度","サポート"]`。**重み最小の移行コスト(15%)が重み最大の価格(35%)より上位**であること
  - **AC-05** の `sens` が緑 — `["14.6","11.6","5.5","0"]`
  - 逆転相手が全行「ベンダーA」であることが緑
  - 対称データ(2基準が同一列)で、無関係なセルを編集しても並び順と逆転相手が動かないことが緑(§8-10)
- **FR/AC**: FR-08, FR-10, FR-15 / **AC-05, AC-06, AC-07**
- **規模**: M

---

#### T-12 — `winContribution` / `scoreContribution`
- **何を作るか**: §1-9 / §1-10。`d0 ≤ EPS` → `[]`(Z-3)、`S_i ≤ EPS` → 全 `"—"`(Z-2、E-8)。**判定は除算より前**に置き `0/0` を一度も生成しない。
- **依存**: T-08
- **完了条件**:
  - **AC-11** が緑 — `["+300.0","-85.7","+57.1","-171.4"]`、`Σ−1 = 2.886580e-15 ≤ 1e-12`
  - **AC-13** が緑 — ベンダーB `["31.3","35.8","23.9","9.0"]`、ベンダーA `["16.5","42.5","22.0","18.9"]`、ベンダーC `["27.5","47.1","19.6","5.9"]`、各行 `Σ−1 ≤ 2.22e-16`
  - **AC-17** の g が緑 — `["+27.1","+47.5","+25.4"]`、全て正、`Σ−1 = -2.22e-16`
  - **AC-19** が緑 — 案Z の4基準がすべて文字列 `"—"`。出力文字列中に `"NaN"` も `"0%"` も現れない
  - **AC-12** が緑 — `winContribution` の値と `tippingPoint` の判定を**独立に計算して**突き合わせ、全基準で `g_k ≤ 1 ⟺ 下方向に逆転不能` が成立(片方から導出しない)
- **FR/AC**: FR-13, FR-14 / **AC-11, AC-12, AC-13, AC-17, AC-19**
- **規模**: M

---

#### T-13 — `robustness`(文言生成を含む)
- **何を作るか**: §1-11。判定 + prd §5-1 / §5-2 のテンプレート適用。`labelLine` / `verdict` / `caveat` を確定文字列で返す。
- **依存**: T-11, T-04
- **完了条件**:
  - **AC-08** が緑 — `label === "fragile"`、`displayDelta === "6.8"`、`kStarName === "移行コスト"`、`verdict` が prd §5-1 の DS-1 具体出力と**完全一致**
  - **AC-09** が緑 — `theta = 0.05` で `label === "contingent"`、かつ `deltaStar` と `kStarName` が θ に依らず不変
  - **AC-17** が緑 — DS-2 で `label === "robust"`、`verdict` が prd §5-2 の総括文 + 3基準の逆転不能文、`caveat === "基準そのものが抜けている可能性は、この分析では検出できません。"`
  - `label === "robust"` ⟹ `caveat !== null` の表明が全テストケースで緑(§8-11)
  - `verdict` が常に非空文字列であることの表明が緑(FR-11)
  - 境界 `Δ* === θ` ちょうどのケースが `fragile` 側になることが緑(E-7)
- **FR/AC**: FR-11, FR-12, FR-22 / **AC-08, AC-09, AC-17**
- **規模**: M

---

#### T-14 — `anchoringDetect` / `applyCutoffs`
- **何を作るか**: §1-12 / §1-13。`anchoringDetect` は**時計を読まない**。`applyCutoffs` は E-11 の `< cutoff − EPS` 判定。
- **依存**: T-05, T-04
- **完了条件**:
  - **AC-21 の後半**が緑 — `history` 3件(`B→A`, `A→B`, `B→A`)で `edits=3, flips=3, warn=true`、`message` が prd §5-4 の文言と完全一致
  - **AC-16** が緑 — 移行コスト `cutoff = 3.0` で `includedIndices === [0,1]`、`excluded[0].text === "ベンダーC — 移行コストが最低ライン3.0を下回るため除外"`
  - 全 `cutoff = null` で `excluded === []` が緑
- **FR/AC**: FR-18, FR-20 / **AC-16, AC-21(部分)**
- **規模**: S

---

#### T-15 — `createInitialState` / `migrateState` / `validateState`
- **何を作るか**: §1-16。`validateState` の3値応答と、`repaired` の16項目の修復を全て実装。`migrateState` は恒等変換だが分岐の器を置く。
- **依存**: T-06, T-05
- **完了条件**:
  - `repaired` の16項目それぞれについて1本ずつテストが緑(16ケース)
  - `{criteria:{}, options:{}}` が `failed` になることが緑
  - `rawWeight: "abc"` の入力が `repaired` されて起動でき、以後の `analyze` が `NaN` を生成しないことが緑(§8-5)
  - `createInitialState()` の返り値が `analyze` に渡せて例外を投げず `degenerate === "no-criteria"` を返すことが緑
- **FR/AC**: FR-16, FR-19, FR-02 / design.md §3-6, §8-5, §8-6
- **規模**: M

---

#### T-16 — `analyze`(単一の入口)+ コア公開面の凍結
- **何を作るか**: §1-14。退化判定8段、NaN 遮断(D-10 第3段)、全下位関数の畳み込み、`warnings` の集約。最後に `const TenbinCore = Object.freeze({...})`(§1-0 の全20メンバ)と `globalThis.TenbinCore = TenbinCore;`(END マーカの外側)。
- **依存**: T-04〜T-15 すべて
- **完了条件**:
  - `analyze(DS1State)` が §1-14 の入出力例と**フィールド単位で一致**(緑)
  - 退化8状態それぞれで `degenerate` と `message` が prd §5-3 の正典文言に完全一致(8ケース緑)
  - **AC-18** が緑 — DS-3 で `robustness === null` かつ `winContrib.length === 0` かつ `ranking` は埋まっている
  - `analyze` が**いかなる入力に対しても例外を投げない**ことをファズ的に検証(不正型・空・巨大・NaN 混入 の20入力で `assertThrowsNot`)
  - `Object.isFrozen(core) === true`、公開面が §1-0 の20メンバと**過不足なく一致**していることが緑
  - T-02 の純粋性ガード(C-5/C-6)が引き続き緑
- **FR/AC**: FR-06, FR-19 / **AC-18** + すべての AC の集約点
- **規模**: L

---

### 3-2. 状態と永続化(L3 / L4)

---

#### T-17 — 永続化層 L4(probe / load / save / quarantine / clearAll)
- **何を作るか**: `<script id="tenbin-persist">`。起動時の capability probe(`tenbin.v1.__probe` を try/catch で書読削)、`load(key)` の3段復旧ラダー(D-6)、`save` の 300ms デバウンス + `visibilitychange`(hidden)と `beforeunload` での即時フラッシュ、`QuotaExceededError` 時の `history` 半減 + 1回再試行、`clearAll()` は `Object.keys(localStorage)` 走査で `tenbin.v1.` 前置の**全キー**を削除(名指し削除にしない)。
- **依存**: T-16
- **完了条件**:
  - キーが `tenbin.v1.state` / `tenbin.v1.history` / `tenbin.v1.corrupt` の3つだけであること(ブラウザで確認)
  - **AC-22 の前半**: DS-1 + `θ=0.05` を入力しリロードし、全項目が復元され `analyze` の結果が AC-01 / AC-09 と一致
  - **AC-22 の後半**: 全消去後に `Object.keys(localStorage).filter(k => k.startsWith("tenbin.v1.")).length === 0`
  - 壊れた JSON(`localStorage.setItem("tenbin.v1.state","{{{")`)を仕込んでリロードし、**白画面にならず**初期状態で起動し、`tenbin.v1.corrupt` に生文字列が残ること
  - プライベートウィンドウで開いて例外が出ず、計算機能が全て動くこと(§8-1)
- **FR/AC**: FR-16 / **AC-22**、design.md §3-6, §8-1
- **規模**: M

---

#### T-18 — 状態管理層 L3(AppState 保持・id 採番・コマンド群)
- **何を作るか**: `<script id="tenbin-store">` の前半。`AppState` の単一保持、id カウンタの復元(`max(既存 id の数値部)+1`)、コマンド: `addCriterion` / `removeCriterion`(重みを残りに比例再配分)/ `renameCriterion` / `setDirection` / `setCutoff` / `addOption` / `removeOption` / `renameOption` / `setScore` / `setWeights` / `setTheta` / `setChallenger` / `clearAll`。上限10のハード拒否(FR-02)。名前200文字クランプ。
- **依存**: T-17
- **完了条件**:
  - 11 コマンドそれぞれの単体テスト(Node で `AppState` を組み立てて `analyze` に通す形)が緑
  - 基準を削除しても他選択肢のスコアが**ずれない**ことが緑(`Record<Id, RawScore>` の効き目、D-5)
  - 11件目の追加が拒否され、既存10件が壊れないことが緑(FR-02)
  - `setWeights` が `reweight` の結果を `rawWeight` に書き戻し(D-4)、再読み込み後も同じ `w` が復元されることが緑
- **FR/AC**: FR-01, FR-02, FR-04, FR-05, FR-20 / AC-20
- **規模**: L

---

#### T-19 — `w⁰` の確定と重み編集履歴の採取
- **何を作るか**: 「最初に全スコアを入力し終えた時点」で `initialWeights` を1度だけ確定し以後不変にする判定。重み編集の確定時(`change` / ドラッグ終了)に `WeightEdit` を1件作り `history` に追加する(`at` はここで `Date.now()` を採取 — **L3 だけが時計を読む**)。`leaderBefore` / `leaderAfter` は編集前後の `analyze` 結果の1位 id(同点/未確定なら `null`)。500件で古い方から切る。
- **依存**: T-18
- **完了条件**:
  - **AC-21 の完全再現**: 移行コストを `15%→25%→15%→30%` と編集し、各段階の6桁重みが `["30.882353","26.470588","17.647059","25.000000"]` / `["28.823529","24.705882","16.470588","30.000000"]` に一致し、`f` が 1→2→3 と進み、3回目で警告文が現れる。**編集はブロックされない**
  - ドラッグ1回が編集1回として数えられること(`input` 連発で `f` が増えない)
  - 501件目の追加で先頭が捨てられ長さが500に留まることが緑
- **FR/AC**: FR-18 / **AC-21**
- **規模**: M

---

### 3-3. レンダリング(L2)

---

#### T-20 — CSS 基盤(identity.md §7 の :root + 版面 + 数値タイポ + フォーカスリング)
- **何を作るか**: §2 B-03 の 2-1〜2-4 と 2-6 と 2-8。identity.md §7 の `:root` 定義を**一字一句そのまま**貼る。`--font-numeric` + `font-variant-numeric: tabular-nums` を `.num, input[type="number"], td.score, .delta, .weight, .pct` に適用。`:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }`。`sr-only` ユーティリティ。
- **依存**: T-01
- **完了条件**:
  - `index.html` 中に `outline: none` / `outline:none` の出現が0(T-03 のテストで緑)
  - `box-shadow` / `border-radius: 8px|12px|16px` / `Inter` / `Roboto` / `Poppins` / `Nunito` / `#667eea` / `#764ba2` / `#22c55e` / `#eab308` / `#3b82f6` の出現が0(T-03 に追加した禁止トークンテストで緑)
  - ブラウザでフォーカスリングが目視可能
- **FR/AC**: FR-23, FR-25, FR-26 / AC-24, AC-26(末尾)、identity.md §6 do/don't 1〜16
- **規模**: M

---

#### T-21 — 描画層 L2 の骨格(差分描画とフォーカス保護)
- **何を作るか**: `<script id="tenbin-render">`。前回の `Analysis` を保持し、フィールド単位で比較して**変わった箇所の `textContent` だけ**書き換える枠組み。D-12 の実装: 書き戻し前に `el === document.activeElement` を検査してスキップ、スライダーと数値入力の**ペア単位**でスキップ。書き込みは `requestAnimationFrame` で1フレームに1回。**`toFixed` を1回も呼ばない**(INV-2)。
- **依存**: T-16, T-20
- **完了条件**:
  - `tenbin-render` ブロックの本文に `toFixed` / `Math.` の出現が0(静的検査テストに追加、緑)
  - グリッドのセルに連続入力してもカーソル位置が飛ばないこと(手動確認 + `activeElement` スキップの単体テスト)
  - スライダーをドラッグ中、そのスライダー自身に書き戻されないこと(つまみが指から逃げない)
- **FR/AC**: FR-06 / design.md §6-1(D-11), §6-3(D-12), INV-2
- **規模**: M

---

#### T-22 — Z2 順位ストリップ + Z6 スコアグリッド
- **何を作るか**: `<table>` + `<th scope="col">`(基準名 + 向き `↓低いほど良い`)+ `<th scope="row">`(選択肢名 `<input>`)+ `<td>` の `<input type="number" min="0" max="10" step="0.5" aria-label="{選択肢}の{基準}のスコア">`。コスト基準セルの**ゴースト変換値**(`→ 3.0`)。Z2 の順位カード(`<ol>`、勝者に `--band-winner` 帯 + `--primary` 3px 左罫 + 語「1位」)、勝ち幅 `D₀`、除外リスト。行/列の DOM 生成は**構造変化のときだけ**。
- **依存**: T-21, T-18
- **完了条件**:
  - **AC-01 / AC-02** の値が画面に表示される(`67.0 / 63.5 / 51.0`、勝者ベンダーB、勝ち幅 `3.5`)
  - **AC-14** のゴースト値が画面に出る — 価格列 `A→3.0 / B→6.0 / C→4.0`、移行コスト列 `A→8.0 / B→4.0 / C→2.0`。benefit 基準ではゴーストを出さない
  - 向きを cost→benefit に切り替えると、その列のゴースト値が全行同時に更新され、勝者が **ベンダーB → ベンダーA** に変わる(AC-14 の後半)
  - `<th scope>` が全ヘッダに付いており、全セルに `aria-label` がある
- **FR/AC**: FR-01, FR-03, FR-04, FR-07, FR-20, FR-26② / **AC-01, AC-02, AC-14**
- **規模**: L

---

#### T-23 — Z1 結論帯(labelLine / verdict / caveat / Δ* 数直線)
- **何を作るか**: 4段構成。① `labelLine`(identity §5-6 の左4px 実線/破線/点線 + 語)② `verdict`(`--fs-lede` 20px / `--font-display` / `max-width: 62ch`)③ `caveat`(robust のみ)④ Δ* 数直線(0〜40pt 固定軸、`●` が `Δ*`、`|` が `θ`、`Δ* > 40` なら右端に `▶` + 実値ラベル)。robust のとき ④ は `Δ*` マーカーを打たず右端に `∞`。**文字列はすべて `Analysis` から受け取る。ここで丸めない。**
- **依存**: T-21
- **完了条件**:
  - **AC-08** の verdict 全文が画面に表示される
  - **AC-09**: θ を 0.05 に変えるとラベルが `contingent` に変わり、数直線の `●` は動かない
  - **AC-17**: DS-2 で `robust` + caveat が同時表示される
  - 順位表(Z2)が Z1 より**上に来ていない**こと(DOM 順で `#z1` が `#z2` より前。identity do/don't 12)
  - 3ラベルが色以外に**語と罫スタイル**で区別されていること(fragile と contingent の相互コントラストは 1.00:1 のため必須)
- **FR/AC**: FR-07, FR-11, FR-12, FR-22, FR-26④ / **AC-08, AC-09, AC-17**
- **規模**: M

---

#### T-24 — Z4 貢献度パネル(中心0軸バー + 100%積み上げ帯)
- **何を作るか**: (B) 勝敗貢献度 — `grid-template-columns: 1fr 1px 1fr` の中心0軸バー(軸は `--primary` = 支点)、スケールは `max(1, max|g_j|)`、`100%` 位置の基準線とラベル「100% = 勝ち幅の全部」、負のバーは方向 + `--muted-soft` で示し**色で正負を区別しない**、符号付き数値ラベルを必ず併記、prd §5-7 の但し書きを同カード内に常時表示(折りたたまない)。(A) スコア貢献度 — 100%積み上げ帯、区画が狭ければ数値を帯の外へ引き出す(**数値を消さない**)、`S_i = 0` の行は4基準とも `"—"` + 理由文。挑戦者 `<select>` + 「この選択は貢献度の内訳だけを変えます。崩れやすさの計算は常に全ての選択肢を相手にしています。」の注記。
- **依存**: T-23
- **完了条件**:
  - **AC-11** の4値が画面に出る(`+300.0% / -85.7% / +57.1% / -171.4%`)。価格のバーだけが 100% 基準線を越えている
  - **AC-13** の9値が画面に出る(3行 × 4基準の一部)
  - **AC-19**: 案Z の行が4基準とも `—`(`0%` も `NaN` も出ない)
  - **AC-18**: DS-3 で (B) が丸ごと非表示になり「同点です。基準またはスコアを見直してください。」に切り替わる。(A) は表示してよい
  - バー幅の計算に `max ≤ EPS` ガードがある(Z-7)
- **FR/AC**: FR-13, FR-14, FR-15, FR-25, FR-26① / **AC-11, AC-12(可視化), AC-13, AC-18, AC-19**
- **規模**: L

---

### 3-4. 入力ハンドラ

---

#### T-25 — グリッド入力のハンドラと人間工学
- **何を作るか**: `input` で `parseScore`(空文字 → `null`、`Number.isFinite` 偽 → `null`)して `store.setScore`。**セルの `.value` に触らない**(一方向)。`step=0.5` の丸めは `blur` 時と復元時にのみ適用。`Enter` = 下のセル(最終行なら次の基準の先頭へ折り返す)、`Ctrl+矢印` = セル間移動、`↑↓` = 標準の 0.5 刻み数値増減、`Esc` = 編集破棄。タブ順は行優先。
- **依存**: T-22
- **完了条件**:
  - `"e"` / `"-"` / `"1e999"` を打ち込んでも画面に `NaN` が1文字も出ず、未入力扱いになる(§8-5)
  - `7` を消して `8` を打つ途中の空文字・`0.` が矯正されず、打鍵が壊れないこと
  - `Enter` / `Ctrl+矢印` / `Esc` の4挙動が手動確認で成立
  - **AC-26.3**(12個のスコアセル全てにキーボードのみで DS-1 の値を入力)が完了できる
- **FR/AC**: FR-01, FR-03, FR-26⑤ / **AC-26.3**、design.md §6-3, §8-5
- **規模**: M

---

#### T-26 — 重みスライダーのハンドラと比例再正規化
- **何を作るか**: `<input type="range" min="0" max="100" step="0.1">` + 併設の数値直接入力(双方向同期)。`input` で `x = value/100` → `reweight(currentW, k, x)` → `store.setWeights(w')`。矢印キーは `keydown` で吸収して **±1.0 ポイント**(`Shift+矢印` = ±0.1、`PageUp/Down` = ±10、`Home/End` = 0/100)。ドラッグ中のスライダー自身には書き戻さない(D-12)。**Z3 の行の並べ替えは `change` / `blur` / ドラッグ終了時のみ**(§5-2 の裁定 X-4)。
- **依存**: T-21, T-18
- **完了条件**:
  - **AC-15**: 価格を 50% にすると他3基準が `23.076923 / 15.384615 / 11.538462`(6桁)になり、順位は不変
  - **AC-26.4**: 矢印キーで 1 ポイント刻みに動くこと、数値入力に `35 30 20 15` を直接入力できること
  - スライダー操作中に行が並び替わらないこと。手を離した瞬間に並び替わること
  - 全スライダーを 0 に引き切っても `NaN` が出ず、等重みで順位が出て警告が表示されること(§8-2)
  - 1つの基準を 100% にしても例外が出ず、ラベルが `robust` になること(§8-8)
- **FR/AC**: FR-05, FR-26⑤ / **AC-15, AC-26.4**、design.md §8-2, §8-8
- **規模**: L

---

#### T-27 — 基準・選択肢の追加/削除/リネーム/向き/足切りの UI 結線
- **何を作るか**: `[+ 基準を足す]`(新行の名前入力にフォーカス、重み既定 `0%`、仮名 `基準{n}`)、`[+ 選択肢を足す]`(スコアは空、名前入力にフォーカス)、`[⋯]` メニュー内の削除と「最低ラインを設定」、向きトグル(語で表示。`benefit`/`cost` の英語を画面に出さない)。7個目/7件目のインライン警告(ブロックしない)、10個/件目で追加ボタン `disabled` + 理由文。削除の確認ダイアログは置かない。
- **依存**: T-26, T-22
- **完了条件**:
  - **AC-16**: 移行コストに最低ライン 3.0 を設定すると、ベンダーC が Z2 から除外リストへ移り、理由文「ベンダーC — 移行コストが最低ライン3.0を下回るため除外」が表示され、残る2件の表示が `67.0 / 63.5` で AC-01 と同一
  - **AC-20**: ベンダーD(3,10,9,1)を追加すると `86.0` で1位になるが、既存3件の表示値が `67.0 / 63.5 / 51.0` のまま変わらず、**警告が一切出ない**
  - 7個目の追加で「基準が重複していないか確認してください。」が出て**追加はできる**
  - 11個目の追加ができない
  - **AC-26.1 / AC-26.2**: キーボードのみで選択肢3件・基準4件を追加して命名し、向きを切り替えられる
- **FR/AC**: FR-01, FR-02, FR-04, FR-20, FR-21 / **AC-16, AC-20, AC-26.1, AC-26.2**
- **規模**: L

---

### 3-5. 感度分析 UI ★最重要

---

#### T-28 — 臨界度レール(支点マーカー + 勝者ゾーン塗り分け)
- **何を作るか**: 重みスライダーのトラックそのものを逆転閾値の目盛盤にする。identity §5-3 の支点(`--primary` 2px 縦線、上下に 5px 突き出す、`::after` の CSS 三角形)を `w_k*` の位置に絶対配置。トラック背景の `linear-gradient` ハードストップで「ここまで {W} が1位 / ここから {逆転相手} が1位」を2ゾーンに塗り分け、**文字ラベルを必ず載せる**(色に頼らない)。ヘッダ行に `現在 {w_k}% → 逆転 {w_k*}%({±Δ}ポイント) {逆転相手} に逆転`。臨界度バー(全行最大値で正規化)+ 最上位行に `← 最も浅い`。逆転不能行は支点を消し、トラックを `repeating-linear-gradient` の斜線ハッチにし、`—(逆転不能)` + prd §5-2 の理由文。行番号 `①②③`、パネル見出し「基準 — 崩れやすい順」。
- **依存**: T-26, T-11
- **完了条件**:
  - **AC-05 / AC-06 / AC-07 が1画面で同時に見える** — 移行コスト `+6.8pt`(★が▼の右)、価格 `-8.6pt`(★が▼の左)、機能充足度 `+18.1pt`、サポート(支点なし・ハッチ・逆転不能文)
  - 行が `|Δw|` 昇順に並び、逆転不能が末尾
  - 表示値が `21.8% / 26.4% / 48.1%` であること
  - 数値ラベルが支点の隣に必ずあること(FR-10③④ / FR-26①)
  - **通常の重みバーに赤を使っておらず、`--fragile-ink` は最臨界基準 `k*` の1本だけ**であること(identity §5-2)
- **FR/AC**: FR-05, FR-08, FR-09, FR-10, FR-25, FR-26① / **AC-05, AC-06, AC-07**
- **規模**: L

---

#### T-29 — `[閾値へ]` / `[元に戻す]` と θ 変更 UI(AC-10 のキーボード経路)
- **何を作るか**: 各行の `[{w_k*}% へ]` ボタン(**ラベルに数値を入れる**)。押すと `w_k` を**内部値 `wStar` に厳密に設定**する(表示丸め値を使わない)。押した直後、同じ位置が `[元に戻す]` に変わり、**押す前の重みベクトル全体**を復元する。支点にホバー/フォーカスで予告文「ここに合わせると {L} と同点(どちらも {S})になります」。Z1 の理由文中の基準名を Z3 の該当行へフォーカスを送るリンクにする(経路C)。θ 変更ポップオーバー(Z0 と Z1④ の両方から開く。prd §5-1 のツールチップ由来文を**常時展開**して置く。ラベルが変わる場合はプレビュー文で予告)。`[全消去]` の2段階化(1回目でラベルが `本当に全部消す` に変わり、`Esc` / フォーカス離脱で戻る。**モーダルにしない**)。
- **依存**: T-28, T-10
- **完了条件**:
  - **AC-10 が画面上で成立** — `[21.8% へ]` を押すと重み表示が `32.2 / 27.6 / 18.4 / 21.8`、スコアが `64.8 / 64.8 / 48.5`、Z1 が「同点です。基準またはスコアを見直してください。」に変わる。価格の `[26.4% へ]` で `67.9` 同点、機能充足度の `[48.1% へ]` で `70.4` 同点
  - `[元に戻す]` で重みベクトル全体が復元される
  - **AC-26.5**: キーボードのみで θ を変更できる。由来の文が hover なしで読める
  - **AC-26.7**: キーボードのみで全消去を実行できる。`Esc` で取り消せる
  - **AC-09**: θ を 0.05 にするとラベルだけが変わり、`Δ*` の `●` は動かない
- **FR/AC**: FR-05, FR-08, FR-12, FR-16 / **AC-09, AC-10, AC-26.5, AC-26.7**
- **規模**: L

---

#### T-30 — Z5 重み履歴帯と逆算検知の表示
- **何を作るか**: 「最初の重み: {k}: {w⁰_k}% → 現在: {w_k}%」の並記(prd §5-4)。`f ≥ threshold` のとき identity §5-9 の警告ブロック(左 4px `--primary` 罫、背景を塗らない、`role="status"`、**モーダル・`alert()` にしない**)。再訪時の「前回 {日時} の続きです」を1行静かに出す。`[履歴を見る]`。
- **依存**: T-19, T-21
- **完了条件**:
  - **AC-21 が画面上で成立** — 移行コストを 3 回編集すると Z5 に「重みを 3 回編集する間に1位が 3 回入れ替わっています。結論に合わせて重みを調整していないか確認してください。」が現れ、**編集は続けられる**
  - 警告が **Z1 には出ない**こと(Z1 は結論の場所であり行動の指摘で汚さない)
  - `f = 1` / `f = 2` では何も出ないこと
- **FR/AC**: FR-18 / **AC-21**
- **規模**: M

---

### 3-6. アクセシビリティ

---

#### T-31 — `aria-live` の二重化とデバウンス
- **何を作るか**: `#verdict`(視覚用・即時更新・`aria-hidden="true"`)と `#verdict-live`(`sr-only` + `aria-live="polite"` + `aria-atomic="true"`)の双子構成。`#verdict-live` は **§5-2 の裁定 X-2 により 700ms** のデバウンス後、**前回と文字列が異なる場合のみ** `textContent` を更新。「結論あり ↔ 空状態/同点」のモード変化はデバウンスを待たず即時発火。`aria-live` 領域は Z1 / Z5 / Z0 の3つだけ(Z2/Z3/Z4 は live にしない)。スライダーには `aria-valuetext="35.0パーセント"` を入れる(生の `35` が「35」とだけ読まれるのを防ぐ)。
- **依存**: T-23, T-30
- **完了条件**:
  - スライダーを連続ドラッグしても `#verdict-live` の書き換えが**1回に畳まれる**こと(`MutationObserver` を仕込んだ手動計測、または L2 の更新回数カウンタの単体テスト)
  - `#verdict-live` と `#verdict` の文字列が常に同一(`robustness.verdict`)であることの表明が緑
  - `role="alert"` を1箇所も使っていないこと(静的検査に追加)
- **FR/AC**: FR-26③ / **AC-26(末尾)**、design.md §6-5(D-14)
- **規模**: M

---

#### T-32 — キーボード完全操作とフォーカス順の総点検
- **何を作るか**: ux.md §6-1 のキー割当表 全19行を通しで検証し、欠けを埋める。`tabindex` の正値を使わない(DOM 順 = 視覚順 = タブ順)。支点・レール帯・臨界度バー・貢献度バーを**フォーカス対象にしない**。Z3 の行が並べ替わってもフォーカス中の要素が同一 DOM ノードのまま移動する(D-13 の `appendChild` 移動)。各ゾーン先頭の `<h2>`。狭幅(<720px)とズーム200%で単一カラム化 + Z6 の選択肢別2列テーブル化。
- **依存**: T-25, T-26, T-27, T-29, T-31
- **完了条件**:
  - **AC-26 の1〜7を1度も マウス・トラックパッドに触れずに通しで完了できる**(手動チェックリストとして記録を残す)
  - ズーム200%で横スクロールが発生しない
  - `tabindex="[1-9]` の出現が0(静的検査)
  - Z3 の並べ替え中にフォーカスが失われないこと
- **FR/AC**: FR-26⑤⑥ / **AC-26 全項目**
- **規模**: L

---

### 3-7. 空状態・エラー・出力

---

#### T-33 — 空状態・退化状態・境界状態の全分岐
- **何を作るか**: ux.md §7-1 の12状態と §7-2 の優先順位7段を実装。Z1 に出す文言は常に1つだけ。初回は Z3/Z4/Z5 を**存在ごと隠す**。空状態の Z1 にはラベル記号も Δ* 数直線も出さない。未入力セル数 `{c}` が入力のたびに減る。§7-3 の【要文言確定】B-1〜B-5 は暫定案をそのまま使う(**勝手に文面を変えない**)。§8-7 の全件足切り、§8-1 の localStorage 不可時のプライバシー文差し替え。
- **依存**: T-32, T-17
- **完了条件**:
  - 12状態それぞれで、例外が出ず、prd §5-3 の正典文言が**一字一句そのまま**表示されることを手動チェックリストで確認
  - 優先順位が正しい(基準0件 + 選択肢0件 が同時に成立したとき「何で比べるかを決めてください。…」だけが出る)
  - **AC-18**: 同点で `Δ*` 数直線もラベルも出ず、Z3 の支点が消えること
  - **AC-19**: `S_i = 0` の行が `—`
  - プライベートウィンドウで B-5 の文言に差し替わること
  - `analyze` に対する20入力のファズテスト(T-16)が引き続き緑で、画面にも `NaN` が出ないこと
- **FR/AC**: FR-02, FR-19, FR-20, FR-24 / **AC-18, AC-19**、prd §5-3、ux §7 全体
- **規模**: L

---

#### T-34 — エクスポート(CSV / Markdown / JSON)と完成検査
- **何を作るか**: `[出力▾]` から3形式。押した瞬間にダウンロードが始まる(中間ダイアログなし)。`Blob` + `URL.createObjectURL` + `<a download>`(ネットワークを1回も使わない)。**生成は L3 の責務**(§5-2 の裁定 X-8)。出力後に Z0 で `aria-live="polite"` の完了通知。§6 の完成判定チェックリストを全項目走らせる。
- **依存**: T-33
- **完了条件**:
  - **AC-23**: 3形式すべてに `67.0 / 63.5 / 51.0`、順位、`+6.8 / -8.6 / +18.1 / 逆転不能`、`Δ* = 6.8pt`、`k* = 移行コスト`、`fragile`、各基準の向きが含まれる。JSON がパース可能で数値フィールドが数値型。CSV が「ヘッダ1行 + 選択肢3行」以上
  - **AC-25**: DevTools Network を開いた状態で DS-1 を全入力し、重みを3回動かし、3形式をエクスポートして、**追加リクエスト数 = 0**
  - **AC-26.6**: キーボードのみでエクスポートを実行できる
  - §6 のチェックリストが全項目 ✓
- **FR/AC**: FR-17, FR-24 / **AC-23, AC-25, AC-26.6**
- **規模**: M

---

### 3-8. タスク依存グラフ(要約)

```
T-01 ─┬─ T-02 ─┬─ T-03
      │        └─ T-04 ─┬─ T-05 ─┬─ T-07 ─┬─ T-08 ─┬─ T-09 ─┬─ T-10 ─┐
      │                 ├─ T-06 ─┘        │        ├─ T-11 ─┼────────┤
      │                 └─ T-14 ──────────┤        └────────┘        │
      │                                   └─ T-12 ───────────────────┤
      │                                      T-13 ←(T-11, T-04)      │
      │                                      T-15 ←(T-05, T-06)      │
      └─ T-20 ────────────────────────────────────────────────────┐   │
                                                                  │   │
   T-16 ← T-04..T-15 すべて ── T-17 ── T-18 ── T-19               │   │
                                 │       │                        │   │
                       T-21 ←(T-16, T-20)┘                        │   │
                        ├─ T-22 ─┬─ T-25 ─┐                       │   │
                        ├─ T-23 ─┼─ T-24  │                       │   │
                        └─ T-26 ─┴─ T-27 ─┤                       │   │
                             │            │                       │   │
                             T-28 ── T-29 ┤                       │   │
                                     T-30 ┤                       │   │
                                     T-31 ┤                       │   │
                                     T-32 ── T-33 ── T-34 ────────┴───┘
```

---

## 4. テストファイルの設計(`tests/tenbin.test.js`)

### 4-1. ファイル構造

```
tests/tenbin.test.js          単一ファイル。Node 標準ライブラリのみ。依存パッケージ0。
                              実行: node tests/tenbin.test.js
                              終了コード: 全緑 0 / 1本でも赤 1

  §A  ミニランナー        test(name, fn) / assertEqual / assertClose / assertDeepEqual /
                          assertThrowsNot / run()
  §B  loadCore            §4-2 の実装。抽出 + 純粋性ガード + 評価
  §C  静的検査            AC-24 / AC-25 / identity 禁止トークン(HTML をテキストとして検査)
  §D  データセット組立    buildDS1() / buildDS2() / buildDS3() / buildDS1WithZ() /
                          buildDS1WithD() / buildDS1AllBenefit() / buildDS1WithCutoff()
  §E  単位テスト          §1-1 〜 §1-16 の関数ごと
  §F  AC テスト           AC-01 〜 AC-23 の対応表(§4-4)に沿って1本ずつ
  §G  性質テスト          §4-5 の反例探索(ランダム試行 × 閉形式 vs ブルートフォース)
```

### 4-2. `loadCore` の実装方針

design.md §2-3 の疑似コードをそのまま Node に写す。**追加も省略もしない。**

```
loadCore(htmlPath):
  1. html ← fs.readFileSync(htmlPath, "utf8")
  2. C-1: BEGIN / END がそれぞれちょうど1回。b < e
  3. C-2: '<script id="tenbin-core">' の位置 sOpen、その後の '</script>' の位置 sClose に対し
          sOpen < b かつ e < sClose
  4. src ← html.slice(b + BEGIN.length, e)
  5. C-5 / C-6 純粋性ガード:
     FORBIDDEN = ["document","window","localStorage","sessionStorage","navigator",
                  "fetch","XMLHttpRequest","alert","Date","Math.random","globalThis","</script"]
     単語境界つき正規表現で照合。1つでも当たれば fail("INV-1 違反: …")
     ★ この手順5自体が独立した1本のテストである
  6. factory ← new Function('"use strict";\n' + src + '\nreturn TenbinCore;')
     core    ← factory()
     C-4: typeof core === "object" かつ Object.isFrozen(core)
  7. return core
```

**設計上の要点:**
- `new Function` は呼び出し元スコープを閉じ込めないため、テスト側の変数がコアから見えない。**コアが暗黙にテスト側の何かに依存していたら、その場で `ReferenceError` で落ちる。**
- `"use strict"` を前置して sloppy mode の暗黙グローバル生成を防ぐ。
- `loadCore` はモジュール先頭で**1回だけ**呼び、返り値を全テストで共有する(`Object.freeze` 済みなので汚染されない)。
- 単語境界照合は `new RegExp("\\b" + escapeRegExp(token) + "\\b")` を基本とし、`Math.random` と `</script` はドット/スラッシュを含むため単純な `includes` で照合する。

### 4-3. データセット組立ヘルパ

```
buildDS1()            prd §4-0。criteria 4 / options 3。id は "c1".."c4" / "o1".."o3"
buildDS2()            prd AC-17。criteria 3 / options 2
buildDS3()            prd AC-18。criteria 2 / options 2(厳密同点)
buildDS1WithZ()       DS-1 + 案Z(10, 0, 0, 10)→ a = [0,0,0,0]、S = 0     … AC-19
buildDS1WithD()       DS-1 + ベンダーD(3, 10, 9, 1)→ S = 0.86           … AC-20
buildDS1AllBenefit()  DS-1 の direction を全て benefit に               … AC-14
buildDS1WithCutoff()  DS-1 + 移行コスト cutoff = 3.0                     … AC-16
buildHistoryAC21()    AC-21 の WeightEdit 3件                            … AC-21
```

**id を `"c1".."c4"` のような決定的な文字列にする**(design.md §3-4 が `crypto.randomUUID` を使わない理由に「ID の再現性がテストを楽にするため」を挙げている)。

### 4-4. AC ↔ テストケース対応表

| AC | 主なテストケース名 | 検証対象の関数 | 検証形式 | 備考 |
|---|---|---|---|---|
| **AC-01** | `AC-01 総合スコアと表示値` | `computeScores` / `fmt.score` / `analyze` | 表示文字列 `["63.5","67.0","51.0"]` の**完全一致** + 厳密値との `assertClose(1e-9)` | |
| **AC-02** | `AC-02 順位と勝者と勝ち幅` | `rank` / `analyze` | 順位名配列の完全一致、`displayD0 === "3.5"` | |
| **AC-03** | `AC-03 重みの合計が厳密に1` | `normalizeWeights` | `assertClose(Σw, 1, 1e-9)` + 表示4件 | 実測 `Σ−1 = -1.11e-16` |
| **AC-04** | `AC-04 合計が100でない重みの正規化` | `normalizeWeights` | 表示 `["41.7","25.0","16.7","16.7"]` | **表示合計が 100.1% でも赤にしない** |
| **AC-05** | `AC-05 逆転閾値 Δw_k` ★ | `tippingPoint` / `criticality` | 4行の `delta` / `wStar` / `sens` の値 + 表示 | 厳密値 119/1740, −91/1060, 49/270 と `assertClose(1e-9)` |
| **AC-06** | `AC-06 臨界度ランキングの並び順` | `criticality` | 名前配列 `["移行コスト","価格","機能充足度","サポート"]` | 反直感的洞察の検証を兼ねる |
| **AC-07** | `AC-07 支配的優位の判定` ★ | `tippingPoint` | 両挑戦者で `reason === "dominant"`、`sens === 0` | 両端点(0% / 100%)での1位不変も検証 |
| **AC-08** | `AC-08 頑健性ラベル fragile` | `robustness` | `label` + `verdict` 全文の**完全一致** | prd §5-1 の DS-1 具体出力 |
| **AC-09** | `AC-09 θ 変更でラベルが変わる` | `robustness` | `label === "contingent"`、`deltaStar` / `kStarName` が θ 不変 | |
| **AC-10** | `AC-10 閾値まで動かすと同点` ★★ | `reweight` + `computeScores` | 3基準それぞれで `assertClose(S_W − S_L, 0, 1e-9)` + 表示重み/スコア | **`reweight` と `tippingPoint` の一致検証。実測残差 1.11e-16** |
| **AC-11** | `AC-11 勝敗貢献度 g_j` | `winContribution` | 表示4件 + `assertClose(Σg, 1, 1e-12)` | 実測 `Σ−1 = 2.89e-15` |
| **AC-12** | `AC-12 貢献度と実行可能性の相互整合` | `winContribution` × `tippingPoint` | 全基準で `g_k ≤ 1 ⟺ down 不可` | **独立計算どうしの突合。片方から導出しない** |
| **AC-13** | `AC-13 スコア貢献度 c_ij` | `scoreContribution` | 3行 × 4基準 = 12 表示値 + 各行 `Σ = 1` | |
| **AC-14** | `AC-14 コスト反転が効いている` ★ | `normalize` / `analyze` | 正/誤 2設定で勝者が `B → A` に変わる + セル値 `3.0/6.0/4.0` `8.0/4.0/2.0` | |
| **AC-15** | `AC-15 再正規化後の合計が1` ★ | `reweight` | 6桁表示4件 + `assertClose(Σ,1,1e-9)` + 順位不変 | |
| **AC-16** | `AC-16 足切りが加重和の前段` | `applyCutoffs` + `analyze` | `includedIndices` / 理由文 / 残り2件の表示が AC-01 と同一 / `Δ*` が AC-08 と同一 | 集合非依存性 |
| **AC-17** | `AC-17 robust ケース` ★ | `robustness` / `winContribution` | `label === "robust"`、`caveat !== null`、g 3件 | DS-2 |
| **AC-18** | `AC-18 同点の退化` | `rank` / `analyze` | `degenerate === "tie"`、`robustness === null`、`winContrib === []` | **`=== 0` では通らない。EPS 判定の存在証明** |
| **AC-19** | `AC-19 S_i = 0 の退化` | `scoreContribution` | 4件とも `display === "—"`。出力に `"NaN"` / `"0%"` を含まない | |
| **AC-20** | `AC-20 選択肢追加への順位不変` | `analyze` | 追加前後で既存3件の `score` が**厳密一致**、相対順序も一致、`warnings` に rank reversal 警告が無い | |
| **AC-21** | `AC-21 逆算検知` ★ | `reweight` + `rank` + `anchoringDetect` | 3編集の6桁重み + 各段の1位 + `flips === 3` + `message` 完全一致 | |
| **AC-22** | `AC-22 localStorage 永続化` | `validateState` / `migrateState` | **Node 側**: state の round-trip(`JSON.stringify` → `parse` → `validateState` → `analyze`)が AC-01/AC-09 と一致<br>**ブラウザ側**: キー前置と全消去0個を手動チェックリストで | 半分は Node、半分は手動 |
| **AC-23** | `AC-23 エクスポート` | `analyze` の ViewModel 網羅性 | Node: `Analysis` に AC-23 が列挙する全値が載っていることを表明<br>ブラウザ: 実ファイル3本の内容を手動確認 | **§5-2 X-8 の裁定による** |
| **AC-24** | `AC-24 単一HTML` | HTML テキスト | 禁止トークン7種の出現回数 = 0 | **完全に機械検査可能** |
| **AC-25** | `AC-25 ネットワーク送信ゼロ` | HTML テキスト + 手動 | 禁止トークン6種の出現回数 = 0(機械)+ DevTools Network の記録 = 1(手動) | |
| **AC-26** | `AC-26 キーボード完全操作` | HTML テキスト + 手動 | `outline: none` / `tabindex="[1-9]` の出現 = 0(機械)+ 7操作の通し実行(手動) | |

**機械検査だけで閉じる AC: AC-01〜AC-21 + AC-24。** AC-22 / AC-23 / AC-25 / AC-26 は機械検査 + 手動チェックリストの二層。

### 4-5. 数式の反例探索テスト(閉形式 vs ブルートフォース)

**目的:** 逆転閾値の閉形式 `Δw_k = D₀(1−w_k)/(D₀−d_k)` が、比例再正規化つきの重みスイープと**一致する**ことを、AC が用意した3つのデータセットの外側で確かめる。design.md §2-4(5)が「反例探索が現実的になる」と述べた枠を実装する。

```
test("性質: 閉形式とブルートフォースが一致する(1000試行)"):

  seed ← 固定(線形合同法など、Math.random を使わず再現可能に)
  FOR trial IN 1..1000:
      m ← rand(2..10)                    # 選択肢数
      n ← rand(1..10)                    # 基準数
      rawW  ← n 個の rand(1..100) の整数
      raw   ← m×n 個の rand(0..20)/2     # 0.5 刻み
      dir   ← n 個の rand({benefit,cost})
      st    ← buildState(...)
      vm    ← core.analyze(st)
      IF NOT vm.ok: CONTINUE             # 退化はこのテストの対象外

      FOR each row IN vm.criticality:
          k ← row の基準 index

          # ── 主張1: feasible なら閾値でちょうど同点になる ────────────
          IF row.infeasible == false:
              w2 ← core.reweight(w, k, row.wStar)
              S2 ← core.computeScores(a, w2)
              ASSERT |S2[winner] − S2[opponent]| <= 1e-9
                  ELSE 反例として (m,n,rawW,raw,dir,k) を出力して fail

          # ── 主張2: infeasible なら [0,1] のどこへ動かしても1位が変わらない ──
          #    ブルートフォース。0.00, 0.01, …, 0.99 の100点 + 端点
          ELSE:
              FOR x IN [0, 0.01, 0.02, …, 0.99, 1 − 1e-9]:
                  w2 ← core.reweight(w, k, x)
                  S2 ← core.computeScores(a, w2)
                  ASSERT argmax(S2) == winnerIndex  (または S2 の1位が winner と同点)
                      ELSE 反例として出力して fail

          # ── 主張3: feasible なら閾値の「向こう側」で1位が入れ替わる ──────
          IF row.infeasible == false AND row.wStar ∈ (0,1):
              eps2 ← 1e-4
              側A ← reweight(w, k, clamp(row.wStar − eps2))
              側B ← reweight(w, k, clamp(row.wStar + eps2))
              ASSERT argmax(computeScores(a,側A)) ≠ argmax(computeScores(a,側B))
                  # 閾値をまたぐと1位が変わる。またがなければ閉形式が誤っている
```

**このテストが担うもの:**
- **主張1** は AC-10 の一般化。AC-10 は DS-1 の3基準しか見ていないが、これは 1000 × 最大10基準 = 最大1万本の閾値を検証する。
- **主張2** は AC-07 の一般化。「逆転不能」を宣言した基準が本当に逆転不能であることを、100点のスイープで独立に確かめる。**閉形式が偽陰性(逆転可能なのに不能と言う)を出していないか**を突く。
- **主張3** は逆方向。閉形式が偽陽性(逆転不能なのに可能と言う)を出していないかを突く。

**追加の性質テスト(いずれも安価で、壊れたときに真っ先に落ちるべきもの):**

| # | 性質 | 表明 |
|---|---|---|
| P-1 | 重み総和の保存 | 任意の `reweight` 連鎖(20回)の後も `\|Σw − 1\| ≤ 1e-9`。**AC-21 の3連続編集の一般化**(実測は `Σ−1 = 0.0`) |
| P-2 | 貢献度の総和 | `ok` な全試行で `\|Σg − 1\| ≤ 1e-12` かつ各行 `\|Σc − 1\| ≤ 1e-12` |
| P-3 | 集合非依存性 | 任意の選択肢を1件追加しても、既存選択肢の `S_i` が**ビット単位で変わらない**。**AC-20 の一般化**(FR-21) |
| P-4 | 順序の安定性 | 同スコア2件を含む入力で、無関係なセルを編集しても両者の表示順が変わらない(§8-10) |
| P-5 | NaN 非出現 | 全試行の全 `display*` 文字列に `"NaN"` / `"Infinity"` / `"undefined"` が1度も現れない(D-10 の出口の表明) |
| P-6 | 例外非投擲 | 不正型・空・巨大・NaN 混入を含む生成入力200本に対し `analyze` が1度も throw しない(§4-13 の事後条件) |
| P-7 | `sens` の単位 | 全 feasible 行で `sens × \|delta\| === 1`(誤差 `1e-9` 以内)。**ポイント単位への取り違えを構造的に検出する**(§4-6-1) |
| P-8 | robust ⟹ caveat | 全試行で `label === "robust"` ⟹ `caveat !== null`(§8-11 / FR-22) |

**乱数は自前の線形合同法で seed 固定にする。** テストが `Math.random` を使うと、赤くなった試行を再現できない — 反例探索の目的は「反例を見つけること」ではなく「**反例を再現して直せること**」である。

---

## 5. 実装順序の危険地帯

### 5-1. 先に作らないと詰むもの / 後回しにすると壊れるもの

| # | 内容 | なぜ |
|---|---|---|
| **H-1** | **T-02 の `loadCore` を最初に作る。** | これが無いと T-04 以降の全ての完了条件が「ブラウザを開いて目で見る」になり、AC-01〜AC-21 の29個の表示文字列を毎回手で確認することになる。**テストが重くなった瞬間に書かれなくなる**(design.md §2-1 の動機そのもの) |
| **H-2** | **`fmt`(T-04)を計算関数より先に作る。** | AC の過半が検証しているのは数値ではなく**表示文字列**である(D-1)。`fmt` が無いと T-07 以降の完了条件が半分しか書けない |
| **H-3** | **`tippingPoint`(T-09)を `criticality`(T-11)より先に、`reweight`(T-10)を `criticality` と同時期に。** | AC-10 は「`reweight(w,k,wStar)` の結果で `computeScores` すると同点」という形でしか書けない。両者が揃うまで AC-10 のテストは書けず、**AC-10 が書けないまま T-28 の UI に進むと、支点の位置が正しいかを画面でしか判断できなくなる** |
| **H-4** | **`analyze`(T-16)の退化判定8段を UI(T-33)より先に確定させる。** | ux.md §7-2 の優先順位7段は `analyze` の判定順序と**同じ順番でなければならない**。UI 側に第2の分岐を書くと、二重管理になって必ずずれる。**優先順位の実装は L1 に1箇所だけ** |
| **H-5** | **`w⁰` の確定タイミング(T-19)をレンダリング(T-20〜)より先に。** | `initialWeights` は「最初に全スコアを入力し終えた時点」の1点を捉えた**導出不能な量**(D-3)。この採取を後回しにすると、Z5 の並記と AC-21 の全体が後から追加になり、`analyze` の呼び出し順(編集前後で2回呼ぶ)を組み直すことになる |
| **H-6** | **CSS 基盤(T-20)を各ゾーンの実装(T-22〜)より先に。** | identity.md §7 の `:root` を後から入れると、それまでに書いたハードコード色を全部剥がすことになる。特に `--radius: 0px` と `--shadow: none` は「後から角丸とシャドウを消す」作業が最も面倒な種類のもの |
| **H-7** | **D-12(フォーカス中の要素に書き戻さない)を T-21 の枠組みに埋め込む。** | 後付けできない。素朴な「毎回全部書き戻す」実装を一度作ると、**タイピング中に文字が消える**という致命的な不具合が全セルで同時に出る。設計の付録C-8 が「これを破ると打鍵できなくなる」と名指ししている |
| **H-8** | **T-19 の履歴採取は `change` 側に置く(`input` ではない)。** | `input` に置くとドラッグ1回が数十回の編集として数えられ、AC-21 の「編集3回」が最初の1ドラッグで達成されてしまう。ux §5-2 が「ドラッグ1回を数十回の編集として数えない」と明記している |
| **H-9** | **Z3 の並べ替えを `change` 側に置く(T-26)。** | design.md §6-4 は「再描画のたび `appendChild` で並べ替える」と書いているが、これを `input` ごとに走らせると打鍵中に行が動く。§5-2 の裁定 X-4 参照 |
| **H-10** | **`normalizeMatrix` を公開面に入れる(T-16)。** | design.md §2-2 の export リストから漏れているが、AC-14 のセル単位検証(`a×10` の6値)を Node から書くのに要る |

### 5-2. 位相間の矛盾と裁定 ★実装者は着手前に必ず読むこと

**以下は design.md / ux.md / identity.md / prd.md の間で実際に食い違っている箇所である。黙って片方に寄せず、根拠を明記して裁定する。**

---

**X-1 — localStorage 保存デバウンスの値が食い違う**

| 出典 | 記述 |
|---|---|
| design.md §7-5(D-15) | 「保存は **300ms** のデバウンスをかける」 |
| ux.md §5-2 | 「`localStorage` 保存(FR-16) … `change` 確定時 + **500ms** デバウンス」 |

> **裁定: design.md の 300ms を採る。** 理由: (a) design.md はこの値に D-15 という設計判断番号を与え、`stringify` + `setItem` が 1ms 未満であること、`visibilitychange` でのフラッシュを併記した上で決めている。(b) ux.md 側は表の1セルに書かれた付随的な記述で、根拠が添えられていない。(c) prd の AC は保存間隔を規定していないため、どちらでも AC は通る — この場合、**根拠を持つ側を採る**のが規律である。
> **ただし ux.md の「`change` 確定時に保存する」は採る。** design.md の D-15 も「重み編集の確定・追加削除・全消去は即時に書く」と述べており、両者は矛盾しない。実装は「`change` で即時 + `input` は 300ms デバウンス」。

---

**X-2 — `aria-live` のデバウンス値が食い違う**

| 出典 | 記述 |
|---|---|
| design.md §6-5(D-14) | 「`aria-live` 領域への書き込みは『入力が **600ms** 止まってから』」 |
| ux.md §6-4 | 「Z1 の live 更新は、最後の入力から **700ms** 静止したときにのみ発火」 |

> **裁定: ux.md の 700ms を採る。** 理由: (a) design.md 自身が「600ms は**経験則であり理論的裏付けを持たない**」と明記しており、この値への設計上の主張が弱い。(b) スクリーンリーダーの発話量制御は UX 位相の一次責務であり(ux §6-4 が「最大の落とし穴」として1節を割いている)、担当位相の判断を優先する。(c) 100ms の差は AC-26 の成否に影響しない。
> **実装ではこの値を `const ARIA_LIVE_DEBOUNCE_MS = 700; // 経験則。理論的裏付けを持たない(design.md §6-5 / ux.md §6-4)` として1箇所に置き、由来のコメントを残す**(design.md §6-5 が「設定値としてコード上にコメントを残す」と要求している)。

---

**X-3 — 重み合計の表示について正反対のことを言っている ★**

| 出典 | 記述 |
|---|---|
| design.md §5-3 | 「**UI では重みの合計を『100.0%』と別途表示せず、各行の値のみを出す**(合計を出すと丸め誤差が見えてしまい、かえって不信を招く)」 |
| ux.md §1-2 / §5-3 | 「パネル末尾に **`合計 100.0% ✓` を常時表示**」+「丸め表示の合計ではなく内部値が1であることを示す固定文言 `合計 100%(内部では常に厳密に 100%)` を添える」 |

> **裁定: ux.md を採る。ただし ux.md 自身が示した後段の形で実装する。**
> 理由: (a) 両者の**懸念は同一**である — 「丸め表示の合計が 100.1% になり、ユーザーが不具合と誤認する」(AC-04 が明記している現象)。(b) design.md の解は「合計を隠す」、ux.md の解は「合計を出した上で内部値が厳密に1であることを言葉で保証する」。(c) prd の AC-04 は「丸め表示の合計は 100.1% になりうるが、内部値の合計は厳密に 1 であること」を**受け入れ基準として明文化している**。この事実を画面から隠すのは、prd §7-4 の誠実性の要件(自分の限界を自分で言う製品)と方向が逆である。(d) ux.md の後段の解は design.md の懸念を実際に解消している。
> **実装: パネル末尾に固定文言 `合計 100%(内部では常に厳密に 100%)` を置く。各行の丸め値を足し上げた数値は表示しない。** これで「100.1%」という数字が画面に現れることはなく、design.md の懸念も同時に満たされる。

---

**X-4 — 臨界度行の並べ替えタイミングが食い違う**

| 出典 | 記述 |
|---|---|
| design.md §6-4(D-13) | 「再描画 for #criticality: rows ← analysis.criticality(既に昇順)… `container.appendChild(el)`」— **再描画のたびに並べ替える** |
| ux.md §5-2 | 「Z3 の**行の並べ替え** … `change` / `blur` / ドラッグ終了時のみ。打鍵中に行が動くとフォーカスとポインタの位置がずれる」 |

> **裁定: ux.md を採る。design.md の D-13 は「並べ替えの機構」の設計であって「並べ替えの頻度」の設計ではない、と解釈する。**
> 理由: (a) `input` のたびに並べ替えると、スライダーをドラッグしている最中に**掴んでいる行そのものが画面上を移動する**。これは操作不能を意味する。(b) design.md §6-3(D-12)は同じ問題意識(フォーカス中の要素を動かさない)を持っており、D-13 と D-12 を素直に両立させると ux.md の結論になる。(c) D-13 の `appendChild` による要素の使い回しは**そのまま採用する** — 並べ替える瞬間にフォーカスが失われないための機構であり、頻度とは独立した価値がある。
> **実装: `analysis.criticality` の並び順は毎回計算するが、DOM の並べ替え(`appendChild` ループ)を走らせるのは `change` / `blur` / ドラッグ終了時のみ。行の中身(数値・支点位置・文言)は `input` ごとに差分更新する。** 並べ替え実行後に `aria-live` へ「崩れやすい順を更新しました。1位は {k}。」を流す(ux §5-2)。

---

**X-5 — 頑健性ラベルの「形」が2通り定義されている ★**

| 出典 | 記述 |
|---|---|
| ux.md §2-2 | アイコン形状: robust = **閉じた四角(錠)■** / contingent = **菱形 ◆** / fragile = **三角(警告)▲** |
| design.md §6-6 | 「アイコン形状(FR-26④ の robust/fragile/contingent の区別): **inline SVG**」 |
| identity.md §5-6 | robust = 左 **4px 実線**の縦罫 / contingent = 左 **4px 破線** / fragile = 左 **4px 点線** + 下に 1px の `--primary` 罫 |
| identity.md do/don't 14 | 「**アイコンフォント・絵文字・SVG スプライトを持ち込まない。** 形は border / CSS 三角形 / 罫スタイルだけで作る」 |

> **裁定: identity.md §5-6 の罫スタイル(実線/破線/点線)を採る。ux.md の ■◆▲ とアイコン化は採らない。**
> 理由: (a) FR-26④ が要求しているのは「**色に加えて語とアイコン形状で区別する**」ことであり、罫スタイルの差(実線/破線/点線)はこの要求を満たす形の差である。(b) identity.md は視覚アイデンティティの担当位相であり、ux.md §0 が「色値・フォント名・角丸量などの視覚アイデンティティは identity 位相が別途決定する」と**自ら明け渡している**。(c) identity.md §5-6 は「実線 → 破線 → 点線は『連続性が失われていく』ことの直接的な表現であり、頑健性の意味とそのまま対応する」という意味論的な根拠を持つ。ux.md の ■◆▲ は根拠が添えられていない。(d) identity.md §2-4 が「`--fragile-ink` と `--contingent-ink` の相互コントラストは **1.00:1**(輝度がほぼ完全に一致)」を実測しており、形の区別が**必須制約**であることを示している — この制約を提示した位相の解を採るのが筋である。
> **同様に、ux.md ワイヤーフレーム中の 🔒(錠)/ ⚠(警告)/ ★ / ▼ の絵文字・記号は「意味の説明のための図記号」であって実装指示ではないと解釈する。**
> - 逆転不能の「🔒」→ identity §5-4 の**斜線ハッチ + 語「逆転不能」+ prd §5-2 の理由文**で置き換える(identity §5-4 は「赤を使わない。支点を消し、トラック全体を斜線ハッチで塗る」と明示)。
> - 逆転閾値の「★」→ identity §5-3 の**支点(`--primary` 2px 縦線 + CSS 三角形)**で置き換える。ux.md §4-0 が求めた「同一軸上の目盛」という**機能**はそのまま満たされる。
> - 警告の「⚠」→ identity §5-9 の**左 4px `--primary` 罫**で置き換える。
> - design.md §6-6 の「inline SVG」も、identity do/don't 14 と衝突するため**採らない**(CSS の border と罫スタイルで全て描ける。FR-25 は「CSS の幅指定と inline SVG のみ」と**許可**しているだけで、SVG を義務づけていない)。

---

**X-6 — モーションの許容範囲が食い違う ★**

| 出典 | 記述 |
|---|---|
| ux.md §8-1 / §8-2 | 「動きは **120〜180ms**」。順位カードのスライド 160ms、Z3 行の移動 180ms、貢献度バーの `width` トランジション 120ms、レール塗り分けの移動 200ms、Z1 の縁の明滅1周期、★のフェードイン 150ms |
| identity.md do/don't 15 | 「**許可される transition は `background-color` と `border-color` の `120ms linear` のみ。**」+ `--motion: 120ms linear` |
| identity.md do/don't 4 | 「`box-shadow` を書かない。ドロップシャドウ・グロー・`filter: blur()` を一切使わない」 |

> **裁定: identity.md を採る。`transition` は `background-color` と `border-color` のみ、`120ms linear`(= `var(--motion)`)。ux.md が挙げた位置・幅・スライドのトランジションは実装しない。**
> 理由: (a) identity.md do/don't 15 は「FR-06 は 16ms 以内の即時再計算を要求しており、**演出はそれを嘘にする**」という根拠を持つ。これは ux.md §8-1 の原則1「数値は動かさない。表示は常に現在の真値である」と**同じ思想**であり、identity.md はそれをより厳格に適用しているだけである。(b) ux.md §8-1 の原則3 自身が「連続操作(スライダードラッグ)中は**トランジションを 0 にする**(追従遅延はライブ更新の嘘になる)」と述べている。この製品の主要な操作はまさにスライダードラッグであり、トランジションが効く場面はほとんど残らない。(c) prd に「アニメーションがあること」を要求する FR / AC は1つも無い。**AC を1つも失わない側**を採る。
> **ux.md §8-2 の「reduced-motion 時」列が、そのまま常時の挙動になる。** すなわち: 順位は即座に並び替わる、★(支点)は即座に表示、バーは即座に伸縮、警告は即座に表示。**情報は1つも失われない**(ux.md §8-3 が「動きが担っていた注意の誘導は `aria-live` の通知と静的な強調が引き継ぐ」と設計している通り)。
> `prefers-reduced-motion` の分岐は identity.md §7 の `:root { --motion: 0ms; }` をそのまま置く。

---

**X-7 — プライバシー文の位置が食い違う**

| 出典 | 記述 |
|---|---|
| ux.md §1-2 / §1-3 | Z0(ヘッダ)に枠付きで常時表示。狭幅でも「🔒 どこにも送信していません」を維持 |
| identity.md §5-10 | 「`--muted-soft`、`--font-numeric`、`13px`、**版面フッタ**。上部に `--hairline` の 1px 罫。**アイコン(鍵・盾)を使わない**」 |

> **裁定: identity.md の「版面フッタ・13px・`--muted-soft`・アイコンなし」を採る。**
> 理由: (a) AC-25 の要求は「『どこにも送信していません』を意味する文言が画面上に**常時表示**されていること」であり、**位置を指定していない**。フッタでも AC は通る。(b) identity.md は「バッジ化した瞬間にマーケティング文言に見え、信頼性を毀損する」という根拠を持つ。ux.md 側に位置の根拠は書かれていない。(c) 視覚配置は identity 位相の管轄であり、ux.md §0 がそれを明け渡している。
> **ただし ux.md の「常時表示」「初回も再訪も表示」「狭幅でも維持」の3点は非交渉として採る**(AC-25 の直接の要求)。
> **§8-1 の localStorage 不可時の文言差し替え(B-5)も、このフッタで行う。**

---

**X-8 — エクスポート生成の置き場所が design.md に無い**

design.md §2-2 の `TenbinCore` 公開面に、エクスポート(CSV / Markdown / JSON)を生成する関数が**存在しない**。一方 §2-5 は「コア領域に文字列 `"</script>"` を書く(エクスポート機能の HTML 生成等)→ C-6 違反」と述べており、エクスポートがコアに来る可能性を想定した警告を残している。

> **裁定: エクスポート生成は L3(`tenbin-store`)の責務とする。コアには入れない。**
> 理由: (a) `TenbinCore` の公開面(design.md §2-2)に無い関数を勝手に足さない。(b) エクスポートは `Blob` / `URL.createObjectURL` / `<a download>` という**ブラウザ API に不可分に結びついた操作**であり、INV-1(L1 は何にも依存しない)と両立しない。
> **帰結: AC-23 は Node の純関数テストだけでは閉じない。** §4-4 の対応表に記した通り、Node 側では「`Analysis` に AC-23 が列挙する全値(スコア3件・順位・`Δw_k` 4件・`Δ*`・`k*`・ラベル・向き4件)が載っていること」を表明し、実ファイル3本の内容確認は手動チェックリストに置く。**これは検証の穴ではなく、穴の位置を明示した上での分担である。**

---

**X-9 — design.md 内部の食い違い: `normalizeMatrix` が公開面から漏れている**

design.md §4-1 は `normalizeMatrix(options, criteria)` の署名を明示的に定めているが、§2-2 の `TenbinCore` 公開リストに含まれていない。

> **裁定: `normalizeMatrix` を公開面に含める(§1-0)。** 理由: §4-1 が署名を定めた関数を非公開にする根拠が無く、AC-14 のセル単位検証(`a×10` の6値)を Node から書くのに必要である。**公開面が20メンバになることを §1-0 に明記した。**

---

**X-10 — prd §5-1 のテンプレート内のプレースホルダ名が誤記**

prd §5-1 の正典テンプレートは `{k*} の重みを {w_k*}% から {x*}%({±Δ}ポイント)に動かすと` と書いているが、同§の DS-1 具体出力は「移行コストの重みを **15.0% から 21.8%**」であり、第1の値は**現在の重み `w_k`** である(`w_k* = 21.8%` は第2の値)。design.md §4-10 は `{k*} の重みを {w_k}% から {x*}%` と正しく書いている。

> **裁定: design.md §4-10 の読み(第1プレースホルダ = 現在の重み `w_k`、第2 = `w_k*`)を採る。** 理由: prd 自身の具体出力(AC-08 の期待文字列)が design.md の読みと一致しており、**AC が正典である**。テンプレート表記の方が誤記である。
> **実装者への注意: `TEXT` にテンプレートを写すときは、prd の `{w_k*}` を `{w_k}` に読み替えること。** 出力文字列は prd §5-1 の DS-1 具体出力と一字一句一致させる。

---

**X-11 — 未入力セルがある間の Z2 の扱いが design.md に無い**

| 出典 | 記述 |
|---|---|
| ux.md §3-1④ / §7-1 | 「**Z2(順位)と Z6 の再計算は未入力があっても走らせる**(未入力セルは `0` として扱わず、その選択肢の総合スコアを `—` とする)。全ての選択肢が埋まった行から順にスコアが立ち上がる」 |
| design.md §4-4 / §4-13 | `computeScores` の事前条件は「`a` に `null` を含まない」。退化判定4で `unfilled-cells` を返し、**行ごとの部分計算の経路が定義されていない** |

> **裁定: ux.md の挙動を採り、`Analysis.ranking` に「未入力を含む行」を `score: null` / `displayScore: "—"` / `rank: 0` として載せる。**
> 理由: (a) ux.md §3-1④ が「『入力が結果に効いている』感覚(US-03)が最初の1セルから得られる」という体験上の根拠を持つ。(b) design.md §4-13 は「**`ok = false` でも計算できる部分は計算する**」と明記しており、この裁定と矛盾しない。(c) `computeScores` の事前条件は破らない — **未入力を含む行を `computeScores` に渡さず**、`null` 行はその手前で `score: null` を割り当てる。ゼロ代用は一切しない(§8-9 が「未入力を 0 とみなすと、未入力が『最低評価』として結論に影響する」と禁じている)。
> **実装: `analyze` は `degenerate === "unfilled-cells"` を返しつつ、`ranking` は「埋まった行 = 実スコア降順」+「未入力を含む行 = 末尾、`displayScore: "—"`、`rank: 0`」で埋める。`criticality` / `winContrib` / `robustness` は空 / null のまま。**
> **§1-14 の退化判定表の 4 の行に、この挙動を実装契約として追記した(T-16 の完了条件に含む)。**

---

**X-12 — `[元に戻す]` の履歴記録は prd 未定義(位相間矛盾ではないが裁定を要する)**

ux.md §4-4 経路B が【prd 未定義 — 要確認】として保留している。「FR-18 は『重み編集ごとに履歴を記録』としか定めておらず、取り消し操作の扱いを規定していない」。

> **裁定: ux.md 自身が示した既定 —「`[元に戻す]` も1回の編集として記録する」— を採る。**
> 理由: (a) ux.md が「確認が取れない場合の既定は prd の文面に忠実な側」と明示している。(b) requirements 位相の確認は現時点で取れていない。(c) この選択は**警告が出やすくなる方向**であり、FR-18(結論ありき逆算の検知)の目的に対して安全側である。
> **ux.md §7-3 の【要文言確定】B-1〜B-5 も同様に、暫定案をそのまま使う。実装者は文面を変えない。**

---

### 5-3. design.md §8 の失敗モードのうち、実装時に踏みやすいもの

| 順位 | 失敗モード | 踏み方 | 対応タスク |
|---|---|---|---|
| **1** | **§8-5 NaN が順位を静かに壊す** | `0/0` を作ってから `isNaN` で拾う実装にする。**例外が出ないので気づけず、画面に嘘の順位が出る。** 本製品で最も危険 | T-06(Z-1)/ T-12(Z-2, Z-3)/ T-15(入口)/ T-16(中間)/ T-04(出口)。**性質テスト P-5 が最終防衛線** |
| **2** | **§8-4 `D₀ === 0` と書く** | DS-3 は厳密には同点だが float では `-1.11e-16`。`=== 0` では AC-18 が**通らない**。設計の付録C-2 が名指ししている | T-08。完了条件に AC-18 を明示的に置いた |
| **3** | **§6-3(D-12)フォーカス中の `<input>` に書き戻す** | 素朴な「毎回全部書き戻す」で全セルが同時に打てなくなる。**後付けで直すのが最も面倒な種類** | T-21 の枠組みに埋め込む(H-7) |
| **4** | **§4-6-1 `sens` の単位を取り違える** | ポイント単位の逆数だと `0.146 / 0.116 / 0.055` になり AC-05 と合わない。**design.md が「設計時に実際に1度取り違えた」と告白している** | T-04 / T-11。性質テスト P-7 が構造的に検出する |
| **5** | **§4-6(D-7)実行可能性判定を除算の後に置く** | 手順4を手順5〜7の後に置くと `d_k = D₀` でゼロ除算が到達可能になる。**順序そのものが安全性の根拠** | T-09。完了条件に「手順5〜7に到達しない」テストを置いた |
| **6** | **§4-3 `reweight` と `tippingPoint` を別々に実装する** | 両者が同一の写像でないと AC-10 が通らない。片方だけ「改良」した瞬間に壊れる | T-10。完了条件に一致検証を置いた。性質テスト主張1が一般化する |
| **7** | **§4-7 逆転不能を末尾に置くための分岐を書く** | `Infinity` の昇順ソートで自動的に満たされる。分岐を書くと同値のちらつき(§8-10)の温床になる | T-11。付録C-7 |
| **8** | **§8-2 重み全ゼロで計算を止める** | 等重みは意味のある既定であり、結論を出せなくする理由がない。「退化」に分類すると `analyze` の判定表に余計な段が増える | T-06 / T-16。**`Σŵ ≤ EPS` は `warnings` であって `degenerate` ではない** |
| **9** | **§2-5 コア領域に `console.log` / `Date` / `"</script>"` を書く** | `console` は FORBIDDEN に入っていないので**テストは通る**が、入れない。`Date` と `</script` は落ちる | T-04〜T-16 全体。T-02 の純粋性ガードが `Date` を捕捉する |
| **10** | **§8-11 robust に caveat を付け忘れる** | 数値ではなく**意味の故障**。型の事後条件として要求されている | T-13。性質テスト P-8 |
| **11** | **§8-10 同値の `\|Δw\|` でちらつく** | E-10 のヒステリシスを `<` だけにすると、無関係なセルの編集で逆転相手の表示が入れ替わる | T-11。性質テスト P-4 |
| **12** | **§5-3(D-8)丸めた値を計算に戻す** | 「重みを表示用に 0.1% 刻みに丸めてから再正規化」が典型。AC-10 / AC-15 / AC-21 の「合計が厳密に1」を確実に壊す | T-10 / T-26。性質テスト P-1 |

---

## 6. 完成判定チェックリスト

### 6-1. 機械検査可能な項目(`node tests/tenbin.test.js` で全て自動)

| # | 項目 | 判定 |
|---|---|---|
| M-01 | `node tests/tenbin.test.js` が終了コード **0** で完走する | 必須 |
| M-02 | `/*===TENBIN-CORE-BEGIN===*/` の出現回数 = **1** | C-1 |
| M-03 | `/*===TENBIN-CORE-END===*/` の出現回数 = **1**、BEGIN より後 | C-1 |
| M-04 | 両マーカが `<script id="tenbin-core">` と直後の `</script>` の間にある | C-2 |
| M-05 | コア領域に `document` `window` `localStorage` `sessionStorage` `navigator` `fetch` `XMLHttpRequest` `alert` `Date` `Math.random` `globalThis` `</script` が**1つも無い** | C-5 / C-6 / INV-1 |
| M-06 | `TenbinCore` が `Object.isFrozen` で凍結され、公開面が §1-0 の**20メンバと過不足なく一致** | C-4 |
| M-07 | **`<script src=` の出現回数 = 0** | **AC-24** |
| M-08 | **`<link rel="stylesheet"` の出現回数 = 0** | **AC-24** |
| M-09 | **`@import` の出現回数 = 0** | **AC-24** |
| M-10 | **`http://` / `https://` の出現回数 = 0** | **AC-24** |
| M-11 | `fetch(` / `XMLHttpRequest` / `sendBeacon` / `new WebSocket` / `new EventSource` / `<form action=` の出現回数がいずれも **0** | **AC-25** |
| M-12 | `outline: none` / `outline:none` の出現回数 = **0** | **AC-26** |
| M-13 | `tabindex="[1-9]` の出現回数 = **0**(正の tabindex を使わない) | ux §6-2.1 |
| M-14 | `role="alert"` の出現回数 = **0**(逆算警告は `role="status"`) | ux §6-3 |
| M-15 | `box-shadow` / `filter: blur` の出現回数 = **0** | identity do/don't 4 |
| M-16 | `Inter` / `Roboto` / `Poppins` / `Nunito` の出現回数 = **0** | identity do/don't 2 |
| M-17 | `#667eea` / `#764ba2` / `#22c55e` / `#eab308` / `#3b82f6` の出現回数 = **0** | identity do/don't 1, 10 |
| M-18 | `border-radius` の値が `0` / `2px` 以外に無い | identity do/don't 3 |
| M-19 | `tenbin-render` ブロック内に `toFixed` の出現回数 = **0** | INV-2 / D-1 |
| M-20 | AC-01 〜 AC-21 の全ケースが緑(§4-4 の対応表) | prd §4 |
| M-21 | AC が要求する**表示文字列29個**がすべて完全一致 | design.md §5-3 |
| M-22 | 厳密値との差が全 AC 値で **`≤ 1e-9`** | prd §7-2-4 |
| M-23 | 性質テスト P-1 〜 P-8 が全て緑(1000試行) | §4-5 |
| M-24 | 反例探索の主張1/2/3 が全て緑(1000試行) | §4-5 |
| M-25 | `analyze` が 200 の生成入力に対し**1度も throw しない** | §4-13 事後条件 / P-6 |
| M-26 | 全試行の全 `display*` 文字列に `"NaN"` / `"Infinity"` / `"undefined"` が**1度も現れない** | D-10 / P-5 |
| M-27 | 成果物ディレクトリに `.js` / `.css` / フォント / 画像ファイルが**0個**(`index.html` と `tests/` のみ) | **AC-24** |

### 6-2. ブラウザでの手動チェックリスト

| # | 項目 | 根拠 |
|---|---|---|
| B-01 | ネットワークを遮断して `index.html` をダブルクリックし、DS-1 を入力して `67.0 / 63.5 / 51.0` と `Δ* = 6.8pt` / `fragile` が得られる | **AC-24** |
| B-02 | DevTools Network を開き、DS-1 全入力 + 重み3回操作 + 3形式エクスポートを行い、**記録されたリクエスト数 = 1**(HTML 自身のみ) | **AC-25** |
| B-03 | 「どこにも送信していません」の文言が**常時表示**されている(初回・再訪・狭幅すべて) | **AC-25** |
| B-04 | DS-1 + `θ=0.05` を入力してリロード → 全項目復元、ラベルが `contingent` | **AC-22** |
| B-05 | `localStorage` の全キーが `tenbin.v1.` で始まる。全消去後に該当キーが **0個** | **AC-22** |
| B-06 | `[21.8% へ]` を押すと `64.8 / 64.8 / 48.5` と「同点です。…」が出る。`[26.4% へ]` で `67.9`、`[48.1% へ]` で `70.4` | **AC-10** |
| B-07 | 向きを cost→benefit に切り替えると勝者が **ベンダーB → ベンダーA** に変わる。ゴースト値が全行同時に更新される | **AC-14** |
| B-08 | 移行コストに最低ライン 3.0 → ベンダーC が除外リストへ移り、理由文が出て、残り2件が `67.0 / 63.5` | **AC-16** |
| B-09 | ベンダーD を追加 → `86.0` で1位になるが既存3件の値が変わらず、**警告が出ない** | **AC-20** |
| B-10 | 移行コストを `15→25→15→30%` と編集 → Z5 に prd §5-4 の警告文が出て、**編集は続けられる** | **AC-21** |
| B-11 | CSV / Markdown / JSON の3ファイルに AC-23 の全値が含まれる。JSON がパース可能で数値が数値型。CSV が4行以上 | **AC-23** |
| B-12 | **マウス・トラックパッドに一切触れず** AC-26 の1〜7を通しで完了できる | **AC-26** |
| B-13 | フォーカスリングが全ての操作要素で目視可能 | **AC-26** |
| B-14 | ブラウザズーム 200% で**横スクロールが発生しない** | **AC-26** |
| B-15 | スクリーンリーダーで Z1 の結論文が完全文で読み上げられる。スライダー連続操作中に読み上げが洪水にならない | **AC-26** / FR-26③ |
| B-16 | プライベートウィンドウで開いて例外が出ず、計算が全て動き、フッタ文言が B-5 の暫定案に差し替わる | design.md §8-1 |
| B-17 | `localStorage.setItem("tenbin.v1.state","{{{")` を仕込んでリロード → 白画面にならず初期状態で起動、`tenbin.v1.corrupt` に生文字列が残る | design.md §3-6 |
| B-18 | 全スライダーを 0 に引き切っても `NaN` が出ず、等重みで順位が出て警告が表示される | design.md §8-2 |
| B-19 | 1つの基準を 100% にしても例外が出ず、ラベルが `robust` になる | design.md §8-8 |
| B-20 | 名前欄に10万文字をペーストしてもレイアウトが崩れず保存も成功する(200文字で切られる) | design.md §8-6 |
| B-21 | 12個のセルに連続入力してもカーソル位置が飛ばない。スライダードラッグ中につまみが指から逃げない | D-12 |
| B-22 | スライダー操作中に Z3 の行が並び替わらない。手を離した瞬間に並び替わる | §5-2 X-4 |

### 6-3. 設計規律の充足

| # | 項目 | 根拠 |
|---|---|---|
| D-01 | `EPS` を使う箇所が **E-1 〜 E-11 の11箇所**であり、`=== 0` による0との比較が**1箇所も無い** | design.md §5-4 |
| D-02 | 除算の直前に分母を検査する箇所が **Z-1 〜 Z-8** を網羅している | design.md §5-5 |
| D-03 | `AppState` に**導出可能な量が1つも無い**(保存するのは `rawWeight` / 生スコア / `w⁰` / `history` / 設定のみ) | D-3 |
| D-04 | `Option.scores` が `Record<Id, RawScore>` であり、配列 index を ID にしていない | D-5 |
| D-05 | ラベル・バー・レール・帯のすべてに**生の数値と語が併記**されている | R2 / FR-26① |
| D-06 | 画面の最上部が**順位ではなく頑健性の文章**である(DOM 順で `#z1` が `#z2` より前) | R1 / FR-07 / identity do/don't 12 |
| D-07 | prd §5-1 〜 §5-8 の文言が**一字一句そのまま**使われている(言い換えが1箇所も無い) | ux §7-1 |
| D-08 | prd §6 の「不採用」機能(AHP / ペア比較 / 永続URL共有 / min-max 正規化 / 逆数化コスト反転 / スケール選択 UI)が**1つも実装されていない** | prd §7-1.2 |
| D-09 | §5-2 の裁定 X-1 〜 X-12 がすべて実装に反映されている | 本文書 §5-2 |

---

**タスク総数: 34 本(T-01 〜 T-34)**
**規模内訳: S = 8(T-01,03,04,05,06,07,08,14)/ M = 16(T-02,09,10,11,12,13,15,17,19,20,21,23,25,30,31,34)/ L = 10(T-16,18,22,24,26,27,28,29,32,33)**
