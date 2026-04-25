export type MachineState = 'RUN' | 'IDLE' | 'DOWN' | 'UNKNOWN';
export type Severity = 'warning' | 'major' | 'critical';

export interface Facility {
  id: string;
  facility_id: string;
  name: string;
  city: string;
  province: string;
}

export interface ProductionLine {
  id: string;
  facility_id: string;
  line_id: string;
  name: string;
  description?: string;
  target_oee: number;
}

export interface Device {
  id: string;
  facility_id: string;
  line_id: string;
  machine_id: string;
  name: string;
  vendor: string;
  model: string;
  protocol: string;
  ideal_cycle_time_sec: number;
}

export interface Alert {
  id: string;
  rule_id: string;
  facility_id: string;
  line_id: string;
  machine_id: string;
  metric: string;
  value: number;
  severity: Severity;
  message: string;
  status: 'open' | 'acknowledged' | 'resolved';
  fired_at: string;
  acknowledged_at?: string;
  resolved_at?: string;
}

export interface OEEResult {
  availability: number;
  performance: number;
  quality: number;
  oee: number;
  operating_time_sec: number;
  planned_time_sec: number;
  downtime_sec: number;
  total_count: number;
  good_count: number;
  reject_count: number;
  cycle_time_actual_sec: number;
  classification: 'world-class' | 'above-average' | 'average' | 'below-target' | 'insufficient-data';
}

export interface OEEMachine extends OEEResult {
  facility: string;
  line: string;
  machine: string;
}

export interface OEELineRollup {
  facility: string;
  line?: string;
  machines: OEEMachine[];
  aggregate: OEEResult;
}

export interface TelemetryEnvelope {
  type: 'mqtt';
  topic: string;
  parsed: { facility: string; line: string; machine: string; kind: string };
  payload: {
    ts: string;
    metric?: string;
    value?: number;
    unit?: string;
    state?: MachineState;
    severity?: Severity;
    message?: string;
    code?: string;
  };
  ts: string;
}
