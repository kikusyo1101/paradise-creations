# 天秤 — 市場調査

> 調査日: 2026-09-01 / 調査手法: web_search + web_extract による実地調査
> 本文書に記載した製品・価格・機能は、すべて下記「5. 出典一覧」のURLから実際に取得した記述に基づく。
> 取得できなかった項目は明示的に「未確認」と記載している。

---

## 1. 既存製品の実地調査

### 1-A. エンタープライズ / 理論系 MCDA ツール

| 製品名 | URL | 料金 | 中核機能 | 弱点 |
|---|---|---|---|---|
| **1000minds** | https://www.1000minds.com/ (料金: /pricing/general-decision-making) | Full decision-making suite **$25,000/年**。Noise audit $2,500/回、Preferences survey/DCE $9,500/件。年次前払い請求(USD/EUR/GBP/CAD/AUD/NZD)。無料枠なし、まず「onboarding call」 | 査読済み **PAPRIKA法**(部分プロファイルのペア比較)で重みを導出。グループ意思決定・投票・合意形成、"noise audit"(人の直感判断のばらつき可視化)、inter-rater reliability検定、多言語ステークホルダー調査、value-for-money比較、AIアシスタント。EU/GDPRインスタンスあり | **価格が個人・小チームに完全に手が届かない**($25k/年)。セルフサーブ導線が存在せず必ず商談を経る。個人の「今夜決めたい」用途を全く想定していない |
| **TransparentChoice** | https://www.transparentchoice.com/ | Software Advice掲載で **£4,000/年〜**(公式ページは "book a call" 方式で、公式サイト上の明示価格は**未確認**) | **AHP専用**。ペア比較による重み付け、組み込みの**整合性チェック(consistency check)**、協働ワークショップ、優先度マトリクス・効率的フロンティア可視化、AI生成シナリオ、PPMツール連携。"Pick One"(ベンダー選定等)と"Pick Many"(プロジェクトポートフォリオ)の2用途 | プロジェクトポートフォリオ管理(PPM)に強く寄っており、**個人の一回きりの意思決定には過剰**。要商談。自社FAQで「重み付けスコアリングは数学的厳密性と整合性チェックを欠く」とAHP優位を主張しており、軽量手法を意図的に切り捨てている |
| **SpiceLogic AHP Software / Rational Will** | https://spicelogic.com/products/ahp-software-30 , https://spicelogic.com/products/rational-will-29 | **買い切り永続ライセンス**(2007年以来サブスクではない旨を明記)。具体的金額は本文抜粋範囲では**未確認**。全機能の無料トライアルあり | **感度分析をファーストクラス機能として実装**。スライダーを動かすと即座に再計算・チャート更新。one-way sensitivity analysis、weighted criteria attribute chart(「どの基準がどの程度決定に効いているか」を可視化)、無制限階層のサブ基準、グループ意思決定(AIJ/AIP)、PDF/Excelの論文提出可能なレポート出力 | **Windowsデスクトップアプリでオフライン前提**(クラウド非依存を売りにしている裏返し)。共有・URL共有ができない。UIが学術ツール寄りで学生・研究者向け。ブラウザだけで完結したい層には届かない |

### 1-B. 無料Webツール(ロングテール多数)

| 製品名 | URL | 料金 | 中核機能 | 弱点 |
|---|---|---|---|---|
| **yesnowheelapp 加重決定マトリクス** | https://yesnowheelapp.com/en/weighted-decision-matrix-calculator | 完全無料・登録不要 | 重み(合計100%に自動正規化)+ 1-10スコア。**"Tipping Point Check"** ＝ 上位2案の差と、「どの単一基準の重みを動かせば勝者が入れ替わるか」を提示。結果が"robust"(どの単一基準の重み変更でも逆転しない)かを明示。避けるべき失敗(基準6-7個超で重複、選択肢単位でなく基準単位で採点、勝者を無検証で確定、結論ありきの重み逆算)まで解説 | **競合の中で唯一、感度分析に近いものを実装している最有力の比較対象**。ただし単一基準のOne-at-a-time検査に留まり、貢献度%や複数基準同時変動は非対応。保存・共有・履歴なし(その場限り) |
| **Argumentree Decision Matrix** | https://argumentree.com/tools/decision-matrix | マトリクスツール自体は無料・登録不要・完全ブラウザ内処理。本体アプリは**無料枠+チーム向け有料プラン**(具体的金額は**未確認**) | 重み1-5 × スコア1-10 の単純加重和、ライブ順位表示、テキストコピー。本体は**議論の pro/con 論証ツリー**、AIによる議事録からの論点抽出、匿名投稿、意思決定の監査証跡、66言語対応 | マトリクス部分は**意図的に最小限**(本体アプリへの導線)。感度分析なし。「これは助言ではなく、あなたの代わりに決めるものではない」と明記するに留まる |
| **Gera Tools Decision Matrix Maker** | https://geratools.com/decision-matrix | 無料・ブラウザ内完結 | 加重和を0-100に正規化。スケール(0-5/0-7/0-10)選択可。**コスト基準の自動反転**(「低いほど良い」と「高いほど良い」を1つの表に混在可)。**CSV / Markdown / JSON エクスポート** | 感度分析なし。共有・共同編集なし |
| **Online Tool Hubs Decision Matrix Calculator** | https://onlinetoolhubs.com/tools/decision-matrix-calculator | 無料・100%クライアントサイド | Pugh Matrix / 加重総和。レーダーチャート的可視化(「バランスの取れた五角形か、一点特化か」)。MAUT(多属性効用理論)への言及あり | 感度分析なし。SEO記事的なコンテンツ量に対し機能は素朴 |
| **altftool Decision Matrix Builder** | https://altftool.com/tools/all/decision-matrix-builder | 無料 | Σ(weight × score) ÷ Σ(weights) × 10 で0-100スコア化。**重みを100%に自動正規化**(1つ上げると他が比例して下がる) | 感度分析なし。保存・共有なし |
| **chamsdel Decision Matrix** | https://chamsdel.online/tools/decision-matrix | 無料・サーバー送信なし | 重み1-10 × スコア1-10 → 100点正規化。「2案が5点差以内なら本当に僅差」というヒューリスティックを提示 | 感度分析なし。5点差ルールは経験則で理論的裏付けなし |
| **MyMap Decision Matrix Maker** | https://mymap.ai/tools/decision-matrix-maker | 無料(サインアップ不要) | **AIが選択肢・基準・重み・スコアまで自動生成**。「AIに重みの根拠を説明させる」「重みの感度分析を実行させる」と謳う | 感度分析はAIへの自然言語依頼であり、**決定論的な数値手法として実装されていない**(再現性・監査可能性が保証されない) |
| **Decisive Leader EDGE Decision Matrix** | https://beadecisiveleader.com/apps/prioritization | 無料ブラウザツール | エグゼクティブ向けガイド付き/クイックの2フロー、共有可能な結果 | 独自メソッド(EDGE)と書籍販売への導線。汎用性に欠ける |

### 1-C. 汎用SaaSのテンプレート型(専用ツールではない)

| 製品名 | URL | 料金 | 中核機能 | 弱点 |
|---|---|---|---|---|
| **ClickUp Decision Matrix 系テンプレート** | https://clickup.com/templates/comparison-matrix-t-200540429 , /hiring-selection-matrix-t-182148283 , /design-matrix-kkmvq-6109084 ほか多数 | ClickUp本体の料金に従属(テンプレート自体は無償配布) | Custom Fields に重みを持たせ、Table View で合計を計算。Comparison Matrix / Hiring Selection Matrix / Design Matrix / Risk-Benefit Analysis / Criteria Matrix など**用途別に多数のテンプレートが乱立** | **重みも合計も手動運用**。公式手順が「custom field に重みを割り当てる」「Table View で合計を計算する」と、実質スプレッドシート。感度分析の概念が一切ない。ClickUp契約が前提 |
| **Notion Decision Matrix 系テンプレート** | https://notion.com/templates/decision-making-matrix , /matrix-decision-making , /smart-decision-matrix-comparison-table-life-choices-pro , /decission-lab | 多くが無料配布(有料テンプレートも混在)。Notion本体の料金に従属 | Score と Weight の2プロパティ + 数式で加重和。pros/consの色分け。"Decision Lab"のように5基準固定の組み込み数式型もある | **基準数・選択肢数が固定的で拡張しづらい**。感度分析なし。テンプレートの品質が作者依存でバラバラ。「Weight=100%にすればスコアだけで使える」という逃げ道が用意されている＝重みが正しく使われていない実態の裏返し |
| **Priority Matrix (Appfluence)** | https://appfluence.com/ , https://appfluence.com/pricing/ | Pro **$12〜15/月/人**、PM Collaborate $12〜15/月/人(最小5人)、Business Class $24〜30/月/人。無料枠あり(5プロジェクト/100オープンタスク/5人まで) | **アイゼンハワー・マトリクス**ベースのタスク優先度管理。Outlook / Teams アドオン、Gantt、レポート、SSO | **加重スコアリングツールではない**。2軸(重要度×緊急度)の4象限であり、任意の重み付き複数基準を扱えない。「decision matrix」と検索して辿り着く層のニーズとはズレている |
| **Loomio** | https://www.loomio.com/ , https://www.loomio.com/pricing/ | Starter **$399/年**(1グループ30人まで)、Pro **$999/年**(3,000人まで・サブグループ無制限)。非営利割引 Starter $299/年・Pro $499/年。14日間無料トライアル(10人/10スレッド)。**オープンソース**でセルフホスト可 | **合意形成プロセス**(Advice / Consent / Consensus / Polls & Proposals)、提案・議論・投票・結果を1つの記録に統合、監査可能な意思決定履歴、CSV/HTML/JSONエクスポート、Slack/Discord/Teams連携 | **加重スコアリング機能を持たない**。多人数の合意形成・ガバナンスが目的で、「複数選択肢を数値で採点し順位付けする」用途とは別ジャンル。個人利用には過大 |

---

## 2. 機能の採用度ランキング

### 🔴 必須(これがないと「決定マトリクスツール」を名乗れない)

| 機能 | なぜ必須か(根拠1行) |
|---|---|
| 選択肢 × 基準のグリッド入力 | 調査した13ツール全てが例外なく実装している、カテゴリの定義そのもの |
| 基準ごとの重み設定 | 「weighted」の語がカテゴリ名に入っており、無重みでは単なる比較表に退化する |
| 重みの100%への自動正規化 | yesnowheelapp / altftool / 1000minds が明示的に採用。1000minds も「重みは通常合計1(100%)に正規化される」と記述 |
| 加重和 Σ(weight × score) の自動計算とライブ更新 | 全ツールが実装。onlinetoolhubs はこれをMAUT(多属性効用理論)の線形結合と明記 |
| 順位表示と勝者ハイライト | 全ツールが実装。出力が「順位」であることがユーザーの期待値の中心 |
| スコアの正規化(0-100 等の共通尺度化) | geratools / altftool / chamsdel が採用。生スコアのままでは基準間の尺度差が結果を歪める |
| ログイン不要・ブラウザ内完結 | 無料Webツール群8つ中7つが「登録不要・サーバー送信なし」を最大の訴求点に据えている＝この層の参入障壁 |
| コスト基準の反転(低いほど良い) | geratools が実装。価格・時間・リスクは実務でほぼ必ず登場するため、これがないと手作業で逆数化が必要になる |

### 🟠 差別化(実装すれば明確に勝てる領域)

| 機能 | なぜ差別化になるか(根拠1行) |
|---|---|
| **One-at-a-time 重みスイープと逆転閾値(tipping point)の数値提示** | 無料ツール13個中 yesnowheelapp **1つだけ**が実装(「Locationの重みを10%→18.9%、8.5ポイント上げれば勝者がJob Aに逆転」という具体値まで出す)。残り全てが未実装 |
| **基準ごとの貢献度%(criterion contribution)の可視化** | SpiceLogic の "weighted criteria attribute chart" が有料デスクトップ製品として実装しているのみ。Webの無料層はゼロ |
| **結論の頑健性ラベル(robust / fragile)** | yesnowheelapp が「どの単一基準の重み変更でも逆転しない＝robust」と判定表示。これがユーザーに「決めていい」という許可を与える最終出力になっている |
| **どの基準が結論を支配しているかのランキング表示** | Triantaphyllou & Sánchez (1997) の「最も感度の高い基準」を実装した製品は SpiceLogic 等の学術寄りツールに限られ、一般向けには存在しない |
| **AHP整合性比率(CR ≤ 0.1)による重みの妥当性チェック** | TransparentChoice / SpiceLogic / 1000minds という**高額商用ツールの独占領域**。無料層に降ろせば強い差別化 |
| ペア比較による重み導出(直接入力の代替) | 1000minds(PAPRIKA)・TransparentChoice(AHP)が中核に据える。1000minds 自身が「直接レーティングは本質的に不正確でバイアスを受けるため推奨しない」と明言 |
| 結果の永続URL共有 / エクスポート(CSV・Markdown・JSON) | geratools のみがエクスポート実装。無料ツールのほぼ全てが「その場限り」で保存できず、意思決定の記録として残らない |
| 「重みの結論ありき逆算」の検知・警告 | yesnowheelapp が失敗パターンとして言語化しているのみで、**機能としては誰も実装していない** |

### 🟡 見送り(今回のスコープでは作らない)

| 機能 | なぜ見送りか(根拠1行) |
|---|---|
| リアルタイム多人数共同編集・投票 | Loomio($399〜999/年)・1000minds($25,000/年)が既に成熟しており、個人の意思決定という中核価値と直交する |
| AIによる選択肢・基準・スコアの自動生成 | MyMap が実装済みだが、AI生成のスコアは**根拠の追跡ができず**「なぜその結論か」を示すという天秤の目的と正面から衝突する |
| プロジェクトポートフォリオ管理・タスク管理連携 | TransparentChoice / Priority Matrix / ClickUp の主戦場であり、参入すると製品が別物になる |
| TOPSIS / ELECTRE 等の代替MCDM手法の切替 | UK政府ガイドが outranking 法は「基数的な便益尺度を出せず順序尺度のみ」と指摘。一般ユーザーには手法選択自体が認知負荷 |
| 多階層のサブ基準ツリー | SpiceLogic が無制限階層を売りにするが、1000minds は「基準が増えるほど回答者が圧倒される」と警告し、複数ツールが基準3-6個を推奨 |
| ノイズ監査 / 評価者間信頼性検定 | 1000minds が $2,500/回で提供する組織向けサービス。個人利用には設計が重すぎる |
| Monte Carlo / 確率的感度分析 | SpiceLogic Rational Will が実装するがHTA(医療技術評価)等の専門領域向け。決定論的な重みスイープで「どの基準が支配的か」は十分に答えられる |

---

## 3. 手法の理論的裏付け

### 3-1. 加重和モデル(WSM / SAW / SMART)

- **加重和モデル(Weighted Sum Model, WSM)** は、選択肢 A_i のスコアを `Σ_j (w_j × a_ij)` で算出する最も基本的なMCDM手法。Triantaphyllou & Sánchez (1997, *Decision Sciences* 28(1), pp.151-194) が WSM・WPM(加重積モデル)・AHP の3手法を対象に感度分析の方法論を定式化している。
  出典: http://www.csc.lsu.edu/trianta/Journal_PAPERS1/SENSIT1.htm / PDF: https://bit.csc.lsu.edu/trianta/Journal_PAPERS1/MCDM_SensitivityAnalysis_by_Triantaphyllou1.pdf / DOI: https://onlinelibrary.wiley.com/doi/abs/10.1111/j.1540-5915.1997.tb01306.x

- **SMART (Simple Multi-Attribute Rating Technique)** は Edwards が1971年に素描し1977年に記述した多属性効用測定法。Barron & Barrett (1994) "SMARTS and SMARTER" が SMART とその発展形を整理している。SMART の重み導出は「基準を順位付けし、最下位の基準に10点を与え、以降より高い点を割り当てる」手続き。
  出典: https://fsi-live.s3.us-west-1.amazonaws.com/s3fs-public/smarts_and_smarter.pdf / https://sk.sagepub.com/dict/edvol/download/the-sage-dictionary-of-quantitative-management-research/chpt/multiattribute-utility-value-theory.pdf

- **Swing weighting** (von Winterfeldt & Edwards, 1986) は加法的多属性効用関数の重みを引き出す簡便かつ普及した方法。
  出典: https://proceedings.mlr.press/v62/troffaes17b/troffaes17b.pdf

- **重みの正規化**: MCDA では重みは通常「基準全体で合計1(100%)になるよう正規化される」。
  出典: https://www.1000minds.com/decision-making/what-is-mcdm-mcda

- **補償性の注意点**: UK政府 Analysis Function のMCDAガイドは、加重和系を「classic compensatory MCDA」と呼び、**ある基準の好成績が別の基準の悪成績を埋め合わせてしまう**性質を明示的な注意点として挙げている。対策として「各基準に絶対的な最低ラインを設け、分析前に選択肢を除外する」ことを示唆。
  出典: https://analysisfunction.civilservice.gov.uk/policy-store/an-introductory-guide-to-mcda/

### 3-2. AHP のペア比較と整合性比率(Consistency Ratio)

- **AHP** は Thomas L. Saaty が1970年代に開発。ステークホルダーが基準を2つずつ比較して相対的重要度を決め、重みセットを構築する。
  出典: https://www.transparentchoice.com/analytic-hierarchy-process

- **必要な比較回数**: 基準数 n に対し `n(n-1)/2` 問。基準5個なら 5×4/2 = **10問**。階層化すれば異なる枝のサブ基準同士を比較しなくてよいため問題数が減る。
  出典: https://www.transparentchoice.com/analytic-hierarchy-process

- **整合性指標(CI)**: `CI = (λ_max − n) / (n − 1)`。行列が完全に整合的なら λ_max = n となり CI = 0。
  出典: https://pmc.ncbi.nlm.nih.gov/articles/PMC12144522

- **整合性比率(CR)**: `CR = CI / RI`。RI(Random Index)は同サイズのランダム生成行列500個のCIの平均。**Saaty は CR ≤ 0.1 を許容閾値とした**。0.1 を超えた場合、判断の信頼性が疑われ、ペア比較の見直しが求められる。
  出典: https://pmc.ncbi.nlm.nih.gov/articles/PMC12144522 / http://www.isahp.org/uploads/460-exploratory.pdf

- **実装例と具体値**: n=3 のとき RI = 0.58。CI = 0.042885948 なら CR = 0.042885948 / 0.58 = **0.0739**(閾値内)。SpiceLogic は CR > 0.10 を太字赤で警告表示する。
  出典: https://spicelogic.com/docs/ahp-software/intro/ahp-consistency-ratio-transitivity-rule-388

- **閾値の但し書き**: Saaty 自身が3次・4次の行列については閾値をそれぞれ 0.05・0.08 とすることを追加提案している(※MDPIレビューの本文では "0.5 / 0.8" と表記されているが、これは 0.05 / 0.08 の慣用値の記載揺れの可能性があり**要一次資料確認**)。また基準数が増えると CR が 0.10 を超えやすくなるため、Saaty の整合性指標は文献上で批判もある(Murphy は9点尺度に原因を求めた)。
  出典: https://www.mdpi.com/2227-7390/10/8/1206 (Consistency Indices in Analytic Hierarchy Process: A Review)

- **CR < 0.2 までを許容とする立場**もある。
  出典: https://www.sciencedirect.com/science/article/abs/pii/S0020025519307832

### 3-3. TOPSIS

- **TOPSIS (Technique for Order of Preference by Similarity to Ideal Solution)** は Hwang & Yoon が1981年に開発(Yoon 1987、Hwang/Lai/Liu 1993 で発展)。「選ばれるべき案は、正の理想解(PIS)からの幾何距離が最短で、負の理想解(NIS)からの幾何距離が最長である」という概念に基づく。
  出典: https://en.wikipedia.org/wiki/TOPSIS

- **近接係数(closeness coefficient)**: `s_iw = d_iw / (d_iw + d_ib)`、値域 0〜1。s_iw = 1 なら最良、0 なら最悪の条件。この値で選択肢を順位付けする。
  出典: https://en.wikipedia.org/wiki/TOPSIS

- **弱点**: Opricovic & Tzeng は「TOPSIS は最良案を出すとされるが必ずしもそうではない」と論じ、Wang & Luo は**選択肢が近接している場合の順位逆転(rank reversal)問題**を指摘。実際に近接係数 0.44 / 0.56 の2案が、選択集合を変えると順位が変わる例が報告されている。
  出典: https://reference-global.com/download/article/10.1515/fcds-2015-0017.pdf

### 3-4. 感度分析 —「どの基準が結論を支配しているか」を数値で示す手法

これが天秤の中核。以下は出典ごとに具体的な手法として確認できたもの。

#### (a) 最小重み変化量 = 臨界度(Triantaphyllou & Sánchez 1997)

論文の核心的な問題設定は次の通り(原文の趣旨):

> 「一般には**最も重みの大きい基準が最も重大(critical)である**と考えられている(Winston 1991, p.754)。しかしこれは常に真とは限らず、場合によっては**最も重みの小さい基準が最も重大**でありうる。」

- **第1の感度分析問題**: 「現在の重みに対する**最小の変化量で、選択肢の既存順位を変えてしまう**のはどの基準か」を求めることで、各基準がどれだけ critical かを判定する。
- **第2の感度分析問題**: 同じ概念を用いて、単一基準における選択肢の**性能値(スコア)**が順位に対してどれだけ critical かを判定する。
- **臨界度(criticality degree)と感度係数(sensitivity coefficient)**: 定義9として `sens(a_i, j) = 1 / Δ'_i,j`(臨界度の逆数)を置き、臨界度が実行不能なら感度係数は0とする。**臨界度 Δ が小さいほど順位が変わりやすく、感度係数が高いほど順位変化が容易**。最も感度の高い選択肢は感度係数が最大のもの。
- **計算量**: WPM の場合、最も critical な基準を判定するには合計 `2 × (N × M(M−1)/2)` 個の臨界変化量 δ を計算する必要がある(N=基準数, M=選択肢数)。→ **選択肢ペア × 基準の全組合せを総当たりで解く**設計になる。

出典: http://www.csc.lsu.edu/trianta/Journal_PAPERS1/SENSIT1.htm / https://bit.csc.lsu.edu/trianta/Journal_PAPERS1/MCDM_SensitivityAnalysis_by_Triantaphyllou1.pdf / https://www.researchgate.net/publication/227656830_A_Sensitivity_Analysis_Approach_for_Some_Deterministic_Multi-Criteria_Decision-Making_Methods

#### (b) 順位逆転を保証する最小重み修正量(Wolters & Mareschal ほか)

- Applied Soft Computing 誌の系統的レビュー「Sensitivity analysis approaches in multi-criteria decision analysis: A systematic review」(2023, Vol.148, 110915)は、MCDA の感度分析手法を体系的に整理している。
- そこで紹介される **Wolters & Mareschal (1995)** の手法は「特定の選択肢を**ランキング1位にするために必要な、基準重みの最小修正量**を示す」もの。結論として「**上位にランクされた選択肢ほど、必要な重み変更の閾値は低い**」ことが示されている。
- レビューの総括: 「大半の研究は、**基準重みの値の変化がランキング結果に与える影響を測定すること**に焦点を当てている」。
- **Rank Reversal パラドクス**は多くの多基準手法に共通する問題として明示されている(Nabavi, Wang & Rangaiah の手法はこの感度を検査する)。

出典: https://www.sciencedirect.com/science/article/pii/S156849462300933X / https://www.researchgate.net/publication/374540215_Sensitivity_analysis_approaches_in_multi-criteria_decision_analysis_A_systematic_review

#### (c) 実装レベルでの One-at-a-Time 重みスイープ(競合実装の観測事実)

yesnowheelapp の "Tipping Point Check" は、上記理論を一般ユーザー向けに落とし込んだ**現時点で唯一の無料Web実装**であり、そのまま設計参照点になる。取得できた具体的挙動:

- 単一基準の重みを 1つずつ動かし、**残りの重みは比例配分で差し引く**(合計100%を保つ)。
- 「Location の重みを 10% から 18.9% 弱まで上げる(= 8.5ポイントのシフト)と勝者が Job A に逆転する」と**具体的な数値と方向**を提示。
- 「Growth が次に近いレバーで、約9ポイントの増加が必要」と**基準を逆転しやすさ順にランキング**。
- 「Salary と Work-Life Balance は単独では結果を覆せない。Job B が既に両方で勝っているため、重みを上げても Job B のリードが広がるだけ」と**逆転不可能な基準を理由付きで明示**。
- 総括文: 「これは 7.4 対 7.1 で決着した判定ではなく、**Location の重み付けをどれだけ信頼できるかに大きく依存する、真に僅差の決定である**」。
- どの単一基準でも逆転しない場合は結論を **"robust"** とラベル付けする。

出典: https://yesnowheelapp.com/en/weighted-decision-matrix-calculator

#### (d) 基準貢献度(criterion contribution)の可視化

- SpiceLogic の **weighted criteria attribute chart** は「**どの基準がどの程度、決定に影響しているかを示す**」チャートとして製品化されている。加えて one-way sensitivity analysis(選択した変数について詳細な感度ビュー)と、スライダー操作に対する即時再計算を提供。
- 数式上は、選択肢 i の総スコア `Σ_j (w_j × a_ij)` に対して各項 `w_j × a_ij` が占める割合が貢献度%になる(※この分解式そのものを明記した一次資料は本調査では**未確認**。onlinetoolhubs が加重総和を MAUT の線形結合と記述している点までが確認範囲)。

出典: https://spicelogic.com/products/ahp-software-30 / https://onlinetoolhubs.com/tools/decision-matrix-calculator

#### (e) 選好閾値・拒否権(veto)による非補償化

- 選好閾値(preference threshold)は「一方の選択肢を完全に選好させるに足る最小の性能差」を指す。ある選択肢が**たった1つの基準でも** veto 値以上に劣る場合、他の基準での成績にかかわらず、その選択肢は相手を outrank できない。
  出典: https://pmc.ncbi.nlm.nih.gov/articles/PMC7970504/

---

## 4. 満たされていないニーズ / 差別化の勝ち筋

### 4-1. 観測された市場の構造的な穴

調査した13製品を「感度分析の実装」という軸で並べると、市場が**きれいに二分**されていることが分かる。

| 層 | 感度分析 | 価格 | 該当製品 |
|---|---|---|---|
| 高額商用 | あり(整合性チェック、weighted criteria chart、one-way SA) | $12,000〜$25,000/年 または要商談・デスクトップ買い切り | 1000minds, TransparentChoice, SpiceLogic |
| 無料Web | **ほぼ全て無し** | $0 | geratools, altftool, chamsdel, onlinetoolhubs, MyMap, Argumentree, Decisive Leader ほか |
| 汎用SaaSテンプレート | 無し(重み計算すら手動) | 本体契約に従属 | ClickUp, Notion |

**中間が存在しない。** 唯一 yesnowheelapp が "Tipping Point Check" で橋を架けているが、単一基準のOAT検査に留まり、保存・共有・貢献度%・複数基準同時変動のいずれも持たない。

### 4-2. 満たされていない具体的ニーズ

1. **「勝者は分かったが、信じていいのか分からない」問題が放置されている。**
   無料ツールの大半は加重和と順位を出して終わる。しかし yesnowheelapp 自身が言語化している通り「**重みは測定値ではなく意見**であり、マトリクスは、その勝者がたまたま1つの基準の重み付け次第で成立しているだけの場合でも、自信ありげな単一の勝者を出力してしまう」。ユーザーが本当に欲しいのは順位ではなく「**この結論を信じてよいか**」という判定。

2. **「どの基準が結論を支配しているか」が学術的には解けているのに製品化されていない。**
   Triantaphyllou & Sánchez (1997) は「最も重みの大きい基準が最も重大とは限らず、最も重みの小さい基準が最も重大でありうる」ことを1997年に示している。これは**直感に反する強い洞察**であり、ユーザーに驚きと納得を与える。にもかかわらず、この計算をブラウザで無料で回せる製品は確認できなかった。

3. **意思決定が記録として残らない。**
   無料ツール群のセールスポイント「サーバーに何も送らない・登録不要」は、裏返すと**結果を保存も共有もできない**。一方 Loomio が高く評価される理由は一貫して「the record(記録)」であり、10Pines の事例でも「検索可能な意思決定の履歴と理由」が価値の中心。個人・小チーム向けに「軽さ」と「記録」を両立した製品が空白。

4. **結論ありきの重み逆算(motivated reasoning)を誰も止めない。**
   yesnowheelapp は失敗パターンとして「自分の好きな選択肢が勝つまで重みを調整していることに気づいたら、マトリクスは仕事をやめている」と明記するが、**機能として検知・警告する実装は皆無**。重みの編集履歴を保持すれば技術的には検知可能。

5. **エンタープライズ層が意図的に軽量ユーザーを切り捨てている。**
   TransparentChoice は公式FAQで「AHPは加重スコアリングより優れているか?→ **Yes。加重モデルは数学的厳密性と整合性チェックを欠く**」と明言している。つまり彼らは「厳密性が欲しければ$4,000/年払え」という立場を取っており、**厳密性を無料層に降ろす製品が構造的に生まれにくい**。ここが最大の攻め所。

### 4-3. 差別化の勝ち筋(3つ)

**① 出力を「順位」から「頑健性の判定」に変える。**
天秤の一次出力は「A が勝ち」ではなく「**A の勝ちは Location の重みを 8.5 ポイント動かすと崩れる。それ以外の基準では崩れない**」であるべき。競合13製品のうち12製品は順位で終わっており、これだけで独立したカテゴリを名乗れる。無料層で誰もやっていない一方、理論(Triantaphyllou & Sánchez の臨界度、Wolters & Mareschal の最小重み修正量)は確立済みで、実装リスクが低い。

**② 「支配している基準」を貢献度%とランキングで常時表示する。**
各基準について (a) 総スコアへの貢献度%、(b) 順位を逆転させるのに必要な重み変化量、(c) そもそも逆転が不可能な基準はその理由 —— の3点セットを、全基準について降順で並べる。Triantaphyllou の「最小重みの基準が最も critical でありうる」という反直感的結果が実データで出た瞬間が、この製品の最も強い体験になる。SpiceLogic が有料デスクトップで持つ weighted criteria attribute chart を、ブラウザで無料化する形。

**③ 厳密性(AHP の CR ≤ 0.1)を無料層に降ろす。**
ペア比較で重みを導出し、`CR = CI / RI` を計算して 0.1 超で警告する —— これは現在 1000minds($25,000/年)・TransparentChoice(£4,000/年〜)・SpiceLogic(有料デスクトップ)の独占領域。1000minds 自身が「直接レーティングは本質的に不正確でバイアスを受けるため推奨しない」と述べており、**無料ツールが全て採用している直接レーティング方式には理論的な弱点があると、業界最上位が公言している**。基準5個なら10問で済む(n(n-1)/2)ため、UX的にも成立する。

> **一行で言えば**: 「順位を出すツール」は飽和しているが、「**その順位を信じてよいかを数値で答えるツール**」は無料層に一つも存在しない。天秤はそこに立つ。

---

## 5. 出典一覧

### 製品(実地調査)
1. https://www.1000minds.com/
2. https://www.1000minds.com/pricing
3. https://www.1000minds.com/pricing/general-decision-making
4. https://www.1000minds.com/decision-making
5. https://www.1000minds.com/articles/decision-criteria
6. https://www.1000minds.com/decision-making/what-is-mcdm-mcda
7. https://www.transparentchoice.com/analytic-hierarchy-process
8. https://www.transparentchoice.com/software/decision-support
9. https://www.transparentchoice.com/pricing
10. https://www.softwareadvice.com/product/473710-TransparentChoice (第三者による価格情報: £4,000/年〜)
11. https://spicelogic.com/
12. https://spicelogic.com/products/ahp-software-30
13. https://spicelogic.com/products/rational-will-29
14. https://spicelogic.com/products/decision-tree-software-27
15. https://spicelogic.com/docs/rational-will
16. https://yesnowheelapp.com/en/weighted-decision-matrix-calculator
17. https://argumentree.com/tools/decision-matrix
18. https://geratools.com/decision-matrix
19. https://onlinetoolhubs.com/tools/decision-matrix-calculator
20. https://altftool.com/tools/all/decision-matrix-builder
21. https://chamsdel.online/tools/decision-matrix
22. https://mymap.ai/tools/decision-matrix-maker
23. https://beadecisiveleader.com/apps/prioritization
24. https://clickup.com/templates/comparison-matrix-t-200540429
25. https://clickup.com/templates/hiring-selection-matrix-t-182148283
26. https://clickup.com/templates/design-matrix-kkmvq-6109084
27. https://clickup.com/templates/risk-benefit-analysis-kkmvq-6107884
28. https://clickup.com/templates/criteria-matrix-interior-design-t-900200018693
29. https://notion.com/templates/decision-making-matrix
30. https://notion.com/templates/matrix-decision-making
31. https://notion.com/templates/smart-decision-matrix-comparison-table-life-choices-pro
32. https://notion.com/templates/decission-lab
33. https://appfluence.com/
34. https://appfluence.com/pricing/
35. https://prioritymatrix.com/manage/upgrade/
36. https://www.loomio.com/
37. https://www.loomio.com/pricing/
38. https://www.loomio.com/docs/en/policy/subscriptions/pricing
39. https://www.loomio.com/collaborative-decision-making
40. https://www.loomio.com/sociocracy

### 学術・理論
41. http://www.csc.lsu.edu/trianta/Journal_PAPERS1/SENSIT1.htm — Triantaphyllou & Sánchez, "A Sensitivity Analysis Approach For Some Deterministic Multi-Criteria Decision Making Methods", *Decision Sciences* 28(1), 1997, pp.151-194
42. https://bit.csc.lsu.edu/trianta/Journal_PAPERS1/MCDM_SensitivityAnalysis_by_Triantaphyllou1.pdf — 同上 PDF全文
43. https://onlinelibrary.wiley.com/doi/abs/10.1111/j.1540-5915.1997.tb01306.x — 同上 DOI: 10.1111/j.1540-5915.1997.tb01306.x
44. https://www.researchgate.net/publication/227656830_A_Sensitivity_Analysis_Approach_for_Some_Deterministic_Multi-Criteria_Decision-Making_Methods — 同上(本文抜粋取得元)
45. https://www.sciencedirect.com/science/article/pii/S156849462300933X — "Sensitivity analysis approaches in multi-criteria decision analysis: A systematic review", *Applied Soft Computing* 148, 110915 (2023)
46. https://www.researchgate.net/publication/374540215_Sensitivity_analysis_approaches_in_multi-criteria_decision_analysis_A_systematic_review — 同上
47. https://en.wikipedia.org/wiki/TOPSIS — TOPSIS(Hwang & Yoon 1981)の定式化・近接係数
48. https://www.sciencedirect.com/topics/engineering/technique-for-order-preference-by-similarity-to-ideal-solution — TOPSIS 概説
49. https://reference-global.com/download/article/10.1515/fcds-2015-0017.pdf — TOPSIS の順位逆転問題(Wang & Luo、Opricovic & Tzeng の指摘)
50. https://fsi-live.s3.us-west-1.amazonaws.com/s3fs-public/smarts_and_smarter.pdf — Barron & Barrett (1994) "SMARTS and SMARTER"
51. https://sk.sagepub.com/dict/edvol/download/the-sage-dictionary-of-quantitative-management-research/chpt/multiattribute-utility-value-theory.pdf — SMART (Edwards 1977) / MAUT
52. https://proceedings.mlr.press/v62/troffaes17b/troffaes17b.pdf — Swing weighting (von Winterfeldt & Edwards 1986)
53. https://www.researchgate.net/publication/223743977_On_the_convergence_of_multiattribute_weighting_methods — SMART の重み割当手続き
54. https://onlinelibrary.wiley.com/doi/full/10.1111/itor.13171 — Rezaei (2024) 属性重み引き出しにおけるアンカリングバイアス
55. https://spicelogic.com/docs/ahp-software/intro/ahp-consistency-ratio-transitivity-rule-388 — AHP 整合性比率と Random Index の具体計算例
56. https://www.mdpi.com/2227-7390/10/8/1206 — "Consistency Indices in Analytic Hierarchy Process: A Review", *Mathematics* 10(8), 1206
57. http://www.isahp.org/uploads/460-exploratory.pdf — グループ平均ランダム指数の探索的分析(CR ≤ 0.1 の由来)
58. https://pmc.ncbi.nlm.nih.gov/articles/PMC12144522 — AHP 専門家判断の整合性向上(CI / CR / RI の定義式)
59. https://www.sciencedirect.com/science/article/abs/pii/S0020025519307832 — Amenta et al. (2020) 整合性近似、CR < 0.2 許容の立場
60. https://pmc.ncbi.nlm.nih.gov/articles/PMC7970504/ — MCDA プロセスの分類学(選好閾値・veto)
61. https://analysisfunction.civilservice.gov.uk/policy-store/an-introductory-guide-to-mcda/ — 英国政府 Analysis Function「MCDA入門ガイド」(補償性MCDA、outranking 法の限界)

### 未確認事項(明記)
- **TransparentChoice の公式価格**: 公式サイトは "book a call" 方式。£4,000/年〜 は第三者サイト(Software Advice)の記載であり一次情報未確認。
- **SpiceLogic AHP Software の具体的なライセンス金額**: 「買い切り永続ライセンス」であることは公式に確認できたが、金額そのものは取得できず。
- **Argumentree 本体アプリの有料プラン価格**: 「無料枠+チーム向け有料プラン」との記述のみで、金額は未確認。
- **AHP の n=3, n=4 における閾値の正確な値**: MDPI レビュー本文の表記(0.5 / 0.8)が慣用値(0.05 / 0.08)と食い違うため、Saaty の一次資料での確認が必要。
- **基準貢献度%の分解式そのものを明記した一次学術資料**: 未確認(SpiceLogic の製品仕様と MAUT の線形結合という記述までが確認範囲)。
