import { MoneyValue } from './MoneyValue';
import type { IslrLineaDetalle } from '../services/api';

type Props = {
  conceptoLabel: string;
  loading?: boolean;
  linea?: IslrLineaDetalle | null;
  retIvaLabel: string;
  tipoIslrLabel: string;
};

export function IslrLineaCalcPanel({
  conceptoLabel,
  loading,
  linea,
  retIvaLabel,
  tipoIslrLabel
}: Props) {
  const data = linea ?? {
    totalBs: 0,
    totalUsd: null,
    grabadoBs: 0,
    baseImponible: 0,
    iva16: 0,
    retencionIva: 0,
    baseIslr: 0,
    retencionIslr: 0,
    montoAPagar: 0,
    montoAPagarUsd: null
  };

  return (
    <div className="islr-linea-calc">
      {conceptoLabel && (
        <p className="islr-linea-calc-concept">{conceptoLabel}</p>
      )}
      <p className="islr-linea-calc-title">
        {loading ? 'Calculando…' : 'Cálculo automático'}
      </p>
      <div className="islr-linea-calc-grid">
        <div className="calc-preview-item">
          <label>Total Bs</label>
          <MoneyValue value={data.totalBs} />
        </div>
        {data.totalUsd != null && (
          <div className="calc-preview-item">
            <label>Total USD</label>
            <MoneyValue value={data.totalUsd} />
          </div>
        )}
        <div className="calc-preview-item">
          <label>Grabado Bs</label>
          <MoneyValue value={data.grabadoBs} />
        </div>
        <div className="calc-preview-item">
          <label>Base imponible</label>
          <MoneyValue value={data.baseImponible} />
        </div>
        <div className="calc-preview-item">
          <label>IVA 16%</label>
          <MoneyValue value={data.iva16} />
        </div>
        <div className="calc-preview-item">
          <label>Ret. IVA ({retIvaLabel})</label>
          <MoneyValue value={data.retencionIva} />
        </div>
        <div className="calc-preview-item">
          <label>Base ISLR</label>
          <MoneyValue value={data.baseIslr} />
        </div>
        <div className="calc-preview-item">
          <label>Ret. ISLR ({tipoIslrLabel})</label>
          <MoneyValue value={data.retencionIslr} />
        </div>
        <div className="calc-preview-item calc-preview-highlight">
          <label>A pagar Bs</label>
          <MoneyValue value={data.montoAPagar} size="lg" />
        </div>
        {data.montoAPagarUsd != null && (
          <div className="calc-preview-item">
            <label>A pagar USD</label>
            <MoneyValue value={data.montoAPagarUsd} />
          </div>
        )}
      </div>
    </div>
  );
}
