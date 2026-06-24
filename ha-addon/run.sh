#!/bin/sh
set -e

# Port the Express server listens on (matches ingress_port in config.yaml)
export PORT="${PORT:-8099}"

# Tell Express where to find the built Vite static files
export STATIC_DIR="/app/public"

echo "[wall-kiosk] Starting on port ${PORT}"
echo "[wall-kiosk] Supervisor token present: $([ -n "$SUPERVISOR_TOKEN" ] && echo yes || echo no)"

exec node --enable-source-maps /app/dist/index.mjs
