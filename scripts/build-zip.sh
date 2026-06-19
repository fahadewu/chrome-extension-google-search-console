#!/usr/bin/env bash
# Build a clean zip of just the shippable extension files (for the Chrome
# Web Store, or for archiving). Excludes the private key and dev tooling.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
mkdir -p dist
OUT="dist/search-console-peek-$(python3 -c 'import json;print(json.load(open("manifest.json"))["version"])').zip"
rm -f "$OUT"

zip -r "$OUT" \
  manifest.json \
  src \
  icons \
  -x '*/.DS_Store' >/dev/null

echo "Built $OUT"
unzip -l "$OUT" | tail -n +2
