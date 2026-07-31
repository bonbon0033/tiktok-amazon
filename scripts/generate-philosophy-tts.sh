#!/usr/bin/env bash
# Generate philosophy-slide narration as a single 30-second track.
# Tone: slow, contemplative, lower pitch — matches cosmic visuals.
#
#   bash scripts/generate-philosophy-tts.sh

set -euo pipefail
cd "$(dirname "$0")/.."

mkdir -p assets/audio/parts

VOICE="${HF_VOICE:-ja-JP-KeitaNeural}"
RATE="${HF_RATE:=-15%}"
PITCH="${HF_PITCH:=-5Hz}"

# Single track narration synced to 10 slides (3s each).
# Slight commas / pauses give breathing room between slides.
TEXT="もし宇宙の果てを見たら、あなたは何を思うだろうか。
光は１秒に、地球を、７周半進む。
それでも、宇宙の端まで、４６５億光年。人類はその中の塵にすぎない。
ならば、なぜ我々は、星を見上げるのだろうか。
答えは、我々が宇宙の一部だから。
人間は、考える葦である。考えるからこそ、宇宙より偉大だ。
明日も日常に追われる、あなたへ。
見上げた星は、４６５億年前の光だ。
この感覚を知りたい人へ、１冊紹介する。
プロフのリンクから、続きを読もう。"

echo "[tts] philosophy-narration.mp3"
# Prefer project-local venv: on Windows the PATH python lacks edge_tts and
# Scripts/*.exe launchers fail silently under Git Bash.
if [ -x ".venv-tts/Scripts/python" ]; then
  PYTTS=".venv-tts/Scripts/python"
else
  PYTTS="python"
fi
"$PYTTS" -m edge_tts \
  --voice="$VOICE" \
  --rate="$RATE" \
  --pitch="$PITCH" \
  --text "$TEXT" \
  --write-media "assets/audio/parts/philosophy-narration.mp3"

echo
ls -la assets/audio/parts/philosophy-narration.mp3
