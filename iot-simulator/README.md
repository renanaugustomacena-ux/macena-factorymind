# FactoryMind IoT Simulator

Node.js CLI that publishes realistic industrial-IoT MQTT traffic for development and demo. Generates 1-second-cadence telemetry across configurable lines × machines, with realistic state machines (RUNNING / IDLE / DOWN), sporadic faults, and per-machine performance drift.

The simulator is the dev-loop replacement for a real PLC connected to a real broker — the topic taxonomy and payload shape match exactly what `iot-simulator/simulator.js:243-258` produces, which is also what real edge gateways are expected to publish.

## Run

```bash
npm install
node simulator.js                                    # defaults: facility=mozzecane, 2 lines × 4 machines
node simulator.js --facility=plant-b --lines=3 --machines-per-line=8
node simulator.js --config=./my.json                 # explicit machine list
```

Configuration via env vars (also picked up when running under docker-compose):

| Env var | Default | Notes |
|---|---|---|
| `MQTT_BROKER_URL` | `mqtt://localhost:1883` | Set to the broker the simulator should publish to. |
| `MQTT_USERNAME` | `''` | Required if the broker rejects anonymous (R-MQTT-ANON-001). |
| `MQTT_PASSWORD` | `''` | Required when broker auth is enabled. |
| `SIM_FACILITY` | `mozzecane` | Topic-segment 2 in `factory/<facility>/<line>/<machine>/<kind>`. |
| `SIM_LINES` | `2` | Number of synthetic production lines. |
| `SIM_MACHINES_PER_LINE` | `4` | Machines per line. |
| `SIM_INTERVAL_MS` | `1000` | Inter-publish interval. |
| `SIM_FAULT_PROBABILITY` | `0.01` | Per-machine probability per tick of transitioning to DOWN. |

## Topics

The default emit shape (per `simulator.js:243-258`):

```
factory/<facility>/<line-id>/<machine-id>/telemetry    # 1 Hz, every machine
factory/<facility>/<line-id>/<machine-id>/status       # state transitions only
factory/<facility>/<line-id>/<machine-id>/alarms       # fault events only
```

All segments are lower-case, alphanumeric or hyphen, 1-32 chars — passing the canonical regex in `backend/src/mqtt/topics.js#CANONICAL_TOPIC_REGEX` (R-MQTT-TOPIC-VALIDATION-001). Default `line_id` and `machine_id` use the `line-NN` / `machine-NN` form.

## Dockerfile

The simulator runs as the `node` user (UID 1000) per its Dockerfile USER directive — also pinned in `docker-compose.yml` (R-INFRA-USER-EXPLICIT-001).

## Doctrine references

- **H-9** — the canonical topic regex lives in `backend/src/mqtt/topics.js`. Do NOT add a parallel topic builder here; if the simulator needs to publish a new kind, extend `KIND_VALUES` in topics.js first.
- **R-3** — the simulator is a dev tool. It should not be hardened with production-grade auth or TLS unless that's the test scenario; production traffic comes from real edge gateways using real broker credentials.

See [`docs/HANDOFF.md`](../docs/HANDOFF.md) § 4 (module map) for how the simulator slots into the broader testing strategy.
