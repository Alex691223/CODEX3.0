#!/usr/bin/env bash
# CODEX — build frontend for cPanel deployment
#
# Usage:
#   ./build_frontend_for_cpanel.sh https://your-domain.com
#   ./build_frontend_for_cpanel.sh https://api.your-domain.com     # if you use subdomain
#
# Output: ./build_for_cpanel/  (copy contents into cPanel public_html)

set -euo pipefail

if [ -z "${1:-}" ]; then
  echo "ERROR: pass your backend URL as first argument"
  echo "  Example: $0 https://your-domain.com"
  exit 1
fi

BACKEND_URL="$1"
HERE="$(cd "$(dirname "$0")" && pwd)"
FRONTEND="$HERE/../frontend"
OUT="$HERE/build_for_cpanel"

echo "==> Backend URL: $BACKEND_URL"
echo "==> Frontend source: $FRONTEND"

cd "$FRONTEND"

# Write production env
echo "REACT_APP_BACKEND_URL=$BACKEND_URL" > .env.production.local
echo "WDS_SOCKET_PORT=443" >> .env.production.local

echo "==> Installing deps..."
yarn install --frozen-lockfile

echo "==> Building React..."
yarn build

rm -rf "$OUT"
mkdir -p "$OUT"
cp -r build/* "$OUT/"

# .htaccess for SPA routing + cache + security headers
cp "$HERE/frontend_public_html/.htaccess" "$OUT/.htaccess"

echo
echo "==> DONE."
echo "    Upload contents of: $OUT"
echo "    Into cPanel File Manager → public_html/"
echo "    Remember: .htaccess file (hidden) must also be uploaded."
