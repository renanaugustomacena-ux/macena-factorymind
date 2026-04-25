-- =========================================================================
-- Seed data — demo facility / line / devices / shifts / alert rule / admin.
-- Enough to light up the frontend dashboard and Grafana panels immediately
-- after `docker compose up`.
-- =========================================================================

INSERT INTO facilities (facility_id, name, address, city, province, country, timezone)
VALUES
  ('mozzecane', 'Stabilimento Mozzecane', 'Via dell''Industria 12', 'Mozzecane', 'VR', 'IT', 'Europe/Rome')
ON CONFLICT (facility_id) DO NOTHING;

INSERT INTO lines (facility_id, line_id, name, description, target_oee)
VALUES
  ('mozzecane', 'line-01', 'Linea Tornitura CNC', 'Centri di lavoro tornitura, 3 turni', 0.75),
  ('mozzecane', 'line-02', 'Linea Assemblaggio', 'Assemblaggio componenti meccanici', 0.70)
ON CONFLICT (facility_id, line_id) DO NOTHING;

INSERT INTO devices (facility_id, line_id, machine_id, name, vendor, model, protocol, ideal_cycle_time_sec)
VALUES
  ('mozzecane','line-01','machine-01','CNC Lathe #1','Mazak','Quick Turn 250','opcua',18.0),
  ('mozzecane','line-01','machine-02','CNC Lathe #2','Mazak','Quick Turn 250','opcua',18.0),
  ('mozzecane','line-01','machine-03','CNC Lathe #3','Okuma','LB3000','modbus_tcp',20.0),
  ('mozzecane','line-01','machine-04','CNC Lathe #4','Okuma','LB3000','modbus_tcp',20.0),
  ('mozzecane','line-02','machine-01','Assembly Cell A','Beckhoff','CX5140','mqtt',35.0),
  ('mozzecane','line-02','machine-02','Assembly Cell B','Beckhoff','CX5140','mqtt',35.0),
  ('mozzecane','line-02','machine-03','Packaging Robot','Siemens','S7-1500','opcua',12.0),
  ('mozzecane','line-02','machine-04','End-of-Line Test','Bosch','Rexroth IndraControl','modbus_tcp',9.0)
ON CONFLICT (facility_id, line_id, machine_id) DO NOTHING;

-- Default single 8h shift window for today (06:00–14:00 local Europe/Rome).
INSERT INTO shifts (facility_id, line_id, shift_name, start_at, end_at, planned_breaks_sec)
SELECT 'mozzecane', 'line-01', 'Turno Mattina',
       (NOW() AT TIME ZONE 'Europe/Rome')::DATE + TIME '06:00' AT TIME ZONE 'Europe/Rome',
       (NOW() AT TIME ZONE 'Europe/Rome')::DATE + TIME '14:00' AT TIME ZONE 'Europe/Rome',
       1800
WHERE NOT EXISTS (SELECT 1 FROM shifts WHERE facility_id='mozzecane' AND line_id='line-01');

INSERT INTO shifts (facility_id, line_id, shift_name, start_at, end_at, planned_breaks_sec)
SELECT 'mozzecane', 'line-02', 'Turno Mattina',
       (NOW() AT TIME ZONE 'Europe/Rome')::DATE + TIME '06:00' AT TIME ZONE 'Europe/Rome',
       (NOW() AT TIME ZONE 'Europe/Rome')::DATE + TIME '14:00' AT TIME ZONE 'Europe/Rome',
       1800
WHERE NOT EXISTS (SELECT 1 FROM shifts WHERE facility_id='mozzecane' AND line_id='line-02');

-- Example rule: alarm when spindle temperature ≥ 85 °C for more than 15 s.
INSERT INTO alert_rules (name, facility_id, line_id, metric, severity, expression, enabled)
SELECT 'spindle_overheat', 'mozzecane', NULL, 'spindle_temp_c', 'major',
       '{"kind":"threshold","operator":">=","threshold":85,"hysteresis":2,"debounce_sec":15}'::JSONB,
       TRUE
WHERE NOT EXISTS (SELECT 1 FROM alert_rules WHERE name='spindle_overheat');

-- Default admin per il dev locale: admin@factorymind.local / FactoryMind2026!
-- Hash scrypt N=2^14 r=8 p=1 keylen=64 salt=0123456789abcdef
-- Generato con: node -e 'console.log(require("crypto").scryptSync("FactoryMind2026!","0123456789abcdef",64).toString("hex"))'
-- NON USARE IN PRODUZIONE: l'installer sostituisce questo hash al primo boot.
INSERT INTO users (email, full_name, role, facility_scope, password_salt, password_hash, active)
SELECT 'admin@factorymind.local', 'Default Admin', 'admin', ARRAY['mozzecane'],
       '0123456789abcdef',
       '85c8a02d508bfcf8b39bb2d818b2f037b23e48c1e47ceac11ff734877382218fea9c2223fb1b42958c57d8230b84fb6489da8d8f798bfac016e2f1ff94c57487',
       TRUE
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email='admin@factorymind.local');
