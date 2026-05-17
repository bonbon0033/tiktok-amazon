#!/usr/bin/env node
// Combine picker + hook + caption + trends outputs into a single weekly brief.
//   node agents/strategy-brief.mjs
//
// Writes output/weekly-brief-YYYYMMDD.md

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const dataDir = path.join(root, 'research/data');

function read(name) {
  const p = path.join(dataDir, name);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

const picked = read('picked.json');
const hooks = read('hooks.json');
const caption = read('caption.json');

if (!picked || !hooks || !caption) {
  console.error('Missing inputs. Run: bash scripts/weekly-pipeline.sh');
  process.exit(1);
}

const trendsFiles = fs.existsSync(dataDir)
  ? fs.readdirSync(dataDir).filter(f => f.startsWith('trends-')).sort()
  : [];
const trends = trendsFiles.length ? read(trendsFiles.at(-1)) : null;

const date = new Date().toISOString().slice(0, 10);
const theme = picked.theme || '自己啓発';

const md = `# Weekly Brief — ${date}

**テーマ**: ${theme}
**ピックエンジン**: ${picked.pickedBy || 'Ollama (llama3.1)'}
**フックエンジン**: ${hooks.generatedBy || 'Ollama (llama3.1)'}

---

## 1. ピックした5商品

${picked.products.map(p => `### ${p.rank}位: ${p.name}
- 価格: **${p.price}** / 評価: ★${p.rating} / レビュー: ${p.reviews}件
- タグライン: 「${p.tagline}」
- ASIN: \`${p.asin}\`
- アクセント色: \`${p.accent}\``).join('\n\n')}

---

## 2. フック候補（3パターン）

${hooks.hooks.map(h => `### ${h.id} (公式 ${h.formula_id})
「**${h.text}**」
→ ${h.rationale}`).join('\n\n')}

> 採用する1つを選んで、\`index.html\` の \`#hook-title\` / \`#hook-sub\` テキストを書き換え、\`scripts/generate-tts.sh\` の hook セリフも更新する。

---

## 3. キャプ + ハッシュタグ

\`\`\`
${caption.caption}
\`\`\`

\`\`\`
${caption.hashtags.join(' ')}
\`\`\`

${trends ? `---

## 4. Google Trends（直近7日 / JP）

| キーワード | 直近24h平均 | 7日ピーク | 勢い (%) |
|---|---|---|---|
${Object.entries(trends.keywords).map(([k, v]) => `| ${k} | ${v.recent_avg} | ${v.peak} | ${v.momentum}% |`).join('\n')}

→ 勢いが高いキーワードを次週のテーマ候補にする（70%超なら即採用、40%未満なら避ける）。
` : ''}
---

## 5. 次のアクション

\`\`\`bash
# A. picked.products を data/products.json に反映
node agents/apply-picked.mjs

# B. JSON → index.html に同期
node scripts/swap-products.mjs

# C. ナレーション（hook）を採用フックで再生成
#    scripts/generate-tts.sh の 01-hook.mp3 の text を編集 → 実行
bash scripts/generate-tts.sh

# D. レンダー + Linktree 再生成
bash scripts/new-video.sh week-${date.replace(/-/g, '')}

# E. キャプ・ハッシュ（上記）を TikTok 投稿時に貼る
\`\`\`
`;

const outDir = path.join(root, 'output');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, `weekly-brief-${date}.md`);
fs.writeFileSync(outPath, md);

console.log(`✓ Wrote ${path.relative(root, outPath)}`);
console.log('\nTo see the brief: cat ' + path.relative(root, outPath));
