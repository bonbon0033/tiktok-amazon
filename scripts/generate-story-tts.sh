#!/usr/bin/env bash
# Generate story-mode narration audio.
#   bash scripts/generate-story-tts.sh

set -euo pipefail
cd "$(dirname "$0")/.."

mkdir -p assets/audio/story

VOICE="${HF_VOICE:-ja-JP-NanamiNeural}"
RATE="${HF_RATE:-+10%}"
PITCH="${HF_PITCH:-+0Hz}"

say() {
  local out="$1"; shift
  local text="$1"; shift
  echo "[tts] $out  <-  $text"
  python -m edge_tts \
    --voice "$VOICE" \
    --rate "$RATE" \
    --pitch "$PITCH" \
    --text "$text" \
    --write-media "assets/audio/story/$out"
}

say "01-hook.mp3"     "3年やって稼げなかった話、聞いて"
say "02-problem.mp3"  "TikTokやっても再生ゼロ、本読んでも続かなかった。月の収益ゼロ円"
say "03-realize.mp3"  "あるとき気づいた。続かないのはやる気じゃない、習慣化してないだけだったって"
say "04-solution.mp3" "これに毎日書いた。3ヶ月で月5万、半年で月10万超えた"
say "05-cta.mp3"      "プロフリンクの3位に、私が使ったやつ置いといた"

echo
ls -la assets/audio/story/
