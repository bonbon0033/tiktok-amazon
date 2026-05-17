#!/usr/bin/env bash
# Weekly retrospective: re-analyze the last 7+ days of posts and refresh data/strategy.json.
# Run before next week's content pipeline.
#
#   bash scripts/weekly-retro.sh

set -euo pipefail
cd "$(dirname "$0")/.."

echo ""
echo "=================================================================="
echo "  Weekly Retro — $(date +%Y-%m-%d)"
echo "=================================================================="
echo ""

POSTS=$(node -e 'console.log(JSON.parse(require("fs").readFileSync("data/performance.json","utf8")).posts.length)')
echo "Posts logged so far: $POSTS"

if [ "$POSTS" = "0" ]; then
  echo ""
  echo "  ⚠ No posts logged yet. Log a post first:"
  echo ""
  echo "     node scripts/log-post.mjs week-$(date +%Y%m%d)-rank tiktok ranking 自己啓発 books A F06 \"...\" \\"
  echo "       --views=8000 --saves=42 --clicks=11 --purchases=1 --revenue=240 --asins=B0XXX,B0YYY"
  echo ""
  exit 0
fi

echo ""
echo "▶ Updating strategy from performance log..."
node agents/learn.mjs

echo ""
echo "▶ Strategy is now baked into product-picker + hook-generator."
echo "  Next: bash scripts/weekly-pipeline.sh <theme> <bestseller-url>"
echo ""
