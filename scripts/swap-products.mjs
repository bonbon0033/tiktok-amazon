#!/usr/bin/env node
// Sync product data from data/products.json into index.html.
// Use this after editing data/products.json so the rendered video reflects the new ranking.
//
//   node scripts/swap-products.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

const data = JSON.parse(fs.readFileSync(path.join(root, 'data/products.json'), 'utf8'));
const indexPath = path.join(root, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

for (const p of data.products) {
  const r = p.rank;
  const rankStr = String(r).padStart(2, '0');

  // Replace product name
  html = html.replace(
    new RegExp(`(<div class="product-name" id="r${r}-name">)[^<]*(</div>)`),
    `$1${escape(p.name)}$2`
  );
  // Price
  html = html.replace(
    new RegExp(`(<div class="product-price" id="r${r}-price">)[^<]*(</div>)`),
    `$1${escape(p.price)}$2`
  );
  // Rating
  html = html.replace(
    new RegExp(`(<div class="product-rating" id="r${r}-rating">)[^<]*(</div>)`),
    `$1★${p.rating} / レビュー${escape(p.reviews)}件$2`
  );
  // Tagline
  html = html.replace(
    new RegExp(`(<div class="product-tagline" id="r${r}-tag">)[^<]*(</div>)`),
    `$1${escape(p.tagline)}$2`
  );
  // Image (alt and src)
  html = html.replace(
    new RegExp(`(<div class="product-image-wrap" id="r${r}-img">[\\s\\S]*?<img src=")[^"]*(" alt=")[^"]*("[^>]*/?>[\\s\\S]*?</div>)`),
    `$1${p.image}$2${escape(p.name)}$3`
  );
  // Rank number text
  html = html.replace(
    new RegExp(`(<div class="rank-num" id="r${r}-num">)[^<]*(</div>)`),
    `$1${rankStr}$2`
  );
}

fs.writeFileSync(indexPath, html);
console.log('Synced data/products.json -> index.html');
console.log('Next: bash scripts/new-video.sh');

function escape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
