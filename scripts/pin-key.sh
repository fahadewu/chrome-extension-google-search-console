#!/usr/bin/env bash
# Generate a private key, pin the extension's public "key" into manifest.json,
# and print the resulting stable extension ID.
#
# Run once. Keep key.pem PRIVATE and OUT of git and the Web Store zip.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
KEY="$ROOT/key.pem"
MANIFEST="$ROOT/manifest.json"

if [[ ! -f "$KEY" ]]; then
  echo "Generating private key -> key.pem"
  openssl genrsa 2048 2>/dev/null > "$KEY"
else
  echo "Reusing existing key.pem"
fi

# Public key in DER (SubjectPublicKeyInfo) form.
PUB_DER="$(mktemp)"
openssl rsa -in "$KEY" -pubout -outform DER 2>/dev/null > "$PUB_DER"

# manifest "key" = base64 of the DER public key.
MANIFEST_KEY="$(base64 < "$PUB_DER" | tr -d '\n')"

# Extension ID = first 16 bytes of SHA256(DER), each hex nibble mapped 0-f -> a-p.
EXT_ID="$(python3 - "$PUB_DER" <<'PY'
import hashlib, sys
der = open(sys.argv[1], "rb").read()
digest = hashlib.sha256(der).hexdigest()[:32]
print("".join(chr(ord('a') + int(c, 16)) for c in digest))
PY
)"
rm -f "$PUB_DER"

# Write the key into manifest.json (insert or replace the "key" field).
python3 - "$MANIFEST" "$MANIFEST_KEY" <<'PY'
import json, sys
path, key = sys.argv[1], sys.argv[2]
m = json.load(open(path))
m["key"] = key
json.dump(m, open(path, "w"), indent=2)
open(path, "a").write("\n")
PY

echo
echo "================================================================"
echo " Stable extension ID:"
echo "   $EXT_ID"
echo
echo " Use this ID when creating the OAuth client (type: Chrome"
echo " Extension) in Google Cloud Console. The ID will stay the same"
echo " every time you reload the unpacked extension."
echo "================================================================"
