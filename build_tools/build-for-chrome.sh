#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
BUILD_DIR="$SCRIPT_DIR/build/chrome"
ARCHIVE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/household-chrome.XXXXXX")"
trap 'rm -rf "$ARCHIVE_DIR"' EXIT

mkdir -p "$BUILD_DIR/icons"
cp "$SCRIPT_DIR/manifest-chrome.json" "$BUILD_DIR/manifest.json"
for asset in background.js content.js popup.js popup.html popup.css; do
    cp "$PROJECT_DIR/$asset" "$BUILD_DIR/$asset"
done
cp -R "$PROJECT_DIR/icons/." "$BUILD_DIR/icons/"

cd "$BUILD_DIR"
zip -q -r "$ARCHIVE_DIR/netflix-bypass-chrome.zip" manifest.json background.js content.js popup.js popup.html popup.css icons
mv "$ARCHIVE_DIR/netflix-bypass-chrome.zip" "$BUILD_DIR/netflix-bypass-chrome.zip"
echo "Built unpacked extension and ZIP in $BUILD_DIR"
