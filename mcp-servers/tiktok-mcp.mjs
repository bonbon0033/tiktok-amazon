#!/usr/bin/env node
// MCP server exposing TikTok Content Posting API tools to Claude Code / MCP clients.
//
// Tools provided:
//   - tiktok_inbox_post     Upload to drafts (safest, no audit needed)
//   - tiktok_direct_post    Publish immediately (requires audited app with direct.post)
//   - tiktok_check_status   Poll publish status
//   - tiktok_creator_info   Query the user's posting limits & creator profile
//
// Register in ~/.claude/mcp.json (Claude Code) or settings.json:
//   "mcpServers": {
//     "tiktok-publisher": {
//       "command": "node",
//       "args": ["C:/Users/googo/projects/tiktok-amazon/mcp-servers/tiktok-mcp.mjs"]
//     }
//   }
//
// Auth: needs .tiktok-auth.json in project root (run scripts/tiktok-auth.mjs once).

import readline from 'node:readline';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');
const API = 'https://open.tiktokapis.com';

const TOOLS = [
  {
    name: 'tiktok_inbox_post',
    description: 'Upload a video file to the TikTok user\'s inbox (drafts). User must finalize the post (caption, sound, settings) in the TikTok app. Safest mode — no app audit required by TikTok. Use for week 1-8 of the publishing roadmap.',
    inputSchema: {
      type: 'object',
      properties: {
        video_path: { type: 'string', description: 'Absolute path to the mp4. Recommended: 1080x1920, < 200MB, < 60s.' },
      },
      required: ['video_path'],
    },
  },
  {
    name: 'tiktok_direct_post',
    description: 'Publish a video directly to TikTok with caption and privacy settings. Requires an APPROVED developer app with the direct.post scope. Use after audited (typically post 1,000 followers).',
    inputSchema: {
      type: 'object',
      properties: {
        video_path: { type: 'string', description: 'Absolute path to mp4.' },
        caption: { type: 'string', description: 'Full caption with hashtags. Max ~2,200 chars. Include #PR for affiliate.' },
        privacy_level: { type: 'string', enum: ['PUBLIC_TO_EVERYONE', 'MUTUAL_FOLLOW_FRIENDS', 'SELF_ONLY'], default: 'PUBLIC_TO_EVERYONE' },
        disable_comment: { type: 'boolean', default: false },
        disable_duet: { type: 'boolean', default: false },
        disable_stitch: { type: 'boolean', default: false },
        brand_content_toggle: { type: 'boolean', description: 'Mark as branded content (Amazon Associates affiliate = true required per 2026-04 規約)', default: true },
        ai_generated_toggle: { type: 'boolean', description: 'Mark as AI-generated (required if HyperFrames + Edge TTS used heavily)', default: true },
      },
      required: ['video_path', 'caption'],
    },
  },
  {
    name: 'tiktok_check_status',
    description: 'Check the moderation/processing status of a previously posted video by publish_id.',
    inputSchema: {
      type: 'object',
      properties: { publish_id: { type: 'string' } },
      required: ['publish_id'],
    },
  },
  {
    name: 'tiktok_creator_info',
    description: 'Get the authenticated creator\'s posting limits, allowed privacy levels, and rate limits. Call before tiktok_direct_post to verify the account can do that mode.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'tiktok_photo_post',
    description: 'Post a PHOTO CAROUSEL (2-10 images = TikTok Photo Mode / slideshow) directly to TikTok. Photos must be hosted at publicly accessible URLs (HTTPS, no auth). TikTok rejects PNG — use JPEG or WEBP. Use this for the self-improvement slideshow pattern instead of video. Requires audited app with content.posting.api scope.',
    inputSchema: {
      type: 'object',
      properties: {
        photo_urls: {
          type: 'array',
          items: { type: 'string' },
          minItems: 2, maxItems: 10,
          description: 'Array of 2-10 publicly accessible JPEG/WEBP image URLs (HTTPS). E.g. https://yourhandle.github.io/repo/photos/photo-01.jpg',
        },
        caption: { type: 'string', description: 'Caption + hashtags. Max ~2,200 chars. Include #PR for Amazon affiliate.' },
        photo_cover_index: { type: 'integer', minimum: 0, default: 0, description: 'Which image is the cover (default: 0 = first image)' },
        privacy_level: { type: 'string', enum: ['PUBLIC_TO_EVERYONE', 'MUTUAL_FOLLOW_FRIENDS', 'SELF_ONLY'], default: 'PUBLIC_TO_EVERYONE' },
        disable_comment: { type: 'boolean', default: false },
        brand_content_toggle: { type: 'boolean', default: true, description: 'Amazon Associates 規約必須' },
        auto_add_music: { type: 'boolean', default: true, description: 'Let TikTok auto-attach a trending music track (recommended for slideshow)' },
      },
      required: ['photo_urls', 'caption'],
    },
  },
];

const rl = readline.createInterface({ input: process.stdin });

rl.on('line', async (line) => {
  let req;
  try { req = JSON.parse(line); } catch { return; }
  try {
    if (req.method === 'initialize') {
      respond(req.id, {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'tiktok-publisher', version: '0.1.0' },
      });
    } else if (req.method === 'notifications/initialized') {
      // no response expected
    } else if (req.method === 'tools/list') {
      respond(req.id, { tools: TOOLS });
    } else if (req.method === 'tools/call') {
      const result = await invokeTool(req.params.name, req.params.arguments || {});
      respond(req.id, { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] });
    } else {
      respondError(req.id, `Unsupported method: ${req.method}`);
    }
  } catch (e) {
    respondError(req?.id ?? null, e.message);
  }
});

function respond(id, result) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n');
}
function respondError(id, message) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32603, message } }) + '\n');
}

function loadAuth() {
  const p = path.join(projectRoot, '.tiktok-auth.json');
  if (!fs.existsSync(p)) {
    throw new Error('Not authenticated. Run `node scripts/tiktok-auth.mjs` in ' + projectRoot);
  }
  const auth = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (!auth.access_token) throw new Error('access_token missing in .tiktok-auth.json');
  return auth;
}

async function invokeTool(name, args) {
  const auth = loadAuth();
  const headers = { Authorization: `Bearer ${auth.access_token}`, 'content-type': 'application/json' };

  if (name === 'tiktok_inbox_post' || name === 'tiktok_direct_post') {
    const direct = name === 'tiktok_direct_post';
    const videoPath = args.video_path;
    if (!videoPath || !fs.existsSync(videoPath)) {
      return { ok: false, error: `Video not found: ${videoPath}` };
    }
    const stat = fs.statSync(videoPath);
    const size = stat.size;

    const endpoint = direct ? '/v2/post/publish/video/init/' : '/v2/post/publish/inbox/video/init/';
    const body = direct
      ? {
          post_info: {
            title: args.caption || '',
            privacy_level: args.privacy_level || 'PUBLIC_TO_EVERYONE',
            disable_comment: !!args.disable_comment,
            disable_duet: !!args.disable_duet,
            disable_stitch: !!args.disable_stitch,
            brand_content_toggle: args.brand_content_toggle !== false,
            // AI-generated label flag — TikTok 2026 rules
            ...(args.ai_generated_toggle !== false ? { brand_organic_toggle: false } : {}),
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

    const initResp = await fetch(`${API}${endpoint}`, { method: 'POST', headers, body: JSON.stringify(body) });
    const init = await initResp.json();
    if (init.error?.code !== 'ok') {
      return { ok: false, step: 'init', error: init.error };
    }
    const data = fs.readFileSync(videoPath);
    const upResp = await fetch(init.data.upload_url, {
      method: 'PUT',
      headers: {
        'Content-Range': `bytes 0-${size - 1}/${size}`,
        'Content-Type': 'video/mp4',
      },
      body: data,
    });
    if (upResp.status !== 201 && upResp.status !== 200) {
      return { ok: false, step: 'upload', status: upResp.status, body: await upResp.text() };
    }
    return {
      ok: true,
      mode: direct ? 'direct' : 'inbox',
      publish_id: init.data.publish_id,
      file_size: size,
      next_step: direct
        ? 'Use tiktok_check_status with publish_id to monitor processing.'
        : 'Open the TikTok app — the video is in your inbox/drafts. Finalize caption + sound + branded content toggle.',
    };
  }

  if (name === 'tiktok_check_status') {
    const r = await fetch(`${API}/v2/post/publish/status/fetch/`, {
      method: 'POST', headers,
      body: JSON.stringify({ publish_id: args.publish_id }),
    });
    return await r.json();
  }

  if (name === 'tiktok_creator_info') {
    const r = await fetch(`${API}/v2/post/publish/creator_info/query/`, {
      method: 'POST', headers, body: '{}',
    });
    return await r.json();
  }

  if (name === 'tiktok_photo_post') {
    const urls = args.photo_urls || [];
    if (urls.length < 2 || urls.length > 10) {
      return { ok: false, error: `photo_urls must contain 2-10 URLs (got ${urls.length})` };
    }
    const rejected = urls.filter(u => /\.png(\?|$)/i.test(u));
    if (rejected.length) {
      return { ok: false, error: `TikTok rejects PNG. Convert to JPEG/WEBP first. Bad: ${rejected.join(', ')}` };
    }

    const body = {
      post_info: {
        title: args.caption || '',
        privacy_level: args.privacy_level || 'PUBLIC_TO_EVERYONE',
        disable_comment: !!args.disable_comment,
        brand_content_toggle: args.brand_content_toggle !== false,
        auto_add_music: args.auto_add_music !== false,
      },
      source_info: {
        source: 'PULL_FROM_URL',
        photo_cover_index: Math.max(0, Math.min(urls.length - 1, args.photo_cover_index ?? 0)),
        photo_images: urls,
      },
      post_mode: 'DIRECT_POST',
      media_type: 'PHOTO',
    };
    const r = await fetch(`${API}/v2/post/publish/content/init/`, {
      method: 'POST', headers, body: JSON.stringify(body),
    });
    const j = await r.json();
    if (j.error?.code !== 'ok') {
      return { ok: false, step: 'init', error: j.error };
    }
    return {
      ok: true,
      mode: 'photo_direct',
      publish_id: j.data.publish_id,
      photo_count: urls.length,
      cover_index: body.source_info.photo_cover_index,
      next_step: 'Use tiktok_check_status with publish_id to monitor processing. TikTok will fetch the images from their URLs.',
    };
  }

  throw new Error(`Unknown tool: ${name}`);
}

// stderr is fine for logs (stdout reserved for JSON-RPC)
process.stderr.write('[tiktok-mcp] server ready\n');
