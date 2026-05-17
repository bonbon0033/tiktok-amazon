#!/usr/bin/env bash
# Weekly pipeline for the philosophy/cosmos/wisdom genre.
# Rotates one book from data/philosophy-products.json into philosophy-slide/index.html,
# regenerates narration, and renders.
#
#   bash scripts/philosophy-weekly.sh [rotation-index]
#
# rotation-index: 0-based index into candidates[]. Defaults to ISO week number mod N.

set -euo pipefail
cd "$(dirname "$0")/.."

# Pick rotation
ROTATION="${1:-auto}"

if [ "$ROTATION" = "auto" ]; then
  WEEK=$(date +%V)
  COUNT=$(node -e 'console.log(JSON.parse(require("fs").readFileSync("data/philosophy-products.json","utf8")).candidates.length)')
  ROTATION=$(( (10#$WEEK) % COUNT ))
  echo "[philosophy] Auto-rotation: ISO week $WEEK → candidate index $ROTATION (of $COUNT)"
fi

# Update currentBook to candidates[ROTATION]
node -e "
const fs = require('fs');
const p = JSON.parse(fs.readFileSync('data/philosophy-products.json', 'utf8'));
const idx = ${ROTATION} % p.candidates.length;
const next = p.candidates[idx];
p.currentBook = {
  asin: next.asin,
  title: next.title,
  author: next.author,
  publisher: next.publisher || '',
  price: next.price || '',
  tagline: next.tagline,
  themeSlideKey: next.themeSlideKey,
};
fs.writeFileSync('data/philosophy-products.json', JSON.stringify(p, null, 2));
console.log('  Selected: 「' + next.title + '」 by ' + next.author + ' (theme: ' + next.themeSlideKey + ')');
"

echo ""
echo "▶ Syncing book into philosophy-slide/index.html..."
node scripts/swap-philosophy.mjs

echo ""
echo "▶ Regenerating narration TTS..."
bash scripts/generate-philosophy-tts.sh

echo ""
echo "▶ Rendering MP4..."
DATE=$(date +%Y%m%d)
npx hyperframes render --composition philosophy-slide/index.html --output "output/philosophy-$DATE.mp4" --resolution portrait

echo ""
echo "=================================================================="
echo "  ✓ Philosophy video ready: output/philosophy-$DATE.mp4"
echo "  Book: $(node -e 'console.log(JSON.parse(require("fs").readFileSync("data/philosophy-products.json","utf8")).currentBook.title)')"
echo "=================================================================="
