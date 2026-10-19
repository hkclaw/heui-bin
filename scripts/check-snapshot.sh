#!/bin/sh
# Static snapshot gate. This repo has no package.json, so CI runs this instead of npm test.
set -eu
cd "$(dirname "$0")/.."

rev=$(tr -d '[:space:]' < rev.txt)
case "$rev" in
  v[0-9]*) ;;
  *)
    echo "rev.txt must be a single revision token, got: $rev"
    exit 1
    ;;
esac

if grep -qx 'rev.txt' .surgeignore; then
  echo "STOP: rev.txt is in .surgeignore and will not upload"
  exit 1
fi

grep -q "name=\"tap-eta-rev\" content=\"$rev\"" index.html
grep -q "var REV = '$rev'" index.html
grep -q "/assets/index-${rev}.js" index.html
grep -q "/assets/index-${rev}.css" index.html
test -f "assets/index-${rev}.js"
test -f "assets/index-${rev}.css"
grep -q "$rev" sw.js
test -f assets/arrive-notify.js
grep -q "/assets/arrive-notify.js" index.html
grep -q "assets/arrive-notify.js" sw.js
node scripts/check-arrive-notify.js
node scripts/check-walk.js
node scripts/check-settings.js
node scripts/check-ctb.js
node scripts/check-bus-filter.js
test -f manifest.webmanifest
test -f _headers
test -f data/catalogue.json
test -f data/kmb-stops.json
test -f data/ctb-stops.json
test -f data/ctb-routes.json
test -f data/lrt-stations.json
test -f data/mtr-stations.json
test -f data/tml-stations.json
test -f data/lrt-next.json

echo "snapshot $rev ok"
