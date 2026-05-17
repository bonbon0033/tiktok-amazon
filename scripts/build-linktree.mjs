#!/usr/bin/env node
// Build linktree/output.html from linktree/template.html + data/products.json
//   node scripts/build-linktree.mjs
// Override handle via env: HANDLE='@your_handle' node scripts/build-linktree.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

const products = JSON.parse(fs.readFileSync(path.join(root, 'data/products.json'), 'utf8'));
const template = fs.readFileSync(path.join(root, 'linktree/template.html'), 'utf8');

const handle = process.env.HANDLE || '@your_handle';
const tag = products.associatesTag || 'REPLACE-WITH-YOUR-TAG-22';

function amazonUrl(asin) {
  return `https://www.amazon.co.jp/dp/${asin}?tag=${tag}`;
}

const sorted = [...products.products].sort((a, b) => a.rank - b.rank);

const productsHtml = sorted.map((p) => {
  const url = amazonUrl(p.asin);
  return `<a class="product" href="${url}" target="_blank" rel="nofollow noopener sponsored">
      <div class="rank">${String(p.rank).padStart(2, '0')}</div>
      <div class="info">
        <div class="name">${p.name}</div>
        <div class="meta">
          <span class="price">${p.price}</span>
          <span class="star">★${p.rating}</span>
          <span>${p.reviews}件</span>
        </div>
      </div>
      <div class="arrow">→</div>
    </a>`;
}).join('\n    ');

const out = template
  .replaceAll('{{HANDLE}}', handle)
  .replace('{{PRODUCTS}}', productsHtml);

const outPath = path.join(root, 'linktree/output.html');
fs.writeFileSync(outPath, out);

console.log(`Wrote ${outPath}`);
console.log(`Handle: ${handle}`);
console.log(`Associates tag: ${tag}`);
console.log(`Products: ${sorted.length}`);
if (tag.startsWith('REPLACE')) {
  console.warn('\n⚠ Associates tag is still the placeholder. Edit data/products.json: "associatesTag" before publishing.');
}
