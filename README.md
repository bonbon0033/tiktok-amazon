# TikTok × Amazon Associates 量産パイプライン

縦動画 1080×1920 / 30秒 を **週2本（ランキング型＋ストーリー型）** 回すための最小ループ。**完全無料設計**。

```
                ┌→ index.html       (ランキング型) ─┐
data/products.json                                   ├→ MP4
                └→ story-mode/index.html  (ストーリー型) ─┘
                ↘  linktree/output.html → GitHub Pages → Bio リンク
```

## ドキュメント（リサーチ + 運用）

**リサーチ層**（エージェントがナレッジベースとして参照）:
- [docs/tiktok-viral-patterns.md](docs/tiktok-viral-patterns.md) — 完走率/アルゴリズム + 6つのバズパターン
- [docs/affiliate-demand-map.md](docs/affiliate-demand-map.md) — 紹介料率 × 需要 × 動画適性マトリクス
- [docs/hook-formulas.md](docs/hook-formulas.md) — 冒頭3秒フック公式集（F01-F15）

**運用層**:
- [docs/roadmap.md](docs/roadmap.md) — Week 1-12 段階別 KPI と必須タスク
- [docs/content-calendar.md](docs/content-calendar.md) — 12週24本のテーマと商品候補
- [docs/cross-platform.md](docs/cross-platform.md) — YouTube Shorts / Instagram Reels 同時投稿戦略
- [docs/bgm-setup.md](docs/bgm-setup.md) — 無料 BGM の取得と統合
- [posting-kit.md](posting-kit.md) — キャプション・ハッシュタグ・PR表記

## 自律フロー（週次オーケストレーション）

```
research/   ─→  agents/   ─→  data/products.json  ─→  動画  ─→  投稿
   ↑             (Ollama llama3.1 or fallback)                    │
   └─── アナリティクス（Amazon Associates レポート、手動）  ←─────┘
```

### 1コマンドで戦略ブリーフ生成

```bash
# 月曜朝にこれだけ
bash scripts/weekly-pipeline.sh 自己啓発 https://www.amazon.co.jp/gp/bestsellers/books/
#                                ^テーマ     ^カテゴリ URL（省略可）

# → output/weekly-brief-YYYYMMDD.md が出る
# → 5商品ピック + フック3案 + キャプ + ハッシュ全部含まれる
```

### パイプライン構成

| ステップ | 実装 | 出力 |
|---|---|---|
| 1. データ取得 | `research/fetch-bestsellers.mjs` | `research/data/candidates.json` |
| 2. トレンド取得 | `research/fetch-trends.py` (pytrends) | `research/data/trends-YYYYMMDD.json` |
| 3. 商品ピック | `agents/product-picker.mjs` | `research/data/picked.json` |
| 4. フック生成 | `agents/hook-generator.mjs` | `research/data/hooks.json` |
| 5. キャプ生成 | `agents/caption-generator.mjs` | `research/data/caption.json` |
| 6. ブリーフ統合 | `agents/strategy-brief.mjs` | `output/weekly-brief-*.md` |
| 7. KPI ログ（投稿後） | `scripts/log-post.mjs` | `data/performance.json` |
| 8. 競合トラッキング | `scripts/track-competitor.mjs` | `data/competitors.json` |
| 9. 戦略学習（週末） | `agents/learn.mjs` | `data/strategy.json` + benchmark |

### LLM の使い分け

- **Ollama (llama3.1:8b) ローカル** が動いてれば、ピック/フック/キャプを Ollama が生成
- 動いてなければ**ルールベース fallback**（自前のスコアリング式）が動く → 完全停止しない
- 環境変数で切替可: `OLLAMA_URL` / `OLLAMA_MODEL`
- Ollama のインストール: `powershell -ExecutionPolicy Bypass -File scripts/setup-ollama.ps1`

### ブリーフを動画に反映

```bash
# ブリーフを確認
cat output/weekly-brief-$(date +%Y-%m-%d).md

# 1コマンドで products.json に反映 + index.html 同期
node agents/apply-picked.mjs
node scripts/swap-products.mjs

# フック変えるなら scripts/generate-tts.sh の hook セリフを書き換えてから:
bash scripts/generate-tts.sh

# レンダー（既存の手順）
bash scripts/new-video.sh week-$(date +%Y%m%d)
```

### 競合トラッキング（@isekai_no_eichi 型のリファレンス投稿を追う）

参考にしたい他人の TikTok を `data/competitors.json` に蓄積、niche 別の中央値ベンチマークを `learn.mjs` が出す。自分の投稿と比較して「save率が競合の半分」「再生数 5x の差」みたいな差分推奨を生成。

```bash
# 動画 (yt-dlp で 5秒で取れる)
node scripts/track-competitor.mjs https://www.tiktok.com/@xxx/video/123 movie "20分映画系"

# 写真 (スライドショー、Playwright で TikTok ログイン必要)
# 初回: ブラウザが開くので TikTok にログイン → 閉じる
node scripts/scrape-tiktok-photo.mjs https://www.tiktok.com/@xxx/photo/123 --login
# 以後はヘッドレスで取れる
node scripts/track-competitor.mjs https://www.tiktok.com/@xxx/photo/123 philosophy "宇宙系スライド"

# benchmark を含む strategy 再計算
node agents/learn.mjs
```

`learn.mjs` の出力例:
```
Competitor benchmark (5 tracked):
  movie       n=2  medianViews=850,000  medianSave%=0.23  topBgm="original sound"
  philosophy  n=3  medianViews=180,000  medianSave%=2.10  topBgm="cosmic ambient"

Recommendations:
  • save率: 自分 0.31% vs 競合中央値 1.20% → 4x の差。「保存させる理由」(リスト・まとめ・チェックリスト) を増やす
  • 競合の過半数が "original sound" を採用 → トレンド音源より自前ナレ + BGM で差別化可能
```

同じ URL を再 track すると `history[]` に時系列で積まれる → 競合の伸びをグラフ化可能。

### 哲学/宇宙/雑学スライド型（3本目のフォーマット）

@isekai_no_eichi 系の **ダークコスモス背景 + 大きな衝撃ファクト + 名言 + 本紹介** スライドを `philosophy-slide/` として独立 composition 化。週1本 (例: 日曜) で投入する想定。

```bash
# 1コマンドで book 自動ローテーション → 動画
bash scripts/philosophy-weekly.sh
# → data/philosophy-products.json の candidates[] からISO週番号で1冊選択
# → philosophy-slide/index.html の book-title を差し替え
# → 哲学ナレを Edge TTS で再生成 (Keita 男性低音)
# → MP4 レンダー → output/philosophy-YYYYMMDD.mp4
```

10スライド × ~5秒 = 約50秒のスロー didactic 型動画。テーマは cosmos / philosophy / self-help / wisdom の 4カテゴリで rotation。本は哲学・宇宙関連 8冊が `data/philosophy-products.json` に入ってる。

| 構成要素 | 場所 |
|---|---|
| 30秒・10スライドの composition | `philosophy-slide/index.html` |
| 推薦本のリスト (8冊) | `data/philosophy-products.json` |
| ナレ TTS スクリプト | `scripts/generate-philosophy-tts.sh` |
| 本差し替え | `scripts/swap-philosophy.mjs` |
| 週次パイプライン | `scripts/philosophy-weekly.sh` |

### 学習ループ（投稿後 → 来週の戦略へ自動反映）

投稿しっぱなしにせず、KPI を `data/performance.json` に毎週ログ → `agents/learn.mjs` が hook formula / カテゴリ / 動画タイプ別にスコア計算 → `data/strategy.json` を更新 → 次回の `product-picker` と `hook-generator` がそれを参照して **勝ち筋に bias** する仕組み。

```bash
# 投稿 48-72h 後（TikTok アナリティクス + Amazon Associates レポートを見ながら）
node scripts/log-post.mjs week-20260520-rank tiktok ranking 自己啓発 books A F06 "今買わないと一生後悔" \
  --views=8000 --likes=210 --saves=42 --shares=8 --comments=6 \
  --clicks=11 --purchases=1 --revenue=240 --asins=B0XXX,B0YYY

# 週末に retro（次週の戦略を更新）
bash scripts/weekly-retro.sh
# → data/strategy.json 更新
# → 次回 weekly-pipeline が勝った formula / カテゴリを優先する
```

| ステップ | スクリプト | 出力 |
|---|---|---|
| 投稿 KPI 記録 | `node scripts/log-post.mjs ...` | `data/performance.json` に append |
| 戦略再計算 | `bash scripts/weekly-retro.sh` | `data/strategy.json` 更新 |
| 来週の picker/hooks | 自動で `strategy.json` 読み込み | 勝ち筋カテゴリ +50% boost / 勝ち formula を A 配置 |

**学習されるもの**:
- **hook formula score**: save% × ctr% × cvr% × log10(revenue) で formula F01-F15 をランク
- **category score**: 売上 / CTR が高いカテゴリ（例: books, beauty）を picker でブースト
- **video type**: ranking vs story どちらが伸びるか → 投入比率の推奨
- **死に formula**: save%<0.5% が 2本以上続いた formula は当面除外推奨

### Amazon ベストセラーカテゴリ URL（よく使う）

- 自己啓発本: `https://www.amazon.co.jp/gp/bestsellers/books/466302/`
- ビジネス: `https://www.amazon.co.jp/gp/bestsellers/books/466298/`
- 文房具: `https://www.amazon.co.jp/gp/bestsellers/officeproduct/`
- 家電（ガジェット）: `https://www.amazon.co.jp/gp/bestsellers/electronics/`
- 食品＆飲料: `https://www.amazon.co.jp/gp/bestsellers/food-beverage/`
- ヘルス＆ビューティー: `https://www.amazon.co.jp/gp/bestsellers/hpc/`

→ 週ごとにテーマと URL をペアで叩けば、自動で 5商品ピック + フック + キャプが揃う。

## セットアップ（1回だけ）

```bash
# 1. 依存ツール（ホストOSに）
#    - node (already on system)
#    - python3 + edge-tts: `pip install edge-tts`
#    - ffmpeg (already)
# 2. Amazon Associates タグを入れる
#    data/products.json の "associatesTag" を本物の ID に
# 3. ハンドル名を入れる
#    HANDLE='@your_handle' で linktree 出力時に渡す
```

## 量産ループ（1週分 = 2本 = ~1時間）

### A. ランキング型（月曜）

```bash
# 1. 今週の5商品を data/products.json に書き込む
# 2. JSON → HTML 同期
node scripts/swap-products.mjs
# 3. ナレ変えるなら再生成
bash scripts/generate-tts.sh
# 4. レンダー + Linktree 再生成
HANDLE='@your_handle' bash scripts/new-video.sh

# → output/tiktok-YYYYMMDD.mp4 ができる
# → linktree/output.html も更新される
```

### B. ストーリー型（木曜）

```bash
# 1. scripts/generate-story-tts.sh のセリフを今週のテーマに書き換える
# 2. ストーリー用 TTS 再生成
bash scripts/generate-story-tts.sh
# 3. story-mode/index.html の Before/After 数字・商品名・商品画像を編集
# 4. レンダー
npx hyperframes render --composition story-mode/index.html --output output/story-$(date +%Y%m%d).mp4
```

## ファイル構造

```
tiktok-amazon/
├── DESIGN.md                       # ビジュアル方針（色・フォント）
├── README.md                       # このファイル
├── posting-kit.md                  # 投稿時のキャプ/ハッシュタグ/規約
├── index.html                      # メインコンポジション (30秒)
├── meta.json / hyperframes.json    # HyperFrames 設定
├── package.json                    # npm scripts (dev/check/render)
├── data/
│   ├── products.json               # 5商品データ（毎週ここを更新）
│   ├── philosophy-products.json    # 哲学/宇宙系の本候補
│   ├── performance.json            # 投稿 KPI ログ（log-post.mjs で追記）
│   ├── competitors.json            # 競合動画 metrics（track-competitor.mjs で追記）
│   └── strategy.json               # 学習済み重み + competitor benchmark
├── philosophy-slide/
│   └── index.html                  # 哲学/宇宙スライド composition (10スライド/50秒)
├── agents/
│   ├── product-picker.mjs          # 5商品ピック（strategy で bias）
│   ├── hook-generator.mjs          # フック 3案（strategy で並び替え）
│   ├── caption-generator.mjs       # キャプ + ハッシュ生成
│   ├── strategy-brief.mjs          # 週次ブリーフ統合
│   ├── apply-picked.mjs            # picked → products.json
│   └── learn.mjs                   # performance → strategy
├── research/
│   ├── fetch-bestsellers.mjs       # Amazon ベストセラー取得
│   └── fetch-trends.py             # Google Trends 取得 (pytrends)
├── assets/
│   ├── products/product-{1-5}.svg  # 商品画像（差し替え可能）
│   └── audio/parts/*.mp3           # シーン別 TTS ナレ
├── linktree/
│   ├── template.html               # Linktree HTML テンプレ
│   └── output.html                 # 生成物 (build-linktree.mjs で生成)
├── scripts/
│   ├── new-video.sh                # 1本作るオーケストレーター
│   ├── weekly-pipeline.sh          # ランキング/ストーリー型の週次パイプライン
│   ├── philosophy-weekly.sh        # 哲学/宇宙型の週次パイプライン
│   ├── weekly-retro.sh             # 週末の戦略 retro
│   ├── log-post.mjs                # 自分の投稿 KPI 記録
│   ├── track-competitor.mjs        # 競合 TikTok を tracking (video → yt-dlp)
│   ├── scrape-tiktok-photo.mjs     # 競合 photo post を Playwright で scrape
│   ├── setup-ollama.ps1            # Ollama + llama3.1:8b セットアップ (任意)
│   ├── generate-tts.sh             # TTS 再生成（ランキング型）
│   ├── generate-philosophy-tts.sh  # TTS 再生成（哲学型、Keita 低音）
│   ├── swap-products.mjs           # JSON → HTML 同期（ランキング型）
│   ├── swap-philosophy.mjs         # JSON → HTML 同期（哲学型）
│   └── build-linktree.mjs          # Linktree 生成
└── output/                         # MP4 出力先
```

## カスタマイズ

### ナレーション声を変える
`scripts/generate-tts.sh` の `VOICE` を変更:
- `ja-JP-NanamiNeural` — 女性、明るい、デフォルト
- `ja-JP-KeitaNeural` — 男性
- 環境変数で上書き: `HF_VOICE=ja-JP-KeitaNeural bash scripts/generate-tts.sh`

### テンポを変える
`HF_RATE='+20%' bash scripts/generate-tts.sh` で早口に。

### デザインを変える
`DESIGN.md` の色を編集 → `index.html` の CSS 変数を反映。

### サブコンポジション化（任意）
1ファイルで管理が辛くなったら、各 scene を `compositions/scene-rank{N}.html` に分割可能。HyperFrames lint が密度警告を出してたら検討。

## アフィリエイトリンクの仕組み

`data/products.json` の `asin` (Amazon Standard Identification Number) と `associatesTag` から:
```
https://www.amazon.co.jp/dp/{asin}?tag={associatesTag}
```
を `build-linktree.mjs` が自動生成する。Linktree からのクリックは全部このタグ付き URL → Amazon の cookie に 24h 残る → 24h 以内にユーザーが Amazon で何か買えば報酬発生。

## 既知の制限

- 商品画像は SVG プレースホルダー。実画像 (.jpg) を Amazon から手動取得して差し替えるのが理想（fair use 範囲、ただし著作権リスクを完全に避けるなら ComfyUI 等で自作生成）
- BGM は未組込。TikTok 上でトレンド音源を後乗せする想定
- 商品名が長い場合は自動折り返しに任せている（`max-width: 920px`）。極端に長い場合は手動短縮を推奨

## 次の発展

- `compositions/scene-rank.html` 化してパラメータ化（rank/name/price/... を data-attr で渡す）
- ComfyUI MCP で商品ジェネリック画像を自動生成（FLUX.1 で "self-help journal, dark studio lighting" 等）
- 動画タイトル/サムネ用の 1080×1080 静止画も同時生成
- ストーリー型動画用の `compositions/story.html` を追加して2パターン運用
