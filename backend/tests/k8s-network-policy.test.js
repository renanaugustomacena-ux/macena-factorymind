/**
 * R-K8S-NETPOL-001 — F-MED-001 closure regression.
 *
 * Locks the structure of `k8s/network-policy.yaml` so a future edit can't
 * silently drop the postgres / influxdb / mosquitto fine-grained policies
 * that gate the in-cluster data-plane.
 *
 * This is a static-text assertion (not a real cluster smoke test). The
 * exit criterion calls for "smoke test that the cluster still functions";
 * the substitute documented here (per H-20) is structural — apply to a
 * cluster manually when adding new components, since the agent has no
 * cluster access from this seat.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const NETWORK_POLICY = path.resolve(__dirname, '../../k8s/network-policy.yaml');
const NAMESPACE = path.resolve(__dirname, '../../k8s/namespace.yaml');

let netpolSource;
let namespaceSource;

beforeAll(() => {
  netpolSource = fs.readFileSync(NETWORK_POLICY, 'utf8');
  namespaceSource = fs.readFileSync(NAMESPACE, 'utf8');
});

describe('namespace.yaml — preserved baseline (R-K8S-NETPOL-001 regression)', () => {
  it('default-deny NetworkPolicy is present', () => {
    expect(namespaceSource).toMatch(/name:\s*default-deny/);
    expect(namespaceSource).toMatch(/podSelector:\s*\{\}/);
  });

  it('backend-allow NetworkPolicy is present (Ingress + Egress)', () => {
    expect(namespaceSource).toMatch(/name:\s*backend-allow/);
    const backendAllowSection = namespaceSource.split(/^---$/m).find((s) =>
      /name:\s*backend-allow/.test(s)
    );
    expect(backendAllowSection).toBeDefined();
    expect(backendAllowSection).toMatch(/policyTypes:[\s\S]*-\s*Ingress[\s\S]*-\s*Egress/);
  });
});

describe('network-policy.yaml — fine-grained data-plane policies', () => {
  function policySection(name) {
    return netpolSource.split(/^---$/m).find((s) => new RegExp(`name:\\s*${name}\\b`).test(s));
  }

  it('declares the three required NetworkPolicies', () => {
    expect(netpolSource).toMatch(/name:\s*postgres-allow/);
    expect(netpolSource).toMatch(/name:\s*influxdb-allow/);
    expect(netpolSource).toMatch(/name:\s*mosquitto-allow/);
  });

  it('every policy targets the factorymind namespace', () => {
    const docs = netpolSource.split(/^---$/m).filter((s) => /kind:\s*NetworkPolicy/.test(s));
    expect(docs.length).toBeGreaterThanOrEqual(3);
    for (const d of docs) {
      expect(d).toMatch(/namespace:\s*factorymind/);
    }
  });

  describe('postgres-allow', () => {
    it('podSelector matches postgres component', () => {
      const s = policySection('postgres-allow');
      expect(s).toMatch(/podSelector:[\s\S]*matchLabels:[\s\S]*component:\s*postgres/);
    });
    it('ingress allows backend on port 5432 and nothing else (no Egress policyType)', () => {
      const s = policySection('postgres-allow');
      expect(s).toMatch(/component:\s*backend/);
      expect(s).toMatch(/port:\s*5432/);
      expect(s).not.toMatch(/-\s*Egress/);
    });
  });

  describe('influxdb-allow', () => {
    it('podSelector matches influxdb component', () => {
      const s = policySection('influxdb-allow');
      expect(s).toMatch(/podSelector:[\s\S]*matchLabels:[\s\S]*component:\s*influxdb/);
    });
    it('ingress allows backend AND grafana on port 8086', () => {
      const s = policySection('influxdb-allow');
      expect(s).toMatch(/component:\s*backend/);
      expect(s).toMatch(/component:\s*grafana/);
      expect(s).toMatch(/port:\s*8086/);
    });
  });

  describe('mosquitto-allow', () => {
    it('podSelector matches mosquitto component', () => {
      const s = policySection('mosquitto-allow');
      expect(s).toMatch(/podSelector:[\s\S]*matchLabels:[\s\S]*component:\s*mosquitto/);
    });
    it('ingress allows backend, iot-simulator, edge-gateway on 1883/8883', () => {
      const s = policySection('mosquitto-allow');
      expect(s).toMatch(/component:\s*backend/);
      expect(s).toMatch(/component:\s*iot-simulator/);
      expect(s).toMatch(/component:\s*edge-gateway/);
      expect(s).toMatch(/port:\s*1883/);
      expect(s).toMatch(/port:\s*8883/);
    });
  });
});
