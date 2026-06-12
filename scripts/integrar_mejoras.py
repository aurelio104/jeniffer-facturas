#!/usr/bin/env python3
"""Pipeline completo: estructura + parches VBA + xlsm final."""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LISTO = ROOT / "REGISTRO FACTURA LISTO.xlsm"
VENV_PY = Path("/tmp/vba_venv/bin/python3")


def add_modules(xlsm: Path):
    from pyopenvba import ExcelFile, VBAModuleKind
    vba_dir = ROOT / "VBA_IMPORTAR"
    with ExcelFile(str(xlsm)) as wb:
        project = wb.vba_project()
        names = set(project.module_names())
        for name, fname in [("UtilidadesSistema", "UtilidadesSistema.bas"), ("ControlInterno", "ControlInterno.bas")]:
            if name not in names:
                text = (vba_dir / fname).read_text(encoding="utf-8").replace("\n", "\r\n")
                project.add_module(name, text, kind=VBAModuleKind.standard)
        wb.save(str(xlsm))


def main():
    if not LISTO.exists():
        print("Falta REGISTRO FACTURA LISTO.xlsm")
        sys.exit(1)
    subprocess.run([sys.executable, str(ROOT / "scripts" / "actualizar_estructura_completo.py")], check=True)
    subprocess.run([str(VENV_PY), "-m", "pyopenvba", "pull", str(LISTO), "/tmp/vba_full"], check=True)
    subprocess.run([sys.executable, str(ROOT / "scripts" / "aplicar_patches_vba.py")], check=True)
    subprocess.run([str(VENV_PY), "-m", "pyopenvba", "push", "/tmp/vba_full", str(LISTO), "--out", str(LISTO)], check=True)
    add_modules(LISTO)
    print(f"\nListo: {LISTO}")


if __name__ == "__main__":
    main()
