#!/usr/bin/env node
// Generate TikTok caption + hashtags from picked products and chosen hook.
//   node agents/caption-generator.mjs <theme> [hook-id A|B|C]
//
// Writes research/data/caption.json.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { llmAvailable, llmChat, parseJson } from './lib/llm.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

const theme = process.argv[2] || '自己啓発';
const hookId = process.argv[3] || 'A';

const pickedPath = path.join(root, 'research/data/picked.json');
const hooksPath = path.join(root, 'research/data/hooks.json');

if (!fs.existsSync(pickedPath) || !fs.existsSync(hooksPath)) {
  console.error('Run product-picker and hook-generator first.');
  process.exit(1);
}

const picked = JSON.parse(fs.readFileSync(pickedPath, 'utf8'));
const hooks = JSON.parse(fs.readFileSync(hooksPath, 'utf8'));
const hook = hooks.hooks.find(h => h.id === hookId) || hooks.hooks[0];

if (!picked.products || picked.products.length === 0) {
  console.error('No products in research/data/picked.json. Run product-picker first with valid candidates.');
  console.error('Fallback: use data/products.json as candidates:');
  console.error('  cp data/products.json research/data/candidates.json');
  console.error('  node agents/product-picker.mjs ' + theme);
  process.exit(1);
}

console.log(`[caption] Theme: ${theme} / Hook: ${hook.id} 「${hook.text}」`);
const useLlm = await llmAvailable();
console.log(`[caption] Ollama: ${useLlm ? 'available' : 'unavailable → rule-based'}`);

let result;
if (useLlm) {
  result = await llmGenerate(theme, picked.products, hook);
} else {
  result = ruleBasedCaption(theme, picked.products, hook);
}

const outPath = path.join(root, 'research/data/caption.json');
fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
console.log(`\nWrote ${path.relative(root, outPath)}`);
console.log('\n--- caption ---');
console.log(result.caption);
console.log('\n--- hashtags (10) ---');
console.log(result.hashtags.join(' '));

// ─────────────────────────────────────────

async function llmGenerate(theme, products, hook) {
  const system = `TikTok 用 キャプション + ハッシュタグ生成 AI。
日本語、改行多め、絵文字 1-2 個まで。
2026-04 Amazon Associates 規約改訂対応で #PR 必須。
出力は厳密に JSON のみ。`;

  const user = `テーマ: 「${theme}」
フック: 「${hook.text}」
TOP1 商品: ${products[0].name} (${products[0].price})

以下を満たすキャプションを生成:
- 1行目: フックを反映した煽り
- 2-3行目: 商品の魅力1つ
- 4行目: "▼Amazon全部プロフリンク" の CTA
- 末尾に "#PR" 含める
- 全体 100-150文字
- ハッシュタグは別に10個。大4(自己啓発 / Amazon / 主要ジャンル) + 中3 + 小3

出力 JSON:
{
  "theme": "${theme}",
  "hook_id": "${hook.id}",
  "caption": "...本文...",
  "hashtags": ["#自己啓発", "#Amazon", ... 計10個]
}`;

  const out = await llmChat({ system, user, format: 'json', temperature: 0.8, maxTokens: 1024 });
  return parseJson(out);
}

function ruleBasedCaption(theme, products, hook) {
  const top = products[0];
  // FOMO-loaded body: 損失予告 + 希少性 + 群衆プルーフ を1キャプで重ねる
  return {
    theme,
    hook_id: hook.id,
    generatedBy: 'rule-based',
    caption: `${hook.text}\n\n気づいてる人だけ得してる👇\n1位「${top.name.slice(0, 18)}」は買い逃したら一生後悔する神品\n\n⚠️もうすぐ値上げかも。今すぐプロフから\n\n▼Amazon全部プロフリンク #PR #Amazonアソシエイト`,
    // FOMO ハッシュ強化: 損失喚起 + 希少性 + 群衆 + イベントを mix
    hashtags: [
      `#${theme}`, '#Amazon', '#TikTokmademebuyit', '#買ってよかった',
      '#今買え', '#見逃し厳禁', '#情弱卒業',
      '#神アイテム', '#コスパ最強', '#Amazonでリピ買い',
    ],
  };
}
