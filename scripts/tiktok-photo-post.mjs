#!/usr/bin/env node
// CLI: Post a 4-image Photo Carousel to TikTok via Content Posting API.
//
//   node scripts/tiktok-photo-post.mjs
//
// Reads:
//   - linktree/photos/*.jpg          (must be deployed to GitHub Pages)
//   - output/mobile-ready/caption.txt
//   - output/mobile-ready/hashtags.txt
//   - .tiktok-auth.json              (run tiktok-auth.mjs first)
//   - PUBLIC_BASE_URL env var        (e.g. https://uyu0033.github.io/tiktok-amazon)
//
// All photos must be JPEG (TikTok rejects PNG) and reachable at PUBLIC_BASE_URL/photos/*.jpg

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const API = 'https://open.tiktokapis.com';

// Load .env if present
const envPath = path.join(root, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.+)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}

const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
if (!PUBLIC_BASE_URL) {
  console.error('PUBLIC_BASE_URL not set. Add to .env (e.g. https://uyu0033.github.io/tiktok-amazon)');
  process.exit(1);
}

const authPath = path.join(root, '.tiktok-auth.json');
if (!fs.existsSync(authPath)) {
  console.error('.tiktok-auth.json missing. Run: node scripts/tiktok-auth.mjs');
  process.exit(1);
}
const auth = JSON.parse(fs.readFileSync(authPath, 'utf8'));

const photoDir = path.join(root, 'linktree/photos');
const photos = fs.readdirSync(photoDir).filter(f => /\.jpe?g$/i.test(f)).sort();
if (photos.length < 2 || photos.length > 10) {
  console.error(`Need 2-10 JPEG photos in linktree/photos/, found ${photos.length}`);
  process.exit(1);
}
const photoUrls = photos.map(f => `${PUBLIC_BASE_URL}/photos/${f}`);

const captionPath = path.join(root, 'output/mobile-ready/caption.txt');
const hashtagsPath = path.join(root, 'output/mobile-ready/hashtags.txt');
const caption = (fs.existsSync(captionPath) ? fs.readFileSync(captionPath, 'utf8') : '') +
  '\n\n' +
  (fs.existsSync(hashtagsPath) ? fs.readFileSync(hashtagsPath, 'utf8') : '');

console.log('▶ TikTok Photo Post');
console.log(`  Base URL: ${PUBLIC_BASE_URL}`);
console.log(`  Photos:`);
photoUrls.forEach((u, i) => console.log(`    ${i}: ${u}`));
console.log(`  Caption (${caption.length} chars):`);
console.log(caption.split('\n').map(l => '    ' + l).join('\n'));

const body = {
  post_info: {
    title: caption.trim(),
    privacy_level: process.env.TIKTOK_PRIVACY || 'PUBLIC_TO_EVERYONE',
    disable_comment: false,
    brand_content_toggle: true,
    auto_add_music: true,
  },
  source_info: {
    source: 'PULL_FROM_URL',
    photo_cover_index: 0,
    photo_images: photoUrls,
  },
  post_mode: 'DIRECT_POST',
  media_type: 'PHOTO',
};

const resp = await fetch(`${API}/v2/post/publish/content/init/`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${auth.access_token}`,
    'Content-Type': 'application/json; charset=UTF-8',
  },
  body: JSON.stringify(body),
});
const j = await resp.json();
console.log('\n--- TikTok API response ---');
console.log(JSON.stringify(j, null, 2));

if (j.error?.code === 'ok') {
  console.log(`\n✓ Submitted. publish_id: ${j.data.publish_id}`);
  console.log(`  Check status: node scripts/tiktok-publish.mjs --status ${j.data.publish_id}`);
} else {
  console.error(`\n✗ Failed: ${j.error?.message || JSON.stringify(j.error)}`);
  process.exit(2);
}
