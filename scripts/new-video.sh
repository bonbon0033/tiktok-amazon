#!/usr/bin/env bash
# Render a new ranking video for today's batch.
# Steps: lint -> inspect -> render -> rebuild linktree -> show output paths.
#
# Usage:
#   bash scripts/new-video.sh                # default name: output/tiktok-YYYYMMDD.mp4
#   bash scripts/new-video.sh my-video       # output/my-video.mp4

set -euo pipefail
cd "$(dirname "$0")/.."

NAME="${1:-tiktok-$(date +%Y%m%d)}"
OUT="output/${NAME}.mp4"

mkdir -p output

echo "▶ Linting..."
npx --no -y hyperframes lint

echo "▶ Inspecting layout..."
npx --no -y hyperframes inspect

echo "▶ Rendering -> $OUT"
npx --no -y hyperframes render --output "$OUT"

echo "▶ Rebuilding linktree..."
node scripts/build-linktree.mjs

echo ""
echo "✓ Done."
echo "  Video    : $OUT"
echo "  Linktree : linktree/output.html"
echo ""
echo "Next: open posting-kit.md for caption + hashtags."
