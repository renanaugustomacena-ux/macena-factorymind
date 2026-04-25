import clsx from 'clsx';

export interface MQTTConnectionIndicatorProps {
  state: 'connecting' | 'open' | 'closed' | 'error';
  label?: string;
}

const PALETTE: Record<string, string> = {
  connecting: 'bg-signal-amber',
  open: 'bg-signal-green',
  closed: 'bg-steel-300',
  error: 'bg-signal-red'
};

const LABELS: Record<string, string> = {
  connecting: 'Connessione in corso',
  open: 'Stream live attivo',
  closed: 'Stream interrotto',
  error: 'Errore di connessione'
};

export function MQTTConnectionIndicator({ state, label }: MQTTConnectionIndicatorProps) {
  return (
    <div className="flex items-center gap-2 text-xs text-steel-600">
      <span className={clsx('h-2.5 w-2.5 rounded-full', PALETTE[state])} aria-hidden="true" />
      <span>{label || LABELS[state]}</span>
    </div>
  );
}
