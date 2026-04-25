import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import { useRealtime } from '@/hooks/useRealtime';
import { MachineStatus } from '@/components/MachineStatus';
import { OEEGauge } from '@/components/OEEGauge';
import { AlertFeed } from '@/components/AlertFeed';
import { MQTTConnectionIndicator } from '@/components/MQTTConnectionIndicator';
import type { MachineState } from '@/types';
import { useMemo } from 'react';
import { useT } from '@/i18n/useT';

const DEFAULT_FACILITY = import.meta.env.VITE_DEFAULT_FACILITY || 'mozzecane';

export function Dashboard() {
  const facility = DEFAULT_FACILITY;
  const t = useT();

  const devicesQuery = useQuery({
    queryKey: ['devices', facility],
    queryFn: () => api.devices.list(facility),
    staleTime: 60_000
  });

  const alertsQuery = useQuery({
    queryKey: ['alerts', 'open'],
    queryFn: () => api.alerts.open(),
    refetchInterval: 15_000
  });

  const oeeQuery = useQuery({
    queryKey: ['oee', facility],
    queryFn: () => api.oee.forLine(facility),
    refetchInterval: 30_000
  });

  const realtime = useRealtime({ topics: [`factory/${facility}/+/+/status`, `factory/${facility}/+/+/telemetry`] });

  const machineStates = useMemo(() => {
    const map = new Map<string, { state: MachineState; ts: string }>();
    for (const msg of realtime.messages) {
      const key = `${msg.parsed.line}/${msg.parsed.machine}`;
      if (msg.parsed.kind === 'status' && msg.payload.state) {
        map.set(key, { state: msg.payload.state as MachineState, ts: msg.payload.ts || msg.ts });
      }
    }
    return map;
  }, [realtime.messages]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-steel-900">{t('dashboard.title')}</h1>
          <p className="text-sm text-steel-500">
            {t('dashboard.subtitle_facility', { facility })} &middot;{' '}
            {t('dashboard.subtitle_machines', { count: devicesQuery.data?.length || 0 })}
          </p>
        </div>
        <MQTTConnectionIndicator state={realtime.state} />
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="kpi-card flex flex-col items-center">
          <OEEGauge value={oeeQuery.data?.aggregate?.oee ?? 0} />
        </div>
        <div className="kpi-card">
          <p className="text-xs uppercase text-steel-500">{t('dashboard.oee.availability')}</p>
          <p className="mt-2 text-3xl font-semibold text-steel-900">
            {((oeeQuery.data?.aggregate?.availability ?? 0) * 100).toFixed(1)}%
          </p>
          <p className="mt-1 text-xs text-steel-500">{t('dashboard.oee.availability_hint')}</p>
        </div>
        <div className="kpi-card">
          <p className="text-xs uppercase text-steel-500">{t('dashboard.oee.performance')}</p>
          <p className="mt-2 text-3xl font-semibold text-steel-900">
            {((oeeQuery.data?.aggregate?.performance ?? 0) * 100).toFixed(1)}%
          </p>
          <p className="mt-1 text-xs text-steel-500">{t('dashboard.oee.performance_hint')}</p>
        </div>
        <div className="kpi-card">
          <p className="text-xs uppercase text-steel-500">{t('dashboard.oee.quality')}</p>
          <p className="mt-2 text-3xl font-semibold text-steel-900">
            {((oeeQuery.data?.aggregate?.quality ?? 0) * 100).toFixed(1)}%
          </p>
          <p className="mt-1 text-xs text-steel-500">{t('dashboard.oee.quality_hint')}</p>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-steel-800">{t('dashboard.machines_heading')}</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(devicesQuery.data || []).map((d) => {
            const key = `${d.line_id}/${d.machine_id}`;
            const live = machineStates.get(key);
            return (
              <MachineStatus
                key={d.id}
                machine={d.name}
                state={live?.state ?? 'UNKNOWN'}
                lastUpdate={live?.ts ? new Date(live.ts).toLocaleTimeString('it-IT') : undefined}
                cycleTimeSec={d.ideal_cycle_time_sec}
              />
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-steel-800">{t('dashboard.alerts_heading')}</h2>
        <AlertFeed items={alertsQuery.data || []} />
      </section>
    </div>
  );
}
