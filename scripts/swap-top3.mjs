#!/usr/bin/env node
// Sync top3 products (rank 1-3) from data/products.json into compositions-roots/top3-price.html.
//   node scripts/swap-top3.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

const data = JSON.parse(fs.readFileSync(path.join(root, 'data/products.json'), 'utf8'));
const compPath = path.join(root, 'compositions-roots/top3-price.html');
let html = fs.readFileSync(compPath, 'utf8');

// Top 3 by rank (smallest = best)
const top3 = [...data.products].sort((a, b) => a.rank - b.rank).slice(0, 3);

if (top3.length < 3) {
  console.error(`Only ${top3.length} products in data/products.json. Need at least 3.`);
  process.exit(1);
}

// FOMO reason rotation by rank position (1位 = most urgent)
const reasonsByRank = {
  1: ['今買わないと一生後悔', 'TikTokで爆売れ中'],
  2: ['99%は気づいてない', '気づいた人だけ得してる'],
  3: ['もうすぐ値上げかも', '今が買い時のラスト'],
};

for (const p of top3) {
  const r = p.rank;
  const rankStr = String(r).padStart(2, '0');
  const reasons = reasonsByRank[r] || ['買い逃すと損する', 'いま動け'];

  // Rank number — note class may have additional modifiers (glow-lime, etc.)
  html = html.replace(
    new RegExp(`(<div class="rank-num[^"]*" id="r${r}-num">)[^<]*(</div>)`),
    `$1${rankStr}$2`
  );
  html = html.replace(
    new RegExp(`(<div class="product-name[^"]*" id="r${r}-name">)[^<]*(</div>)`),
    `$1${escape(p.name)}$2`
  );
  html = html.replace(
    new RegExp(`(<div class="price-big[^"]*" id="r${r}-price">)[^<]*(</div>)`),
    `$1${escape(p.price)}$2`
  );
  html = html.replace(
    new RegExp(`(<div class="price-rating[^"]*" id="r${r}-rating">)[^<]*(</div>)`),
    `$1★${p.rating}$2`
  );
  // Reason 1 (FOMO line A)
  html = html.replace(
    new RegExp(`(<div class="reason-text" id="r${r}-reason1">)[^<]*(</div>)`),
    `$1${escape(reasons[0])}$2`
  );
  // Reason 2 (FOMO line B)
  html = html.replace(
    new RegExp(`(<div class="reason-text" id="r${r}-reason2">)[^<]*(</div>)`),
    `$1${escape(reasons[1])}$2`
  );
  // Image (alt + src) — composition lives in subdir, so use ../assets
  const imgPath = p.image.startsWith('assets/') ? `../${p.image}` : p.image;
  html = html.replace(
    new RegExp(`(<div class="product-image-wrap" id="r${r}-img">[\\s\\S]*?<img src=")[^"]*("[^>]*alt=")[^"]*("[^>]*/?>[\\s\\S]*?</div>)`),
    `$1${imgPath}$2${escape(p.name)}$3`
  );
}

// Derive the hook price cap from the actual top3 max price (rounded up to ¥1,000)
const cap = ceilTo(Math.max(...top3.map(p => priceNum(p.price))), 1000);
if (cap > 0) {
  const capStr = `¥${cap.toLocaleString('en-US')}`;
  html = html.replace(
    /(<div class="hook-price-big[^"]*" id="hook-price">)[^<]*(<\/div>)/,
    `$1${capStr}$2`
  );
}

fs.writeFileSync(compPath, html);
console.log(`Synced top3 to ${path.relative(root, compPath)}`);
console.log(`  Hook price cap: ¥${cap}`);
for (const p of top3) {
  console.log(`  ${p.rank}位: ${p.name.slice(0, 30)} (${p.price}, ★${p.rating})`);
}
console.log(`\nNext: bash scripts/generate-top3-tts.sh (if narration needs updating)`);
console.log(`Then: npx hyperframes render --composition compositions-roots/top3-price.html --output output/top3-$(date +%Y%m%d).mp4`);

function priceNum(s) {
  return parseInt(String(s).replace(/[^0-9]/g, '')) || 0;
}
function ceilTo(n, step) {
  return Math.ceil(n / step) * step;
}
function escape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
