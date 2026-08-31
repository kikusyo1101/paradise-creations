# critique.md — reflect (敵対的自己批評)

対象: 楽園の機構そのもの (`critic.js review graph --self`) — 改革の道の定めに従う。

## 実行結果
- `critic.js review graph --self --lessons graph/lessons.json` → **VERDICT: clean, exit 0**
- 新しい教訓 `gauge-trajectory-over-outcome` (applies:paradise-internal) は登録済みで satisfied。

## この改修が生んだ新しい盲点 (問いに答える)

**Q: 門を足したなら、その門自身は誰が見張るのか。**

1. **秤の決定性** — 「同一入力2回→同一出力」の回帰テストが見張る。秤が揺れれば試験が切れる。
2. **秤と門の縁 (欄名)** — 手書き fixture でなく gauge 実出力を verdict に直結する契約テストが見張る。
3. **秤の式の妥当性** — 係数 (10/5/15/20) は「荒れ<健全」「暴走>差し戻し」「未完走<完走」という
   **順序の不変量**としてテストに固定した。係数の絶対値は神が変えてよい — 門は順序だけを縛る
   (「値でなく不変量を固定せよ」の教訓に従う)。
4. **残る盲点 (正直な申告)**: gauge は「相の粒度」より下 (司祭の個々のツール呼び出し) は見えない。
   run-state に刻まれる粒度が採点の解像度の上限。step-level PRM (AgentProcessBench 型) は
   将来 spawn-trace.js の証跡と結合すれば可能だが、今回は射程外と宣言する。
5. **自己言及の限界 (第23条の作法)**: この改革走行自身の採点は 80/100 (verdict 相が未完のため
   未完走扱い)。**改革の道を建てた走行は、その道の完成後にしか満点を刻めない** — 台帳には
   断罪後に record し、次の reform 走行がこの数値を上回ることが第38条の最初の証明となる。
