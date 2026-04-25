import clsx from 'clsx';
import type { MachineState } from '@/types';

export interface MachineStatusProps {
  machine: string;
  state: MachineState;
  lastUpdate?: string;
  cycleTimeSec?: number;
  onClick?: () => void;
}

const BADGE: Record<MachineState, string> = {
  RUN: 'badge badge-run',
  IDLE: 'badge badge-idle',
  DOWN: 'badge badge-down',
  UNKNOWN: 'badge bg-steel-100 text-steel-600'
};

export function MachineStatus({ machine, state, lastUpdate, cycleTimeSec, onClick }: MachineStatusProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'kpi-card flex w-full flex-col items-start gap-1 text-left transition hover:border-steel-300 hover:shadow-md'
      )}
    >
      <div className="flex w-full items-center justify-between">
        <span className="font-semibold text-steel-800">{machine}</span>
        <span className={BADGE[state]}>{state}</span>
      </div>
      <span className="text-xs text-steel-500">
        {lastUpdate ? `Aggiornato ${lastUpdate}` : 'Nessun dato recente'}
      </span>
      {cycleTimeSec !== undefined && (
        <span className="text-xs text-steel-500">Cycle time {cycleTimeSec.toFixed(2)} s</span>
      )}
    </button>
  );
}
