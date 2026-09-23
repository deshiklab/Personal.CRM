#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Creates the UPLOAD keystore for Google Play release builds.
#
#   RUN THIS LOCALLY, ONCE, ON A MACHINE YOU CONTROL.
#   The generated .jks is never committed (see .gitignore).
#
#   If you lose this file or its passwords you CANNOT publish another update
#   to your Play listing, ever. Back it up in at least two places
#   (password manager + offline encrypted drive) before you ship.
#
#   Usage:  ./scripts/make-release-keystore.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
OUT="${1:-android/upload-keystore.jks}"
ALIAS="${2:-upload}"
VALIDITY="${3:-10000}"   # days — keep validity well beyond Google's 2033 floor

[ -f "$OUT" ] && { echo "refusing to overwrite existing $OUT" >&2; exit 1; }

printf 'Choose a keystore password (min 6 chars, SAVE IT): '
read -rs STOREPASS; echo
printf 'Choose a key password (SAVE IT): '
read -rs KEYPASS; echo

keytool -genkeypair -v \
  -keystore "$OUT" -storetype JKS \
  -alias "$ALIAS" \
  -keyalg RSA -keysize 2048 -validity "$VALIDITY" \
  -storepass "$STOREPASS" -keypass "$KEYPASS" \
  -dname "CN=BITSCOL, OU=Mobile, O=BITSCOL, L=Dhaka, ST=Dhaka, C=BD"

echo
echo "created $OUT (alias: $ALIAS)"
echo
echo "Add these as GitHub Actions secrets (repo -> Settings -> Secrets):"
echo "  KEYSTORE_BASE64   ->  base64 -w0 $OUT   (macOS: base64 -i $OUT)"
echo "  KEYSTORE_PASSWORD ->  the keystore password you typed"
echo "  KEY_ALIAS         ->  $ALIAS"
echo "  KEY_PASSWORD      ->  the key password you typed"
echo
echo "Then back up the .jks file and BOTH passwords somewhere safe."
