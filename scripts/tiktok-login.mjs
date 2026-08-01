#!/usr/bin/env node
// Open a headed browser on the saved TikTok profile so the user can log in
// manually. Cookies persist under .playwright-tiktok-profile/.
//
//   node scripts/tiktok-login.mjs
//
// The script stays alive while the window is open. It prints a JSON line and
// exits by itself once a login is detected (profile page shows the user), or
// when the window is closed.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const profileDir = path.join(root, '.playwright-tiktok-profile');

const context = await chromium.launchPersistentContext(profileDir, {
  headless: false,
  viewport: { width: 412, height: 915 },
  userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
  locale: 'ja-JP',
  args: ['--disable-blink-features=AutomationControlled'],
});

const page = await context.newPage();
await page.goto('https://www.tiktok.com/profile', { waitUntil: 'domcontentloaded' });

console.error('  A browser window is open. Log in to TikTok there.');
console.error('  This script exits automatically once login is detected.');

let done = false;
context.on('close', () => { done = true; });

// Poll: logged-in profile URL becomes /@<handle>
for (let i = 0; i < 360 && !done; i++) { // up to ~30 min
  await page.waitForTimeout(5000).catch(() => { done = true; });
  if (done) break;
  const url = page.url();
  if (/\/@[^/]+/.test(url)) {
    const handle = '@' + url.split('/@')[1].split(/[/?]/)[0];
    console.log(JSON.stringify({ loggedIn: true, handle }));
    await context.close();
    process.exit(0);
  }
}

console.log(JSON.stringify({ loggedIn: false, reason: 'window-closed-or-timeout' }));
try { await context.close(); } catch {}
