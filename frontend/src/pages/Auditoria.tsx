import { useEffect, useState } from 'react';
import { HeroTemplate } from '../components/HeroTemplate';
import { AppNav } from '../components/AppNav';
import { PageHeader } from '../components/PageHeader';
import { maestraApi } from '../services/api';

type Log = { id: string; fecha: string; usuario?: string; accion: string; detalle?: string };

export function Auditoria() {
  const [logs, setLogs] = useState<Log[]>([]);

  useEffect(() => {
    maestraApi.auditoria().then(setLogs);
  }, []);

  return (
    <HeroTemplate>
      <AppNav />
      <PageHeader title="Auditoría" subtitle="Últimas 500 acciones registradas" />

      <div className="ios-glass-card">
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Usuario</th>
                <th>Acción</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td>{new Date(l.fecha).toLocaleString('es-VE')}</td>
                  <td className="col-text">{l.usuario ?? '—'}</td>
                  <td><span className="badge badge-parcial">{l.accion}</span></td>
                  <td>{l.detalle ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </HeroTemplate>
  );
}
