#!/usr/bin/env bash
# Levanta un servidor por variante y corre la comparacion A/B intercalada.
set -euo pipefail
T="$(cd "$(dirname "$0")/.." && pwd)"
cd "$T"
pkill -f "server.mjs.*431[9]" 2>/dev/null || true
pkill -f "server.mjs.*4320" 2>/dev/null || true
sleep 1
node .perf/server.mjs "$T/dist-perf-base" 4319 >/dev/null 2>&1 &
A=$!
node .perf/server.mjs "$T/dist-perf-b1" 4320 >/dev/null 2>&1 &
B=$!
trap 'kill $A $B 2>/dev/null || true' EXIT
sleep 2
curl -sf -o /dev/null http://127.0.0.1:4319/perf-1.html || { echo "servidor base no responde"; exit 1; }
curl -sf -o /dev/null http://127.0.0.1:4320/perf-1.html || { echo "servidor b1 no responde"; exit 1; }
node .perf/lh-ab.mjs "${1:-5}" "${2:-1,3}"
