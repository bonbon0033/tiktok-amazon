#!/usr/bin/env node
// Apply research/data/picked.json into data/products.json (preserving associatesTag and category).
//   node agents/apply-picked.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

const picked = JSON.parse(fs.readFileSync(path.join(root, 'research/data/picked.json'), 'utf8'));
const productsPath = path.join(root, 'data/products.json');
const products = JSON.parse(fs.readFileSync(productsPath, 'utf8'));

products.products = picked.products
  .sort((a, b) => a.rank - b.rank)
  .map(p => ({
    rank: p.rank,
    name: p.name,
    price: p.price,
    rating: p.rating,
    reviews: p.reviews,
    tagline: p.tagline,
    asin: p.asin,
    image: p.image || `assets/products/product-${p.rank}.svg`,
    accent: p.accent || '#e8ff3a',
  }));

fs.writeFileSync(productsPath, JSON.stringify(products, null, 2));
console.log(`✓ Updated ${path.relative(root, productsPath)} (${products.products.length} products)`);
console.log('Next: node scripts/swap-products.mjs');
