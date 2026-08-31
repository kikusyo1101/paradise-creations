# design.md — gauge.js の設計

## 変える engine
| 対象 | 変更 |
|---|---|
| `graph/gauge.js` | **新設**。run-state (conclave.json / *.run.json) の決定的採点・台帳・比較 |
| `graph/verdict.js` | `report.trajectory` を読む。低スコア/loop-guard → REWORK。artifact 系で不在 → REWORK |
| `CONSTITUTION.md` | 第38条 追記 |
| `CLAUDE.md` / `README.md` | engine 表・門一覧・数の更新 (census が裁く) |
| `tests/paradise.test.js` | gauge 一式 + verdict 新規則 + 既存 fixture への trajectory 付与 |

## gauge.js の形 (他 engine と同型: CLI verbs, 依存 stdlib のみ)
```
score <run.json> [--json]     決定的採点 (再現可能)
record <run.json> --slug s    採点して台帳へ追記
baseline                      workspace 配下の全 run-state を record
compare <a> <b> | --last N    台帳から Δ 表
ledger                        台帳の一覧
```

## 採点式 (ヘッダに明文化, 全て run-state から機械的に導出)
```
score = 100
  − 10 × reworkCount        (domain-rework event)
  − 5  × retryOverhead      (Σattempts − 着手相数)
  − 15 × loopGuardTrips     (domain-loop-guard event)
  − 20 × (未完走なら1)       (全 domain ratified でない)
clamp [0,100]
```
- 三値 step 採点 (AgentProcessBench) の簡約: 前進 (+1) = 一発 done、中立 (0) = 再試行、
  有害 (−1) = rework/loop-guard、を係数化したもの。
- conclave 形式 (domains[].phases) と orchestrator 形式 (phases{}) の両方を読む。
  (orchestrator は init() が必ず history を書くため、history 不在の run-state は
  実運用で発生しない — 発生した場合 rework=0 と読むのみ。review 指摘により訂正済)

## 台帳の住所 — 第30条
`workspace.js resolve()` の root 直下 `gauge-ledger.jsonl`。走行の痕跡は creations の寿命
(artifact-repo separation)。engine repo には式だけが住み、数値は artifact 側に積もる。

## verdict.js への統合 (fail-closed の作法は既存の completeness pass に合流)
- `report.trajectory = {score, reworkCount, firstPassRate, loopGuardTrips}` (gauge score --json をそのまま)
- defects: score < TRAJ_FLOOR(60) / loopGuardTrips > 0
- completeness: produces 'artifact' で trajectory 欠落 → REWORK 「走行は測られていない — 測らなかった走行は改善を主張できない」
- reasons: score >= floor なら `trajectory ${score}/100`

## この変更で嘘になる既存の門 (第35条の点検)
- verdict の既存テスト fixture (trajectory 無しで SHIP を期待するもの) → 全て更新。
- census の claims: README/CLAUDE.md の engine 数・テスト数 → fix ループで収束させる。
- critic --self: gauge.js 自身も critic の走査対象 (graph/*.js) に自動で入る — 追加作業なし。

## 新しい盲点 (reflect への申し送り)
- 秤自身は誰が見張るか → 決定性テスト (同一入力2回 → 同一出力) + 悪化注入テストで固定。
- 台帳は追記型 JSONL — 改竄検出は git (creations repo) に委ねる。
