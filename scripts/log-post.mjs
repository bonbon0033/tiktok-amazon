#!/usr/bin/env node
// Append a posted-video KPI entry to data/performance.json.
//
// Usage:
//   node scripts/log-post.mjs <videoId> <platform> <videoType> <theme> <category> <hookId> <hookFormulaId> "<hookText>" \
//        --views=12000 --likes=340 --saves=89 --shares=12 --comments=8 \
//        --clicks=22 --purchases=1 --revenue=240 --asins=B0XXX,B0YYY \
//        --notes="..."
//
// Minimal example (only mandatory positional args + key metrics):
//   node scripts/log-post.mjs week-20260516-rank tiktok ranking 自己啓発 books A F06 "今買い逃したら..." \
//        --views=8000 --saves=42 --clicks=11 --purchases=1 --revenue=240 --asins=B0XXX,B0YYY

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const perfPath = path.join(root, 'data/performance.json');

const argv = process.argv.slice(2);
const positional = argv.filter(a => !a.startsWith('--'));
const flags = Object.fromEntries(
  argv.filter(a => a.startsWith('--')).map(a => {
    const [k, ...rest] = a.replace(/^--/, '').split('=');
    return [k, rest.join('=')];
  })
);

if (positional.length < 8) {
  console.error('Usage: node scripts/log-post.mjs <videoId> <platform> <videoType> <theme> <category> <hookId> <hookFormulaId> "<hookText>" --views=N ...');
  process.exit(1);
}

const [videoId, platform, videoType, theme, category, hookId, hookFormulaId, hookText] = positional;

const num = (v) => v == null ? 0 : Number(v);
const entry = {
  videoId,
  postedAt: flags.postedAt || new Date().toISOString(),
  platform,
  videoType,
  theme,
  category,
  hookId,
  hookFormulaId,
  hookText,
  products: (flags.asins || '').split(',').filter(Boolean),
  metrics: {
    views: num(flags.views),
    likes: num(flags.likes),
    saves: num(flags.saves),
    shares: num(flags.shares),
    comments: num(flags.comments),
    linkClicks: num(flags.clicks),
    purchases: num(flags.purchases),
    revenueJpy: num(flags.revenue),
  },
  notes: flags.notes || '',
};

const perf = JSON.parse(fs.readFileSync(perfPath, 'utf8'));

const dup = perf.posts.findIndex(p => p.videoId === videoId);
if (dup >= 0) {
  console.log(`[log-post] Updating existing entry: ${videoId}`);
  perf.posts[dup] = entry;
} else {
  console.log(`[log-post] Appending new entry: ${videoId}`);
  perf.posts.push(entry);
}

fs.writeFileSync(perfPath, JSON.stringify(perf, null, 2));
console.log(`  views=${entry.metrics.views} saves=${entry.metrics.saves} clicks=${entry.metrics.linkClicks} purchases=${entry.metrics.purchases} rev=¥${entry.metrics.revenueJpy}`);
console.log(`  Total posts logged: ${perf.posts.length}`);
console.log(`\nNext: node agents/learn.mjs   # update strategy weights`);
