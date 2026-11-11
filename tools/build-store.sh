#!/usr/bin/env bash
# Builds dist/archiv-ai-<version>.zip with manifest.json at the zip root, runtime files only.
set -euo pipefail
cd "$(dirname "$0")/.."
VER=$(node -p "require('./manifest.json').version")
OUT="dist/archiv-ai-$VER.zip"
node tools/sync-site.mjs
rm -rf dist && mkdir -p dist
zip -qr "$OUT" manifest.json background.js theme.js switch.css ui.css popup.html popup.css popup.js \
  dashboard.html dashboard.css dashboard.js export.html export.css export.js sidebar.js sidebar.css \
  content lib icons \
  -x "*.DS_Store"
echo "built $OUT ($(du -h "$OUT" | cut -f1))"
unzip -l "$OUT" | tail -1
