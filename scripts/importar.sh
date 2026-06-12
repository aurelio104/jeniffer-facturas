#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ ! -d .venv ]; then
  python3 -m venv .venv
  .venv/bin/pip install -r scripts/requirements.txt
fi

.venv/bin/python scripts/importar_excel_a_db.py
