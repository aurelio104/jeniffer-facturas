#!/usr/bin/env python3
"""Integra estructura Excel + parches VBA y genera archivo listo para trabajar."""
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "REGISTRO FACTURA DEFINITIVO.xlsm"
OUT = ROOT / "REGISTRO FACTURA LISTO.xlsm"
VENV_PY = Path("/tmp/vba_venv/bin/python3")


def run_estructura():
    subprocess.run([sys.executable, str(ROOT / "scripts" / "actualizar_estructura.py")], check=True)
    tmp = ROOT / "REGISTRO FACTURA DEFINITIVO_CORREGIDO.xlsm"
    if not tmp.exists():
        raise SystemExit("No se generó el archivo de estructura")
    return tmp


def patch_registro_fact(content: str) -> str:
    content = content.replace("ObtenerORegistrarTasa", "ObtenerTasaDelDia")
    content = content.replace('Me.ComboBoxTIPO.Value = "Recibo"', 'Me.ComboBoxTIPO.Value = "REC"')
    content = content.replace(
        "No se pueden aplicar retenciones de ISLR a un Recibo.",
        "No se pueden aplicar retenciones de ISLR a un Recibo (REC).",
    )
    content = content.replace("Me.TextBoxID.BackColor = RGB(220, 220, 220)", "Me.TextBoxID.BackColor = COLOR_BLOQUEADO")
    content = content.replace("colorFondo = RGB(230, 230, 230)", "colorFondo = COLOR_BLOQUEADO")
    content = re.sub(
        r"Private Function ObtenerTasaDelDia\(ByVal fechaFactura As Date\) As Double.*?^End Function\r?\n",
        "",
        content,
        count=1,
        flags=re.MULTILINE | re.DOTALL,
    )

    moneda_block = """
        ' Moneda y conversión USD al momento del registro
        Dim monedaTxt As String
        Dim tasaRegistro As Double
        Dim totalUsd As Double

        If Me.OptionButtonUSD.Value = True Then
            monedaTxt = "USD"
            tasaRegistro = tasaDia
            totalUsd = montoTotalDoc
        Else
            monedaTxt = "Bs"
            tasaRegistro = ObtenerTasaDelDia(CDate(TextBoxFecha.Value))
            If tasaRegistro > 0 Then
                totalUsd = totalEnBs / tasaRegistro
            Else
                totalUsd = 0
            End If
        End If

        If ColumnaExisteEnTbl(Tbl, "MONEDA") Then
            .Cells(1, Tbl.ListColumns("MONEDA").Index).Value = monedaTxt
        End If
        If ColumnaExisteEnTbl(Tbl, "TASA REGISTRO") Then
            .Cells(1, Tbl.ListColumns("TASA REGISTRO").Index).Value = tasaRegistro
        End If
        If ColumnaExisteEnTbl(Tbl, "TOTAL USD") Then
            .Cells(1, Tbl.ListColumns("TOTAL USD").Index).Value = totalUsd
        End If
"""

    content = content.replace(
        "        .Cells(1, Tbl.ListColumns(\"EXENTO\").Index).Value = exentoEnBs\n        \n                ",
        "        .Cells(1, Tbl.ListColumns(\"EXENTO\").Index).Value = exentoEnBs\n" + moneda_block + "\n                ",
    )

    # Bs: usar tasa real para registro USD
    content = content.replace(
        "        totalEnBs = montoTotalDoc\n        exentoEnBs = montoExentoDoc\n        tasaDia = 1\n        dolaresOriginales = 0",
        "        totalEnBs = montoTotalDoc\n        exentoEnBs = montoExentoDoc\n        tasaDia = ObtenerTasaDelDia(CDate(TextBoxFecha.Value))\n        dolaresOriginales = 0",
    )

    post_guardar = """
    Dim filaGuardada As Long
    If filaEdicion > 0 Then
        filaGuardada = filaEdicion
    Else
        filaGuardada = 1
    End If
    Call ControlInterno.PostGuardarFactura(filaGuardada)

"""
    content = content.replace(
        "    ' Limpieza total del formulario para el siguiente registro\n    filaEdicion = 0",
        post_guardar + "    ' Limpieza total del formulario para el siguiente registro\n    filaEdicion = 0",
    )

    if "Private Function ColumnaExisteEnTbl" not in content:
        content += """
Private Function ColumnaExisteEnTbl(tbl As ListObject, nombre As String) As Boolean
    On Error Resume Next
    ColumnaExisteEnTbl = tbl.ListColumns(nombre).Index > 0
    On Error GoTo 0
End Function
"""

    return content


def patch_registropagos(content: str) -> str:
    if "Nro. factura / documento..." not in content:
        content = re.sub(
            r"DOCUMENTO\.Locked = True\s+DOCUMENTO\.BackColor = RGB\(230, 230, 230\)",
            "DOCUMENTO.Locked = False\n    DOCUMENTO.BackColor = COLOR_ACTIVO\n    DOCUMENTO.Text = \"Nro. factura / documento...\"\n    DOCUMENTO.ForeColor = &H80000011",
            content,
            count=1,
        )
        content = content.replace(
            "MontoBs.Locked = True\n    MontoUSD.Locked = True",
            "MontoBs.Locked = True\n    MontoBs.BackColor = COLOR_BLOQUEADO\n    MontoUSD.Locked = True\n    MontoUSD.BackColor = COLOR_BLOQUEADO",
            1,
        )
    content = content.replace("RGB(230, 230, 230)", "COLOR_BLOQUEADO")
    content = content.replace("RGB(255, 255, 255)", "COLOR_ACTIVO")

    documento_events = """
Private Sub DOCUMENTO_Enter()
    If DOCUMENTO.Text = "Nro. factura / documento..." Then
        DOCUMENTO.Text = ""
        DOCUMENTO.ForeColor = &H80000008
    End If
End Sub

Private Sub DOCUMENTO_KeyDown(ByVal KeyCode As MSForms.ReturnInteger, ByVal Shift As Integer)
    If KeyCode = 13 Then Call BuscarDocumentoParaPago
End Sub

Private Sub BuscarDocumentoParaPago()
    Dim doc As String
    Dim lr As ListRow
    Dim tblFact As ListObject
    Dim neto As Double
    Dim netoUsd As Double
    Dim tasa As Double

    doc = Trim(DOCUMENTO.Text)
    If doc = "" Or doc = "Nro. factura / documento..." Or UCase(doc) = "ANTICIPO" Then Exit Sub

    DesprotegerHoja("REGISTRO FACT")
    Set tblFact = Sheets("REGISTRO FACT").ListObjects("REGISTROFACTURAS")

    Set lr = BuscarFacturaPorNumero(doc)
    If lr Is Nothing Then
        MsgBox "Documento no encontrado en REGISTRO FACT.", vbExclamation
        DOCUMENTO.SetFocus
        ProtegerHoja("REGISTRO FACT")
        Exit Sub
    End If

    bloqueandoEventos = True
    RIF.Text = lr.Range(tblFact.ListColumns("RIF").Index).Value
    PROVEEDOR.Text = lr.Range(tblFact.ListColumns("PROVEEDOR").Index).Value
    DOCUMENTO.Text = lr.Range(tblFact.ListColumns("NUMERO").Index).Value
    DOCUMENTO.Locked = True
    DOCUMENTO.BackColor = COLOR_BLOQUEADO

    neto = CDbl(lr.Range(tblFact.ListColumns("MONTO A PAGAR").Index).Value)
    MontoBs.Text = Format(neto, "#,##0.00")
    MontoBs.ForeColor = &H80000008

    On Error Resume Next
    netoUsd = CDbl(lr.Range(tblFact.ListColumns("MONTO A PAGAR $").Index).Value)
    On Error GoTo 0
    If netoUsd > 0 Then
        MontoUSD.Text = Format(netoUsd, "#,##0.00")
    Else
        tasa = ObtenerTasaDelDia(CDate(lr.Range(tblFact.ListColumns("FECHA").Index).Value))
        If tasa > 0 Then MontoUSD.Text = Format(neto / tasa, "#,##0.00")
    End If

    bloqueandoEventos = False
    ProtegerHoja("REGISTRO FACT")
    FORMAPAG.SetFocus
End Sub
"""

    if "BuscarDocumentoParaPago" not in content:
        content = content.replace(
            "Private Sub PROVEEDOR_Change()",
            documento_events + "\nPrivate Sub PROVEEDOR_Change()",
        )

    if "PostGuardarPago" not in content:
        content = content.replace(
            'MsgBox "Registro de pago procesado con éxito.", vbInformation, "Éxito"',
            'Call ControlInterno.PostGuardarPago(RIF.Text, DOCUMENTO.Text, PROVEEDOR.Text)\n\n    MsgBox "Registro de pago procesado con éxito.", vbInformation, "Éxito"',
        )

    return content


def patch_thisworkbook(content: str) -> str:
    if "BD MAESTRA" not in content:
        content = content.replace(
            "End Sub",
            "    On Error Resume Next\n    Sheets(\"BD MAESTRA\").Protect Password:=\"1234\", UserInterfaceOnly:=True, AllowFiltering:=True\n    On Error GoTo 0\nEnd Sub",
            1,
        )
    return content


def add_new_modules(xlsm_path: Path) -> None:
    from pyopenvba import ExcelFile, VBAModuleKind

    vba_dir = ROOT / "VBA_IMPORTAR"
    with ExcelFile(str(xlsm_path)) as wb:
        project = wb.vba_project()
        names = set(project.module_names())
        for name, fname in [("UtilidadesSistema", "UtilidadesSistema.bas"), ("ControlInterno", "ControlInterno.bas")]:
            if name not in names:
                text = (vba_dir / fname).read_text(encoding="utf-8").replace("\n", "\r\n")
                project.add_module(name, text, kind=VBAModuleKind.standard)
        wb.save(str(xlsm_path))


def patch_validaciones(content: str) -> str:
    if "SincronizarMaestra" not in content:
        content += """
Sub SincronizarMaestra()
    Call ControlInterno.SincronizarMaestraCompleta
End Sub
"""
    return content


def main():
    base = run_estructura()
    work_dir = Path(tempfile.mkdtemp(prefix="vba_build_"))

    subprocess.run(
        [str(VENV_PY), "-m", "pyopenvba", "pull", str(base), str(work_dir)],
        check=True,
    )

    (work_dir / "REGISTRO_FACT.cls").write_text(
        patch_registro_fact((work_dir / "REGISTRO_FACT.cls").read_text(encoding="latin-1")),
        encoding="latin-1",
    )
    (work_dir / "REGISTROPAGOS.cls").write_text(
        patch_registropagos((work_dir / "REGISTROPAGOS.cls").read_text(encoding="latin-1")),
        encoding="latin-1",
    )
    (work_dir / "ThisWorkbook.cls").write_text(
        patch_thisworkbook((work_dir / "ThisWorkbook.cls").read_text(encoding="latin-1")),
        encoding="latin-1",
    )
    (work_dir / "Validaciones.bas").write_text(
        patch_validaciones((work_dir / "Validaciones.bas").read_text(encoding="latin-1")),
        encoding="latin-1",
    )

    shutil.copy(ROOT / "VBA_IMPORTAR" / "BUSCAR.bas", work_dir / "BUSCAR.bas")
    shutil.copy(ROOT / "VBA_IMPORTAR" / "ControlInterno.bas", work_dir / "ControlInterno.bas")
    shutil.copy(ROOT / "VBA_IMPORTAR" / "UtilidadesSistema.bas", work_dir / "UtilidadesSistema.bas")

    subprocess.run(
        [str(VENV_PY), "-m", "pyopenvba", "push", str(work_dir), str(base), "--out", str(OUT)],
        check=True,
    )

    # Módulos nuevos (push no los agrega automáticamente)
    add_new_modules(OUT)

    print(f"\nArchivo listo: {OUT}")
    print("Abre en Excel y ejecuta SincronizarMaestra una vez (Alt+F8) si BD MAESTRA esta vacia.")


if __name__ == "__main__":
    main()
