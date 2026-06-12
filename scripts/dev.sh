#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

for port in 3020 3021; do
  if lsof -ti:"$port" >/dev/null 2>&1; then
    echo "Liberando puerto $port..."
    lsof -ti:"$port" | xargs kill -9 2>/dev/null || true
    sleep 0.5
  fi
done

if [ ! -f backend/prisma/dev.db ]; then
  echo "Inicializando base de datos local..."
  npm run db:push
  npm run db:seed
fi

exec npx concurrently -n api,web -c cyan,green "npm run dev:backend" "npm run dev:frontend"
