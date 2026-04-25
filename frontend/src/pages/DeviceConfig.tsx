import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';

export function DeviceConfig() {
  const facility = import.meta.env.VITE_DEFAULT_FACILITY || 'mozzecane';
  const devicesQuery = useQuery({
    queryKey: ['devices', facility],
    queryFn: () => api.devices.list(facility),
    staleTime: 30_000
  });

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <header className="mb-4">
        <h1 className="text-2xl font-bold text-steel-900">Configurazione macchine</h1>
        <p className="text-sm text-steel-500">
          Elenco dei dispositivi configurati. Ogni macchina interconnessa
          soddisfa i requisiti Piano Transizione 4.0 per la detrazione fiscale.
        </p>
      </header>

      <div className="overflow-hidden rounded-xl border border-steel-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-steel-50 text-left text-xs uppercase text-steel-500">
            <tr>
              <th className="px-4 py-3">Macchina</th>
              <th className="px-4 py-3">Linea</th>
              <th className="px-4 py-3">Vendor / Model</th>
              <th className="px-4 py-3">Protocollo</th>
              <th className="px-4 py-3">Cycle Ideale</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-steel-200">
            {(devicesQuery.data || []).map((d) => (
              <tr key={d.id}>
                <td className="px-4 py-3 font-medium text-steel-800">{d.name}</td>
                <td className="px-4 py-3 text-steel-600">{d.line_id}</td>
                <td className="px-4 py-3 text-steel-600">{d.vendor} {d.model}</td>
                <td className="px-4 py-3">
                  <span className="badge bg-steel-100 text-steel-700">{d.protocol}</span>
                </td>
                <td className="px-4 py-3 text-steel-600">{d.ideal_cycle_time_sec}s</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
