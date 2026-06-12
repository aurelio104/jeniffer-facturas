#!/usr/bin/env bash
set -euo pipefail
FRONTEND="${FRONTEND_URL:-https://jeniffer-facturas.vercel.app}"
# API_URL debe apuntar a tu API activa (Render, túnel cloudflared, etc.)
API="${API_URL:?Define API_URL, ej. https://tu-api.onrender.com/api}"

echo "=== Smoke test PRODUCCIÓN ==="
echo "Frontend: $FRONTEND"
echo "API: $API"

code=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND/")
echo "Frontend HTTP: $code"
[ "$code" = "200" ] || exit 1

curl -sf "$API/health" | grep -q ok && echo "API health OK"

LOGIN=$(curl -sf -X POST "$API/auth/login" -H 'Content-Type: application/json' -d '{"username":"admin","password":"Admi123"}')
TOKEN=$(echo "$LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
echo "Login admin OK"

for path in proveedores facturas pagos maestra export/info; do
  curl -sf -H "Authorization: Bearer $TOKEN" "$API/$path" > /dev/null && echo "OK $path"
done

curl -sf -H "Authorization: Bearer $TOKEN" "$API/export/excel?periodo=mensual" -o /tmp/prod-export.xlsx
echo "OK export/excel ($(wc -c < /tmp/prod-export.xlsx) bytes)"

echo "=== Producción verificada ==="
