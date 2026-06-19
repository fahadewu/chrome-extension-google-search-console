#!/usr/bin/env bash
# Build a clean zip of just the shippable extension files for the Chrome Web
# Store. The local manifest.json keeps its "key" field (so the unpacked dev ID
# stays stable), but the Web Store REJECTS packages that contain "key", so we
# strip it from the copy that goes into the zip.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
mkdir -p dist

VERSION="$(python3 -c 'import json;print(json.load(open("manifest.json"))["version"])')"
OUT="dist/search-console-peek-$VERSION.zip"
rm -f "$OUT"

# Stage the shippable files in a temp dir so we can edit the manifest copy
# without touching the working one.
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
cp -R src icons "$STAGE/"

# Copy manifest WITHOUT the "key" field (Web Store disallows it).
python3 - "$STAGE/manifest.json" <<'PY'
import json, sys
m = json.load(open("manifest.json"))
m.pop("key", None)
json.dump(m, open(sys.argv[1], "w"), indent=2)
open(sys.argv[1], "a").write("\n")
PY

( cd "$STAGE" && zip -r "$ROOT/$OUT" manifest.json src icons -x '*/.DS_Store' >/dev/null )

echo "Built $OUT  (key field stripped: $(python3 -c "import json,zipfile;print('key' not in json.loads(zipfile.ZipFile('$OUT').read('manifest.json')))"))"
unzip -l "$OUT" | tail -n +2
