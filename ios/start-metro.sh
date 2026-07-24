#!/bin/bash

set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
METRO_PORT="${RCT_METRO_PORT:-8081}"
METRO_STATUS_URL="http://127.0.0.1:${METRO_PORT}/status"
METRO_LOG="${TMPDIR:-/tmp/}aacp-metro.log"

if /usr/bin/curl --silent --fail --max-time 1 "$METRO_STATUS_URL" |
  /usr/bin/grep --quiet "packager-status:running"; then
  exit 0
fi

# Xcode'un kullandığı Node yolunu React Native ortam dosyalarından al.
if [ -f "$SCRIPT_DIR/.xcode.env" ]; then
  # shellcheck disable=SC1091
  source "$SCRIPT_DIR/.xcode.env"
fi
if [ -f "$SCRIPT_DIR/.xcode.env.local" ]; then
  # shellcheck disable=SC1091
  source "$SCRIPT_DIR/.xcode.env.local"
fi
NODE_BINARY="${NODE_BINARY:-$(command -v node)}"

cd "$PROJECT_ROOT" || exit 1
nohup "$NODE_BINARY" node_modules/react-native/cli.js start \
  --port "$METRO_PORT" >"$METRO_LOG" 2>&1 </dev/null &

# Uygulamayı başlatmadan önce Metro'nun dinlemeye hazır olmasını bekle.
for _ in {1..20}; do
  if /usr/bin/curl --silent --fail --max-time 1 "$METRO_STATUS_URL" |
    /usr/bin/grep --quiet "packager-status:running"; then
    echo "Metro ${METRO_PORT} portunda hazır."
    exit 0
  fi
  sleep 0.5
done

echo "error: Metro başlatılamadı. Ayrıntılar: $METRO_LOG"
exit 1
