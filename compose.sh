#!/usr/bin/env bash
# compose.sh — post-process Remotion output for web delivery.
#
# Usage:
#   ./compose.sh out/my-video.mp4                    # produces out/my-video-web.mp4
#   ./compose.sh out/my-video.mp4 out/final.mp4      # explicit output path
#   ./compose.sh out/my-video.mp4 out/final.mp4 square  # 1:1 aspect for IG feed

set -euo pipefail

INPUT="${1:?Usage: compose.sh <input.mp4> [output.mp4] [aspect]}"
OUTPUT="${2:-${INPUT%.*}-web.mp4}"
ASPECT="${3:-}"

# Detect ffmpeg: prefer system, fall back to Remotion's bundled binary
if command -v ffmpeg &>/dev/null; then
  FFMPEG="ffmpeg"
else
  FFMPEG="npx remotion ffmpeg"
fi

VF=""
case "$ASPECT" in
  square)
    VF="-vf scale=1080:1080:force_original_aspect_ratio=increase,crop=1080:1080"
    ;;
  vertical)
    VF="-vf scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920"
    ;;
  horizontal)
    VF="-vf scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black"
    ;;
  "")
    # No aspect change
    ;;
  *)
    echo "Unknown aspect: $ASPECT (expected: square|vertical|horizontal)" >&2
    exit 1
    ;;
esac

echo "==> Input:  $INPUT ($(du -h "$INPUT" | cut -f1))"
echo "==> Output: $OUTPUT"

# shellcheck disable=SC2086
$FFMPEG -y -i "$INPUT" \
  $VF \
  -c:v libx264 -crf 28 -preset slow -pix_fmt yuv420p \
  -c:a aac -b:a 128k \
  -movflags +faststart \
  "$OUTPUT"

echo "==> Done.   $(du -h "$OUTPUT" | cut -f1)"
