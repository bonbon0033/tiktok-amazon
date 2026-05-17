#!/usr/bin/env bash
# Dynamic narration for TOP3 composition:
#  - Voice rotation (Nanami / Keita) gives sonic variety
#  - Per-scene rate/pitch creates emotional arc (warn → urgent → finale → push)
#
#   bash scripts/generate-top3-tts.sh

set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p assets/audio/top3

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
    --write-media "assets/audio/top3/$out"
}

# ─── Emotional arc ────────────────────────────────────────────────
# Hook  : Nanami, fast & high   → warning tone
# Rank3 : Keita,  steady        → male voice for variety + authority
# Rank2 : Nanami, slow & low    → whisper / "secret" tone
# Rank1 : Keita,  bold & high   → declarative finale
# CTA   : Nanami, fastest       → urgent push-out

say "01-hook.mp3"   "ja-JP-NanamiNeural" "+22%" "+30Hz" "今買わないと一生損する、Amazon神アイテムTOP3、もうすぐ値上げかも"
say "02-rank3.mp3"  "ja-JP-KeitaNeural"  "+8%"  "+8Hz"  "3位、もうすぐ値上げ確実。今が買い時のラストチャンス、絶対損するな"
say "03-rank2.mp3"  "ja-JP-NanamiNeural" "+0%"  "-8Hz"  "2位、99パーセントの人は気づいてない神品。知ってる人だけ得してる、知らないと一生損する"
say "04-rank1.mp3"  "ja-JP-KeitaNeural"  "+25%" "+20Hz" "1位、買い逃したら一生後悔する神品。TikTokで爆売れ中、今すぐ動け"
say "05-cta.mp3"    "ja-JP-NanamiNeural" "+32%" "+35Hz" "急げ、今すぐプロフから飛べ、明日には間に合わないかも、見逃したら一生損する"

echo
echo "Generated $(ls assets/audio/top3/*.mp3 | wc -l) audio files."
ls -la assets/audio/top3/
