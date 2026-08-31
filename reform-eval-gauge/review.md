# コードレビュー — graph/gauge.js(新設)/ graph/verdict.js(trajectory 統合)

審査対象: `graph/gauge.js`(261行・新設)、`graph/verdict.js`(trajectory ブロックと第38条完走検査)、
参照: `design.md`、`CONSTITUTION.md` 第38条、`tests/paradise.test.js` Gauge 節(2276〜2410行)、
兄弟 engine(`census.js` / `workspace.js` / `conclave.js` / `orchestrator.js`)。読むだけの審査 — 何も実行していない。

---

## 1. 兄弟 engine との整合 — ✅ 良好

- **CLI verbs 形式**: `score / record / baseline / compare / ledger` — census(`check/fix`)・workspace(`root/resolve/init/check`)と同型。usage 誤りは exit 3、測定不能は exit 2 と、意味の異なる失敗を exit code で分けているのは gauge が兄弟より丁寧なくらい(verdict.js は usage 誤りに exit 2 を使っており BLOCK と衝突するが、これは今回の変更範囲外の既存問題)。
- **stdlib のみ**: 外部依存は `fs`/`path` と楽園内部の `workspace.js` のみ。合格。
- **ヘッダの WHY**: 「門(verdict)はあったが走行を測る秤が無かった」という欠落の物語、採点式の明文化、第30・37・38条への言及 — census.js のヘッダ作法(数は黙って腐る)と同じ品格で書かれている。合格。
- **module.exports** でテストから素関数を叩ける構造(`score`, `normalize`, `record`, …)も兄弟と同じ。
- 罫線ボックスの render、絵文字の使い方も verdict/census の流儀に一致。

## 2. 命名と明瞭さ — ✅ 概ね良好(小言あり)

- `WEIGHTS` / `retryOverhead` / `loopGuardTrips` / `firstPassRate` / `HIGHER_BETTER` — いずれも自明で良い。
- `normalize()` が conclave/orchestrator 両形式を `{phases, history, domainsTotal, domainsRatified}` に畳む設計は読みやすい。ヘッダの JSDoc も付いている。
- 小言①: 関数 `score()` と返り値の欄 `score` が同名で、`m.score` と `score(run)` が並ぶと一瞬詰まる。`composite` を欄名にも使う手はあった(修正必須ではない)。
- 小言②: `renderScore(m, label)` の label が「run ファイルの親ディレクトリ名」から暗黙に導かれる(223行)。slug になる意図は分かるが、コメント一行が欲しい。

## 3. 設計意図(design.md)との乖離

| 設計の約束 | 実装 | 判定 |
|---|---|---|
| 採点式 `100 −10×rework −5×retryOverhead −15×loopGuard −20×未完走, clamp[0,100]` | 41行 `WEIGHTS` + 96〜101行、`Math.max(0, Math.min(100, raw))` | ✅ 一致 |
| 台帳は `workspace.js resolve()` の root 直下 `gauge-ledger.jsonl` | 44〜46行。`'creations/'` の直書きゼロ(workspace.js `hardcodedRefs` の門も通る書き方) | ✅ 一致 |
| 相の無い run-state は拒否・exit 2 | 73〜75行で throw → main の catch(254〜257行)で exit 2。テスト 2329〜2332行が固定 | ✅ 一致 |
| conclave 形式(domains[].phases)と orchestrator 形式(phases{})の両方 | 52〜65行。event 名も conclave `domain-rework`/`domain-loop-guard`、orchestrator `rework`/`loop-guard` の両方に正規表現 `/rework/` `/loop-guard/` が命中(conclave.js 229/249行、orchestrator.js 134/142行で実在を確認) | ✅ 一致 |
| **「history が無い orchestrator 形式では rework は phases の status/attempts から導出」**(design.md 33行) | **未実装**。66行で history 不在は `[]` に既定化され reworkCount=0 になるだけ。status/attempts からの導出コードは存在しない | ⚠️ **乖離** |
| verdict: score < 60 / loopGuardTrips > 0 → REWORK、artifact で trajectory 不在 → REWORK、score ≥ floor なら reasons | verdict.js 66〜79行・128〜130行。テスト 2383〜2409行が全経路を固定 | ✅ 一致 |

乖離の評価: orchestrator.js は `init()` の時点で必ず `history` を書く(orchestrator.js 54行)ため、**history 無しの orchestrator run-state は実運用では発生しない**。実害は現状ゼロ。ただし第33条の精神(散文が機構を騙るな)からすれば、design.md のこの一文は嘘になっている。**design.md の当該行を削るか、導出フォールバックを実装するか、どちらかに揃えること**(reflect への申し送りで足りる軽微事項)。

## 4. 読んで見つかる欠陥・危うさ

深刻なバグは無い。以下は軽微な指摘:

1. **何もしていない走行が 80 点を得る**(gauge.js 80〜90行)。全 phase が attempts=0(召集直後・一度も dispatch していない conclave.json)でも、phases は存在するので第37条の門は通り、減点は「未完走 −20」だけ — **手つかずの run が 80/100**。「不在は通過ではない」の残り香であり、`started.length === 0` も throw(または大幅減点)する価値がある。baseline で古い召集残骸を拾ったとき台帳が汚れる。
2. **`compare --last 0` は「全件」になる**(241〜243行)。`Number('0')=0` → `slice(-0)` = `slice(0)` = 全件。引数が数でない場合(`--last x`)も `slice(NaN)` → 全件。N ≥ 1 の検証が一行あると良い。
3. **台帳の一行破損で ledger/compare 全体が exit 2**(137行)。追記型 JSONL は creations repo の git マージで conflict marker が混じり得る(design.md 52行自身が改竄検出を git に委ねている)。`JSON.parse` を try で包んで破損行を警告付きで読み飛ばす方が秤として頑健。
4. **verdict.js の `(traj.loopGuardTrips || 0)`**(76行)— `||0` が欄の不在を握り潰す。`score == null` の門(72行)はあるので trajectory 丸ごとの空は捕まるが、gauge 側が欄名を変えた場合 loop-guard 検査だけ静かに素通りする。gauge の `--json` 出力と欄名で結合している以上、契約テスト(gauge 出力 → verdict 入力の直結テスト)が一本あると縁が切れない。現状のテストは手書き fixture で欄名を写しているだけ。
5. **trajectoryFloor が CLI から変えられない**(verdict.js 172〜177行)。`--floor` は coverage 専用で、`opts.trajectoryFloor` は API 経由でしか届かない。意図的な固定なら良いが、`explain` の LAW 文(161〜165行)にも trajectory / 第38条の記述が無く、散文と機構がずれ始めている(第33条)。LAW への一行追記を推奨。
6. **baseline の途中失敗が全体を落とす**(168行)。creation 配下の `readdirSync` が一つでも throw すると(record 個別の try の外なので)baseline 全体が exit 2。個別 catch に寄せる方が「測れた分は刻む」秤らしい。同 160行の `for (const name of ['conclave.json'])` は要素一つのループで、意図(将来の拡張)ならコメントを、でなければ if に畳むべき。

なお off-by-one の疑いがある箇所(retryOverhead の `Σattempts − started.length`、firstPassRate の `attempts === 1 && done`)は検算した — makeGaugeRun の fixture(retries{build:2,verify:2} → retryOverhead=4)とも一致し、正しい。conclave が dispatch で `attempts += 1` を刻むこと(conclave.js 194行)も確認済みで、実 run-state で attempts が常に 0 という事態は無い。

## 5. テスト網羅(読了のみ)

決定性(同一入力2回)、荒れ<健全の分水嶺、loop-guard>rework の重み順、未完走減点、空 run 拒否、orchestrator 形式、実 run-state の固定、台帳 record→compare、verdict 側の 4 経路(低 score / loop-guard / 不在 / engine・document 免除)— design.md 51行の「秤自身は誰が見張るか」への答えとして十分。悪化注入(reworks を増やすと単調に下がる)も 2308行で担保。

---

## 結論

採点式・台帳の住所・exit 2 拒否・両形式対応という設計の四本柱はすべて実装が忠実に守っており、兄弟 engine の作法(CLI verbs / stdlib / WHY ヘッダ)にも完全に馴染んでいる。指摘 4-1〜4-6 はいずれも軽微で、design.md 33行の乖離も実運用で到達不能。ただし design.md の当該行の訂正と、上記軽微項目は reflect / 次サイクルへ申し送ること。

**承認**
