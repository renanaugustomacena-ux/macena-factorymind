import clsx from 'clsx';

export interface OEEGaugeProps {
  value: number;       // 0..1
  label?: string;
  target?: number;     // 0..1
  size?: number;
}

function classify(value: number): { color: string; text: string } {
  if (value >= 0.85) return { color: '#10b981', text: 'World-class' };
  if (value >= 0.60) return { color: '#3b82f6', text: 'Sopra media' };
  if (value >= 0.50) return { color: '#eab308', text: 'In media' };
  return { color: '#ef4444', text: 'Sotto obiettivo' };
}

export function OEEGauge({ value, label = 'OEE', target = 0.60, size = 160 }: OEEGaugeProps) {
  const pct = Math.max(0, Math.min(1, value));
  const { color, text } = classify(pct);
  const radius = size / 2 - 10;
  const circ = 2 * Math.PI * radius;
  const offset = circ * (1 - pct);
  const targetAngle = target * 360 - 90;
  return (
    <div className={clsx('flex flex-col items-center gap-2')}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label={`${label} ${(pct * 100).toFixed(1)}%`}>
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="#e2e8f0" strokeWidth="10" fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth="10"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <g transform={`translate(${size / 2}, ${size / 2}) rotate(${targetAngle})`}>
          <line x1={radius - 6} y1={0} x2={radius + 6} y2={0} stroke="#475569" strokeWidth="2" />
        </g>
        <text x="50%" y="48%" textAnchor="middle" fontSize={size * 0.22} fontWeight="700" fill="#0f172a">
          {(pct * 100).toFixed(0)}%
        </text>
        <text x="50%" y="64%" textAnchor="middle" fontSize={size * 0.09} fill="#475569">
          {label}
        </text>
      </svg>
      <span className="text-xs font-medium text-steel-500">{text}</span>
    </div>
  );
}
