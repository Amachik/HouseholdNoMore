#!/bin/bash
echo "Building extension for Chrome..."
cd ..
# Create the build directory and the chrome subdirectory if they don't exist
mkdir -p build_tools/build/chrome
cp build_tools/manifest-chrome.json manifest.json
zip -r build_tools/build/chrome/netflix-bypass-chrome.zip . --exclude='*.DS_Store*' --exclude='build_tools/*' --exclude='manifest-firefox.json' --exclude='*.git*'
echo "Done. Created build/chrome/netflix-bypass-chrome.zip"
rm manifest.json
