# requirements.md — 秤 (gauge): 改善の数値的証明機構

findings.md の実測 4 欠陥 (eval engine 0 件 / verdict は trajectory を読まない /
run-state に読者がいない / 台帳が無く前後比較不能) に対する受入条件。

## AC-1: trajectory を決定的に採点する engine が存在する
- `node graph/gauge.js score <conclave.json>` が run-state から **決定的** metrics を出す:
  - outcome: 完走したか (domains ratified / total, phases done / total)
  - firstPassRate: attempts==1 で done した相の割合
  - reworkCount: domain-rework event 数
  - retryOverhead: Σattempts − 着手相数 (余分な試行の総数)
  - loopGuardTrips: loop-guard 発動数
  - durationMs: 走行時間
  - composite 0–100 (式は engine ヘッダに明文化、LLM 不使用)
- 同じ run-state には常に同じ点が出る (決定性)。2026 定石: 決定的に測れるものに
  LLM judge を使わない (Langfuse)。定性は既存 tribunal の領分。

## AC-2: 不在は通過ではない (lesson:absence-is-not-passage)
- 空 JSON / phases の無い run-state は **exit 2 で拒否** — 0 点でも 100 点でもなく「測れない」。

## AC-3: 台帳 — 全採点は追記型 ledger に記録できる
- `gauge.js record <run> --slug <slug>` が creations 側 (workspace.js resolve — 第30条)
  の `gauge-ledger.jsonl` に {ts, slug, scale, metrics, score} を追記する。
- `gauge.js baseline` が既存全 run-state を走査して台帳を初期化する (coin, habit が最初の基線)。

## AC-4: 前後比較 — 「改善した」が数で言える
- `gauge.js compare <slugA> <slugB>` / `compare --last N` が metrics ごとの Δ を表にする。

## AC-5: 断罪の門が trajectory を読む
- verdict-report に `trajectory` 節 (gauge の出力) を持てる。
- score < floor (既定 60) または loopGuardTrips > 0 → **REWORK** 欠陥として名指し。
- produces:'artifact' の report に trajectory が **無い** → REWORK (tests 不在と同格)。
  counsel/document は免除。既存 fixture は全て更新する (門が過去の自作を落とすのは門が本物の証拠)。

## AC-6: prove — 門をわざと壊して鳴らす (第21条)
- 荒れた run (rework 多発・loop-guard 発動) を仕込み、gauge がそれを健全な run より
  低い点で名指しすること / 空 run の拒否 / verdict の trajectory 欠陥発火、を回帰テストで固定。

## AC-7: 憲法 + 文書 + census
- 憲法に第38条「改善は数値で証明する」を追記。
- CLAUDE.md / README の engine 表・門一覧を更新し `census.js check` 緑。
