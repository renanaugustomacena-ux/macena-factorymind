import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import { OEEGauge } from '@/components/OEEGauge';
import { ProductionLine } from '@/components/ProductionLine';
import { useT } from '@/i18n/useT';

export function LineDetail() {
  const { facility, line } = useParams();
  const f = facility || 'mozzecane';
  const l = line || 'line-01';
  const t = useT();

  const oeeQuery = useQuery({
    queryKey: ['oee', f, l],
    queryFn: () => api.oee.forLine(f, l),
    refetchInterval: 30_000
  });

  const rollup = oeeQuery.data;

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-steel-900">{t('nav.line')} {l}</h1>
        <p className="text-sm text-steel-500">
          {t('dashboard.subtitle_facility', { facility: f })}
        </p>
      </header>

      {rollup && (
        <ProductionLine rollup={rollup} />
      )}

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <div className="kpi-card flex flex-col items-center">
          <OEEGauge value={rollup?.aggregate.oee ?? 0} />
        </div>
        <div className="kpi-card lg:col-span-3">
          <h3 className="mb-3 text-sm font-semibold text-steel-800">
            {t('dashboard.machines_heading')}
          </h3>
          <ul className="divide-y divide-steel-200">
            {(rollup?.machines || []).map((m) => (
              <li
                key={m.machine}
                className="flex items-center justify-between py-2 text-sm"
              >
                <span className="font-medium text-steel-800">{m.machine}</span>
                <div className="flex gap-3 text-steel-600">
                  <span title={t('dashboard.oee.availability')}>
                    A {(m.availability * 100).toFixed(0)}%
                  </span>
                  <span title={t('dashboard.oee.performance')}>
                    R {(m.performance * 100).toFixed(0)}%
                  </span>
                  <span title={t('dashboard.oee.quality')}>
                    Q {(m.quality * 100).toFixed(0)}%
                  </span>
                  <span className="font-semibold text-steel-900">
                    OEE {(m.oee * 100).toFixed(0)}%
                  </span>
                </div>
              </li>
            ))}
            {(!rollup || rollup.machines.length === 0) && (
              <li className="py-4 text-sm text-steel-500">
                {t('machines.empty')}
              </li>
            )}
          </ul>
        </div>
      </section>
    </div>
  );
}
