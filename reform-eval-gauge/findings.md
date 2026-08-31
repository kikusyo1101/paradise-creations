# findings.md — 実測: 楽園に「改善の数値的証明機構」は存在するか

計測日: 2026-08-31 / 計測者: 教主 (全コマンドは実行し生出力を確認済み)

## 1. 欠陥の実測 (憶測ではなく数)

### 1-a. eval エンジンの探索 — **0 件**
```
grep -ril "trajectory|軌跡|step.efficiency|eval" graph/*.js
→ graph/codex.js (コメント1箇所), graph/forge.js (counsel語彙の正規表現1箇所)
```
エージェント自身の性能を測る engine は **存在しない**。18 engine 中 0。

### 1-b. verdict.js が読む数 — すべて「創造物」の数であり「走行」の数ではない
```
report.build / report.tests / report.security / report.spec / report.types / report.lint
```
断罪の門は **outcome (成果物)** のみを裁く。エージェントが「どう走ったか (trajectory)」を
読む欄は 1 つも無い。荒れた走行でも成果物が通れば SHIP される。

### 1-c. 原料は既に在る — run-state は完全な trajectory を刻んでいる
```
coin/conclave.json  : events=22  phases=11  attempts>1: なし        span 05:41
habit/conclave.json : events=40  phases=11  attempts>1: review(3), security(3), verify(2)
                      domain-rework あり                             span 1:36:46
```
event 種: convene / dispatch / done / ratify / domain-rework — ts 付き。
**採点に必要なデータは全て disk にあるのに、読む者がいない。**

### 1-d. 台帳 (baseline) — 無し
「改善した」の前後比較を可能にする記録は 0 行。過去の主張はすべて散文 (第33条の病)。

### 1-e. 現在の門はすべて緑 (改修前の基線)
```
tests/paradise.test.js : 194 passed, 0 failed
tests/guards.test.js   :  50 passed, 0 failed
tests/counsel.test.js  :  51 passed, 0 failed
census check           : ✓ / critic --self : VERDICT clean / branch-guard : ✓ (main先端)
CONSTITUTION           : 37 条
```

## 2. 2026 年の定石 (外界調査)

- **outcome だけでなく trajectory を採点するのが分水嶺** — path (tool 選択・順序・
  再試行・ループ) を採点しないと「偶然通った」荒い走行を見逃す。
  (confident-ai LLM Agent Evaluation 2026, Langfuse agent-evaluation, LangChain)
- **決定的に測れるものは決定的に測る** — step 数, ループ検出, 必須 step の有無,
  budget 遵守は code evaluator の領分。LLM judge は定性面のみ。(Langfuse)
- **step-level 三値採点** (+1 前進 / 0 中立 / -1 有害) — AgentProcessBench
  (arXiv:2603.14465)。rule-based 判定は成功率を過小報告しがち (AgentRewardBench)。
- **悪い trajectory を見つけたら性質として符号化し回帰させる** (Langfuse) —
  楽園の lessons 機構と同型。
- **metric は trace に紐づける** — 低い点は「どの走行のどの相か」まで辿れること。

## 3. 結論 (specify への引き渡し)

欠陥は 4 つ、すべて数で立証済み:
1. eval engine 0 件 (1-a)
2. verdict は trajectory を読まない (1-b)
3. 原料 (run-state) はあるのに読者がいない (1-c)
4. 台帳が無く前後比較が不可能 (1-d)

処方: run-state を決定的に採点する engine (秤) + 追記型台帳 + 前後比較コマンド。
LLM judge は既存の断罪機関 (tribunal) が既に担う — 秤は決定的計測に徹する。
