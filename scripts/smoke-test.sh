#!/usr/bin/env bash
set -euo pipefail
API="${API_URL:-http://127.0.0.1:3020/api}"
FAIL=0

pass() { echo "  OK  $1"; }
fail() { echo "  FAIL $1"; FAIL=1; }

echo "=== Smoke test Jeniffer API ==="
echo "Base: $API"

# Health (no auth)
if curl -sf "$API/health" | grep -q ok; then pass "health"; else fail "health"; fi

# Login
LOGIN=$(curl -sf -X POST "$API/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"Admi123"}') || { fail "login"; echo "$LOGIN"; exit 1; }
TOKEN=$(echo "$LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
pass "login admin"

auth() { curl -sf -H "Authorization: Bearer $TOKEN" "$@"; }

# Auth me
if auth "$API/auth/me" | grep -q admin; then pass "auth/me"; else fail "auth/me"; fi

# Modules
for path in proveedores facturas pagos tasas maestra alertas; do
  if auth "$API/$path" | python3 -c "import sys,json; json.load(sys.stdin)" 2>/dev/null; then
    pass "GET /$path"
  else
    fail "GET /$path"
  fi
done

if auth "$API/maestra/dashboard" | grep -q totalFacturas; then pass "maestra/dashboard"; else fail "maestra/dashboard"; fi
if auth "$API/maestra/tab-islr" | python3 -c "import sys,json; json.load(sys.stdin)" 2>/dev/null; then pass "maestra/tab-islr"; else fail "tab-islr"; fi
if auth "$API/maestra/config?categoria=banco" | python3 -c "import sys,json; json.load(sys.stdin)" 2>/dev/null; then pass "config banco"; else fail "config"; fi
if auth "$API/export/info?periodo=mensual" | grep -q facturas; then pass "export/info"; else fail "export/info"; fi

# Export blobs
EXCEL=$(curl -sf -H "Authorization: Bearer $TOKEN" "$API/export/excel?periodo=mensual" -o /tmp/jeniffer-test.xlsx -w "%{http_code}")
if [ "$EXCEL" = "200" ] && [ -f /tmp/jeniffer-test.xlsx ]; then pass "export/excel"; else fail "export/excel"; fi
PDF=$(curl -sf -H "Authorization: Bearer $TOKEN" "$API/export/pdf?periodo=mensual" -o /tmp/jeniffer-test.pdf -w "%{http_code}")
if [ "$PDF" = "200" ] && [ -f /tmp/jeniffer-test.pdf ]; then pass "export/pdf"; else fail "export/pdf"; fi

# Admin (backup header only)
BACKUP_CODE=$(curl -s -o /tmp/jeniffer-backup.db -w "%{http_code}" -H "Authorization: Bearer $TOKEN" "$API/admin/backup")
if [ "$BACKUP_CODE" = "200" ]; then pass "admin/backup"; else fail "admin/backup ($BACKUP_CODE)"; fi

# Operador login
OP=$(curl -sf -X POST "$API/auth/login" -H 'Content-Type: application/json' -d '{"username":"jeniffer","password":"1234"}')
OP_TOKEN=$(echo "$OP" | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
if curl -sf -H "Authorization: Bearer $OP_TOKEN" "$API/facturas" | python3 -c "import sys,json; json.load(sys.stdin)" 2>/dev/null; then
  pass "login operador jeniffer"
else
  fail "login operador"
fi

# Operador cannot admin backup
OP_BACKUP=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $OP_TOKEN" "$API/admin/backup")
if [ "$OP_BACKUP" = "403" ]; then pass "operador blocked from backup"; else fail "operador backup should 403 got $OP_BACKUP"; fi

echo "=== Resultado: $([ $FAIL -eq 0 ] && echo 'TODOS OK' || echo 'HAY ERRORES') ==="
exit $FAIL
