/**
 * R-K8S-DIGEST-001 / R-SUPPLY-001 — closes F-HIGH-008 + F-HIGH-009.
 *
 * Doctrine R-3 again: structural properties of the CD pipeline that must
 * not silently regress. We assert against the YAML text:
 *   - Cosign keyless signing runs on every built image.
 *   - Each `docker/build-push-action` step has an `id` so its
 *     `outputs.digest` is referenceable downstream.
 *   - The deploy job rewrites tag-form image references to digest form
 *     before applying the k8s manifest (no tag-only image hits the
 *     cluster).
 */

'use strict';

const fs = require('fs');
const path = require('path');

const CD_YML = path.resolve(__dirname, '../../.github/workflows/cd.yml');
const K8S_DEPLOYMENT = path.resolve(__dirname, '../../k8s/deployment.yaml');

describe('CD supply chain — Cosign + digest pinning (R-SUPPLY-001 + R-K8S-DIGEST-001)', () => {
  let cd;

  beforeAll(() => {
    cd = fs.readFileSync(CD_YML, 'utf8');
  });

  it('Cosign installer step is present', () => {
    expect(cd).toMatch(/sigstore\/cosign-installer/);
  });

  it('Cosign sign step uses --yes (non-interactive) and signs all three images', () => {
    expect(cd).toMatch(/cosign\s+sign\s+--yes/);
    expect(cd).toMatch(/IMAGE_BACKEND.*build_backend\.outputs\.digest/);
    expect(cd).toMatch(/IMAGE_FRONTEND.*build_frontend\.outputs\.digest/);
    expect(cd).toMatch(/IMAGE_SIMULATOR.*build_simulator\.outputs\.digest/);
  });

  it('every build-push-action has an id (so digest is referenceable)', () => {
    // Simple grep: each docker/build-push-action@v6 block must carry an `id:`.
    const blocks = cd.split(/^\s*-\s+name:/m);
    const buildBlocks = blocks.filter((b) => /docker\/build-push-action@v6/.test(b));
    expect(buildBlocks.length).toBeGreaterThanOrEqual(3);
    for (const b of buildBlocks) {
      expect(b).toMatch(/^\s*id:\s+\S+/m);
    }
  });

  it('builds emit provenance + sbom attestations', () => {
    const provenanceCount = (cd.match(/provenance:\s*true/g) || []).length;
    const sbomCount = (cd.match(/sbom:\s*true/g) || []).length;
    expect(provenanceCount).toBeGreaterThanOrEqual(3);
    expect(sbomCount).toBeGreaterThanOrEqual(3);
  });

  it('staging deploy renders manifests with digest substitution', () => {
    expect(cd).toMatch(/IMAGE_BACKEND_DIGEST/);
    expect(cd).toMatch(/IMAGE_FRONTEND_DIGEST/);
    expect(cd).toMatch(/IMAGE_SIMULATOR_DIGEST/);
    // Aborts if any tag-form ref survived after rewrite
    expect(cd).toMatch(/Tag-form image references survived rewrite/);
  });

  it('SBOM step references the digest, not the floating tag', () => {
    // The Syft step should resolve to image@sha256:<digest>, not :sha-tag.
    expect(cd).toMatch(/anchore\/sbom-action[\s\S]{0,400}IMAGE_BACKEND[\s\S]{0,200}build_backend\.outputs\.digest/);
  });

  it('k8s/deployment.yaml uses tag-form (rewritten by CD to digest)', () => {
    const k = fs.readFileSync(K8S_DEPLOYMENT, 'utf8');
    expect(k).toMatch(/image:\s+ghcr\.io\/factorymind\/factorymind-backend:[\d.]+/);
  });
});
