#!/usr/bin/env bash
# Regenerates the Android DEBUG keystore used for local/CI debug builds.
# Safe to delete and recreate at any time — debug keys are not used for
# distribution. NEVER use a debug keystore to sign a release.
set -euo pipefail
KEYSTORE="${1:-android/debug.keystore}"
mkdir -p "$(dirname "$KEYSTORE")"
rm -f "$KEYSTORE"
keytool -genkeypair -v \
  -keystore "$KEYSTORE" \
  -storetype JKS \
  -alias androiddebugkey \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass android -keypass android \
  -dname "CN=Android Debug, OU=Dev, O=BITSCOL, L=Dhaka, ST=Dhaka, C=BD"
echo "created $KEYSTORE"
echo
echo "If you use Google OAuth from a debug build, register this SHA-1 in"
echo "Google Cloud Console (Android OAuth client, package com.bitscol.personalcrm):"
keytool -list -v -keystore "$KEYSTORE" -alias androiddebugkey -storepass android 2>/dev/null | grep -E "SHA1:|SHA256:" || true
