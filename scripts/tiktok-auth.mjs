#!/usr/bin/env node
// One-time OAuth flow to obtain a TikTok API access_token.
//
// Prerequisites:
//   1. Create a developer app at https://developers.tiktok.com/
//   2. Enable scopes: video.upload, video.publish (or content.posting.api)
//   3. Set Redirect URI to: http://localhost:8080/callback
//   4. Export env vars:
//        TIKTOK_CLIENT_KEY=xxxxx
//        TIKTOK_CLIENT_SECRET=xxxxx
//        TIKTOK_REDIRECT_URI=http://localhost:8080/callback   (optional)
//
// Usage: node scripts/tiktok-auth.mjs
//
// Output: writes .tiktok-auth.json in project root (gitignored).

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

// Load .env if present
const envPath = path.join(root, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.+)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}

const CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY;
const CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET;
const REDIRECT_URI = process.env.TIKTOK_REDIRECT_URI || 'http://localhost:8080/callback';
const SCOPES = 'user.info.basic,video.upload,video.publish';

if (!CLIENT_KEY || !CLIENT_SECRET) {
  console.error('Missing TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET.');
  console.error('Add to .env or export them. See .env.example.');
  process.exit(1);
}

const state = Math.random().toString(36).slice(2, 14);
const authUrl =
  'https://www.tiktok.com/v2/auth/authorize/' +
  `?client_key=${encodeURIComponent(CLIENT_KEY)}` +
  `&scope=${encodeURIComponent(SCOPES)}` +
  '&response_type=code' +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&state=${state}`;

console.log('\n┌──────────────────────────────────────────────────────────┐');
console.log('│  TikTok OAuth — open this URL in your browser:           │');
console.log('└──────────────────────────────────────────────────────────┘\n');
console.log(authUrl);
console.log('\nWaiting for callback on ' + REDIRECT_URI + ' ...\n');

// Best-effort: open browser automatically (Windows / Mac / Linux)
const openCmd = process.platform === 'win32' ? `start "" "${authUrl}"` :
                process.platform === 'darwin' ? `open "${authUrl}"` :
                `xdg-open "${authUrl}"`;
exec(openCmd, () => {});

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT_URI);
  if (!url.pathname.endsWith('/callback')) {
    res.statusCode = 404; res.end('not found'); return;
  }
  const code = url.searchParams.get('code');
  const returnedState = url.searchParams.get('state');
  if (!code) { res.end('No code returned. Check app config.'); return; }
  if (returnedState !== state) { res.end('State mismatch — possible CSRF. Aborted.'); return; }

  try {
    const params = new URLSearchParams({
      client_key: CLIENT_KEY,
      client_secret: CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI,
    });
    const tokenResp = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: params,
    });
    const tokens = await tokenResp.json();
    if (!tokens.access_token) {
      res.statusCode = 500;
      res.end('<h2>❌ Token exchange failed</h2><pre>' + JSON.stringify(tokens, null, 2) + '</pre>');
      console.error('Token exchange failed:', tokens);
      return;
    }

    tokens.obtained_at = Date.now();
    fs.writeFileSync(path.join(root, '.tiktok-auth.json'), JSON.stringify(tokens, null, 2));

    res.end('<h2>✅ Auth saved</h2><p>You can close this tab.</p>');
    console.log('✓ Tokens saved to .tiktok-auth.json');
    console.log('  expires_in:', tokens.expires_in, 'seconds');
    console.log('  scope:', tokens.scope);
    console.log('\nYou can now run: node scripts/tiktok-publish.mjs <video.mp4>');
    server.close();
  } catch (e) {
    res.statusCode = 500;
    res.end('Error: ' + e.message);
    console.error(e);
  }
});

server.listen(8080, () => {
  // ready
});
