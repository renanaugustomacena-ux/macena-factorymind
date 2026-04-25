import type { OEEResult } from '@/types';

export interface ShiftReportProps {
  shiftName: string;
  startAt: string;
  endAt: string;
  oee: OEEResult;
}

export function ShiftReport({ shiftName, startAt, endAt, oee }: ShiftReportProps) {
  const fmt = (iso: string) => new Date(iso).toLocaleString('it-IT');
  return (
    <section className="kpi-card">
      <header className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-steel-800">Report di turno</h3>
          <p className="text-xs text-steel-500">{shiftName} · {fmt(startAt)} – {fmt(endAt)}</p>
        </div>
        <span className="rounded bg-steel-100 px-2 py-0.5 text-xs text-steel-700">
          {oee.classification}
        </span>
      </header>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-steel-500">Pezzi prodotti</dt>
          <dd className="text-lg font-semibold text-steel-800">{oee.total_count}</dd>
        </div>
        <div>
          <dt className="text-steel-500">Pezzi scartati</dt>
          <dd className="text-lg font-semibold text-steel-800">{oee.reject_count}</dd>
        </div>
        <div>
          <dt className="text-steel-500">Tempo operativo</dt>
          <dd className="text-lg font-semibold text-steel-800">
            {Math.floor(oee.operating_time_sec / 3600)}h {Math.floor((oee.operating_time_sec % 3600) / 60)}m
          </dd>
        </div>
        <div>
          <dt className="text-steel-500">Fermi non programmati</dt>
          <dd className="text-lg font-semibold text-steel-800">
            {Math.floor(oee.downtime_sec / 60)} min
          </dd>
        </div>
      </dl>
    </section>
  );
}
