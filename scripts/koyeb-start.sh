#!/bin/sh
set -eu

DATA_DIR="${DATA_DIR:-/data}"
DB_FILE="${DB_FILE:-jeniffer.db}"
mkdir -p "$DATA_DIR"

export DATABASE_URL="${DATABASE_URL:-file:${DATA_DIR}/${DB_FILE}}"
export SERVE_FRONTEND="${SERVE_FRONTEND:-1}"
export PORT="${PORT:-8000}"

if [ -n "${KOYEB_PUBLIC_DOMAIN:-}" ] && [ -z "${FRONTEND_URL:-}" ]; then
  export FRONTEND_URL="https://${KOYEB_PUBLIC_DOMAIN}"
fi

echo "[jeniffer] DATABASE_URL=$DATABASE_URL"
echo "[jeniffer] PORT=$PORT FRONTEND_URL=${FRONTEND_URL:-}"

cd /app/backend
npx prisma db push 2>&1 || {
  echo "[jeniffer] prisma db push falló — verifique volumen y permisos en $DATA_DIR"
  exit 1
}

cd /app
exec node backend/dist/index.js
