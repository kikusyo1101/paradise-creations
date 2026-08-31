# 楽園の創造物 — paradise-creations

[`paradise-forge`](https://github.com/kikusyo1101/paradise-forge)(楽園の engine)が
産んだ**創造物**を収める倉。engine の履歴とは寿命が違うので、住処を分けてある。

| | engine (`paradise-forge`) | 創造物 (この倉) |
|---|---|---|
| 中身 | 法・機関・門 | 願いから産まれた成果物、試作、試験の残骸 |
| 寿命 | 永く保つ | 捨てられる前提。際限なく増える |
| 審査 | PR + 護民官(CI)。マージは神のみ | 直接置いてよい。engine の CI を汚さない |
| 掟 | `main` 保護・直コミット禁止 | 自由 |

## なぜ一つの倉にまとめるのか（創造物ごとに分けない理由）

創造物ごとにリポジトリを切る案を検討し、**採らなかった**。理由は三つ。

1. **創造の総量が読めなくなる。** 楽園は自分の創造物の全てに `critic` を掛けて
   横断的に教訓を採る。倉が散れば、その一回の巡回が N 回のクローンになる。
2. **リポジトリは掃除できない単位。** 試作は捨てられるのが前提だが、
   GitHub のリポジトリを何十も消すのは手作業になる。ディレクトリなら `rm -rf` 一行。
3. **境界は「寿命」であって「作品」ではない。** 分けるべき線は engine と創造物の間に
   一本だけ引けばよく、創造物同士の間には引く理由がない。互いに依存もしない。

**分割の条件**: ある創造物が独立して公開・配布・運用され、
固有の Issue と Release を持ちはじめたら、そのときだけ切り出す(`git subtree split`)。
それまではここに置く。

## 置き方

```
<slug>/
  findings.md         調査
  requirements.md     要件
  design.md           構造
  identity.md         見た目の宣言 (憲法 第17条)
  ux.md               体験の設計 (憲法 第18条)
  index.html          創造物本体 (単一HTML・外部依存ゼロ)
  *.test.js           試験
  verdict-report.json 断罪の記録
```

engine 側からは `graph/workspace.js` が唯一の住所解決者。

```bash
node graph/workspace.js root          # この倉の道を答える
node graph/workspace.js init <slug>   # 創造物の部屋を作る
node graph/workspace.js check         # 楽園に創造物が紛れ込んでいないか検める
```

住所は `PARADISE_CREATIONS` 環境変数で上書きできる。既定は `paradise-forge` の兄弟
(`<workspace>/paradise-creations`)。

## 試験用の成果物

試験(テスト)で産んだものも、捨てるものも、ここに置く。
`_scratch/` 配下は「いつ消えてもよいもの」の置き場とする。
