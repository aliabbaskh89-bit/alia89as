#!/bin/bash
# Ali Kit — installer for Premiere Pro on macOS. Double-click to run.
set -e
cd "$(dirname "$0")"
SRC="$(pwd)"
DEST="$HOME/Library/Application Support/Adobe/CEP/extensions/com.alikit.premiere"

echo "⚡ Ali Kit — التنصيب"
echo "------------------------------"

# 1) allow unsigned extensions (development mode) for every CEP version Premiere might use
for v in 9 10 11 12 13 14; do
  defaults write "com.adobe.CSXS.$v" PlayerDebugMode 1 2>/dev/null || true
done
echo "✓ تفعيل وضع المطور للإضافات"

# 2) copy the extension
mkdir -p "$(dirname "$DEST")"
rm -rf "$DEST"
rsync -a --exclude 'test' --exclude '.git' --exclude 'install-mac.command' "$SRC/" "$DEST/"
echo "✓ نسخ الإضافة إلى: $DEST"

# 3) ffmpeg + yt-dlp (needed for rendering, auto cut, captions, downloads)
if command -v brew >/dev/null 2>&1; then
  for pkg in ffmpeg yt-dlp; do
    if ! command -v "$pkg" >/dev/null 2>&1 && [ ! -x "/opt/homebrew/bin/$pkg" ] && [ ! -x "/usr/local/bin/$pkg" ]; then
      echo "… تنصيب $pkg"
      brew install "$pkg"
    fi
  done
  echo "✓ ffmpeg و yt-dlp جاهزين"
else
  echo "⚠️  ما لكيت Homebrew. نصّبه من https://brew.sh ثم شغّل: brew install ffmpeg yt-dlp"
fi

echo ""
echo "✅ تم. سكّر بريمير وافتحه من جديد، وبعدين:  Window ← Extensions ← Ali Kit"
read -n 1 -s -r -p "اضغط أي زر للإغلاق..."
