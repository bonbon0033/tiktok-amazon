#!/usr/bin/env node
// Sync 1 product (rank 1) from data/products.json into compositions-roots/slideshow-life.html.
//   node scripts/swap-slideshow.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

const data = JSON.parse(fs.readFileSync(path.join(root, 'data/products.json'), 'utf8'));
const compPath = path.join(root, 'compositions-roots/slideshow-life.html');
let html = fs.readFileSync(compPath, 'utf8');

const top = [...data.products].sort((a, b) => a.rank - b.rank)[0];
if (!top) {
  console.error('No products in data/products.json');
  process.exit(1);
}

// Slide 4 product card
html = html.replace(
  /(<div class="pc-name" id="slide4-pc-name">)[^<]*(<\/div>)/,
  `$1${escape(top.name.slice(0, 28))}$2`
);
html = html.replace(
  /(<div class="pc-price" id="slide4-pc-price">)[^<]*(<\/div>)/,
  `$1${escape(top.price)}$2`
);
html = html.replace(
  /(<div class="pc-star" id="slide4-pc-star">)[^<]*(<\/div>)/,
  `$1★${top.rating} / ${escape(top.reviews)}件+$2`
);

fs.writeFileSync(compPath, html);
console.log(`Synced slideshow main product:`);
console.log(`  ${top.name.slice(0, 40)} (${top.price}, ★${top.rating}, ${top.reviews}件)`);
console.log(`\nNext: bash scripts/generate-slideshow-tts.sh`);
console.log(`Then: npx hyperframes render --composition compositions-roots/slideshow-life.html --output output/slideshow-$(date +%Y%m%d).mp4`);

function escape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
