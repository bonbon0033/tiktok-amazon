# Week 1-12 ロードマップ（完全無料・段階別 KPI）

ゴール: Week 12 終了時に **月10万円のアフィリ収益**＋**Amazon Influencer Program 通過** + **Storefront 運用**。

## Phase 1: 立ち上げ（Week 1-4）

**目的**: 動画 8本投稿、Amazon Associates 仮登録、Linktree 公開、フォロワー基盤作り。

### 必須タスク（順番通り）

1. **Amazon Associates 仮登録**（30分） → https://affiliate.amazon.co.jp/
   - 登録後すぐ「アソシエイトID」が発行される（例: `youraccount-22`）
   - これを `data/products.json` の `associatesTag` に書く

2. **TikTok アカウント開設**（10分）
   - ハンドル名は **akumachan と完全分離**（akumachan は gravure 専用）
   - 候補: `@selfimprove_jp` `@bookbest_jp` など、ジャンルが伝わる名前
   - プロフィール: `posting-kit.md` の Bio テンプレを使う
   - 「ビジネスアカウント」に切替（アナリティクス・Bio リンク機能のため）

3. **GitHub リポジトリ作成 + Pages デプロイ**（30分）
   - GitHub で public リポジトリ作成（例: `selfimprove-linktree`）
   - `tiktok-amazon` フォルダの中身を push
   - Settings → Pages → Source: GitHub Actions に設定
   - `.github/workflows/deploy.yml` が走って `https://uyu0033.github.io/selfimprove-linktree/` で公開
   - この URL を TikTok の Bio に貼る

4. **Amazon Associates 管理画面に SNS URL 登録**
   - サイト URL: GitHub Pages の URL
   - SNS URL: TikTok プロフィール URL
   - **これをやらないと規約違反 → 契約解除リスク**

5. **Week 1-4 動画投稿（8本）**
   - 月曜 21時: ランキング型 / 木曜 21時: ストーリー型
   - 商品: `docs/content-calendar.md` 参照

### Phase 1 KPI

| 指標 | Week 4 終了時の目標 |
|---|---|
| 投稿本数 | 8本 |
| フォロワー | 300-500 |
| 累計再生数 | 5,000-20,000 |
| Amazon Associates クリック | 累計 20+ |
| 適格販売 | 0-1件 |

---

## Phase 2: 審査通過（Week 5-8）

**目的**: 180日以内に **3件の適格販売** を達成し、Amazon Associates 本承認 → Influencer Program 申請に必要な **1,000フォロワー** 突破。

### 必須タスク

1. **動画品質を上げる**
   - Week 1-4 のアナリティクスを見る（再生時間・保存率・CTR）
   - 保持率の低かったシーンを `index.html` / `story-mode/index.html` で改善
   - 例: 冒頭3秒で離脱が多い → Hook の煽りを書き換え（`scripts/generate-tts.sh` 再生成）

2. **商品選定をデータ駆動に**
   - Amazon の **本当のベストセラー画面** を毎週月曜にチェック
   - https://www.amazon.co.jp/gp/bestsellers/
   - 売れ筋を `data/products.json` に反映
   - 競合 TikTok アカウントを 5個フォローして同ジャンルの動向を見る

3. **ストーリー型の差別化**
   - ストーリー型は **1動画 = 1商品** で深掘り（ランキング型のような分散投資ではない）
   - 「私が買った理由 → 失敗 → 商品 → 結果」の起承転結

4. **PR表記の徹底**（規約改訂 2026-04-20）
   - 動画内のバッジ（✅ 実装済み）
   - キャプション冒頭に `#PR` または `Amazonアソシエイト` 明記
   - 概要欄/Bio に「アソシエイト参加者です」表記（✅ Linktree footer に実装済み）

### Phase 2 KPI

| 指標 | Week 8 終了時の目標 |
|---|---|
| 投稿本数 | 累計 16本 |
| フォロワー | 1,000+ |
| 累計再生数 | 30,000-100,000 |
| 適格販売 | **3件達成 → 本承認** |
| Amazon クリック / 動画 | 平均 30+ |

### マイルストーン: Amazon Influencer Program 申請

フォロワー 1,000 を超えたら即申請（通過後に **Storefront**＝個別 Amazon ストアページ が作れる）。
TikTok の URL を申請フォームで入れて、過去動画の質で審査される。

---

## Phase 3: スケール（Week 9-12）

**目的**: Storefront 運用、月10万円達成、横展開（YouTube Shorts / IG Reels）。

### 必須タスク

1. **Amazon Storefront 開設**（Influencer Program 通過後）
   - URL: `https://www.amazon.co.jp/shop/your-handle`
   - 商品をカテゴリ別に並べる（自己啓発、ガジェット、本、etc.）
   - Linktree の上に Storefront URL を最上位 CTA に置く
   - 動画 CTA も「プロフのストアから」に変更

2. **クロスプラットフォーム展開開始**
   - `docs/cross-platform.md` 参照
   - 同じ MP4 を YouTube Shorts / IG Reels にも投稿
   - キャプとハッシュだけ差し替え

3. **データ駆動の改善ループ**
   - 週次で Amazon Associates レポートをチェック
   - CVR 高い商品の傾向を `data/products.json` に反映
   - バズった動画のテンプレを 3-5倍出す

4. **コミュニティ化**
   - 投稿後 1時間は全コメント返信
   - 「次に紹介してほしい商品」をコメント募集 → 翌週の動画ネタに

### Phase 3 KPI

| 指標 | Week 12 終了時の目標 |
|---|---|
| 投稿本数 | 累計 24本 |
| フォロワー | 2,000-5,000 |
| 月間収益 | **¥100,000+** |
| 月間 Amazon クリック | 3,000+ |
| 月間適格販売 | 30+ 件 |

---

## 完全無料の前提（コスト 0円で進める）

| カテゴリ | 採用ツール | 月額 |
|---|---|---|
| 動画生成 | HyperFrames (npx) + ComfyUI ローカル | ¥0 |
| TTS | Microsoft Edge TTS（Python ライブラリ） | ¥0 |
| BGM | DOVA-SYNDROME / Pixabay / MusMus | ¥0 |
| LLM（補助） | Ollama (llama3.1:8b ローカル) | ¥0 |
| ホスティング | GitHub Pages（public リポ） | ¥0 |
| ドメイン | github.io サブドメインのまま | ¥0 |
| Amazon Associates | 登録無料 | ¥0 |
| TikTok / YT / IG | アカウント無料 | ¥0 |
| **合計** | | **¥0** |

将来的に有料化を検討する余地（強制ではない）:
- **独自ドメイン**: お名前.com で `.com` 約 ¥1,000/年 → Linktree ドメインをカスタマイズ
- **ComfyUI 用クラウド GPU**: ローカル RTX 5070 が遅い時のスポット利用（vast.ai 約 ¥80-120/時）
- **TikTok Pro Analytics**: 不要、無料アナリティクスで十分

---

## 失敗パターン回避（リサーチで判明）

1. **規約違反 → アカウント停止**
   - 自己購入による 3件達成は NG（バレる）
   - PR 表記なしは契約解除
   - 未登録 URL でのアフィリリンクは契約解除

2. **動画品質が低い → アルゴリズムから外れる**
   - 30秒で 5商品は詰めすぎ（テンポ重視で OK だが、Week 5 以降は 1商品深掘り型にも挑戦）
   - 商品画像が SVG プレースホルダーのままだと信頼度低い → 実画像 or ComfyUI 生成に差し替え

3. **手数料目当ての商品ばかり選ぶ → CVR 低下**
   - レビュー件数が少ない高額商品はクリックされても売れない
   - **「★4.5以上 + レビュー1,000件以上 + 5,000円以下」** を基本ルールに

4. **投稿頻度の波**
   - 週2本を 12週続けるのが最低ライン
   - 1週空けるとアルゴリズムから露骨に外される
   - 体調不良の週用に **「ストック動画」** を 2-3本作っておく

5. **ジャンル分散**
   - 「自己啓発」「美容」「ガジェット」を1アカウントでやると分散して伸びない
   - 1アカウント = 1テーマ（このプロジェクトは自己啓発 / ライフハック軸で統一）

---

## 次にやること（このプロジェクトの今すぐ）

1. ✅ プロジェクト構造完成
2. ✅ ランキング型動画レンダ済み（`output/tiktok-top5.mp4`）
3. ⬜ ストーリー型動画レンダ（`bash scripts/generate-story-tts.sh && npx hyperframes render story-mode/index.html --output output/story.mp4`）
4. ⬜ Amazon Associates 仮登録 → ID 取得 → `data/products.json` 更新
5. ⬜ TikTok アカウント開設
6. ⬜ GitHub リポジトリ作成 → push → Pages 公開
7. ⬜ Week 1 の 2動画を投稿
