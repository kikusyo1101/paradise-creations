# 習慣トラッカー — discover フェーズ 調査報告 (findings.md)

- **wish**: 「毎日の習慣を記録し、連続日数とヒートマップで可視化する習慣トラッカー」
- **前提**: 単一 HTML ファイルの Web アプリ (ビルド不要・オフライン動作・localStorage 永続化)
- **担当**: priest (市場調査)
- **調査日**: 2026-08-31

---

## 1. 調査した先行事例

### 1-1. Loop Habit Tracker (オープンソース / Android)
- <https://github.com/isoron/uhabits> (GitHub ★10.2k, GPLv3, 2,650 commits)
- <https://f-droid.org/en/packages/org.isoron.uhabits>
- <https://loophabits.org>

学べる点:
- **Habit score (習慣スコア)**: 「現在の連続日数に加え、習慣の"強度"を算出する高度なアルゴリズムを持つ。繰り返すたびに強くなり、休むたびに弱くなる。ただし長い連続の後の数日の欠落で進捗が完全に破壊されることはない」(F-Droid 説明文)。→ **連続日数の脆さを補う二本目の指標**という設計思想。
- 完全オフライン・アカウント不要・広告なし。「インターネット接続やオンラインアカウント登録を必要としない」(README)。単一HTML+localStorage 構想と価値観が一致する。
- 詳細なグラフと統計、履歴のスクロール、ウィジェット、ダークモード。
- v2.1 で「特定日付へのメモ追加」「measurable habit への skip 追加」「カスタム頻度の復活」が入っている(F-Droid changelog)。→ **skip(免除)という第3の状態**が実運用で要求された証拠。

### 1-2. Streaks (iOS / Apple Design Award 受賞)
- <https://streaksapp.com/>

学べる点:
- 「毎日タスクを完了するたびにストリークが伸びる」「**チェーンを切るな。切ればストリークは 0 日に戻る**」という、Seinfeld 由来の "don't break the chain" を製品の中心に据える。
- **タスク数の上限を 24 に固定**している(「最大24個のタスクを選択/作成」)。無制限にしないのは意図的な設計判断。
- 「毎日やるべきでないタスクもある。**曜日を設定してストリークを壊さないようにする**」(週3回、平日のみ、毎週水曜など)。→ 頻度設定がないと「毎日ではない習慣」がすべて壊れた記録に見える。
- clockify のレビューでも「アカウント不要、個人情報不要ですぐ始められる」ことが長所、「**進捗を追うカレンダーが極端に小さい**」ことが短所として挙がっている (<https://clockify.me/blog/productivity/best-habit-tracker-apps/>)。→ ヒートマップのセルサイズ/可読性は実際に不満点になる。

### 1-3. Habitica (ゲーミフィケーション型 / オープンソース)
- <https://apps.apple.com/us/app/habitica-gamified-taskmanager/id994882113>
- <https://grokipedia.com/page/Habitica>
- <https://otontechnology.com/how-habitica-gamified-habit-app-works>

学べる点:
- タスクを **Habits / Dailies / To-Dos の3種**に分ける。Dailies のみが「スケジュールされた日に未完了だと HP を失う」= ストリークの対象。Habits は「1日に複数回やるもの/たまにやるもの」で連続日数の概念になじまない。→ **「習慣」と一口に言っても粒度が3つある**という重要な発見。
- 「色分けされたタスクとストリークカウンタで一目で状況が分かる」(App Store 説明文)。
- 失敗モード: HP を失う/キャラクターが死ぬというペナルティ設計は「奮い立つ人もいれば、そうでない人もいる」(personaldevelopmentapps.com のレビュー)。→ **罰による動機づけは万人向けではない**。
- 2013 年から生き残っている数少ないゲーミフィケーション製品 (otontechnology)。ただし「ペイウォールの向こうに習慣形成を助けるものは何もない」とも評される。

### 1-4. GitHub Contribution Graph 系 (ヒートマップ UI の原型)
- <https://www.techinterview.org/post/3233475390/build-github-style-activity-heatmap/>
- <https://fwdtools.com/ui-snippets/github-contribution-heatmap/>
- <https://codepen.io/ire/pen/Legmwo/> (CSS Grid 実装の定番 CodePen)

学べる点(実装仕様として最も具体的):
- レイアウトは **52〜53列 × 7行**。列=週、行=曜日。月ラベルを上、曜日ラベルを左。
- CSS Grid で `grid-template-rows: repeat(7, 11px)` + `grid-auto-flow: column` にすると、日付順にセルを push するだけで自動的に週=列に折り返される。**JS 側で行/列の計算をしなくてよい**。
- 開始日は「直前の日曜(または月曜)まで巻き戻す」ことで、先頭列が欠けた週にならないようにする。
- **色は連続グラデーションではなく 4〜5 段階の離散レベル**にする。「5段階の方が一目で速く読める。目は無限の階調ではなく5つの既知の状態だけ区別すればよい」。GitHub は 0 を含む5段階。
- 線形スケールは誤り。「ほとんどの日はカウントが低く、一部が非常に高い」ため、**分位点ビニング(25/50/75/95パーセンタイル)またはドメインに合わせた固定閾値**を使う。
- アクセシビリティ: 各セルに意味のある `aria-label`(「2026年1月15日水曜日に5件」)、**roving tabindex**(グリッド内でフォーカス可能なセルは常に1つ)、矢印キー移動、**色だけを情報伝達手段にしない**(数値を aria-label に含める)。
- 未来日は空/ミュート表示、またはそもそも描画しない。カウント0の日は透明ではなく最も薄い色にする(グリッド形状を保つため)。
- モバイル: 52列が入らないので **コンテナ内で横スクロール**(ページ自体を横スクロールさせない)。タッチ標的は最低 12×12px。ホバーがないので tap-to-show tooltip。
- エッジケース: **DST(23時間/25時間の日)、うるう年、週の開始曜日のロケール差**(EU=月曜、US=日曜)、極端な外れ値による凡例の歪み。
- 365セル程度なら SVG でも CSS Grid でも性能上問題ない(過剰設計しないこと)。

### 1-5. (補足) ヒートマップ特化アプリ
- <https://habitheat.com/> — 「週・月・年にわたって習慣が積み上がるのをシンプルなカレンダー型ヒートマップで見る」「done/not-done だけでなく、数値・選択肢・所要時間も記録できる」
- <https://apps.apple.com/ca/app/habit-heatmap/id6670768561> — 差別化点として「**年全体を1ブロックで表示するのではなく、月ごとに区切った超明快なヒートマップ**」を掲げる。
  - **実際のバグ報告が公開されている**: 「アプリの日付の曜日が正しくない。全部1日ずれている(例: 2025年1月3日がアプリ上では土曜)」。開発者回答: 「これは**ユーザーの OS 設定の"週の開始曜日"に基づく日付計算の問題**だった。v1.4 で修正し、ヒートマップは週の開始曜日設定に動的に適応するようになった」。→ **これは本プロジェクトが確実に踏む地雷である**(§5, §6 参照)。

### 1-6. (補足) 心理・失敗モードの一次情報
- <https://habit-streak.com/en/blog/habit-tracking/habit-tracking-not-for-everyone>
  - 「調査によれば **ヘルスアプリのユーザーの約70%が10回使っただけで離脱する**」(引用元: <https://www.jmir.org/2024/1/e56897>)。主因は「トラッキング体験そのものがモチベーションではなくストレス源になること」。
  - 「UCL の習慣形成アプリ研究では、**ストリークが途切れるとユーザーはアプリと行動の両方を放棄する**ことが多い」(<https://discovery.ucl.ac.uk/1477627/1/Chi%202016%20LBW%202.1%20camera%20ready.pdf>)。
  - 「二値思考(完璧か破綻か)をする人は、最初の失敗の後に目標を完全に放棄する確率が **3.2倍**」。
  - 「ほとんどの習慣トラッカーは行動を二値として扱う。この all-or-nothing 設計は**自己欺瞞を助長する**——チェックマークで埋まったカレンダーは見えるが、実際に改善しているかは見えない」。
  - 「研究の多くは **1〜3個の習慣から始め**、それが自動化されてから追加することを推奨」。
- <https://www.buildyouryear.com/blog/habit-tracking-streaks-heatmaps>
  - 「**ストリークは1〜30日目には優れた動機づけだが、30日以降は脆くなる**。1日休むと60日のストリークが心理的に"台無し"になる。ヒートマップは連続を気にしない——**時間あたりの密度**を評価する」。
  - 90日で「90日連続してやめた人」より「70/90日やって4回の空白がある人」の方が長期的成果は大きく上回る、という対比。
  - 実務チェックリスト(7項目中5項目満たせば合格): ①ワンタップ記録(摩擦ゼロ) ②見えるストリークカウンタ ③ヒートマップ/52週グリッド ④**赦しの仕組み(skip パス / never-miss-twice)** ⑤習慣は4〜6個まで ⑥アイデンティティを強化する言葉遣い ⑦週次の振り返り。
  - 「現在のストリーク + 最長ストリーク の両方を出すとレバレッジが増す」。

---

## 2. ユーザーが本当に必要としているもの (literal な要求の裏)

wish の literal な要求は「記録する / 連続日数 / ヒートマップ」の3点だが、調査から見える**本当のニーズ**は以下。

| 表面の要求 | 裏にある本当のニーズ | 根拠 |
|---|---|---|
| 「毎日の習慣を記録し」 | **記録すること自体が苦行になってはいけない**。開いて1タップで終わる摩擦ゼロの体験。記録の手間 > 習慣の手間 になった瞬間に離脱する | 70%が10回使用で離脱 (JMIR/habit-streak)。「ログ・分析・最適化に、習慣の実行より多くの時間を使う人がいる」 |
| 「連続日数」 | 欲しいのは数字ではなく**「自分は続けられている」という自己効力感**。ゆえに連続が切れた瞬間に価値がゼロになる指標だけを出すのは、ニーズに反する | UCL 研究: ストリークが切れるとアプリと行動の両方を放棄。二値思考者は3.2倍離脱 |
| 「ヒートマップで可視化」 | 欲しいのは**長期の自分の姿(パターン)の把握**。「今週なぜ落ちたか」を週次で振り返るための材料。単なる装飾ではない | 「ストリークは今日に報いる、ヒートマップは1年に報いる」「ヒートマップは週1回見る、ストリークは毎日」(buildyouryear) |
| (暗黙) | **自分のデータが自分の手元にあること**。アカウント登録・サインアップ・クラウド同期を挟まないこと | Loop の中核価値 (README: オフライン動作・プライバシー尊重)。Streaks も「アカウントも個人情報も不要ですぐ始められる」ことが長所 (clockify) |
| (暗黙) | **失敗しても戻ってこられる設計**。1日休んだ人を歓迎する UI | 「赦しの仕組み(skip パス / never-miss-twice)」がスコアカード必須項目 |

**結論**: これは「記録アプリ」ではなく **「続けている自分を見せて、途切れても戻ってこられる装置」** を作る依頼である。

---

## 3. must-have 機能リスト (根拠つき)

| # | 機能 | 根拠 |
|---|---|---|
| M1 | **習慣の追加/編集/削除**(名前・色・アイコン程度) | 全事例に存在する最小単位。Habitica「色分けされたタスクとストリークカウンタで一目で状況が分かる」 |
| M2 | **今日の一覧 + ワンタップでチェック/解除** | 「ワンタップ記録(摩擦ゼロ)」がスコアカード第1項目。Streaks は「+ を押すだけ。追加ステップなし」 |
| M3 | **現在のストリーク + 最長ストリーク の両方表示** | 「現在 + 過去最長 の組合せで追加のレバレッジ」(buildyouryear)。Streaks の中核機能 |
| M4 | **GitHub 型ヒートマップ(52〜53週 × 7行、離散4〜5段階、月ラベル・曜日ラベル・凡例)** | wish の明示要求。実装仕様は techinterview / fwdtools に確立済み |
| M5 | **習慣ごとのヒートマップ**(全習慣まとめ + 個別の両方が見えること) | Loop・HabitHeat・Daisy テンプレートいずれも「習慣詳細画面にカレンダーヒートマップ」を持つ |
| M6 | **過去日の遡り記録/修正**(ヒートマップのセルをクリックしてトグル) | 記録忘れは必ず発生する。Loop は v2.1 で「特定日付へのメモ追加」まで実装。修正できないと記録の信頼性が崩れ、以後使われなくなる |
| M7 | **skip / 免除状態(未達とは区別される第3の状態)** | Loop v2.1 で追加。「赦しの仕組み」がスコアカード必須項目。二値設計が離脱の主因 |
| M8 | **頻度設定(毎日 / 特定曜日 / 週N回)** | Streaks:「毎日やるべきでないタスクもある。曜日を設定してストリークを壊さないように」。これがないと週3の運動が常に"失敗"に見える |
| M9 | **localStorage への自動永続化 + 起動時復元**(アカウント不要・完全オフライン) | Loop の中核価値。単一HTML前提では必然 |
| M10 | **JSON エクスポート / インポート** | localStorage はユーザーがブラウザを掃除すると消える(§5)。データ消失はこの手のアプリで最も致命的な裏切り。Habitica もデータエクスポートを無料で提供 |
| M11 | **達成率/密度の指標(直近30日で X/30 など)、ストリークに依存しない第二指標** | Loop の「habit score」の思想。「ヒートマップは密度を評価する」「90日で70日やった人の方が成果は上」 |
| M12 | **ダークモード / システム配色追従** | Loop・Habit Heatmap いずれも明示的な機能として掲げる。夜に開くアプリである |
| M13 | **アクセシビリティ: セルの aria-label(日付+状態)、キーボード操作、色以外の情報伝達** | 「色を唯一の信号にしない」「roving tabindex」(techinterview)。ヒートマップは色依存 UI の典型なので必須 |

---

## 4. nice-to-have

- **週の開始曜日の設定**(日曜/月曜) — ロケール差。ただし §5 のバグを踏まえると「準 must」に近い
- **週次の振り返りサマリ**(今週 X/7、先週比) — スコアカード第7項目
- **アイデンティティ強化の言葉遣い**(「今日のあなたはランナーです」型) — スコアカード第6項目
- **習慣数のソフト上限とアラート**(4〜6個を推奨する UI ヒント)。Streaks は 24 個で固定
- **数値型/時間型の習慣**(「30ページ読む」「20分瞑想」)。HabitHeat は done/not-done・数値・選択肢・時間の4型。Streaks も「30/日」の目標値を設定
- **メモ機能**(その日の一言)。Loop v2.1 で追加された
- **月ごとに区切ったヒートマップ表示モード**。Habit Heatmap がこれを差別化点にしている
- **セルの hover/tap ツールチップ**(日付+状態)
- **リング/プログレスバーによる本日の達成率**
- **並べ替え・アーカイブ(一時停止)**。「休止中の習慣をバッジに数えない」ことがスコアカードに書かれている
- **控えめな祝福アニメーション**(全部完了時)
- **PWA 化 / ホーム画面追加**

---

## 5. よくある失敗 / 落とし穴

### UX・心理面
1. **ストリークの神格化** — 途切れた瞬間に全価値が消える設計は、UCL 研究が言うとおり「アプリと行動の両方の放棄」を招く。ストリークは主要指標にしてよいが、**唯一の指標にしてはいけない**。密度・最長記録・habit score 型の減衰スコアを併置する。
2. **二値(done/not-done)しかない状態設計** — 「病気」「旅行」「そもそも今日は対象日でない」を全部「失敗」に潰す。skip / N/A を第3状態として持つ。
3. **罰の設計** — Habitica の HP 減少は「奮い立つ人もいれば、そうでない人もいる」。汎用ツールでデフォルト ON にするのはリスク。
4. **習慣を無制限に追加させる** — 「12個追跡すれば3週目には8個を無視することが保証される」。1〜3個から始めることを研究が推奨。
5. **記録の摩擦** — モーダル→カテゴリ選択→保存、のようなフローは死。1タップ。
6. **通知の攻撃性** — 「ストリークが終わったと少しずつ大きな声で叫ぶ10個の受動攻撃的な通知」(Medium/Claire Gong) は離脱要因。
7. **データ過多** — 「グラフや数字が、進捗のなさへの苛立ちを増やすだけ」(Quora 回答)。初期画面は簡潔に。
8. **空状態の放置** — データ0の初回起動でグリッドが真っ白だと何のアプリか分からない。「親しみやすい空状態を出す」(techinterview のエッジケース)。

### ヒートマップ実装面
9. **週の開始曜日を OS/ロケール設定に合わせない → 曜日が丸ごと1日ずれる**。実際に Habit Heatmap で報告され v1.4 で修正された実バグ。
10. **先頭列の巻き戻し忘れ** — 開始日を直前の日曜(月曜)に巻き戻さないと先頭列が欠けた週になる。
11. **連続グラデーション配色** — 5段階離散にすべき。線形スケールも誤り(分位点 or 固定閾値)。
12. **色だけで情報を伝える** — 色覚特性・スクリーンリーダーで壊滅。aria-label に数値/状態を含める。
13. **未来日を通常セルとして描く** — ミュートするか描かない。
14. **カウント0を透明にする** — グリッド形状が崩れる。最も薄い色を使う。
15. **モバイルで 52 列が入らず、ページごと横スクロールする** — コンテナ内スクロールに閉じる。セルは最低 12×12px。
16. **タッチデバイスに hover ツールチップだけ用意する** — tap で出す経路が必要。
17. **DST / うるう年 / タイムゾーン** — 「23時間や25時間の日」がある。日付演算をミリ秒加算でやると壊れる。

---

## 6. 単一 HTML + localStorage で作る際の技術的示唆

### 6-1. 日付の扱い(最大の地雷)
- **日付キーはローカル日付の `"YYYY-MM-DD"` 文字列を正**とする。`Date` オブジェクトや UTC の ISO 文字列を保存しない。`toISOString()` は UTC 変換するので、JST では日付が1日前にずれる(23:00 に記録すると前日になる)。ローカルの `getFullYear/getMonth/getDate` から自前で組み立てる。
- JSON 経由では **`Date` はプロトタイプを失って ISO 文字列になり、`undefined` は `null` になり、`Map`/`Set` は `{}`/`[]` になる**(jsonic.io / skillstuff)。文字列キーで持てばこの問題が丸ごと消える。
- 日付の加算は「`new Date(y, m, d + n)`」形式で行う。ミリ秒の `+86400000` は DST で壊れる(techinterview のエッジケース)。
- 週の開始曜日は設定値として持ち、ヒートマップの行順・巻き戻し計算の両方に使う(Habit Heatmap v1.4 の修正内容と同じ)。
- 「今日」の判定は日付キー生成を1箇所の関数に集約する。日付をまたいだままタブを開きっぱなしにするケースがあるので、`visibilitychange` で再評価する。

### 6-2. localStorage の扱い
- **strings only**。必ず `JSON.stringify` / `JSON.parse`。オブジェクトを直接渡すと `"[object Object]"` になる(MDN)。
- **`localStorage.key = v` のようなプロパティアクセスを使わない**。`setItem`/`getItem` を使う。MDN 曰く「ネイティブメソッド(`.clear()` 等)との衝突、プロトタイプ継承によるデータ漏れ、プロトタイプ汚染を避けるため」。
- **容量は 1オリジンあたり約 5MB**(MDN の Storage quotas: 「Web Storage は全ブラウザで最大 10MiB、ブラウザは 1オリジンあたり localStorage 5MiB を保存できる」)。**UTF-16 で1文字2バイト**なので実質 ~250万文字。習慣10個 × 10年 × 日付キーでも数百KB程度なので十分だが、**書き込みは必ず try/catch で `QuotaExceededError` を捕まえる**(Firefox は `NS_ERROR_DOM_QUOTA_REACHED` という名前で投げる)。
- **利用可能性の feature detection が必須**。MDN の `storageAvailable()` パターン:「ブラウザによってはストレージ API を無効化できるが、グローバルオブジェクトは隠さない」「プライベートブラウジングでは quota 0 の空の localStorage を返すことがある」。Safari のプライベートブラウジングは 14 未満で全 `setItem` が throw、14+ は書けるがタブを閉じると消える。**書けない場合はメモリにフォールバックし、「この変更はこのセッションでのみ保持されます」と明示する**。
- **同期 API でメインスレッドをブロックする**。中位の Android で 2MB 読み込み時に 80〜120ms のブロックが計測されている(rizz.dev)。→ 起動時に1回読んでメモリ上の状態を正とし、**書き込みはデバウンス**する(キーストローク毎に書かない)。
- **スキーマバージョニングとマイグレーション**を最初から入れる。`{ v: 1, habits: [...], logs: {...} }` のエンベロープ形式にし、読み込み時に `v` を見て変換する。skillstuff の「よくある間違い #4: バージョニング/マイグレーションがない → デプロイでスキーマ不一致がユーザーを壊す」。
- **破損データからの回復**: `JSON.parse` は破損文字列で `SyntaxError` を投げる。try/catch でデフォルト値にフォールバックし、**壊れた生データは別キーに退避してから**上書きする(いきなり捨てない)。
- **キーは名前空間付きの単一キー**(例 `paradise.habit.v1`)にまとめる。複数キーに散らすと部分書き込みで不整合が起きる。
- **`storage` イベント**で他タブの変更を検知できる(同一ページの変更では発火しない)。複数タブで開かれたときの上書き事故を防げるので、余裕があれば対応する。
- **秘密情報は絶対に置かない**。同一オリジンの任意スクリプトから読める。本アプリは習慣名しか持たないので実害は小さいが、原則として守る。
- 5MB を超えるようなら IndexedDB に移すべきだが、**本件の規模では localStorage で完全に妥当**(rizz.dev:「小さく重要度の低い設定なら localStorage で問題ない」)。

### 6-3. ヒートマップの描画
- **依存なしの CSS Grid 実装が確立済み**。`grid-template-rows: repeat(7, <cell>)` + `grid-auto-flow: column` にして、日付順にセルを append するだけで週=列に自動整列する。JS 側の行列計算が不要になる。
- 月ラベルは「新しい月が始まる日曜」を検出して `style.gridColumn = weekIndex + 1` で該当列に配置する。
- 色は CSS カスタムプロパティ + `data-level="0..4"` 属性セレクタで指定する。テーマ変更が1箇所で済み、ダークモードも同じ仕組みで切り替わる。
- 365〜371 セルなら性能上の心配は不要。「過剰設計しないこと」(techinterview)。SVG より CSS Grid の方が簡単でアクセシブル。
- 横スクロールは `overflow-x` を持つ専用コンテナに閉じる。

### 6-4. 単一 HTML ファイルとしての構成
- ビルド不要 = 素の HTML + `<style>` + `<script>`。フレームワークなし。フォントも外部読み込みせずシステムフォントスタックを使う(オフライン動作のため)。
- 状態 → 描画は「単一の state オブジェクト → `render()` を呼ぶだけ」の一方向にする。部分更新の最適化は 365 セル規模では不要。
- `file://` で開いても動くこと。localStorage は `file://` オリジンで挙動がブラウザ依存になるため、**`file://` でストレージが使えないケースを feature detection で検出して警告を出す**設計にしておく。
- エクスポート/インポートは `Blob` + `URL.createObjectURL` によるダウンロードと、`<input type="file">` + `FileReader` で外部依存なしに実装できる。**localStorage がユーザーのブラウザ掃除で消える以上、これは保険ではなく必須機能**。

---

## 7. build フェーズへの推奨サマリ

1. **ストリークを主役にしつつ、それを唯一の指標にしない**(現在/最長ストリーク + 直近30日の密度 + skip 状態)。これが本調査で最も繰り返し出てきた失敗の是正点。
2. **日付は "YYYY-MM-DD" ローカル文字列を唯一の真実**として扱う。ここで手を抜くと必ず「曜日が1日ずれる」実バグを再現する。
3. **CSS Grid + `grid-auto-flow: column` + 5段階 data-level** でヒートマップを依存ゼロで実装する。
4. **localStorage は安全ラッパ(feature detect / try-catch / バージョン付きエンベロープ / デバウンス)経由**でのみ触る。
5. **JSON エクスポート/インポートを初版から入れる**。
6. **初回起動の空状態を設計する**(サンプル習慣の提案 or 1〜3個から始める案内)。

---

### 出典一覧
- Loop Habit Tracker (GitHub): https://github.com/isoron/uhabits
- Loop Habit Tracker (F-Droid): https://f-droid.org/en/packages/org.isoron.uhabits
- Loop Habit Tracker (公式): https://loophabits.org
- Streaks (公式): https://streaksapp.com/
- Habitica (App Store): https://apps.apple.com/us/app/habitica-gamified-taskmanager/id994882113
- Habitica (Grokipedia): https://grokipedia.com/page/Habitica
- Habitica 解説: https://otontechnology.com/how-habitica-gamified-habit-app-works
- Habitica レビュー: https://personaldevelopmentapps.com/habitica-review.html
- 習慣トラッカー比較レビュー: https://clockify.me/blog/productivity/best-habit-tracker-apps/
- GitHub 型ヒートマップ実装解説: https://www.techinterview.org/post/3233475390/build-github-style-activity-heatmap/
- 同 CSS Grid スニペット解説: https://fwdtools.com/ui-snippets/github-contribution-heatmap/
- CSS Grid 実装 CodePen: https://codepen.io/ire/pen/Legmwo/
- HabitHeat: https://habitheat.com/
- Habit Heatmap (App Store, 曜日ずれバグと修正の記録): https://apps.apple.com/ca/app/habit-heatmap/id6670768561
- 習慣トラッキングの失敗モード: https://habit-streak.com/en/blog/habit-tracking/habit-tracking-not-for-everyone
- ストリークとヒートマップの心理: https://www.buildyouryear.com/blog/habit-tracking-streaks-heatmaps
- 習慣アプリが効かない理由 (Medium): https://medium.com/@clairecgong/you-arent-lazy-this-is-why-habit-building-apps-don-t-work-for-you-and-what-to-do-instead-73dee6b3db59
- MDN Web Storage API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API/Using_the_Web_Storage_API
- MDN Storage quotas and eviction criteria: https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
- HTML Standard (Web Storage): https://html.spec.whatwg.org/multipage/webstorage.html
- localStorage 本番バグ集: https://rizz.dev/blog/tutorials/localstorage-production-bugs
- localStorage に複雑なオブジェクトを保存する: https://skillstuff.com/storing-complex-objects-in-localstorage/
- JSON + localStorage ガイド: https://jsonic.io/guides/json-localstorage
- (孫引き) UCL 習慣形成アプリ研究: https://discovery.ucl.ac.uk/1477627/1/Chi%202016%20LBW%202.1%20camera%20ready.pdf
- (孫引き) ヘルスアプリ離脱率 (JMIR 2024): https://www.jmir.org/2024/1/e56897
