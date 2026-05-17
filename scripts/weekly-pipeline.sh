#!/usr/bin/env bash
# Autonomous weekly research → agents → brief pipeline.
#
#   bash scripts/weekly-pipeline.sh [theme] [amazon-bestseller-url]
#
# Defaults: theme="自己啓発", url="https://www.amazon.co.jp/gp/bestsellers/books/"
#
# Output: output/weekly-brief-YYYYMMDD.md

set -euo pipefail
cd "$(dirname "$0")/.."

THEME="${1:-自己啓発}"
URL="${2:-https://www.amazon.co.jp/gp/bestsellers/books/}"
DATE=$(date +%Y%m%d)

echo ""
echo "=================================================================="
echo "  Weekly Pipeline — $DATE"
echo "  Theme: $THEME"
echo "  Bestseller URL: $URL"
echo "=================================================================="
echo ""

echo "▶ [1/5] Fetching Amazon bestsellers..."
node research/fetch-bestsellers.mjs "$URL" || true

# Fallback: if candidates.json doesn't exist or is empty, seed from existing products.json
if [ ! -s research/data/candidates.json ] || [ "$(node -e 'console.log((JSON.parse(require("fs").readFileSync("research/data/candidates.json","utf8")).products||[]).length)' 2>/dev/null)" = "0" ]; then
  echo "  ⚠ Bestseller fetch returned no usable data."
  echo "  Falling back to data/products.json as candidates."
  mkdir -p research/data
  node -e "
    const fs = require('fs');
    const p = JSON.parse(fs.readFileSync('data/products.json', 'utf8'));
    const candidates = p.products.map(x => ({
      asin: x.asin, name: x.name, price: x.price,
      priceNum: parseInt((x.price||'').replace(/[^0-9]/g, '')) || 0,
      rating: x.rating, reviews: x.reviews,
      reviewsNum: parseInt((x.reviews||'').replace(/[^0-9]/g, '')) || 0,
      url: 'https://www.amazon.co.jp/dp/' + x.asin,
    }));
    fs.writeFileSync('research/data/candidates.json', JSON.stringify({
      fetchedAt: new Date().toISOString(),
      source: 'fallback-from-products.json',
      products: candidates,
    }, null, 2));
    console.log('  Seeded ' + candidates.length + ' candidates from data/products.json');
  "
fi

echo ""
echo "▶ [2/5] Fetching Google Trends (optional, skip if pytrends not installed)..."
python research/fetch-trends.py "$THEME" 集中力 朝活 副業 習慣化 2>&1 | tail -5 || {
  echo "  ⚠ pytrends unavailable. Install: pip install pytrends"
  echo "  Continuing without trend data."
}

echo ""
echo "▶ [3/5] Picking 5 products (Ollama → fallback if down)..."
node agents/product-picker.mjs "$THEME"

echo ""
echo "▶ [4/5] Generating hook candidates..."
node agents/hook-generator.mjs "$THEME"

echo ""
echo "▶ [4.5/5] Generating caption + hashtags (using hook A)..."
node agents/caption-generator.mjs "$THEME" A

echo ""
echo "▶ [5/5] Assembling weekly brief..."
node agents/strategy-brief.mjs

echo ""
echo "=================================================================="
echo "  ✓ Done"
echo ""
echo "  Brief: output/weekly-brief-$DATE.md"
echo ""
echo "  Next steps:"
echo "    1. cat output/weekly-brief-$DATE.md   # review picks + hooks"
echo "    2. node agents/apply-picked.mjs       # propagate to data/products.json"
echo "    3. node scripts/swap-products.mjs     # sync into index.html"
echo "    4. (optional) edit scripts/generate-tts.sh to match chosen hook"
echo "    5. bash scripts/generate-tts.sh       # if hook changed"
echo "    6. bash scripts/new-video.sh week-$DATE"
echo ""
echo "  3rd video for the week (philosophy/cosmos):"
echo "    bash scripts/philosophy-weekly.sh"
echo "=================================================================="
