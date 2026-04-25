import {
  BarChart,
  Bar,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

export interface DowntimeDatum {
  reason_code: string;
  total_seconds: number;
  occurrences: number;
}

export interface DowntimeChartProps {
  data: DowntimeDatum[];
}

export function DowntimeChart({ data }: DowntimeChartProps) {
  const ordered = [...data].sort((a, b) => b.total_seconds - a.total_seconds);
  return (
    <div className="kpi-card">
      <h3 className="mb-2 text-sm font-semibold text-steel-800">Pareto dei fermi macchina</h3>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={ordered} margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="reason_code" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(Number(v) / 60)}m`} />
          <Tooltip
            formatter={(value: number) => [`${Math.round(value / 60)} min`, 'Durata']}
            labelFormatter={(label: string) => `Causa: ${label}`}
          />
          <Bar dataKey="total_seconds" fill="#eab308" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
