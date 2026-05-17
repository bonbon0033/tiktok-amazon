#!/usr/bin/env bash
# Generate per-scene narration audio using Microsoft Edge TTS.
# Output: assets/audio/parts/0X-name.mp3
#
# Usage: bash scripts/generate-tts.sh
#
# Voice catalog (JP): ja-JP-NanamiNeural (F, friendly), ja-JP-KeitaNeural (M)

set -euo pipefail
cd "$(dirname "$0")/.."

mkdir -p assets/audio/parts

VOICE="${HF_VOICE:-ja-JP-NanamiNeural}"
RATE="${HF_RATE:-+12%}"
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
    --write-media "assets/audio/parts/$out"
}

say "01-hook.mp3"   "Amazonで爆売れ。自己啓発トップ5"
say "02-rank5.mp3"  "5位、目を守らないと脳もやられる"
say "03-rank4.mp3"  "4位、25分集中するだけで人生変わる"
say "04-rank3.mp3"  "3位、書かないやつは続かない"
say "05-rank2.mp3"  "2位、本読まないなら今ポチれ"
say "06-rank1.mp3"  "1位、これ読んでないのは情弱"
say "07-cta.mp3"    "保存して、プロフから飛べ"

echo
echo "Generated $(ls assets/audio/parts/*.mp3 | wc -l) audio files."
ls -la assets/audio/parts/
