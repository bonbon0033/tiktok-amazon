#!/usr/bin/env node
// Post a video to TikTok via the web Studio uploader using the saved session.
//
//   node scripts/tiktok-web-post.mjs <video.mp4> [--post]
//
// Without --post it does everything EXCEPT clicking the final 投稿 button
// (dry run) and saves a screenshot to output/thumbs/webpost-ready.png.
// With --post it clicks 投稿 and saves output/thumbs/webpost-done.png.
//
// Caption/hashtags come from output/mobile-ready/{caption,hashtags}.txt.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const profileDir = path.join(root, '.playwright-tiktok-profile');

const videoArg = process.argv[2];
const doPost = process.argv.includes('--post');
if (!videoArg) {
  console.error('Usage: node scripts/tiktok-web-post.mjs <video.mp4> [--post]');
  process.exit(1);
}
const videoPath = path.resolve(root, videoArg);
if (!fs.existsSync(videoPath)) {
  console.error('Video not found: ' + videoPath);
  process.exit(1);
}

const caption = fs.readFileSync(path.join(root, 'output/mobile-ready/caption.txt'), 'utf8').trim();
const hashtags = fs.readFileSync(path.join(root, 'output/mobile-ready/hashtags.txt'), 'utf8').trim();
const fullCaption = `${caption}\n${hashtags}`;

const shot = (page, name) => page.screenshot({ path: path.join(root, `output/thumbs/${name}.png`), fullPage: true });

// TikTok Studio opens promo/info modals (data-floating-ui-portal) that overlay
// the editor and intercept clicks. Dismiss whatever is showing.
async function dismissModals(page) {
  // react-joyride product-tour overlay has no real dismiss button — remove it.
  await page.evaluate(() => document.getElementById('react-joyride-portal')?.remove()).catch(() => {});
  for (let i = 0; i < 4; i++) {
    const modal = page.locator('[data-floating-ui-portal]:visible, div[role="dialog"]:visible').first();
    if (!(await modal.count())) return;
    const btn = modal.locator('button:has-text("閉じる"), button:has-text("あとで"), button:has-text("後で"), button:has-text("キャンセル"), button:has-text("OK"), button[aria-label*="閉"], button[aria-label*="close" i]').first();
    try {
      if (await btn.count()) await btn.click({ timeout: 2000 });
      else await page.keyboard.press('Escape');
    } catch { await page.keyboard.press('Escape').catch(() => {}); }
    await page.waitForTimeout(800);
  }
}

const context = await chromium.launchPersistentContext(profileDir, {
  headless: true,
  viewport: { width: 1280, height: 900 },
  locale: 'ja-JP',
  args: ['--disable-blink-features=AutomationControlled'],
});

try {
  const page = await context.newPage();
  page.setDefaultTimeout(120000);

  console.error('[1/5] Open uploader');
  await page.goto('https://www.tiktok.com/upload', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6000);

  console.error('[2/5] Select video file:', path.basename(videoPath));
  await page.setInputFiles('input[type="file"]', videoPath);

  // Wait for the editor (caption box) to appear.
  await page.waitForSelector('div[contenteditable="true"]', { timeout: 180000 });
  console.error('[3/5] Editor ready. Fill caption');
  await page.waitForTimeout(5000);
  await dismissModals(page);

  const captionBox = page.locator('div[contenteditable="true"]').first();
  await captionBox.click();
  // Studio prefills the caption with the file name — clear it first.
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText(fullCaption);
  await page.keyboard.press('Escape');

  // The disclosure settings live far down the form; the form scrolls inside
  // its own container, so wheel-scroll over it.
  console.error('[4/5] Disclosure toggles (branded content / AI label)');
  await page.mouse.move(600, 500);
  for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, 1200); await page.waitForTimeout(400); }
  await dismissModals(page);

  // Disclosure options are collapsed behind 「さらに表示」.
  try {
    const more = page.locator('text=さらに表示').first();
    if (await more.count()) { await more.click({ timeout: 3000 }); await page.waitForTimeout(1500); }
  } catch { /* ignore */ }

  // Label-driven toggle: climb from the label text to the container that owns
  // the switch, flip it on if off, then confirm the follow-up dialog
  // (「オンにする」) that TikTok shows for disclosure toggles.
  async function enableToggle(label) {
    const res = await page.evaluate((text) => {
      const all = [...document.querySelectorAll('div,span,p,label')];
      const el = all.find(e => e.childElementCount <= 3 && (e.innerText || '').trim().startsWith(text));
      if (!el) return { found: false };
      let box = el;
      for (let d = 0; d < 6 && box; d++) {
        const sw = box.querySelector('[role="switch"], input[type="checkbox"]');
        if (sw) {
          const on = sw.getAttribute('aria-checked') === 'true' || sw.checked === true;
          if (!on) sw.click();
          return { found: true, wasOn: on };
        }
        box = box.parentElement;
      }
      return { found: true, noSwitch: true };
    }, label);
    if (res.found && res.wasOn === false) {
      await page.waitForTimeout(1500);
      const dlg = page.locator('div[role="dialog"]:visible, [data-floating-ui-portal]:visible').last();
      if (await dlg.count()) {
        const ok = dlg.locator('button:has-text("オンにする"), button:has-text("有効にする"), button:has-text("OK"), button:has-text("確認")').first();
        if (await ok.count()) { await ok.click().catch(() => {}); await page.waitForTimeout(1000); }
      }
    }
    return { label, ...res };
  }

  const toggleResult = [];
  toggleResult.push(await enableToggle('投稿コンテンツを開示'));
  toggleResult.push(await enableToggle('AI生成コンテンツ'));
  console.error('       toggles: ' + JSON.stringify(toggleResult));

  // Enabling 投稿コンテンツを開示 reveals sub-options; tick ブランドコンテンツ.
  const sub = await page.evaluate(() => {
    const all = [...document.querySelectorAll('div,span,p,label')];
    const el = all.find(e => e.childElementCount <= 3 && (e.innerText || '').trim().startsWith('ブランドコンテンツ'));
    if (!el) return { found: false };
    let box = el;
    for (let d = 0; d < 6 && box; d++) {
      const cb = box.querySelector('input[type="checkbox"], [role="checkbox"]');
      if (cb) {
        const on = cb.checked === true || cb.getAttribute('aria-checked') === 'true' || cb.getAttribute('data-checked') === 'true';
        if (!on) cb.click();
        return { found: true, wasOn: on };
      }
      box = box.parentElement;
    }
    return { found: true, noCheckbox: true };
  });
  console.error('       branded-content sub-option: ' + JSON.stringify(sub));
  await page.waitForTimeout(1000);

  await shot(page, 'webpost-ready');
  // Scroll back to the top and capture the caption area for verification.
  for (let i = 0; i < 10; i++) { await page.mouse.wheel(0, -1200); await page.waitForTimeout(200); }
  await page.waitForTimeout(800);
  await shot(page, 'webpost-top');
  console.error('[5/5] ' + (doPost ? 'CLICK 投稿' : 'dry run — not posting'));
  await dismissModals(page);

  if (doPost) {
    // Cancel any stale discard dialog from earlier runs, then click the exact
    // red 投稿 button (NOT 投稿予約する / nav items containing the same text).
    const stale = page.locator('div[role="dialog"]:visible button:has-text("キャンセル")').first();
    if (await stale.count()) { await stale.click().catch(() => {}); await page.waitForTimeout(800); }

    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(b => (b.innerText || '').trim() === '投稿' && b.offsetParent);
      if (!b) throw new Error('submit button not found: ' + JSON.stringify([...document.querySelectorAll('button')].map(x => (x.innerText || '').trim()).filter(Boolean)));
      b.scrollIntoView();
      b.click();
    });

    // Success = route change to content list, or a success toast/dialog.
    const outcome = await Promise.race([
      page.waitForURL(/tiktokstudio\/(content|posts)/, { timeout: 90000 }).then(() => 'redirected-to-content'),
      page.waitForSelector('text=/投稿しました|シェアしました|公開しました|投稿を完了/', { timeout: 90000 }).then(() => 'success-message'),
    ]).catch(() => null);
    await page.waitForTimeout(8000);
    await shot(page, 'webpost-done');
    console.log(JSON.stringify({ posted: outcome !== null, outcome, url: page.url() }));
  } else {
    console.log(JSON.stringify({ posted: false, dryRun: true, url: page.url() }));
  }
} finally {
  await context.close();
}
