import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { HeroTemplate } from '../components/HeroTemplate';
import { AppNav } from '../components/AppNav';
import { PageHeader } from '../components/PageHeader';
import { FormField } from '../components/FormField';
import { ProveedorSearchField } from '../components/ProveedorSearchField';
import { MoneyValue } from '../components/MoneyValue';
import { MoneyInputField } from '../components/MoneyInputField';
import {
  facturasApi,
  proveedoresApi,
  tasasApi,
  maestraApi,
  type Proveedor,
  type TabIslr,
  type FacturaPreview,
  fmtBs
} from '../services/api';
import { AdminOnly } from '../components/AdminOnly';
import {
  aplicarMontoSugeridoRow,
  autollenarSiUnSoloConcepto,
  calcularBaseImponible,
  calcularGrabado,
  grabadoRestanteIslr,
  isTipoSinIslr,
  matchConceptoTabla,
  newConceptoRow,
  prepararNuevaLineaIslr,
  round2,
  sumMontosConceptos,
  totalBsFromForm,
  type ConceptoRow
} from '../lib/factura-calc';
import { emitAppRefresh } from '../lib/app-refresh';
import { proveedoresUrl } from '../lib/navigation';
import { useFormShortcuts } from '../hooks/useFormShortcuts';

export function FacturaForm() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const deepRif = searchParams.get('rif') ?? '';
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [tabIslr, setTabIslr] = useState<TabIslr[]>([]);
  const [causados, setCausados] = useState<string[]>([]);
  const [estaciones, setEstaciones] = useState<string[]>([]);
  const [tiposDoc, setTiposDoc] = useState<string[]>(['FAC', 'REC', 'NE']);
  const [tasa, setTasa] = useState(0);
  const [preview, setPreview] = useState<FacturaPreview | null>(null);
  const [msg, setMsg] = useState('');
  const [dupWarning, setDupWarning] = useState('');
  const [locked, setLocked] = useState(false);

  const [tipo, setTipo] = useState('FAC');
  const [numero, setNumero] = useState('');
  const [rif, setRif] = useState('');
  const [proveedorNombre, setProveedorNombre] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [causado, setCausado] = useState('');
  const [estacion, setEstacion] = useState('');
  const [concepto, setConcepto] = useState('');
  const [diasCredito, setDiasCredito] = useState('0');
  const [moneda, setMoneda] = useState('Bs');
  const [total, setTotal] = useState(0);
  const [exento, setExento] = useState(0);
  const [conceptos, setConceptos] = useState<ConceptoRow[]>(() => [newConceptoRow()]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [recibidoFisico, setRecibidoFisico] = useState('Pendiente');
  const [retencionEnviada, setRetencionEnviada] = useState('Pendiente');

  const proveedorSel = useMemo(
    () => proveedores.find((p) => p.rif === rif),
    [proveedores, rif]
  );

  const totalBsForm = useMemo(
    () => totalBsFromForm(total, moneda, tasa),
    [total, moneda, tasa]
  );

  const baseImponibleLocal = useMemo(
    () => (totalBsForm > 0 ? calcularBaseImponible(totalBsForm, exento) : 0),
    [totalBsForm, exento]
  );

  const sinIslr = isTipoSinIslr(tipo);

  useEffect(() => {
    proveedoresApi.list().then(setProveedores);
    maestraApi.tabIslr().then(setTabIslr);
    maestraApi.config('causado').then((c) => setCausados(c.map((x) => x.valor)));
    maestraApi.config('estacion').then((c) => setEstaciones(c.map((x) => x.valor)));
    maestraApi.config('tipo_doc').then((c) => c.length && setTiposDoc(c.map((x) => x.valor)));
    tasasApi.hoy().then((t) => setTasa(t.valor));
  }, []);

  useEffect(() => {
    if (!fecha) return;
    tasasApi.porFecha(fecha).then((t) => setTasa(t.valor)).catch(() => {});
  }, [fecha]);

  useEffect(() => {
    if (!id) return;
    facturasApi.get(id).then(async (f) => {
      setTipo(f.tipo);
      setNumero(f.numero);
      setRif(f.rif);
      setProveedorNombre(f.proveedorNombre);
      setFecha(f.fecha.slice(0, 10));
      setCausado(f.causado ?? '');
      setEstacion(f.estacion ?? '');
      setConcepto(f.concepto ?? '');
      setDiasCredito(String(f.diasCredito));
      setMoneda(f.moneda);
      setTotal(f.moneda === 'USD' ? f.totalUsd ?? f.totalBs : f.totalBs);
      setExento(f.exentoBs);
      setRecibidoFisico(f.recibidoFisico);
      setRetencionEnviada(f.retencionEnviada);
      setLocked(true);
      const tab = await maestraApi.tabIslr();
      if (f.detalleIslr) {
        try {
          const parsed = JSON.parse(f.detalleIslr) as { concepto: string; monto: number }[];
          if (parsed.length > 0) {
            setConceptos(
              parsed.map((c) =>
                newConceptoRow({
                  concepto: matchConceptoTabla(c.concepto, tab),
                  monto: c.monto
                })
              )
            );
          } else {
            setConceptos([newConceptoRow()]);
          }
        } catch {
          setConceptos([newConceptoRow()]);
        }
      } else {
        setConceptos([newConceptoRow()]);
      }
    });
  }, [id]);

  useEffect(() => {
    if (isEdit || !numero.trim() || !rif) {
      setDupWarning('');
      return;
    }
    const timer = setTimeout(() => {
      facturasApi.checkDuplicada(tipo, numero.trim(), rif).then((r) => {
        setDupWarning(r.duplicada ? 'Esta factura ya está registrada para este RIF' : '');
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [tipo, numero, rif, isEdit]);

  useEffect(() => {
    if (sinIslr) {
      setConceptos([newConceptoRow()]);
    }
  }, [sinIslr]);

  useEffect(() => {
    if (locked || isEdit || sinIslr || totalBsForm <= 0 || conceptos.length > 1) return;
    const filled = autollenarSiUnSoloConcepto(conceptos, totalBsForm, exento, tipo);
    const same = filled.every(
      (c, i) => c.concepto === conceptos[i]?.concepto && c.monto === conceptos[i]?.monto
    );
    if (!same) setConceptos(filled);
  }, [total, exento, moneda, tasa, tipo, locked, isEdit, sinIslr, totalBsForm, conceptos.length]);

  const buildPayload = () => ({
    tipo,
    numero,
    rif,
    proveedorNombre,
    fecha,
    causado: causado || undefined,
    estacion: estacion || undefined,
    concepto: concepto || undefined,
    diasCredito: parseInt(diasCredito, 10) || 0,
    moneda,
    tasaRegistro: tasa,
    totalBs: moneda === 'Bs' ? total : total * tasa,
    totalUsd: moneda === 'USD' ? total : total / tasa,
    exentoBs: exento,
    conceptosIslr: conceptos
      .filter((c) => c.concepto.trim())
      .map((c) => ({ concepto: c.concepto, monto: c.monto })),
    recibidoFisico,
    retencionEnviada
  });

  useEffect(() => {
    if (!rif || total <= 0 || tasa <= 0) {
      setPreview(null);
      setPreviewLoading(false);
      return;
    }
    setPreviewLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const p = await facturasApi.preview(buildPayload());
        setPreview(p);
      } catch {
        setPreview(null);
      } finally {
        setPreviewLoading(false);
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [
    rif,
    total,
    exento,
    conceptos,
    moneda,
    tasa,
    tipo,
    proveedorNombre,
    fecha,
    causado,
    estacion,
    concepto,
    diasCredito,
    recibidoFisico,
    retencionEnviada,
    locked,
    sinIslr
  ]);

  const onRifChange = async (v: string) => {
    if (locked) return;
    setRif(v);
    const p = proveedores.find((x) => x.rif === v);
    if (p) {
      setProveedorNombre(p.nombre);
      if (p.estacion) setEstacion(p.estacion);
    }
    if (!v) return;
    try {
      const s = await facturasApi.suggest(v);
      if (s.ultimaFactura && !isEdit) {
        setTipo(s.ultimaFactura.tipo);
        if (s.ultimaFactura.estacion) setEstacion(s.ultimaFactura.estacion);
        if (s.ultimaFactura.causado) setCausado(s.ultimaFactura.causado);
        setDiasCredito(String(s.ultimaFactura.diasCredito));
        setMoneda(s.ultimaFactura.moneda);
        if (s.ultimaFactura.conceptosIslr.length > 0) {
          setConceptos(
            s.ultimaFactura.conceptosIslr.map((c) =>
              newConceptoRow({
                concepto: matchConceptoTabla(c.concepto, tabIslr),
                monto: c.monto
              })
            )
          );
        }
        setMsg('Datos sugeridos desde la última factura del proveedor');
      }
    } catch { /* ignore */ }
  };

  useEffect(() => {
    if (!deepRif || isEdit || locked || rif === deepRif || proveedores.length === 0) return;
    onRifChange(deepRif);
  }, [deepRif, isEdit, locked, proveedores.length, rif]);

  const setConceptoRow = (index: number, conceptoVal: string) => {
    const copy = [...conceptos];
    copy[index] = { ...copy[index], concepto: conceptoVal, monto: 0 };
    if (!sinIslr && totalBsForm > 0 && conceptoVal.trim()) {
      setConceptos(aplicarMontoSugeridoRow(copy, index, totalBsForm, exento, tipo));
    } else {
      setConceptos(copy);
    }
  };

  const setConceptoMonto = (index: number, monto: number) => {
    const copy = [...conceptos];
    copy[index].monto = monto;
    setConceptos(copy);
  };

  const addConcepto = () => {
    const next = prepararNuevaLineaIslr(conceptos, totalBsForm, exento);
    if (next.length === 2 && conceptos.length === 1) {
      setMsg('Grabado repartido entre 2 líneas. Ajuste cada monto según el concepto.');
    } else {
      setMsg('');
    }
    setConceptos(next);
  };

  const removeConcepto = (rowId: string) => {
    if (conceptos.length <= 1) {
      setConceptos([newConceptoRow()]);
      return;
    }
    setConceptos(conceptos.filter((c) => c.id !== rowId));
  };

  const grabadoTotal = totalBsForm > 0 ? calcularGrabado(totalBsForm, exento) : 0;
  const grabadoUsado = sumMontosConceptos(conceptos);
  const grabadoLibre = Math.max(0, round2(grabadoTotal - grabadoUsado));

  const trySubmit = useCallback(() => {
    const form = document.getElementById('factura-form') as HTMLFormElement | null;
    form?.requestSubmit();
  }, []);

  useFormShortcuts(trySubmit, !locked);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');
    if (dupWarning) {
      setMsg(dupWarning);
      return;
    }
    const conConcepto = conceptos.filter((c) => c.concepto.trim());
    if (!sinIslr && conConcepto.some((c) => c.monto <= 0)) {
      setMsg('Complete el monto ISLR o verifique total y exento');
      return;
    }
    const grabado = calcularGrabado(totalBsForm, exento);
    const sumaMontos = round2(conConcepto.reduce((s, c) => s + c.monto, 0));
    if (!sinIslr && sumaMontos > grabado + 0.01) {
      setMsg(
        `La suma de conceptos (${fmtBs(sumaMontos)}) supera el grabado (${fmtBs(grabado)}).`
      );
      return;
    }
    if (
      !sinIslr &&
      conConcepto.length === 0 &&
      !window.confirm(
        'No ha agregado retención de ISLR.\n\n¿Está seguro de que esta factura está exenta de retención ISLR?'
      )
    ) {
      return;
    }
    const payload = buildPayload();

    try {
      if (isEdit && id) {
        await facturasApi.update(id, payload);
        setMsg('Factura actualizada');
        emitAppRefresh();
      } else {
        await facturasApi.create(payload);
        emitAppRefresh();
        navigate('/facturas');
      }
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      setMsg(ax.response?.data?.error ?? 'Error al guardar');
    }
  };

  const tipoIslrLabel = preview?.tipoIslrAplicado ?? proveedorSel?.tipoIslr ?? 'PNR';
  const retIvaLabel = preview?.retencionIvaAplicada ?? proveedorSel?.retencionIva ?? '100%';

  return (
    <HeroTemplate>
      <AppNav />
      <PageHeader
        title={isEdit ? 'Editar factura' : 'Nueva factura'}
        subtitle={`Tasa del ${fecha}`}
        actions={
          <span className="num-value num-positive text-lg tabular-nums">
            <MoneyValue value={tasa} />
            <span className="text-muted text-sm ml-1">Bs/USD</span>
          </span>
        }
      />

      <form id="factura-form" onSubmit={submit} className="ios-glass-card form-grid">
        <FormField as="select" label="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} options={
          tiposDoc.map((t) => ({ value: t, label: t }))
        } />
        <FormField label="Número" value={numero} onChange={(e) => setNumero(e.target.value)} required disabled={locked} />
        {dupWarning && <p className="form-grid-span-3 alert-error">{dupWarning}</p>}
        <ProveedorSearchField
          label="RIF proveedor"
          value={rif}
          proveedores={proveedores}
          onChange={onRifChange}
          disabled={locked}
          required
        />
        <FormField label="Proveedor" value={proveedorNombre} onChange={(e) => setProveedorNombre(e.target.value)} disabled={locked} required />
        {!locked && (
          <div className="form-grid-span-3">
            <Link to={proveedoresUrl('/facturas/nueva')} className="link-green text-sm">
              + Registrar proveedor nuevo
            </Link>
          </div>
        )}
        {rif && (
          <div className="form-grid-span-3 fiscal-badges">
            <span className="fiscal-badge">Tipo ISLR: <strong>{tipoIslrLabel}</strong></span>
            <span className="fiscal-badge">Ret. IVA: <strong>{retIvaLabel}</strong></span>
            {totalBsForm > 0 && (
              <span className="fiscal-badge">Base imponible: <strong>{fmtBs(baseImponibleLocal)}</strong></span>
            )}
          </div>
        )}
        <FormField label="Fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
        <FormField as="select" label="Causado" value={causado} onChange={(e) => setCausado(e.target.value)} options={[
          { value: '', label: '—' },
          ...causados.map((c) => ({ value: c, label: c }))
        ]} />
        <FormField as="select" label="Estación" value={estacion} onChange={(e) => setEstacion(e.target.value)} options={[
          { value: '', label: '—' },
          ...estaciones.map((e) => ({ value: e, label: e }))
        ]} />
        <FormField label="Días crédito" type="number" value={diasCredito} onChange={(e) => setDiasCredito(e.target.value)} />
        <FormField label="Concepto" value={concepto} onChange={(e) => setConcepto(e.target.value)} />
        <FormField as="select" label="Moneda" value={moneda} onChange={(e) => setMoneda(e.target.value)} options={[
          { value: 'Bs', label: 'Bolívares' },
          { value: 'USD', label: 'USD' }
        ]} />
        <MoneyInputField
          label={`Total (${moneda})`}
          value={total}
          onChange={setTotal}
          required
          hint={
            total > 0 && tasa > 0
              ? moneda === 'Bs'
                ? `≈ ${fmtBs(total / tasa)} USD`
                : `≈ ${fmtBs(total * tasa)} Bs`
              : undefined
          }
        />
        <MoneyInputField label="Exento Bs" value={exento} onChange={setExento} />
        <FormField as="select" label="Recibido físico" value={recibidoFisico} onChange={(e) => setRecibidoFisico(e.target.value)} options={[
          { value: 'Pendiente', label: 'Pendiente' },
          { value: 'Sí', label: 'Sí' }
        ]} />
        <FormField as="select" label="Retención enviada" value={retencionEnviada} onChange={(e) => setRetencionEnviada(e.target.value)} options={[
          { value: 'Pendiente', label: 'Pendiente' },
          { value: 'Sí', label: 'Sí' }
        ]} />

        <div className="form-grid-span-3 form-divider">
          <div className="panel-header panel-header-accent-rose" style={{ marginBottom: '0.75rem' }}>
            <h3>Conceptos ISLR</h3>
            {!sinIslr && conceptos.length > 0 && (
              <span className="panel-meta">
                {conceptos.length} línea(s)
                {grabadoTotal > 0 && (
                  <> · libre {fmtBs(grabadoLibre)} de {fmtBs(grabadoTotal)}</>
                )}
              </span>
            )}
            {sinIslr && (
              <p className="text-muted text-sm mt-1">
                ISLR solo en facturas (FAC). Recibos y notas de entrega no aplican retención.
              </p>
            )}
          </div>
          {!sinIslr && (
            <div className="concepto-islr-list form-grid-span-3">
              {conceptos.map((c, i) => {
                const restante = totalBsForm > 0
                  ? grabadoRestanteIslr(conceptos, totalBsForm, exento, i)
                  : 0;
                const grabado = totalBsForm > 0 ? calcularGrabado(totalBsForm, exento) : 0;
                const hintMonto =
                  c.concepto && totalBsForm > 0
                    ? restante > 0
                      ? `Grabado total: ${fmtBs(grabado)} · disponible aquí: ${fmtBs(restante)}`
                      : 'Sin grabado restante — ajuste montos de otras líneas'
                    : undefined;
                const activeRows = conceptos.filter((row) => row.concepto.trim());
                const activeIndex = activeRows.findIndex((row) => row.id === c.id);
                const lineaCalc =
                  activeIndex >= 0 ? preview?.lineasIslr?.[activeIndex] : undefined;
                const pctLabel =
                  lineaCalc && lineaCalc.pctEfectivo > 0
                    ? `${round2(lineaCalc.pctEfectivo * 100)}%`
                    : null;
                return (
                  <div key={c.id} className="concepto-islr-card" data-linea={i + 1}>
                    <div className="concepto-islr-head">
                      <span className="concepto-islr-badge">Línea {i + 1}</span>
                      {c.concepto && (
                        <span className="concepto-islr-name" title={c.concepto}>
                          {c.concepto}
                        </span>
                      )}
                      {lineaCalc && c.concepto && (
                        <span className="concepto-islr-calc">
                          <span>Base ISLR: {fmtBs(lineaCalc.baseIslr)}</span>
                          <span>Ret: {fmtBs(lineaCalc.retencionIslr)}</span>
                          {pctLabel && <span>Tarifa: {pctLabel}</span>}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <FormField
                        as="select"
                        label="Concepto TAB ISLR"
                        value={c.concepto}
                        onChange={(e) => setConceptoRow(i, e.target.value)}
                        options={[
                          { value: '', label: '— Seleccionar —' },
                          ...tabIslr
                            .filter((t) => {
                              const usedElsewhere = conceptos.some(
                                (other, j) =>
                                  j !== i &&
                                  other.concepto.trim().toLowerCase() ===
                                    t.concepto.toLowerCase()
                              );
                              return !usedElsewhere || c.concepto === t.concepto;
                            })
                            .map((t) => ({
                              value: t.concepto,
                              label: t.concepto,
                              key: `${c.id}-${t.id}`
                            }))
                        ]}
                      />
                      <MoneyInputField
                        label="Monto Bs (grabado)"
                        value={c.monto}
                        onChange={(monto) => setConceptoMonto(i, monto)}
                        hint={hintMonto}
                      />
                    </div>
                    {conceptos.length > 1 && (
                      <button
                        type="button"
                        className="link-muted concepto-islr-remove"
                        onClick={() => removeConcepto(c.id)}
                      >
                        Quitar línea {i + 1}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {!sinIslr && (
            <div className="concepto-islr-add-row form-grid-span-3">
              <button type="button" className="link-green" onClick={addConcepto}>
                + Otro concepto
              </button>
              <span className="text-muted text-sm">
                {grabadoLibre <= 0 && conceptos.length >= 2
                  ? 'Ajuste los montos de las líneas para liberar grabado antes de agregar otra.'
                  : 'Seleccione tipo y monto en cada línea. La suma no puede superar el grabado.'}
              </span>
            </div>
          )}
        </div>

        {(preview || previewLoading || total > 0 && rif) && (
          <div className="form-grid-span-3 calc-preview">
            <p className="calc-preview-title">
              {previewLoading ? 'Calculando…' : 'Cálculo automático'}
            </p>
            {preview ? (
              <>
                <div className="calc-preview-item"><label>Total Bs</label><MoneyValue value={preview.totalBs} /></div>
                {preview.totalUsd != null && (
                  <div className="calc-preview-item"><label>Total USD</label><MoneyValue value={preview.totalUsd} /></div>
                )}
                <div className="calc-preview-item"><label>Grabado Bs</label><MoneyValue value={preview.grabadoBs} /></div>
                <div className="calc-preview-item"><label>Base imponible</label><MoneyValue value={preview.baseImponible} /></div>
                <div className="calc-preview-item"><label>IVA 16%</label><MoneyValue value={preview.iva16} /></div>
                <div className="calc-preview-item">
                  <label>Ret. IVA ({retIvaLabel})</label>
                  <MoneyValue value={preview.retencionIva} />
                </div>
                <div className="calc-preview-item"><label>Base ISLR</label><MoneyValue value={preview.baseIslr} /></div>
                <div className="calc-preview-item">
                  <label>Ret. ISLR ({tipoIslrLabel})</label>
                  <MoneyValue value={preview.retencionIslr} />
                </div>
                <div className="calc-preview-item calc-preview-highlight">
                  <label>A pagar Bs</label>
                  <MoneyValue value={preview.montoAPagar} size="lg" />
                </div>
                {preview.montoAPagarUsd != null && (
                  <div className="calc-preview-item"><label>A pagar USD</label><MoneyValue value={preview.montoAPagarUsd} /></div>
                )}
              </>
            ) : !previewLoading && total > 0 && (
              <p className="calc-preview-empty text-muted">Seleccione proveedor y complete datos para calcular.</p>
            )}
          </div>
        )}

        <div className="form-grid-span-3 form-actions">
          <button type="submit" className="ios-btn ios-btn-primary">Guardar</button>
          {isEdit && id && (
            <AdminOnly>
              <button
                type="button"
                className="ios-btn ios-btn-rose"
                onClick={async () => {
                  if (!confirm('¿Eliminar esta factura y sus pagos vinculados?')) return;
                  await facturasApi.delete(id);
                  navigate('/facturas');
                }}
              >
                Eliminar
              </button>
            </AdminOnly>
          )}
          {msg && <span className="alert-success">{msg}</span>}
        </div>
      </form>
    </HeroTemplate>
  );
}
