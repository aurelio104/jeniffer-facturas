#!/usr/bin/env bash
# Restaura backend/prisma/dev.db en Koyeb (requiere admin + endpoint /api/admin/restore desplegado).
set -eu

API="${JENIFFER_API:-https://jeniffer-facturas-aurelio104-d09b8633.koyeb.app/api}"
DB="${1:-backend/prisma/dev.db}"
USER="${JENIFFER_USER:-admin}"
PASS="${JENIFFER_PASS:-Admi123}"

if [ ! -f "$DB" ]; then
  echo "No existe: $DB"
  exit 1
fi

echo "Login en $API ..."
TOKEN=$(curl -sf -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USER\",\"password\":\"$PASS\"}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

BYTES=$(wc -c < "$DB" | tr -d ' ')
echo "Subiendo $DB ($BYTES bytes) ..."

python3 - "$API" "$TOKEN" "$DB" <<'PY'
import base64, json, sys, urllib.request

api, token, db_path = sys.argv[1], sys.argv[2], sys.argv[3]
with open(db_path, "rb") as f:
    payload = json.dumps({"database": base64.b64encode(f.read()).decode()}).encode()

req = urllib.request.Request(
    f"{api}/admin/restore",
    data=payload,
    headers={
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    },
    method="POST",
)
with urllib.request.urlopen(req, timeout=120) as resp:
    print(resp.read().decode())
PY

echo "Esperando reinicio del servicio (60s) ..."
sleep 60

TOKEN=$(curl -sf -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USER\",\"password\":\"$PASS\"}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

PROV=$(curl -sf -H "Authorization: Bearer $TOKEN" "$API/proveedores" \
  | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")
FACT=$(curl -sf -H "Authorization: Bearer $TOKEN" "$API/facturas" \
  | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")

echo "Verificación: proveedores=$PROV facturas=$FACT"
