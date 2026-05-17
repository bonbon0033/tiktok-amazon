#!/usr/bin/env node
// Upload a video to TikTok via Content Posting API.
//
// Modes:
//   inbox  (default, safest): video goes to drafts → user finalizes in app
//   direct (requires approved app + direct.post scope): publishes immediately
//
//   node scripts/tiktok-publish.mjs <video.mp4>                     # inbox
//   node scripts/tiktok-publish.mjs <video.mp4> --direct            # direct post
//   node scripts/tiktok-publish.mjs <video.mp4> --direct --caption "本文 #PR #自己啓発"
//   node scripts/tiktok-publish.mjs --status <publish_id>           # check status
//
// Prereq:
//   1. Run `node scripts/tiktok-auth.mjs` once (writes .tiktok-auth.json)
//   2. .tiktok-auth.json must be valid (access_token not expired)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

const API = 'https://open.tiktokapis.com';

function loadAuth() {
  const p = path.join(root, '.tiktok-auth.json');
  if (!fs.existsSync(p)) {
    console.error('.tiktok-auth.json not found. Run: node scripts/tiktok-auth.mjs');
    process.exit(1);
  }
  const auth = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (!auth.access_token) {
    console.error('No access_token. Re-run tiktok-auth.mjs.');
    process.exit(1);
  }
  const ageSec = (Date.now() - (auth.obtained_at || 0)) / 1000;
  if (ageSec > (auth.expires_in || 86400) - 300) {
    console.warn('⚠ access_token likely expired. Re-run tiktok-auth.mjs.');
  }
  return auth;
}

async function publish({ videoPath, mode, caption, privacy = 'PUBLIC_TO_EVERYONE' }) {
  const auth = loadAuth();
  const stat = fs.statSync(videoPath);
  const size = stat.size;

  const endpoint = mode === 'direct'
    ? '/v2/post/publish/video/init/'
    : '/v2/post/publish/inbox/video/init/';

  const body = mode === 'direct'
    ? {
        post_info: {
          title: caption || '',
          privacy_level: privacy,
          disable_comment: false,
          disable_duet: false,
          disable_stitch: false,
        },
        source_info: {
          source: 'FILE_UPLOAD',
          video_size: size,
          chunk_size: size,
          total_chunk_count: 1,
        },
      }
    : {
        source_info: {
          source: 'FILE_UPLOAD',
          video_size: size,
          chunk_size: size,
          total_chunk_count: 1,
        },
      };

  console.log(`▶ Init (${mode}) ${path.basename(videoPath)} (${(size / 1024 / 1024).toFixed(1)} MB)`);
  const initResp = await fetch(`${API}${endpoint}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${auth.access_token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const init = await initResp.json();
  if (init.error?.code !== 'ok') {
    console.error('Init failed:', JSON.stringify(init, null, 2));
    process.exit(2);
  }

  const publishId = init.data.publish_id;
  const uploadUrl = init.data.upload_url;
  console.log(`  publish_id: ${publishId}`);
  console.log(`▶ Upload to ${new URL(uploadUrl).host}`);

  const data = fs.readFileSync(videoPath);
  const upResp = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Range': `bytes 0-${size - 1}/${size}`,
      'Content-Type': 'video/mp4',
    },
    body: data,
  });
  if (upResp.status !== 201 && upResp.status !== 200) {
    console.error(`Upload failed ${upResp.status}: ${await upResp.text()}`);
    process.exit(3);
  }

  console.log('✓ Uploaded');
  return { ok: true, mode, publish_id: publishId, file_size: size };
}

async function checkStatus(publishId) {
  const auth = loadAuth();
  const r = await fetch(`${API}/v2/post/publish/status/fetch/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${auth.access_token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ publish_id: publishId }),
  });
  return await r.json();
}

// CLI parsing
const args = process.argv.slice(2);
if (args.includes('--status')) {
  const idx = args.indexOf('--status');
  const id = args[idx + 1];
  if (!id) { console.error('--status requires <publish_id>'); process.exit(1); }
  const result = await checkStatus(id);
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

const videoPath = args.find(a => a.endsWith('.mp4'));
if (!videoPath || !fs.existsSync(videoPath)) {
  console.error('Usage:');
  console.error('  node scripts/tiktok-publish.mjs <video.mp4> [--direct] [--caption "..."]');
  console.error('  node scripts/tiktok-publish.mjs --status <publish_id>');
  process.exit(1);
}
const mode = args.includes('--direct') ? 'direct' : 'inbox';
const captionIdx = args.indexOf('--caption');
const caption = captionIdx >= 0 ? args[captionIdx + 1] : '';

const result = await publish({ videoPath, mode, caption });
console.log('');
console.log(JSON.stringify(result, null, 2));
console.log('');
if (mode === 'inbox') {
  console.log('→ Video is in TikTok inbox/drafts.');
  console.log('→ Open the TikTok app to finalize caption + sound + publish.');
} else {
  console.log('→ Direct posted. Check status:');
  console.log(`     node scripts/tiktok-publish.mjs --status ${result.publish_id}`);
}
