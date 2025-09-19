#!/bin/bash
echo "Building extension for Firefox..."
cd ..
# Create the build directory and the firefox subdirectory if they don't exist
mkdir -p build_tools/build/firefox
cp build_tools/manifest-firefox.json manifest.json
zip -r build_tools/build/firefox/netflix-bypass-firefox.zip . --exclude='*.DS_Store*' --exclude='build_tools/*' --exclude='manifest-chrome.json' --exclude='*.git*'
echo "Done. Created build/firefox/netflix-bypass-firefox.zip"
rm manifest.json
