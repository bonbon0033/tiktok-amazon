#!/usr/bin/env node
// Check whether the saved TikTok session (.playwright-tiktok-profile) is still
// valid, and if so print the logged-in handle.
//
//   node scripts/tiktok-session-check.mjs [--headed]
//
// Output: single JSON line on stdout, e.g. {"loggedIn":true,"handle":"@xxx"}
// stderr is human-readable progress.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const profileDir = path.join(root, '.playwright-tiktok-profile');
const headed = process.argv.includes('--headed');

if (!fs.existsSync(profileDir)) {
  console.log(JSON.stringify({ loggedIn: false, reason: 'no-profile' }));
  process.exit(0);
}

const context = await chromium.launchPersistentContext(profileDir, {
  headless: !headed,
  viewport: { width: 412, height: 915 },
  userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
  locale: 'ja-JP',
  args: ['--disable-blink-features=AutomationControlled'],
});

try {
  const page = await context.newPage();
  await page.goto('https://www.tiktok.com/', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(6000);

  // Logged-in indicator: the bottom-nav "プロフィール" link points at YOUR OWN
  // profile. Do NOT use the first /@... href — on the FYP that is some random
  // video author (we once read @fabrizioromano from a feed video).
  const profileHrefs = await page.$$eval('a[href^="/@"]', as =>
    as.filter(a => /プロフィール|Profile/i.test((a.innerText || '') + ' ' + (a.getAttribute('aria-label') || '')))
      .map(a => a.getAttribute('href'))
  );

  let handle = null;
  if (profileHrefs.length > 0) {
    handle = profileHrefs[0].replace(/^\//, '').split(/[/?]/)[0];
  } else {
    // Fallback: read the embedded page state for the logged-in user.
    handle = await page.evaluate(() => {
      try {
        const el = document.getElementById('__UNIVERSAL_DATA_FOR_REHYDRATION__');
        if (!el) return null;
        const data = JSON.parse(el.textContent);
        const scope = data && data['__DEFAULT_SCOPE__'];
        const info = scope && (scope['webapp.user-detail']?.userInfo?.user || scope['webapp.user']?.userInfo?.user);
        return info?.uniqueId ? '@' + info.uniqueId : null;
      } catch { return null; }
    });
  }

  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 2000));
  const hasLoginButton = /ログイン|Log in/i.test(bodyText) && !handle;

  if (handle) {
    console.log(JSON.stringify({ loggedIn: true, handle: '@' + handle.replace(/^@/, '') }));
  } else {
    console.log(JSON.stringify({ loggedIn: false, reason: hasLoginButton ? 'login-wall' : 'no-profile-link' }));
  }
} finally {
  await context.close();
}
