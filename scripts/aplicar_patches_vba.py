#!/usr/bin/env python3
"""Aplica parches VBA a directorio de módulos exportados."""
from pathlib import Path

VBA_DIR = Path("/tmp/vba_full")


def patch_file(name: str, replacements: list) -> None:
    p = VBA_DIR / name
    text = p.read_text(encoding="latin-1")
    for old, new in replacements:
        if old not in text and new not in text:
            print(f"  WARN: patrón no encontrado en {name}")
        text = text.replace(old, new)
    p.write_text(text, encoding="latin-1")


def patch_registro_fact():
    append = r'''
Private Sub TextBoxFecha_Exit(ByVal Cancel As MSForms.ReturnBoolean)
    Call ActualizarLabelTasa
End Sub

Private Sub RecargarComboProveedores()
    Set tblProv = Sheets("BD PROVEEDORES").ListObjects("BD_Proveedores")
    With Me.ComboBoxProveedor
        .RowSource = ""
        .Clear
        .List = tblProv.ListColumns(2).DataBodyRange.Value
        .MatchEntry = 1
    End With
End Sub

Private Sub ActualizarLabelTasa()
    On Error Resume Next
    If IsDate(Me.TextBoxFecha.Value) Then
        Dim t As Double
        t = ObtenerTasaDelDia(CDate(Me.TextBoxFecha.Value))
        If t > 0 Then Me.Label12.Caption = "Tasa BCV: " & Format(t, "#,##0.00") & " Bs/$"
    End If
    On Error GoTo 0
End Sub

Private Sub BloquearCamposEdicion()
    Me.TextBoxFACT.Locked = True
    Me.TextBoxFACT.BackColor = COLOR_BLOQUEADO
    Me.ComboBoxProveedor.Enabled = False
    Me.ComboBoxProveedor.BackColor = COLOR_BLOQUEADO
    Me.TextBoxID.Locked = True
    Me.TextBoxID.BackColor = COLOR_BLOQUEADO
    Me.ComboBoxTIPO.Enabled = False
End Sub

Private Function SerializarConceptosISLR() As String
    Dim i As Long, s As String
    For i = 0 To Me.ListBoxConceptos.ListCount - 1
        s = s & Me.ListBoxConceptos.List(i) & vbLf
    Next i
    SerializarConceptosISLR = s
End Function

Private Sub DeserializarConceptosISLR(ByVal detalle As String)
    Dim lineas() As String, i As Long, linea As String, partes() As String
    Me.ListBoxConceptos.Clear
    AcumuladoBaseISLR = 0
    AcumuladoRetencionISLR = 0
    CadenaAuditoriaISLR = ""
    If Trim(detalle) = "" Then Exit Sub
    lineas = Split(detalle, vbLf)
    For i = 0 To UBound(lineas)
        linea = Trim(lineas(i))
        If linea <> "" Then
            Me.ListBoxConceptos.AddItem linea
            partes = Split(linea, "|")
            If UBound(partes) >= 2 Then
                AcumuladoBaseISLR = AcumuladoBaseISLR + CDbl(Replace(Replace(Trim(partes(1)), "Base Bs:", ""), ".", ""))
                AcumuladoRetencionISLR = AcumuladoRetencionISLR + CDbl(Replace(Replace(Trim(partes(2)), "Ret Bs:", ""), ".", ""))
            End If
            CadenaAuditoriaISLR = CadenaAuditoriaISLR & IIf(CadenaAuditoriaISLR = "", "", " / ") & Trim(partes(0))
        End If
    Next i
End Sub
'''
    p = VBA_DIR / "REGISTRO_FACT.cls"
    text = p.read_text(encoding="latin-1")
    if "SerializarConceptosISLR" not in text:
        text += append

    text = text.replace(
        "            Registro_Proveedor.Show\n            \n            ' Al volver, limpiamos para que lo busque de nuevo\n            Me.ComboBoxProveedor.Value = \"\"",
        "            Registro_Proveedor.Show\n            Call RecargarComboProveedores\n            If proveedorRecienRegistrado <> \"\" Then\n                Me.ComboBoxProveedor.Value = proveedorRecienRegistrado\n                proveedorRecienRegistrado = \"\"\n            Else\n                Me.ComboBoxProveedor.Value = \"\"",
    )
    text = text.replace(
        "            .Cells(1, Tbl.ListColumns(\"RETENCION ISLR\").Index).Value = 0\n        End If\n     End With",
        "            .Cells(1, Tbl.ListColumns(\"RETENCION ISLR\").Index).Value = 0\n        End If\n        If ColumnaExisteEnTbl(Tbl, \"DETALLE ISLR\") Then\n            .Cells(1, Tbl.ListColumns(\"DETALLE ISLR\").Index).Value = SerializarConceptosISLR()\n        End If\n     End With",
    )
    if "Call BloquearCamposEdicion" not in text:
        text = text.replace(
            "    End With\n    \n    bloqueandoEventos = False\n    \n     Sheets(\"REGISTRO FACT\").Protect Password:=\"1234\", AllowFiltering:=True\nEnd Sub\n\nPublic Sub CargarDesdeBuscador",
            "    End With\n    \n    If ColumnaExisteEnTbl(Tbl, \"DETALLE ISLR\") Then\n        Call DeserializarConceptosISLR(Tbl.ListRows(nroFila).Range.Cells(1, Tbl.ListColumns(\"DETALLE ISLR\").Index).Value)\n    End If\n    Call BloquearCamposEdicion\n    Call ActualizarLabelTasa\n    bloqueandoEventos = False\n    \n     Sheets(\"REGISTRO FACT\").Protect Password:=\"1234\", AllowFiltering:=True\nEnd Sub\n\nPublic Sub CargarDesdeBuscador",
        )
    p.write_text(text, encoding="latin-1")


def patch_registropagos():
    p = VBA_DIR / "REGISTROPAGOS.cls"
    text = p.read_text(encoding="latin-1")
    if "saldoBsDoc" not in text:
        text = text.replace(
            "Dim tblProv As ListObject\n",
            "Dim tblProv As ListObject\nDim saldoBsDoc As Double\nDim saldoUsdDoc As Double\nDim anticipoAplicadoBs As Double\n",
        )
    text = text.replace(
        "    neto = CDbl(lr.Range(tblFact.ListColumns(\"MONTO A PAGAR\").Index).Value)\n    MontoBs.Text = Format(neto, \"#,##0.00\")",
        "    neto = CDbl(lr.Range(tblFact.ListColumns(\"MONTO A PAGAR\").Index).Value)\n    saldoBsDoc = ControlInterno.ObtenerSaldoDocumento(RIF.Text, lr.Range(tblFact.ListColumns(\"NUMERO\").Index).Value, \"BS\")\n    If saldoBsDoc <= 0 Then saldoBsDoc = neto\n    saldoUsdDoc = ControlInterno.ObtenerSaldoDocumento(RIF.Text, lr.Range(tblFact.ListColumns(\"NUMERO\").Index).Value, \"USD\")\n    MontoBs.Text = Format(saldoBsDoc, \"#,##0.00\")\n    On Error Resume Next\n    Label13.Caption = \"Saldo Bs: \" & Format(saldoBsDoc, \"#,##0.00\")\n    On Error GoTo 0",
    )
    if "Public Sub AbrirParaPago" not in text:
        text += "\nPublic Sub AbrirParaPago(ByVal docNum As String)\n    DOCUMENTO.Text = docNum\n    Call BuscarDocumentoParaPago\nEnd Sub\n"
    text = text.replace(
        "    If Not IsDate(FECHA.Text) Then MsgBox \"Fecha no válida\": Exit Sub\n    \n    ' Desproteger Base de Datos de Pagos",
        "    If Not IsDate(FECHA.Text) Then MsgBox \"Fecha no válida\": Exit Sub\n    If ReferenciaDuplicada(FORMAPAG.Text, REFERENCIA.Text, RIF.Text) Then\n        MsgBox \"Referencia duplicada para este banco y proveedor.\", vbExclamation\n        Exit Sub\n    End If\n    \n    ' Desproteger Base de Datos de Pagos",
    )
    text = text.replace(
        "    On Error GoTo 0\n    \n    ' Calcular Tasa",
        "    On Error GoTo 0\n    If DOCUMENTO.Text <> \"ANTICIPO\" And saldoBsDoc > 0 And MontoBs_Numerico > saldoBsDoc + 0.02 Then\n        MsgBox \"El pago supera el saldo pendiente (\" & Format(saldoBsDoc, \"#,##0.00\") & \" Bs).\", vbExclamation\n        Exit Sub\n    End If\n    anticipoAplicadoBs = 0\n    If DOCUMENTO.Text <> \"ANTICIPO\" Then\n        Dim ant As Double\n        ant = SumarAnticiposAbiertos(RIF.Text)\n        If ant > 0 Then\n            If MsgBox(\"Anticipos abiertos: \" & Format(ant, \"#,##0.00\") & \" Bs. ¿Aplicar a esta factura?\", vbYesNo + vbQuestion) = vbYes Then\n                anticipoAplicadoBs = ant\n            End If\n        End If\n    End If\n    \n    ' Calcular Tasa",
    )
    text = text.replace(
        "    Call ControlInterno.PostGuardarPago(RIF.Text, DOCUMENTO.Text, PROVEEDOR.Text)",
        "    If anticipoAplicadoBs > 0 And DOCUMENTO.Text <> \"ANTICIPO\" Then\n        Call AplicarAnticipoACuenta(RIF.Text, anticipoAplicadoBs, DOCUMENTO.Text)\n        If ColumnaExisteTbl(Tbl, \"ANTICIPO APLICADO\") Then\n            filaDestino.Cells(1, Tbl.ListColumns(\"ANTICIPO APLICADO\").Index).Value = anticipoAplicadoBs\n        End If\n    End If\n    Call ControlInterno.PostGuardarPago(RIF.Text, DOCUMENTO.Text, PROVEEDOR.Text)",
    )
    if "Private Function ColumnaExisteTbl" not in text:
        text += "\nPrivate Function ColumnaExisteTbl(tbl As ListObject, nombre As String) As Boolean\n    On Error Resume Next\n    ColumnaExisteTbl = tbl.ListColumns(nombre).Index > 0\n    On Error GoTo 0\nEnd Function\n"
    p.write_text(text, encoding="latin-1")


def patch_frmconsulta():
    p = VBA_DIR / "frmConsulta.cls"
    text = p.read_text(encoding="latin-1")
    text = text.replace(
        "Set Tbl = Sheets(\"REGISTRO FACT\").ListObjects(\"REGISTROFACTURAS\")",
        "Set Tbl = Sheets(\"BD MAESTRA\").ListObjects(\"BD_MAESTRA\")",
        1,
    )
    text = text.replace(
        "Sheets(\"REGISTRO FACT\").Unprotect Password:=\"1234\"",
        "Sheets(\"BD MAESTRA\").Unprotect Password:=\"1234\"",
    )
    text = text.replace(
        "Sheets(\"REGISTRO FACT\").Protect Password:=\"1234\", AllowFiltering:=True",
        "Sheets(\"BD MAESTRA\").Protect Password:=\"1234\", AllowFiltering:=True",
    )
    text = text.replace(
        "If Tbl Is Nothing Then Set Tbl = Sheets(\"REGISTRO FACT\").ListObjects(\"REGISTROFACTURAS\")",
        "If Tbl Is Nothing Then Set Tbl = Sheets(\"BD MAESTRA\").ListObjects(\"BD_MAESTRA\")",
    )
    text = text.replace(
        "columnas = Array(\"FECHA\", \"TIPO\", \"NUMERO\", \"RIF\", \"CONCEPTO\", \"BASE IMPONIBLE\", \"EXENTO\", \"RETENCION IVA\", \"RETENCION ISLR\")",
        "columnas = Array(\"FECHA\", \"TIPO\", \"NUMERO\", \"RIF\", \"PROVEEDOR\", \"NETO BS\", \"SALDO BS\", \"ESTADO\")",
    )
    text = text.replace(
        "sumaTotal = Application.WorksheetFunction.Sum(hojaTemporal.Range(\"J2:J\" & uFila))",
        "sumaTotal = Application.WorksheetFunction.Sum(hojaTemporal.Range(\"G2:G\" & uFila))",
    )
    text = text.replace(
        "        For i = 1 To Tbl.ListRows.Count\n           If CStr(Tbl.DataBodyRange(i, Tbl.ListColumns(\"NUMERO\").Index).Value) = numFact And _\n               CStr(Tbl.DataBodyRange(i, Tbl.ListColumns(\"TIPO\").Index).Value) = tipoDoc And _\n               CStr(Tbl.DataBodyRange(i, Tbl.ListColumns(\"RIF\").Index).Value) = rifProv Then",
        "        Dim TblFact As ListObject\n        Set TblFact = Sheets(\"REGISTRO FACT\").ListObjects(\"REGISTROFACTURAS\")\n        For i = 1 To TblFact.ListRows.Count\n           If CStr(TblFact.DataBodyRange(i, TblFact.ListColumns(\"NUMERO\").Index).Value) = numFact And _\n               CStr(TblFact.DataBodyRange(i, TblFact.ListColumns(\"TIPO\").Index).Value) = tipoDoc And _\n               CStr(TblFact.DataBodyRange(i, TblFact.ListColumns(\"RIF\").Index).Value) = rifProv Then",
    )
    text = text.replace(
        "    respuesta = MsgBox(\"¿Desea cargar este documento para modificarlo?\", _\n                       vbQuestion + vbYesNo, \"Confirmar Selección\")",
        "    respuesta = MsgBox(\"¿Modificar esta factura? (No = ir a Pagar)\", vbYesNoCancel + vbQuestion, \"Acción\")\n    If respuesta = vbCancel Then Exit Sub",
    )
    if "REGISTROPAGOS.AbrirParaPago" not in text:
        text = text.replace(
            "        MsgBox \"No se encontró el registro original en la tabla.\", vbExclamation\n    End If\nEnd Sub",
            "        MsgBox \"No se encontró el registro original en la tabla.\", vbExclamation\n    ElseIf respuesta = vbNo Then\n        numFact = Me.lstResultados.List(Me.lstResultados.ListIndex, 2)\n        Load REGISTROPAGOS\n        REGISTROPAGOS.AbrirParaPago(numFact)\n        Unload Me\n        REGISTROPAGOS.Show\n    End If\nEnd Sub",
        )
    # Fix column indices for dblclick after column change - tipo=1, num=2, rif=3 still ok
    p.write_text(text, encoding="latin-1")


def patch_proveedor():
    patch_file("Registro_Proveedor.cls", [
        (".AddItem \"RJD\"", ".AddItem \"PJD\""),
        (
            "    MsgBox \"Datos guardados correctamente.\", vbInformation",
            "    proveedorRecienRegistrado = Me.TextBoxNOM.Value\n    LogAuditoria(\"PROVEEDOR\", idCompuesto)\n    MsgBox \"Datos guardados correctamente.\", vbInformation",
        ),
    ])


def patch_validaciones():
    p = VBA_DIR / "Validaciones.bas"
    text = p.read_text(encoding="latin-1")
    if "RefrescarDashboard" not in text:
        text += "\nSub RefrescarDashboard()\n    Call ControlInterno.RefrescarDashboard\nEnd Sub\n\nSub RefrescarResumen()\n    Call ControlInterno.RefrescarResumenProveedor\nEnd Sub\n"
    p.write_text(text, encoding="latin-1")


def patch_thisworkbook():
    p = VBA_DIR / "ThisWorkbook.cls"
    text = p.read_text(encoding="latin-1")
    if "RefrescarDashboard" not in text:
        text = text.replace(
            "Private Sub Workbook_Open()\n    Sheets(\"BD PROVEEDORES\").Protect Password:=\"1234\", UserInterfaceOnly:=True\nEnd Sub",
            "Private Sub Workbook_Open()\n    Sheets(\"BD PROVEEDORES\").Protect Password:=\"1234\", UserInterfaceOnly:=True\n    On Error Resume Next\n    Sheets(\"BD MAESTRA\").Protect Password:=\"1234\", UserInterfaceOnly:=True, AllowFiltering:=True\n    Sheets(\"AUDITORIA\").Protect Password:=\"1234\", UserInterfaceOnly:=True\n    Sheets(\"RESUMEN PROVEEDOR\").Protect Password:=\"1234\", UserInterfaceOnly:=True\n    On Error GoTo 0\n    Call ControlInterno.RefrescarDashboard\nEnd Sub",
        )
    p.write_text(text, encoding="latin-1")


def main():
    import shutil
    src = Path(__file__).resolve().parents[1] / "VBA_IMPORTAR"
    for f in ["UtilidadesSistema.bas", "ControlInterno.bas", "BUSCAR.bas"]:
        shutil.copy(src / f, VBA_DIR / f)
    patch_registro_fact()
    patch_registropagos()
    patch_frmconsulta()
    patch_proveedor()
    patch_validaciones()
    patch_thisworkbook()
    print("Parches VBA aplicados en", VBA_DIR)


if __name__ == "__main__":
    main()
