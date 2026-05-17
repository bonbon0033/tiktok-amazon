#!/usr/bin/env node
// Build the final "ready-to-post" package as a single markdown.
// Combines: product list (with tag URLs), captions (3 platforms), hashtags,
// Bio, hook variants, regulatory checks, and a Yu-side TODO list.
//
//   node agents/build-post-package.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

const products = JSON.parse(fs.readFileSync(path.join(root, 'data/products.json'), 'utf8'));
const captionData = readJsonIfExists(path.join(root, 'research/data/caption.json'));
const hooksData = readJsonIfExists(path.join(root, 'research/data/hooks.json'));

if (!captionData || !hooksData) {
  console.error('Missing research/data/caption.json or hooks.json.');
  console.error('Run: bash scripts/weekly-pipeline.sh <theme> <bestseller-url>');
  process.exit(1);
}

function readJsonIfExists(p) {
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
}

const theme = captionData.theme || 'コンテンツ';
const date = new Date().toISOString().slice(0, 10);
const tag = products.associatesTag;
const isTagPlaceholder = tag.startsWith('REPLACE');

const outDir = path.join(root, 'output');
const mp4s = fs.existsSync(outDir)
  ? fs.readdirSync(outDir).filter(f => f.endsWith('.mp4')).sort((a, b) => {
      const sa = fs.statSync(path.join(outDir, a)).mtimeMs;
      const sb = fs.statSync(path.join(outDir, b)).mtimeMs;
      return sb - sa;
    })
  : [];
const latestVideo = mp4s.length ? mp4s[0] : '(no mp4 yet)';

const sorted = [...products.products].sort((a, b) => a.rank - b.rank);

const amazonUrl = (asin) => `https://www.amazon.co.jp/dp/${asin}?tag=${tag}`;

// Identify TikTok-ready vs narration-baked variants
const tiktokVersions = mp4s.filter(f => f.includes('tiktok'));
const bakedVersions  = mp4s.filter(f => !f.includes('tiktok'));
const latestTikTok   = tiktokVersions[0] || null;
const latestBaked    = bakedVersions[0] || latestVideo;

const md = `# 本番投稿パッケージ — ${date}

**TikTok 投稿用** (ナレなし → トレンド音源後乗せ): \`output/${latestTikTok || '(未生成 — bash scripts/render-for-tiktok.sh で生成)'}\`
**YT Shorts / IG Reels 用** (ナレ焼込み): \`output/${latestBaked}\`
**テーマ**: ${theme}
**Linktree (ローカル)**: \`linktree/output.html\` — ブラウザで開いて UI 確認

${isTagPlaceholder ? `> ⚠ **Associates タグが未設定**: \`data/products.json\` の \`"associatesTag"\` を本物の ID (例: \`yourid-22\`) に書き換えて \`node scripts/build-linktree.mjs\` を再実行してください。下記 URL は \`REPLACE-WITH-YOUR-TAG-22\` 入りプレースホルダーです。\n` : ''}

---

## 📦 1. アフィリエイト対象商品 (TOP ${sorted.length})

${sorted.map(p => `### ${p.rank}位: ${p.name}

- **価格**: ${p.price}
- **評価**: ★${p.rating} / **レビュー**: ${p.reviews}件
- **タグライン (動画内表示)**: 「${p.tagline}」
- **ASIN**: \`${p.asin}\`
- **アクセント色**: \`${p.accent}\`
- **アフィリエイトリンク**:

  \`\`\`
  ${amazonUrl(p.asin)}
  \`\`\`

  Amazon SiteStripe で短縮: \`amzn.to/<6文字ID>\` (任意)`).join('\n\n')}

---

## 📝 2. キャプション (3プラットフォーム別)

### A. TikTok 用 (煽り短め)

\`\`\`
${captionData.caption}
\`\`\`

### B. YouTube Shorts 用 (SEO + 概要欄リンク)

\`\`\`
タイトル: Amazonで爆売れ${theme}TOP5｜知らないと損 #shorts

説明欄:
${captionData.caption}

▼商品リンク
${sorted.map(p => `${p.rank}位 ${p.name.slice(0, 32)}\n→ ${amazonUrl(p.asin)}`).join('\n')}

#shorts ${captionData.hashtags.slice(0, 4).join(' ')}

※当チャンネルは Amazon アソシエイト・プログラム参加者です
\`\`\`

### C. Instagram Reels 用 (絵文字寄り)

\`\`\`
${captionData.caption.replace(/▼/g, '🔗')}

${captionData.hashtags.slice(0, 7).join(' ')}
\`\`\`

---

## 🏷 3. ハッシュタグ (TikTok 標準 10個)

\`\`\`
${captionData.hashtags.join(' ')}
\`\`\`

| 種別 | 個数 | タグ |
|---|---|---|
| 大 (流入) | 4 | ${captionData.hashtags.slice(0, 4).join(' ')} |
| 中 (絞込) | 3 | ${captionData.hashtags.slice(4, 7).join(' ')} |
| 小 (CVR) | 3 | ${captionData.hashtags.slice(7, 10).join(' ')} |

---

## 👤 4. プロフィール Bio

**設定文** (TikTok / IG 共通):

\`\`\`
${theme}で人生変えた｜Amazon厳選まとめ↓
新作 月・木 21時投稿
\`\`\`

**Bio リンク欄**:

\`\`\`
https://<your-github-handle>.github.io/<repo-name>/
\`\`\`

→ GitHub Pages の URL が決まったら、TikTok アプリの「プロフィール編集 → Web サイト」欄に貼る。

---

## 🔥 5. フック A/B テスト候補

採用中: **${hooksData.hooks[0].id}** 「${hooksData.hooks[0].text}」(動画 + キャプ 1行目)

| ID | 公式 | テキスト | 状態 |
|---|---|---|---|
${hooksData.hooks.map((h, i) => `| ${h.id} | ${h.formula_id} | 「${h.text}」 | ${i === 0 ? '✅ 採用' : '予備'} |`).join('\n')}

→ 動画はそのまま投稿し、**キャプ 1行目だけ** 予備フックに差し替えて翌週投稿すれば、フック比較が可能。

---

## ✅ 6. 規約・コンプラチェック

- [x] **動画内 PR バッジ**: \`#pr-badge\` で30秒間常時表示
- [x] **キャプ PR 表記**: 末尾に \`#PR\` 含む
- [x] **Amazon アソシエイト明示**: \`linktree/template.html\` フッターに法定文言
- [x] **商標回避**: Amazon ロゴ・カラー未使用
- [x] **景表法対応**: 「絶対」「100%」等の断定なし
- [x] **薬機法・健康効果暗示**: 該当商品なし
- [ ] **登録 URL**: TikTok URL を Amazon Associates 管理画面に **登録必須** ← Yu 作業
- [ ] **TikTok ブランドコンテンツ開示**: 投稿時にスイッチ ON ← Yu 作業

---

## 🚀 7. 本番化チェックリスト (Yu's TODO)

| # | アクション | 場所 | 状態 |
|---|---|---|---|
| 1 | Amazon Associates 仮登録 (5分) | https://affiliate.amazon.co.jp/ | ⬜ |
| 2 | 取得した ID を反映 | \`data/products.json\` の \`"associatesTag"\` | ⬜ |
| 3 | \`node scripts/build-linktree.mjs\` で再生成 | ターミナル | ⬜ |
| 4 | TikTok アカウント作成 (ビジネス切替) | TikTok アプリ | ⬜ |
| 5 | GitHub リポジトリ作成 (public) | GitHub | ⬜ |
| 6 | プロジェクトを push | \`git init && git push\` | ⬜ |
| 7 | GitHub Pages 有効化 (Source: GitHub Actions) | Settings → Pages | ⬜ |
| 8 | デプロイ URL を TikTok Bio に貼る | TikTok プロフィール編集 | ⬜ |
| 9 | TikTok URL を Amazon Associates に登録 | アソシエイト管理 | ⬜ |
| 10 | 動画 \`output/${latestVideo}\` をスマホに転送 | AirDrop/Drive/Dropbox | ⬜ |
| 11 | TikTok に投稿 (上記キャプ + ハッシュ) | TikTok アプリ | ⬜ |
| 12 | 投稿直後に自分で 1コメント → ピン留め | TikTok | ⬜ |
| 13 | 1時間後にアナリティクス確認 | TikTok 分析 | ⬜ |

---

## 🎵 8. TikTok 音源と投稿フロー

**動画にナレは焼かない** → TikTok アプリで **トレンド音源を後乗せ** がアルゴリズム的に最強。
本パイプラインは 2バージョン render する設計:

| 用途 | mp4 | 音 |
|---|---|---|
| TikTok | \`${latestTikTok || '(bash scripts/render-for-tiktok.sh で生成)'}\` | アプリ内でトレンド音源を後乗せ |
| YT Shorts / IG Reels | \`${latestBaked}\` | Edge TTS ナレ焼込み済み |

### TikTok トレンド音源の探し方
- [TikTok クリエイティブセンター](https://www.tiktok.com/business/creativecenter/inspiration/popular/music/jp) の「人気上昇中の楽曲」
- For You を 30分流して「3回以上聴いた楽曲」が旬
- 詳細: \`docs/tiktok-publishing.md\`

### 投稿前にスマホ転送パッケージ生成

\`\`\`bash
bash scripts/render-for-tiktok.sh compositions-roots/top3-price.html   # ナレなし版を作る
node agents/prepare-for-mobile.mjs                                      # output/mobile-ready/ に投稿セット
\`\`\`

\`output/mobile-ready/\` に以下が出る:
- \`video.mp4\` — 投稿動画
- \`caption.txt\` — キャプション (コピペ用)
- \`hashtags.txt\` — ハッシュタグ
- \`sound-suggestions.txt\` — TikTok 音源検索ヒント
- \`checklist.txt\` — 10ステップ投稿手順

Drive / iCloud / AirDrop でスマホへ転送 → TikTok アプリで貼付け投稿。

### 完全自動投稿 (将来)

フォロワー 1,000 突破後、[TikTok Content Posting API](https://developers.tiktok.com/) 申請可能。承認されればサーバから直接投稿できる。詳細は \`docs/tiktok-publishing.md\` セクション 5。

## 🔁 9. 翌週ループ (毎週月曜朝)

\`\`\`bash
cd ~/projects/tiktok-amazon
ollama serve &
bash scripts/weekly-pipeline.sh ${theme} <別カテゴリ URL>
cat output/weekly-brief-*.md
node agents/apply-picked.mjs
node scripts/swap-products.mjs                                       # ランキング型に反映
node scripts/swap-top3.mjs                                           # TOP3 型に反映
node scripts/swap-slideshow.mjs                                      # スライド型に反映
bash scripts/generate-top3-tts.sh                                    # (ナレ版用、TTS差し替え時のみ)
bash scripts/render-for-tiktok.sh compositions-roots/top3-price.html # TikTok 用ナレなし版
node agents/prepare-for-mobile.mjs                                   # スマホ転送セット
node agents/build-post-package.mjs                                   # このファイル上書き
\`\`\`

---

## 📂 関連ファイル一覧

- 動画: \`output/${latestVideo}\` ${mp4s.slice(1, 5).map(f => `\n- ` + `\`output/${f}\``).join('')}
- ブリーフ: \`output/weekly-brief-${date}.md\`
- Linktree HTML: \`linktree/output.html\`
- 商品 JSON: \`data/products.json\`
- ピック詳細: \`research/data/picked.json\`
- フック詳細: \`research/data/hooks.json\`
- キャプ詳細: \`research/data/caption.json\`
`;

const outPath = path.join(root, `output/post-package-${date}.md`);
fs.writeFileSync(outPath, md);

console.log(`✓ Wrote ${path.relative(root, outPath)}`);
console.log(`  Theme: ${theme}`);
console.log(`  Products: ${sorted.length}`);
console.log(`  Latest video: ${latestVideo}`);
if (isTagPlaceholder) {
  console.log(`\n⚠ Associates tag is still placeholder. URLs use REPLACE-WITH-YOUR-TAG-22.`);
}
console.log(`\nReview: cat ${path.relative(root, outPath)}`);
