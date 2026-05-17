#!/usr/bin/env node
// Bundle a ready-to-post video + caption + hashtags into output/mobile-ready/
// for transfer to phone (Drive / AirDrop / adb push) and TikTok upload.
//
//   node agents/prepare-for-mobile.mjs                       # use latest TikTok-ready mp4
//   node agents/prepare-for-mobile.mjs <mp4-name>            # specify mp4
//
// Output:
//   output/mobile-ready/
//     ├── video.mp4
//     ├── caption.txt         ← copy into TikTok caption field
//     ├── hashtags.txt        ← append after caption (separate file for clarity)
//     ├── sound-suggestions.txt  ← TikTok trending sound search keywords
//     └── checklist.txt       ← step-by-step posting checklist

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const outDir = path.join(root, 'output');
const mobileDir = path.join(outDir, 'mobile-ready');
fs.mkdirSync(mobileDir, { recursive: true });

// Pick the mp4 to use
const explicit = process.argv[2];
let mp4Name;
if (explicit) {
  mp4Name = explicit;
} else {
  const mp4s = fs.readdirSync(outDir).filter(f => f.endsWith('.mp4'));
  // Prefer "tiktok" tagged (no baked narration); else latest
  const tiktokVersions = mp4s.filter(f => f.includes('tiktok'));
  const pool = tiktokVersions.length ? tiktokVersions : mp4s;
  pool.sort((a, b) => fs.statSync(path.join(outDir, b)).mtimeMs - fs.statSync(path.join(outDir, a)).mtimeMs);
  mp4Name = pool[0];
}
if (!mp4Name) {
  console.error('No mp4 found in output/. Run a render first.');
  process.exit(1);
}

const mp4Path = path.join(outDir, mp4Name);
if (!fs.existsSync(mp4Path)) {
  console.error(`Not found: ${mp4Path}`);
  process.exit(1);
}

// Copy video
fs.copyFileSync(mp4Path, path.join(mobileDir, 'video.mp4'));

// Read caption + hashtags + theme
const caption = readJson('research/data/caption.json');
const products = readJson('data/products.json');
const hooks = readJson('research/data/hooks.json');

const theme = caption?.theme || 'コンテンツ';
const captionText = caption?.caption || '(キャプション未生成)';
const hashtagList = caption?.hashtags || [];

fs.writeFileSync(path.join(mobileDir, 'caption.txt'), captionText);
fs.writeFileSync(path.join(mobileDir, 'hashtags.txt'), hashtagList.join(' '));

// Sound suggestions — TikTok-internal trending sound keywords (no hardcoded titles,
// just genre cues that match the video tempo / mood)
const isFomo = /FOMO|F0[6-9]|F10|今買|損する|値上げ/.test(JSON.stringify(hooks || {}));
const isStory = mp4Name.toLowerCase().includes('story') || mp4Name.toLowerCase().includes('slideshow');
const isRanking = mp4Name.toLowerCase().includes('top3') || mp4Name.toLowerCase().includes('top5');

let soundHints;
if (isStory) {
  soundHints = [
    '【ストーリー型 (lo-fi / chill 推奨)】',
    '・「ピアノ」「lo-fi」「インスピレーション」カテゴリで検索',
    '・60-90 BPM のチル系',
    '・歌詞なし or 英語歌詞 (日本語ナレ要らずだが字幕とぶつからない)',
    '',
    '探し方:',
    '  TikTok クリエイティブセンター: https://www.tiktok.com/business/creativecenter/inspiration/popular/music/jp',
    '  「人気上昇中の楽曲」→「インスピレーション / チル」フィルタ',
  ].join('\n');
} else if (isRanking || isFomo) {
  soundHints = [
    '【ランキング/FOMO型 (アップテンポ・電子推奨)】',
    '・「電子」「ヒップホップ」「トラップ」カテゴリで検索',
    '・80-120 BPM',
    '・サイレン・ベース入りで FOMO 演出補強',
    '',
    '探し方:',
    '  TikTok クリエイティブセンター: https://www.tiktok.com/business/creativecenter/inspiration/popular/music/jp',
    '  「人気上昇中の楽曲」→「電子・ヒップホップ」フィルタ',
    '  または For You を 30分流して「3回以上聴いた楽曲」=旬',
  ].join('\n');
} else {
  soundHints = [
    '【トレンド音源を選ぶ】',
    '  TikTok クリエイティブセンター: https://www.tiktok.com/business/creativecenter/inspiration/popular/music/jp',
    '',
    '・「人気上昇中の楽曲」を毎週月曜にチェック',
    '・For You を 30分観察して 3回以上聴いた楽曲を採用',
  ].join('\n');
}
fs.writeFileSync(path.join(mobileDir, 'sound-suggestions.txt'), soundHints);

// Posting checklist
const handle = process.env.HANDLE || '@your_handle';
const checklist = `# TikTok 投稿チェックリスト (${new Date().toISOString().slice(0, 10)})

動画: video.mp4
テーマ: ${theme}
ハンドル: ${handle}

━━━━━━━━━━━━━━━━━━━━━━━━━
■ 投稿前 (3分)
━━━━━━━━━━━━━━━━━━━━━━━━━
□ video.mp4 をスマホに転送 (Drive / AirDrop / adb push)
□ caption.txt をクリップボードにコピー
□ hashtags.txt をクリップボードにコピー (キャプの最後に貼り付け)
□ sound-suggestions.txt の URL でトレンド音源を 1つ選ぶ

━━━━━━━━━━━━━━━━━━━━━━━━━
■ TikTok アプリで投稿 (5分)
━━━━━━━━━━━━━━━━━━━━━━━━━
□ 「+」→ アップロード → video.mp4 を選択
□ 「サウンド」→ 選んだトレンド音源を追加
□ 音量バランス: 元音声 0% / 追加音源 100% (元音声=既に焼かれた可能性のあるトラックを潰す)
□ キャプション欄に caption.txt + hashtags.txt を貼り付け
□ 「その他のオプション」→ 「ブランドコンテンツの開示」を ON
□ 「AI 生成コンテンツ」ラベルも ON (TikTok 2026 ルール、Edge TTS / 自動編集動画は必須)
□ プライバシー: 全員 (Public)
□ コメント: ON
□ デュエット / リミックス: ON (拡散用)
□ 「投稿」をタップ

━━━━━━━━━━━━━━━━━━━━━━━━━
■ 投稿直後 (5分)
━━━━━━━━━━━━━━━━━━━━━━━━━
□ 自分でコメント 1本 (例: 「全部プロフリンクに置いた」) → 長押し → ピン留め
□ プロフィール → リンク欄に GitHub Pages の Linktree URL が貼ってあるか確認
□ TikTok URL を Amazon Associates 管理画面に登録済みか確認 (未登録だと契約解除リスク)

━━━━━━━━━━━━━━━━━━━━━━━━━
■ 1時間後
━━━━━━━━━━━━━━━━━━━━━━━━━
□ TikTok 分析 → 「動画」タブで完走率を確認
   - 完走率 30% 超え → 今週は当たり、翌週同テーマで横展開
   - 完走率 < 30% → 翌日キャプ 1行目だけ差し替えて再投稿、または別フックで再 render
□ コメント全返信 (アルゴリズム評価↑)

━━━━━━━━━━━━━━━━━━━━━━━━━
■ 24時間後
━━━━━━━━━━━━━━━━━━━━━━━━━
□ Amazon Associates レポート → クリック数 / 売上を確認
□ docs/tiktok-viral-patterns.md の「自社学習データ」セクションに結果を追記
   → 翌週のエージェント選定がデータ駆動になる
`;
fs.writeFileSync(path.join(mobileDir, 'checklist.txt'), checklist);

console.log(`✓ Mobile-ready package created at output/mobile-ready/`);
console.log(`  video.mp4              ← ${mp4Name}`);
console.log(`  caption.txt            (${captionText.length} chars)`);
console.log(`  hashtags.txt           (${hashtagList.length} tags)`);
console.log(`  sound-suggestions.txt  (TikTok 内蔵音源の検索ヒント)`);
console.log(`  checklist.txt          (10-step posting flow)`);
console.log(`\n→ output/mobile-ready/ をスマホに同期して TikTok 投稿`);

function readJson(rel) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}
