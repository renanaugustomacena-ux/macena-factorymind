# FactoryMind — API Reference

Base URL: `http://<host>:3002`. All responses are JSON. All mutating endpoints
require a bearer JWT obtained from `POST /api/users/login`.

Error envelope:

```json
{ "error": "human-readable message", "status": 400, "path": "/api/..." }
```

## GET /api/health

Returns the consolidated health envelope consumed by k8s liveness probes and
Compose healthchecks.

Response 200:

```json
{
  "status": "ok",
  "service": "factorymind-backend",
  "version": "1.0.0",
  "uptime_seconds": 1234,
  "time": "2026-04-17T12:34:56.000Z",
  "host": "factorymind-backend",
  "dependencies": {
    "postgres":  { "ok": true, "latency_ms": 2 },
    "influxdb":  { "ok": true, "latency_ms": 3 },
    "mosquitto": { "ok": true, "latency_ms": 0 }
  }
}
```

Response 503 — one or more dependencies unhealthy. Same shape; `status` is `degraded`.

## Authentication

### POST /api/users/login

Body:
```json
{ "email": "admin@factorymind.local", "password": "FactoryMind2026!" }
```
Response 200:
```json
{
  "token": "<jwt>",
  "user": { "id": "...", "email": "...", "role": "admin", "facility_scope": ["mozzecane"] }
}
```
Errors: 400 invalid body, 401 invalid credentials.

### GET /api/users/me

Returns the caller's decoded JWT claims.

### GET /api/users

Admin-only. Returns `{ items: User[] }`.

### POST /api/users

Admin-only. Body validated against the schema in `src/routes/users.js`.

## Facilities

### GET /api/facilities
Returns `{ items: Facility[] }`.

### POST /api/facilities
Create a facility. Fields: `facility_id`, `name`, `address`, `city`, `province`, `country`, `timezone`, `metadata`.

### PUT /api/facilities/:id
Update. Same fields.

### DELETE /api/facilities/:id
Soft-cascade: lines, devices, alerts with matching `facility_id` become orphaned (not deleted) unless manually purged.

## Lines

### GET /api/lines?facility_id=mozzecane
Returns `{ items: Line[] }`.

### POST /api/lines
Fields: `facility_id`, `line_id`, `name`, `description`, `target_oee` (0–1).

### PUT /api/lines/:id
### DELETE /api/lines/:id

## Devices

### GET /api/devices?facility_id=&line_id=
Returns `{ items: Device[] }`.

### GET /api/devices/:id
Returns a single device including `opcua_tags` and `modbus_map`.

### POST /api/devices
Fields:

| Field                 | Type                                                                     |
|-----------------------|--------------------------------------------------------------------------|
| `facility_id`         | string                                                                   |
| `line_id`             | string                                                                   |
| `machine_id`          | string                                                                   |
| `name`                | string                                                                   |
| `vendor`, `model`, `serial` | string (optional)                                                 |
| `protocol`            | `mqtt` \| `opcua` \| `modbus_tcp` \| `modbus_rtu` \| `sparkplug`         |
| `ideal_cycle_time_sec`| number ≥ 0                                                               |
| `opcua_tags`          | `{ nodeId, metric, unit? }[]`                                            |
| `modbus_map`          | `{ address, type, metric, unit? }[]`                                     |

### PUT /api/devices/:id
### DELETE /api/devices/:id

## Metrics

### GET /api/metrics

Query params:

| Param      | Type     | Default   | Description                                   |
|------------|----------|-----------|-----------------------------------------------|
| `facility` | string   | required  |                                               |
| `line`     | string   | required  |                                               |
| `machine`  | string   | required  |                                               |
| `metric`   | string   | required  | e.g. `spindle_speed`, `power_kw`, `vibration_mm_s` |
| `start`    | string   | `-1h`     | Flux start literal                            |
| `stop`     | string   | `now()`   | Flux stop literal                             |
| `window`   | `raw`\|`1m`\|`1h`\|`1d` | `raw` | Downsampling level                  |
| `agg`      | `mean`\|`max`\|`min`\|`sum` | `mean` |                                  |

Response 200:
```json
{
  "facility": "mozzecane",
  "line": "line-01",
  "machine": "machine-01",
  "metric": "spindle_speed",
  "window": "raw",
  "agg": "mean",
  "points": [ { "ts": "2026-04-17T12:00:00.000Z", "value": 2957.3 }, ... ],
  "count": 360
}
```

## OEE

### GET /api/oee

Query params:

| Param      | Required           | Example                      |
|------------|--------------------|------------------------------|
| `facility` | yes                | `mozzecane`                  |
| `line`     | no                 | `line-01`                    |
| `machine`  | no (with `line`)   | `machine-01`                 |
| `start`    | no                 | `-8h`                        |
| `stop`     | no                 | `now()`                      |

When `machine` is supplied, returns a single `OEEResult`. Otherwise returns:

```json
{
  "facility": "mozzecane",
  "line": "line-01",
  "machines": [ { "machine": "machine-01", "oee": 0.74, ... }, ... ],
  "aggregate": { "oee": 0.71, "availability": 0.92, "performance": 0.82, "quality": 0.94, ... }
}
```

## Alerts

### GET /api/alerts?status=open|acknowledged|resolved

### POST /api/alerts/:id/acknowledge

### POST /api/alerts/:id/resolve

### GET /api/alerts/rules

### POST /api/alerts/rules

Body schema:

```json
{
  "name": "spindle_overheat",
  "facility_id": "mozzecane",
  "line_id": null,
  "machine_id": null,
  "metric": "spindle_temp_c",
  "severity": "major",
  "expression": {
    "kind": "threshold",
    "operator": ">=",
    "threshold": 85,
    "hysteresis": 2,
    "debounce_sec": 15
  },
  "enabled": true
}
```

### PUT /api/alerts/rules/:id
### DELETE /api/alerts/rules/:id

## WebSocket `/ws`

After `upgrade`, send:
```json
{ "type": "subscribe", "topics": ["factory/mozzecane/line-01/+/telemetry"] }
```

Server frames:
```json
{
  "type": "mqtt",
  "topic": "factory/mozzecane/line-01/machine-01/telemetry",
  "parsed": { "facility": "...", "line": "...", "machine": "...", "kind": "telemetry" },
  "payload": [ { "ts": "...", "metric": "spindle_speed", "value": 3012, "unit": "rpm" } ],
  "ts": "2026-04-17T12:34:56.000Z"
}
```

Heartbeat: the server sends a ping frame every 20 s; clients that don't
respond within one interval are terminated. The client reconnect strategy
used by the bundled hook `useRealtime` is linear (1 s → 10 s, capped).

## Error Codes

| HTTP | Meaning                                     |
|------|---------------------------------------------|
| 400  | Validation error (Joi) or malformed request |
| 401  | Missing / invalid bearer token              |
| 403  | RBAC: role not authorised                   |
| 404  | Resource not found                          |
| 409  | Conflict (e.g. duplicate `(facility, line, machine)`) |
| 429  | Rate-limit exceeded (120 req/min default)   |
| 500  | Unhandled server error                      |
| 503  | Health degraded — dependency outage         |
