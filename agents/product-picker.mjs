#!/usr/bin/env node
// Pick 5 products from a candidate pool, rank them, and write taglines.
//   node agents/product-picker.mjs <theme> [candidates-json-path]
//
// If Ollama is available, the LLM does ranking + tagline. Otherwise falls back
// to rule-based scoring: rating × log10(reviews+1) × (3000 / price).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { llmAvailable, llmChat, parseJson } from './lib/llm.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

const theme = process.argv[2] || '自己啓発';
const candidatesPath = process.argv[3] || path.join(root, 'research/data/candidates.json');

if (!fs.existsSync(candidatesPath)) {
  console.error(`Candidates file not found: ${candidatesPath}`);
  console.error(`Run: node research/fetch-bestsellers.mjs <amazon-bestseller-url>`);
  process.exit(1);
}

const candData = JSON.parse(fs.readFileSync(candidatesPath, 'utf8'));
const candidates = candData.products || candData;

// Strategy weights from learning loop (data/strategy.json, written by agents/learn.mjs).
// If absent, falls back to a neutral object — no behavior change for cold start.
const stratPath = path.join(root, 'data/strategy.json');
const strategy = fs.existsSync(stratPath)
  ? JSON.parse(fs.readFileSync(stratPath, 'utf8'))
  : { topCategories: [], byCategory: {} };

console.log(`[picker] Theme: ${theme}`);
console.log(`[picker] Candidates: ${candidates.length}`);
if (strategy.basedOn > 0) {
  console.log(`[picker] Strategy: top categories = [${strategy.topCategories.slice(0, 3).join(', ')}] (from ${strategy.basedOn} posts)`);
}

const useLlm = await llmAvailable();
console.log(`[picker] Ollama: ${useLlm ? 'available' : 'unavailable → rule-based fallback'}`);

let picked;
if (useLlm) {
  picked = await llmPick(theme, candidates, strategy);
} else {
  picked = ruleBasedPick(theme, candidates, strategy);
}

const outPath = path.join(root, 'research/data/picked.json');
fs.writeFileSync(outPath, JSON.stringify(picked, null, 2));
console.log(`\nWrote ${path.relative(root, outPath)}\n`);
for (const p of picked.products) {
  console.log(`  ${p.rank}位 [${p.price}] ★${p.rating} ${p.name}`);
  console.log(`      ${p.tagline}`);
}

// ─────────────────────────────────────────

async function llmPick(theme, candidates, strategy) {
  const stratHint = strategy.basedOn > 0
    ? `\n6. 過去実績の優先カテゴリ: [${strategy.topCategories.slice(0, 3).join(', ')}] — これに該当する候補を優先`
    : '';
  const system = `あなたは TikTok 用 Amazon アフィリ動画の商品セレクター。
日本語で出力。CVR最大化を意識し、以下を優先:
1. 価格 ¥1,000-¥10,000 の衝動買い帯
2. レビュー1,000件以上
3. 評価4.3以上
4. テーマと一致する商品
5. 動画映え（数字・画像が映える）${stratHint}
出力は厳密に JSON のみ。`;

  const candidateLines = candidates.slice(0, 25).map((c, i) =>
    `${i + 1}. [${c.asin}] ${c.name} | ${c.price} | ★${c.rating ?? '?'} / ${c.reviews ?? '?'}件`
  ).join('\n');

  const user = `テーマ: 「${theme}」
候補（Amazon ベストセラー）:
${candidateLines}

上位5商品を選び、1位（最強推し）→5位（補強）の順でランキング。各商品に煽り効いた **15文字以内のタグライン** を付ける。
出力 JSON 形式:
{
  "theme": "${theme}",
  "products": [
    {
      "rank": 1,
      "name": "商品名",
      "price": "¥X,XXX",
      "rating": 4.X,
      "reviews": "XX,XXX",
      "tagline": "煽りライン",
      "asin": "BXXXXXXXX",
      "image": "assets/products/product-1.svg",
      "accent": "#e8ff3a"
    }
    // ... 5商品
  ]
}
accent カラー候補: #e8ff3a (lime / 1位・3位), #22e0ff (cyan / 2位・5位), #ff3464 (red / 4位)`;

  const out = await llmChat({ system, user, format: 'json', temperature: 0.5, maxTokens: 2048 });
  return parseJson(out);
}

function ruleBasedPick(theme, candidates, strategy) {
  // Lightweight category inference from product name (Japanese keywords).
  const inferCategory = (name) => {
    const s = String(name).toLowerCase();
    if (/本|book|kindle|文庫|新書|単行|読書/.test(s)) return 'books';
    if (/ノート|ペン|手帳|文具|stationery|シャープ/.test(s)) return 'stationery';
    if (/アイシャドウ|リップ|化粧|スキンケア|美容|香水|beauty/.test(s)) return 'beauty';
    if (/フライパン|鍋|包丁|キッチン|食器|kitchen|タンブラー|水筒/.test(s)) return 'kitchen';
    if (/シャツ|パンツ|スカート|ジャケット|fashion|靴|バッグ|腕時計/.test(s)) return 'fashion';
    if (/イヤホン|スピーカー|充電|モニター|ガジェット|gadget|タイマー|加湿器|ライト/.test(s)) return 'gadgets';
    return 'misc';
  };

  // Category boost from learned strategy (1.0 = neutral, up to 1.5 for top performer).
  const categoryBoost = (cat) => {
    const s = strategy.byCategory?.[cat];
    if (!s || strategy.basedOn === 0) return 1.0;
    const topScore = Math.max(...Object.values(strategy.byCategory).map(x => x.score), 0.001);
    return 1 + 0.5 * (s.score / topScore);
  };

  const scored = candidates
    .filter(c => c.name && c.name.length > 4)
    .map(c => {
      const price = c.priceNum && c.priceNum > 0 ? Math.min(c.priceNum, 30000) : 2500;
      const rating = c.rating ?? 4.3;
      const reviewsNum = c.reviewsNum ?? 200;
      const cat = inferCategory(c.name);
      return {
        ...c,
        _category: cat,
        _score: rating * Math.log10(reviewsNum + 1) * (3000 / price) * categoryBoost(cat),
      };
    })
    .sort((a, b) => b._score - a._score)
    .slice(0, 5);

  const accentMap = ['#e8ff3a', '#22e0ff', '#e8ff3a', '#ff3464', '#22e0ff'];

  // FOMO-loaded taglines per docs/hook-formulas.md F06-F10.
  // 各 rank に「損失 / 希少 / 値上げ / 群衆 / 後悔」を割当て、FOMO 要素を重ねる。
  const taglineRotation = [
    '今買わないと一生後悔',           // 1位: 損失予告 (F06)
    '99%は気づいてない神品',          // 2位: 希少性 (F07)
    'もうすぐ値上げかも',             // 3位: 値上げ煽り (F08)
    'TikTokで9割が買ってる',          // 4位: 群衆プルーフ (F09)
    '気づいた人だけ得してる',         // 5位: 希少性 (F07)
  ];

  return {
    theme,
    pickedBy: strategy.basedOn > 0
      ? `rule-based (boosted by ${strategy.basedOn}-post strategy)`
      : 'rule-based (no LLM, cold-start)',
    products: scored.map((c, i) => ({
      rank: i + 1,
      name: decodeEntities(c.name).slice(0, 40),
      price: c.price && c.price !== '不明' ? c.price : `¥${(1500 + i * 800).toLocaleString('en-US')}`,
      rating: c.rating || 4.5,
      reviews: c.reviews || '1,000+',
      tagline: taglineRotation[i % taglineRotation.length],
      asin: c.asin || 'B0PLACEHOLDER',
      category: c._category,
      image: `assets/products/product-${i + 1}.svg`,
      accent: accentMap[i],
    })),
  };
}

function decodeEntities(s) {
  return String(s)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
