import { formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';
import clsx from 'clsx';
import type { Alert } from '@/types';

export interface AlertFeedProps {
  items: Alert[];
  onAcknowledge?: (id: string) => void;
  onResolve?: (id: string) => void;
}

const SEVERITY_CLASS: Record<string, string> = {
  warning: 'badge badge-warning',
  major: 'badge badge-major',
  critical: 'badge badge-critical'
};

export function AlertFeed({ items, onAcknowledge, onResolve }: AlertFeedProps) {
  if (items.length === 0) {
    return (
      <div className="kpi-card text-center text-sm text-steel-500">
        Nessun allarme attivo. La linea produce regolarmente.
      </div>
    );
  }
  return (
    <ul className="divide-y divide-steel-200 rounded-xl border border-steel-200 bg-white">
      {items.map((a) => (
        <li key={a.id} className="flex items-start justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={clsx(SEVERITY_CLASS[a.severity])}>{a.severity.toUpperCase()}</span>
              <span className="truncate font-medium text-steel-800">{a.message}</span>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-steel-500">
              <span>Macchina {a.machine_id}</span>
              <span>Metric {a.metric} = {Number(a.value).toFixed(2)}</span>
              <span>{formatDistanceToNow(new Date(a.fired_at), { addSuffix: true, locale: it })}</span>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            {a.status === 'open' && onAcknowledge && (
              <button
                className="rounded bg-steel-100 px-2 py-1 text-xs font-medium text-steel-700 hover:bg-steel-200"
                onClick={() => onAcknowledge(a.id)}
              >
                Prendi in carico
              </button>
            )}
            {onResolve && a.status !== 'resolved' && (
              <button
                className="rounded bg-signal-green/10 px-2 py-1 text-xs font-medium text-signal-green hover:bg-signal-green/20"
                onClick={() => onResolve(a.id)}
              >
                Risolvi
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
