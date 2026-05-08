import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import { ShiftReport } from '@/components/ShiftReport';
import { DowntimeChart } from '@/components/DowntimeChart';
import { useT } from '@/i18n/useT';
import type { OEEResult } from '@/types';

const FALLBACK_OEE: OEEResult = {
  availability: 0, performance: 0, quality: 0, oee: 0,
  operating_time_sec: 0, planned_time_sec: 0, downtime_sec: 0,
  total_count: 0, good_count: 0, reject_count: 0,
  cycle_time_actual_sec: 0, classification: 'insufficient-data'
};

export function Reports() {
  const facility = import.meta.env.VITE_DEFAULT_FACILITY || 'mozzecane';
  const t = useT();

  const oeeQuery = useQuery({
    queryKey: ['oee', facility, 'shift-report'],
    queryFn: () => api.oee.forLine(facility),
    refetchInterval: 60_000
  });

  const downtimesQuery = useQuery({
    queryKey: ['downtimes', facility, '-24h'],
    queryFn: () => api.metrics.downtimes({ facility, start: '-24h' }),
    refetchInterval: 60_000
  });

  const now = new Date();
  const start = new Date(now.getTime() - 8 * 3_600_000);

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-steel-900">{t('reports.title')}</h1>
        <p className="text-sm text-steel-500">{t('reports.subtitle')}</p>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ShiftReport
          shiftName={t('reports.shift_current')}
          startAt={start.toISOString()}
          endAt={now.toISOString()}
          oee={oeeQuery.data?.aggregate || FALLBACK_OEE}
        />

        <section aria-busy={downtimesQuery.isLoading}>
          {downtimesQuery.isError ? (
            <div className="kpi-card">
              <h3 className="mb-2 text-sm font-semibold text-steel-800">
                {t('reports.downtime_chart.heading')}
              </h3>
              <p className="text-sm text-rose-700">
                {t('reports.downtime_chart.error')}
              </p>
            </div>
          ) : downtimesQuery.isLoading ? (
            <div className="kpi-card">
              <h3 className="mb-2 text-sm font-semibold text-steel-800">
                {t('reports.downtime_chart.heading')}
              </h3>
              <p className="text-sm text-steel-500">
                {t('reports.downtime_chart.loading')}
              </p>
            </div>
          ) : (
            <DowntimeChart data={downtimesQuery.data?.pareto || []} />
          )}
          {downtimesQuery.data && (
            <p className="mt-2 text-xs text-steel-500">
              {t('reports.downtime_chart.window_note', {
                minutes: Math.round((downtimesQuery.data.total_downtime_seconds || 0) / 60),
                events: downtimesQuery.data.total_events
              })}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
