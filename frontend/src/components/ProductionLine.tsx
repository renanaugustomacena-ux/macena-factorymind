import type { OEELineRollup } from '@/types';
import { OEEGauge } from './OEEGauge';
import { useT } from '@/i18n/useT';

export interface ProductionLineProps {
  rollup: OEELineRollup;
}

export function ProductionLine({ rollup }: ProductionLineProps) {
  const t = useT();
  return (
    <section className="kpi-card">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-steel-800">
            {t('nav.line')} {rollup.line || '—'}
          </h2>
          <p className="text-sm text-steel-500">
            {t('dashboard.subtitle_facility', { facility: rollup.facility })}
          </p>
        </div>
        <OEEGauge value={rollup.aggregate.oee} size={120} />
      </header>

      <div className="grid grid-cols-3 gap-3 text-sm">
        <div>
          <p className="text-steel-500">{t('dashboard.oee.availability')}</p>
          <p className="text-xl font-semibold text-steel-800">
            {(rollup.aggregate.availability * 100).toFixed(1)}%
          </p>
        </div>
        <div>
          <p className="text-steel-500">{t('dashboard.oee.performance')}</p>
          <p className="text-xl font-semibold text-steel-800">
            {(rollup.aggregate.performance * 100).toFixed(1)}%
          </p>
        </div>
        <div>
          <p className="text-steel-500">{t('dashboard.oee.quality')}</p>
          <p className="text-xl font-semibold text-steel-800">
            {(rollup.aggregate.quality * 100).toFixed(1)}%
          </p>
        </div>
      </div>
    </section>
  );
}
