#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
BUILD_DIR="$SCRIPT_DIR/build/firefox"
STAGE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/household-firefox.XXXXXX")"
trap 'rm -rf "$STAGE_DIR"' EXIT

mkdir -p "$BUILD_DIR" "$STAGE_DIR/icons"
cp "$SCRIPT_DIR/manifest-firefox.json" "$STAGE_DIR/manifest.json"
for asset in background.js content.js player.js popup.js popup.html popup.css; do
    cp "$PROJECT_DIR/$asset" "$STAGE_DIR/$asset"
done
cp -R "$PROJECT_DIR/icons/." "$STAGE_DIR/icons/"

cd "$STAGE_DIR"
zip -q -r "$STAGE_DIR/netflix-bypass-firefox.zip" manifest.json background.js content.js player.js popup.js popup.html popup.css icons
mv "$STAGE_DIR/netflix-bypass-firefox.zip" "$BUILD_DIR/netflix-bypass-firefox.zip"
echo "Built Firefox ZIP in $BUILD_DIR"
