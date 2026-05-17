#!/usr/bin/env bash
# Generate narration for the 4-slide "life-change" story composition.
#   bash scripts/generate-slideshow-tts.sh
#
# Voice strategy: female narration throughout (intimacy + relatability),
# rate dynamic per emotional beat (hook fast, problem slow, process steady, CTA push).

set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p assets/audio/slideshow

say() {
  local out="$1"; shift
  local voice="$1"; shift
  local rate="$1"; shift
  local pitch="$1"; shift
  local text="$1"; shift
  echo "[tts] $out  $voice rate=$rate pitch=$pitch"
  python -m edge_tts \
    --voice "$voice" \
    --rate="$rate" \
    --pitch="$pitch" \
    --text "$text" \
    --write-media "assets/audio/slideshow/$out"
}

# Hook  : intimate confession start
say "01-hook.mp3"     "ja-JP-NanamiNeural" "+12%" "+8Hz"  "私が月ゼロから5万円稼げた、本当の理由、3分で話します"

# Problem: slower, vulnerable
say "02-problem.mp3"  "ja-JP-NanamiNeural" "+5%"  "-5Hz"  "最初は全然続かなくて、3年やっても稼げなかった。フォロワーも増えなかった"

# Process: steady, gentle reveal
say "03-process.mp3"  "ja-JP-NanamiNeural" "+10%" "+0Hz"  "でも、これに毎日3行だけ書いてみた。気づいたら、習慣になってた"

# CTA: warm push, slightly faster
say "04-cta.mp3"      "ja-JP-NanamiNeural" "+18%" "+15Hz" "3ヶ月で月5万円突破。私が使ったの、プロフリンクに置いておいた"

echo
echo "Generated $(ls assets/audio/slideshow/*.mp3 | wc -l) audio files."
ls -la assets/audio/slideshow/
