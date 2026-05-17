#!/usr/bin/env bash
# Render a TikTok-ready video WITHOUT baked-in narration.
# The output is meant to be uploaded to TikTok and combined with a trending
# in-app sound. Subtitles in the composition convey the message even with
# narration removed.
#
#   bash scripts/render-for-tiktok.sh                                    # default: top3-price
#   bash scripts/render-for-tiktok.sh compositions-roots/top3-price.html
#   bash scripts/render-for-tiktok.sh compositions-roots/slideshow-life.html

set -euo pipefail
cd "$(dirname "$0")/.."

COMP="${1:-compositions-roots/top3-price.html}"
BASE=$(basename "$COMP" .html)
DATE=$(date +%Y%m%d)
OUT="output/${BASE}-tiktok-${DATE}.mp4"

if [ ! -f "$COMP" ]; then
  echo "Composition not found: $COMP"
  exit 1
fi

# Backup + mute every audio tag (set data-volume to 0). Use python for
# cross-platform regex safety (sed -i quirks on git-bash for Windows).
python - <<PY
import re, shutil
src = "$COMP"
shutil.copyfile(src, src + ".bak")
html = open(src, "r", encoding="utf-8").read()
# Remove existing data-volume, then inject data-volume="0" on every <audio ...>
html = re.sub(r'(<audio\s+[^>]*?)\s*data-volume="[^"]*"', r'\1', html)
html = re.sub(r'<audio(\s+)', r'<audio data-volume="0"\1', html)
open(src, "w", encoding="utf-8").write(html)
print(f"Muted audio tags in {src} (backup saved)")
PY

# Render
npx --no -y hyperframes render --composition "$COMP" --output "$OUT"
RENDER_EXIT=$?

# Restore original
mv "${COMP}.bak" "$COMP"
echo "Restored ${COMP}"

if [ $RENDER_EXIT -eq 0 ]; then
  echo ""
  echo "✓ TikTok-ready video: $OUT"
  echo "  → Upload to TikTok → tap 'Sounds' → pick a trending in-app sound"
  echo "  → Captions are baked in, so the video reads correctly even with new audio"
fi
