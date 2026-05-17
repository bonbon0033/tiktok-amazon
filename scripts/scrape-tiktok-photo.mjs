#!/usr/bin/env node
// Scrape a TikTok photo (slideshow) post via Playwright with persistent context.
// First run: user must log in to TikTok manually in the opened browser.
//            Cookies are saved under .playwright-tiktok-profile/ and reused.
// Subsequent runs: headless, ~10s.
//
// Output: single JSON line on stdout (consumed by track-competitor.mjs).
// stderr is human-readable progress.
//
// Usage:
//   node scripts/scrape-tiktok-photo.mjs <url> [--login]
//
// --login  Force interactive (headed) mode for cookie capture even if profile exists.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const profileDir = path.join(root, '.playwright-tiktok-profile');

const url = process.argv[2];
const forceLogin = process.argv.includes('--login');

if (!url) {
  console.error('Usage: node scripts/scrape-tiktok-photo.mjs <tiktok-photo-url> [--login]');
  process.exit(1);
}

const profileExists = fs.existsSync(profileDir);
const interactive = forceLogin || !profileExists;

if (interactive) {
  console.error('');
  console.error('  ╔══════════════════════════════════════════════════════════╗');
  console.error('  ║  FIRST-RUN SETUP                                         ║');
  console.error('  ║  A Chromium window will open. Log in to TikTok manually. ║');
  console.error('  ║  Then close the window. Cookies will be saved.           ║');
  console.error('  ╚══════════════════════════════════════════════════════════╝');
  console.error('');
}

const context = await chromium.launchPersistentContext(profileDir, {
  headless: !interactive,
  viewport: { width: 412, height: 915 },
  userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
  locale: 'ja-JP',
  args: ['--disable-blink-features=AutomationControlled'],
});

const page = await context.newPage();

if (interactive) {
  await page.goto('https://www.tiktok.com/login', { waitUntil: 'domcontentloaded' });
  console.error('  Waiting for you to log in... (close the window when done)');
  // Wait for context to close.
  await new Promise(resolve => context.on('close', resolve));
  console.error('  Profile saved. Re-run without --login to scrape.');
  process.exit(0);
}

console.error(`[scrape] Loading ${url}`);
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

// Wait for hydration. TikTok renders the __UNIVERSAL_DATA_FOR_REHYDRATION__ script tag.
await page.waitForSelector('script#__UNIVERSAL_DATA_FOR_REHYDRATION__', { timeout: 15000 }).catch(() => {});

const raw = await page.evaluate(() => {
  const tag = document.querySelector('script#__UNIVERSAL_DATA_FOR_REHYDRATION__');
  return tag ? tag.textContent : null;
});

if (!raw) {
  console.error('[scrape] No __UNIVERSAL_DATA__ script. TikTok may have changed structure or session expired.');
  console.error('         Try: node scripts/scrape-tiktok-photo.mjs <url> --login');
  await context.close();
  process.exit(2);
}

const data = JSON.parse(raw);
const item = findItem(data);

if (!item) {
  console.error('[scrape] Could not locate item struct in __UNIVERSAL_DATA__. Dumping shallow keys:');
  console.error(Object.keys(data).join(', '));
  await context.close();
  process.exit(3);
}

const stats = item.stats || item.statsV2 || {};
const imagePost = item.imagePost || {};
const images = imagePost.images || [];
const music = item.music || {};
const author = item.author || {};

const entry = {
  url,
  handle: '@' + (author.uniqueId || ''),
  videoId: item.id || '',
  type: 'photo',
  trackedAt: new Date().toISOString(),
  duration: null,
  slideCount: images.length,
  title: imagePost.title || '',
  description: item.desc || '',
  hashtags: ((item.desc || '').match(/#[^\s#]+/g) || []).map(t => t.slice(1)),
  bgm: music.title ? `${music.title} - ${music.authorName || ''}`.trim() : 'unknown',
  uploadDate: item.createTime ? new Date(item.createTime * 1000).toISOString().slice(0, 10).replace(/-/g, '') : null,
  metrics: {
    views: toInt(stats.playCount ?? stats.viewCount),
    likes: toInt(stats.diggCount ?? stats.likeCount),
    saves: toInt(stats.collectCount ?? stats.saveCount),
    shares: toInt(stats.shareCount),
    comments: toInt(stats.commentCount),
  },
  slides: images.map((img, i) => ({
    index: i,
    imageUrl: img?.imageURL?.urlList?.[0] || null,
    width: img?.imageWidth,
    height: img?.imageHeight,
  })),
};

await context.close();

console.error(`[scrape] OK: ${entry.slideCount} slides, ${entry.metrics.views.toLocaleString()} views`);
// stdout: single JSON line for track-competitor.mjs.
console.log(JSON.stringify(entry));

function toInt(v) {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  return parseInt(String(v).replace(/[^0-9]/g, '')) || 0;
}

function findItem(data) {
  // The item struct lives under __DEFAULT_SCOPE__.webapp.video-detail.itemInfo.itemStruct
  const scope = data?.__DEFAULT_SCOPE__;
  if (!scope) return null;
  const candidates = [
    scope?.['webapp.video-detail']?.itemInfo?.itemStruct,
    scope?.['webapp.photo-detail']?.itemInfo?.itemStruct,
  ].filter(Boolean);
  if (candidates.length) return candidates[0];
  // Fallback: deep search for an object with desc + author + stats.
  let found = null;
  (function walk(o) {
    if (found) return;
    if (o && typeof o === 'object') {
      if (o.desc != null && o.author && o.stats) { found = o; return; }
      for (const v of Object.values(o)) walk(v);
    }
  })(data);
  return found;
}
