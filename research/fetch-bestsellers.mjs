#!/usr/bin/env node
// Fetch Amazon Japan bestsellers from a category page and emit candidate products.
//   node research/fetch-bestsellers.mjs [url]
//
// Output:
//   research/data/bestsellers-YYYYMMDD.json   — snapshot of this fetch
//   research/data/candidates.json             — symlink-like latest, consumed by product-picker
//
// Notes:
// - Uses simple HTML regex parsing. Amazon's markup is fragile — re-tune the
//   regex if structure changes (look for data-asin attributes).
// - Polite rate (1 fetch per run). If running multiple categories, sleep 10s+ between.
// - Once Amazon Associates is approved, prefer the official Product Advertising API
//   over scraping — it's free, regulated, and much more reliable.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const dataDir = path.join(root, 'research/data');
fs.mkdirSync(dataDir, { recursive: true });

const url = process.argv[2] || 'https://www.amazon.co.jp/gp/bestsellers/books/';

console.log(`[bestsellers] Fetching: ${url}`);

const html = await fetch(url, {
  headers: {
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'accept-language': 'ja,en;q=0.7',
  },
}).then(r => {
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
});

console.log(`[bestsellers] Received ${html.length} bytes, parsing...`);

const products = [];
const seen = new Set();

const blockRegex = /data-asin="([A-Z0-9]{10})"([\s\S]{0,4500}?)(?=data-asin="|<\/body>)/g;
let m;
while ((m = blockRegex.exec(html)) && products.length < 30) {
  const asin = m[1];
  if (seen.has(asin)) continue;
  seen.add(asin);

  const block = m[2];

  const titleMatch = block.match(/alt="([^"]{4,150})"/)
    || block.match(/<span[^>]*class="[^"]*p13n-sc-truncate[^"]*"[^>]*>\s*([^<]{4,150})/)
    || block.match(/aria-label="([^"]{4,150})"/);
  const priceMatch = block.match(/¥\s*<\/span>\s*<span[^>]*>([\d,]+)/)
    || block.match(/¥([\d,]+)/);
  const ratingMatch = block.match(/5つ星のうち\s*([\d.]+)/)
    || block.match(/(\d\.\d) out of 5/);
  const reviewsMatch = block.match(/>\s*([\d,]+)\s*<\/span>\s*<\/a>/);

  if (titleMatch) {
    const price = priceMatch ? parseInt(priceMatch[1].replace(/,/g, '')) : 0;
    products.push({
      asin,
      name: titleMatch[1].trim().slice(0, 80),
      price: price ? `¥${price.toLocaleString('en-US')}` : '不明',
      priceNum: price,
      rating: ratingMatch ? parseFloat(ratingMatch[1]) : null,
      reviews: reviewsMatch ? reviewsMatch[1] : null,
      reviewsNum: reviewsMatch ? parseInt(reviewsMatch[1].replace(/,/g, '')) : 0,
      url: `https://www.amazon.co.jp/dp/${asin}`,
    });
  }
}

console.log(`[bestsellers] Parsed ${products.length} candidates`);

const date = new Date().toISOString().slice(0, 10);
const snapshot = {
  url,
  fetchedAt: new Date().toISOString(),
  count: products.length,
  products,
};

const snapPath = path.join(dataDir, `bestsellers-${date}.json`);
const candPath = path.join(dataDir, 'candidates.json');
fs.writeFileSync(snapPath, JSON.stringify(snapshot, null, 2));

// Only overwrite candidates.json if we got a meaningful result.
// Otherwise keep the previous (possibly good) snapshot intact.
if (products.length >= 5) {
  fs.writeFileSync(candPath, JSON.stringify(snapshot, null, 2));
  console.log(`Saved candidates: ${path.relative(root, candPath)}`);
} else {
  console.log(`⚠ Only ${products.length} candidates parsed — keeping existing candidates.json`);
}

console.log(`\nSaved snapshot:  ${path.relative(root, snapPath)}`);
console.log(`\nTop 5 by rating × log(reviews):`);
const ranked = [...products]
  .filter(p => p.rating && p.reviewsNum)
  .map(p => ({ ...p, _score: p.rating * Math.log10(p.reviewsNum + 1) }))
  .sort((a, b) => b._score - a._score)
  .slice(0, 5);
for (const p of ranked) {
  console.log(`  ★${p.rating} × ${p.reviews}件 = ${p._score.toFixed(2)}  ${p.name.slice(0, 50)}`);
}

if (products.length < 5) {
  console.warn('\n⚠ Fewer than 5 products parsed. Amazon markup may have changed.');
  console.warn('  Check the regex in research/fetch-bestsellers.mjs and update it.');
  console.warn('  Alternative: manually populate research/data/candidates.json');
  process.exit(2);
}
