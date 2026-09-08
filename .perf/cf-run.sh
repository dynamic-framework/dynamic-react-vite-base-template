#!/usr/bin/env bash
# Corre una variante completa del harness contrafactual.
# Uso: .perf/cf-run.sh <dir> <etiqueta> <puerto> [--script=...] [--css=...]
set -euo pipefail
DIR="$1"; LABEL="$2"; PORT="$3"; shift 3
mkdir -p .perf/out
node .perf/cf-pages.mjs "$DIR" --n=1,3 "$@"
node .perf/server.mjs "$DIR" "$PORT" > ".perf/out/$LABEL-server.log" 2>&1 &
SRV=$!
trap 'kill $SRV 2>/dev/null || true' EXIT
curl -s --retry 20 --retry-delay 1 --retry-connrefused -o /dev/null "http://127.0.0.1:$PORT/perf-1.html"
# Precalentado: el servidor comprime cada archivo en el primer request (brotli
# q11 sobre 2 MB tarda segundos). Sin esto la primera corrida de Lighthouse mide
# un servidor frio y sale fuera de rango.
for f in perf-1.html perf-3.html widget.css widget-1.js widget-2.js widget-3.js; do
  curl -s -H 'Accept-Encoding: br' -o /dev/null "http://127.0.0.1:$PORT/$f" || true
done
node .perf/cf-sizes.mjs "$DIR" "$LABEL" > ".perf/out/$LABEL-sizes.json"
node .perf/cf-check.mjs "http://127.0.0.1:$PORT" 1 ".perf/out/$LABEL-n1.png" > ".perf/out/$LABEL-check-n1.json" || true
node .perf/cf-check.mjs "http://127.0.0.1:$PORT" 3 ".perf/out/$LABEL-n3.png" > ".perf/out/$LABEL-check-n3.json" || true
node .perf/cf-lh.mjs "http://127.0.0.1:$PORT" ".perf/out/$LABEL-lh.json" 1,3 3
echo "== $LABEL listo"
