#!/usr/bin/env node
// Track a competitor / reference TikTok post into data/competitors.json.
// Auto-detects video vs photo from URL. Uses yt-dlp for videos.
// For photo posts, delegates to scripts/scrape-tiktok-photo.mjs.
//
// Usage:
//   node scripts/track-competitor.mjs <tiktok-url> [niche] [notes]
//   node scripts/track-competitor.mjs https://www.tiktok.com/@xxx/video/123 philosophy "long-form movie format"
//
// Re-running on the same videoId appends to history[] (time-series tracking).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const compPath = path.join(root, 'data/competitors.json');

const url = process.argv[2];
const niche = process.argv[3] || 'unknown';
const notes = process.argv[4] || '';

if (!url) {
  console.error('Usage: node scripts/track-competitor.mjs <tiktok-url> [niche] [notes]');
  process.exit(1);
}

const isPhoto = /\/photo\//.test(url);
const isVideo = /\/video\//.test(url);

if (!isPhoto && !isVideo) {
  console.error('URL must contain /video/ or /photo/');
  process.exit(1);
}

console.log(`[track] ${isPhoto ? 'photo' : 'video'} post: ${url}`);
console.log(`[track] niche: ${niche}`);

let entry;
if (isVideo) {
  entry = trackVideo(url);
} else {
  entry = trackPhoto(url);
}

if (!entry) {
  console.error('[track] Failed to extract metadata. Skipping.');
  process.exit(1);
}

entry.niche = niche;
entry.notes = notes;

const data = JSON.parse(fs.readFileSync(compPath, 'utf8'));
const existing = data.competitors.findIndex(c => c.videoId === entry.videoId);

if (existing >= 0) {
  const prev = data.competitors[existing];
  prev.history = prev.history || [];
  prev.history.push({ trackedAt: prev.trackedAt, metrics: prev.metrics });
  Object.assign(prev, entry);
  console.log(`[track] Updated existing (history length: ${prev.history.length})`);
} else {
  entry.history = [];
  data.competitors.push(entry);
  console.log(`[track] Added new competitor entry`);
}

fs.writeFileSync(compPath, JSON.stringify(data, null, 2));
console.log(`\n  views=${entry.metrics.views?.toLocaleString()} likes=${entry.metrics.likes?.toLocaleString()} saves=${entry.metrics.saves?.toLocaleString()} shares=${entry.metrics.shares?.toLocaleString()}`);
console.log(`  duration=${entry.duration ?? '-'}s slides=${entry.slideCount ?? '-'}  bgm="${entry.bgm}"`);
console.log(`\n  Total competitors tracked: ${data.competitors.length}`);

// ─────────────────────────────────────────

function trackVideo(url) {
  console.log('[track] Running yt-dlp...');
  const r = spawnSync('python', ['-m', 'yt_dlp', '--skip-download', '--dump-single-json', url], {
    encoding: 'utf8', maxBuffer: 50 * 1024 * 1024,
  });
  if (r.status !== 0) {
    console.error('[track] yt-dlp failed:', r.stderr?.slice(0, 500));
    return null;
  }
  // yt-dlp may print a WARNING line before JSON. Take last line that parses as JSON.
  let info;
  for (const line of r.stdout.split('\n').reverse()) {
    if (!line.trim().startsWith('{')) continue;
    try { info = JSON.parse(line); break; } catch {}
  }
  if (!info) {
    console.error('[track] no JSON in yt-dlp output');
    return null;
  }
  const tags = extractHashtags(info.description || info.title || '');
  return {
    url,
    handle: '@' + (info.uploader || info.channel || ''),
    videoId: info.id,
    type: 'video',
    trackedAt: new Date().toISOString(),
    duration: info.duration ?? null,
    slideCount: null,
    title: info.title || '',
    description: info.description || '',
    hashtags: tags,
    bgm: info.track || (info.artists ? `original sound - ${info.artists[0]}` : 'unknown'),
    uploadDate: info.upload_date || null,
    metrics: {
      views: info.view_count ?? 0,
      likes: info.like_count ?? 0,
      saves: info.save_count ?? 0,
      shares: info.repost_count ?? 0,
      comments: info.comment_count ?? 0,
    },
  };
}

function trackPhoto(url) {
  console.log('[track] Delegating to Playwright scraper...');
  const scraper = path.join(here, 'scrape-tiktok-photo.mjs');
  if (!fs.existsSync(scraper)) {
    console.error('[track] scrape-tiktok-photo.mjs not found');
    return null;
  }
  const r = spawnSync('node', [scraper, url], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, stdio: ['inherit', 'pipe', 'inherit'] });
  if (r.status !== 0) return null;
  // Scraper prints a single JSON line as last non-empty line.
  for (const line of r.stdout.split('\n').reverse()) {
    if (line.trim().startsWith('{')) {
      try { return JSON.parse(line); } catch {}
    }
  }
  return null;
}

function extractHashtags(text) {
  const matches = String(text).match(/#[^\s#]+/g) || [];
  return matches.map(t => t.slice(1));
}
