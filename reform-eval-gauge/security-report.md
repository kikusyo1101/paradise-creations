# セキュリティ審査報告 — reform-eval-gauge(証明の秤)

対象:
- 新規 `graph/gauge.js`
- 改修 `graph/verdict.js`(trajectory 裁定 + produces 分岐)
- `.github/workflows/tribunal.yml`(追加 1 行: `"produces": "engine"`)
- 参照 `graph/workspace.js`(resolve / ledgerPath の経路)

前提: エンジンは開発者のローカルマシンで、開発者自身が与えた CLI 引数・ファイルに対して走る。影響範囲(blast radius)は開発者環境に限定される。

---

## (1) 秘密情報・資格情報の混入

- `gauge.js` / `verdict.js` / `tribunal.yml` 変更行に API キー・トークン・秘密鍵・パスワードの類は**一切なし**。
- ネットワーク送信コードもなし(`fs` / `path` / `workspace.js` のみ。verdict.js は `fs` のみ)。
- tribunal.yml は既存の Secret scan ステップ(`sk-` / `ghp_` / PRIVATE KEY パターン)を維持しており、追加行はデータ(JSON 文字列)であって秘密ではない。

**判定: 秘密の混入 0 件。**

## (2) 任意コード実行 / インジェクション

- `gauge.js` は `eval` / `Function` / `child_process` / 動的 `require` を**使っていない**。CLI 引数のファイルは `fs.readFileSync` → `JSON.parse` で読むのみで、コードとして評価される経路はない。
- 台帳追記は `fs.appendFileSync(ledgerPath(), JSON.stringify(entry) + '\n')`。`JSON.stringify` が改行・制御文字をエスケープするため、**slug や run.meta.scale に改行を仕込んでも JSONL の行構造を壊せない**(JSONL インジェクション不成立)。
- `ledgerPath()` は `path.join(workspace.resolve().root, 'gauge-ledger.jsonl')` — ファイル名は定数で、外部入力がパスに混入しない。
- `workspace.resolve()` の根は ①環境変数 `PARADISE_CREATIONS` ②兄弟ディレクトリ ③legacy の一本道。環境変数は起動した開発者自身の管理下であり、攻撃者が制御できる前提ならその時点で任意コマンド実行が可能なため、追加のリスクにはならない。
- `workspace.js` 内の `execFileSync('git', [...])` は固定引数の配列渡しで、シェル解釈なし(インジェクション不成立)。
- tribunal.yml の heredoc に埋まる `$PASSED` / `$FAILED` は `grep -oE '[0-9]+'` で数字のみに絞られており、JSON 破壊・シェル注入の余地はない。

**判定: 実行系の脆弱性なし。**

## (3) パストラバーサル(slug / run ファイル経由)

- `gauge.js` において slug は**パス構築に一切使われない**(台帳エントリの値として JSON に入るだけ)。よって `--slug ../../x` を与えてもファイルシステム上の位置には影響しない。
- run ファイルパス(`score <run.json>` / `record <run.json>`)は開発者が明示的に指定する読み取り専用パスであり、CLI の意図された機能(任意の run-state を採点する)そのもの。権限昇格はない。
- `workspace.creationDir()` は `/^[a-z0-9][a-z0-9-]*$/` で slug を検証しており、`..` や区切り文字を拒否する。`gauge.js baseline` が使う `dir.name` は `readdirSync` の実在ディレクトリ名で、細工されたパス片ではない。

**判定: トラバーサル経路なし。**

## (4) tribunal.yml の CI 権限昇格

- 追加された 1 行 `"produces": "engine"` は verdict-report.json の**データ行**であり、workflow の `permissions` / トリガー / 実行ステップに変化はない。
- tribunal ジョブの権限は従来どおり `contents: read` + `pull-requests: write`(PR コメント掲示に必要な最小限)。昇格なし。
- 意味的効果: `verdict.js` の第37/38条ゲートで、`produces:'engine'` は trajectory(gauge 計測)要求を**免除**される(run-state を持たない CI の断罪のため)。ただし security / build / tests の要求は engine にも課されたまま(`produces !== 'document'` 分岐)であり、fail-closed の骨格は保たれている。ゲートの不当な緩和ではなく、第36条「門は消さず分ける」に沿った意図的な分割と判定。
- 参考(既存挙動・今回の変更外): verdict-report.json の `"security": {"issues": 0, "secrets": 0}` は直前の Secret scan ステップの結果を反映した自己申告値であり、独立計測ではない。現状は verify ジョブの Secret scan が実体を担保している。

**判定: 権限昇格なし。**

## (5) 信頼できない run-state の JSON.parse — DoS / プロトタイプ汚染

- **プロトタイプ汚染: なし。** `JSON.parse` は `__proto__` キーを通常の own property として生成するだけで、`Object.prototype` を書き換えない。gauge.js / verdict.js は parse 結果を**読むだけ**であり、`Object.assign` / 深いマージ / `obj[key] = value` 形式の再帰的書き込みは存在しない。`normalize()` は `Object.values` / `Object.entries` で列挙して新しい配列に写すのみ。危険なマージは確認されなかった。
- **ReDoS: なし。** `/rework/` `/loop-guard/` は固定の単純パターンでバックトラッキング爆発の構造を持たない。
- **メモリ DoS: 低リスク(許容)。** 巨大な run.json や肥大した gauge-ledger.jsonl を `readFileSync` で全量読みするため理論上 OOM し得るが、入力は開発者自身のファイルで、クラッシュは exit 2 で閉じる(fail-closed)。攻撃面ではなく運用上の留意点。

**判定: 汚染・実行系リスクなし。**

---

## 注意点(脆弱性としては数えない・情報提供)

- `compare` / `renderLedger` は slug をそのまま端末に印字するため、ANSI エスケープを含む slug で表示を乱せる(ローカル CLI・実害は限定的)。気になるなら `record` 側にも `workspace.creationDir` と同じ kebab-case 検証を掛けると対称になる。
- gauge-ledger.jsonl は追記専用で無限に伸びる。将来的にローテーションを検討。

## 総括

新規・変更コードに秘密情報はなく、コード実行・インジェクション・パストラバーサル・CI 権限昇格・プロトタイプ汚染のいずれの経路も確認されなかった。`produces:"engine"` は権限に触れないデータ行で、security/build/tests ゲートは engine にも課され続ける。出荷を妨げる欠陥なし。

issues: 0
secrets: 0
