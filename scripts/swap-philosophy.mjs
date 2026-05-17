#!/usr/bin/env node
// Sync data/philosophy-products.json -> philosophy-slide/index.html
// Updates the book recommendation slide (slide 9 #book-title).
//
//   node scripts/swap-philosophy.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

const data = JSON.parse(fs.readFileSync(path.join(root, 'data/philosophy-products.json'), 'utf8'));
const html = fs.readFileSync(path.join(root, 'philosophy-slide/index.html'), 'utf8');

const b = data.currentBook;
const bookLine = `『${b.title}』<br>${b.author} 著`;

const replaced = html.replace(
  /<span class="small" id="book-title">[\s\S]*?<\/span>/,
  `<span class="small" id="book-title">${bookLine}</span>`
);

if (replaced === html) {
  console.error('[swap] WARNING: book-title span not found. Composition unchanged.');
  process.exit(1);
}

fs.writeFileSync(path.join(root, 'philosophy-slide/index.html'), replaced);
console.log(`[swap] book → 『${b.title}』 ${b.author}`);
console.log(`       ASIN: ${b.asin}  tag: ${data.associatesTag}`);
console.log(`       link: https://www.amazon.co.jp/dp/${b.asin}?tag=${data.associatesTag}`);
