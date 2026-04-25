import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { AlertFeed } from '@/components/AlertFeed';
import { useT } from '@/i18n/useT';

export function Alerts() {
  const qc = useQueryClient();
  const t = useT();
  const alertsQuery = useQuery({
    queryKey: ['alerts', 'open'],
    queryFn: () => api.alerts.open(),
    refetchInterval: 10_000
  });

  const ack = useMutation({
    mutationFn: (id: string) => api.alerts.acknowledge(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] })
  });

  const resolve = useMutation({
    mutationFn: (id: string) => api.alerts.resolve(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] })
  });

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-steel-900">{t('alerts.title')}</h1>
        <p className="text-sm text-steel-500">{t('alerts.subtitle')}</p>
      </header>
      <AlertFeed
        items={alertsQuery.data || []}
        onAcknowledge={(id) => ack.mutate(id)}
        onResolve={(id) => resolve.mutate(id)}
      />
    </div>
  );
}
