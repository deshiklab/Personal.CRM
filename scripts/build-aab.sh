#!/usr/bin/env bash
# Build a signed Play upload AAB. Requires Android SDK + release keystore env.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
npm run build
npx cap sync android
cd android
./gradlew bundleRelease
echo ""
echo "AAB → $ROOT/android/app/build/outputs/bundle/release/app-release.aab"
echo "Upload to Play Console → Closed testing. See docs/CLOSED-TEST.md"
