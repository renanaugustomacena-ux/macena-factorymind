/**
 * R-CI-AUDIT-001 / doctrine R-3 — security gates in .github/workflows/ci.yml
 * MUST NOT mask exit codes. This test grep-fails on any `|| true` adjacent
 * to npm audit / Trivy / gitleaks invocations and on `exit-code: "0"` on
 * Trivy. Closes F-CRIT-007.
 *
 * The test reads the YAML as text rather than parsing it because the
 * doctrine target is a textual smell, not a semantic property.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const CI_YML = path.resolve(__dirname, '../../.github/workflows/ci.yml');

function readCiYml() {
  return fs.readFileSync(CI_YML, 'utf8');
}

describe('CI security gates (R-CI-AUDIT-001)', () => {
  let yml;

  beforeAll(() => {
    yml = readCiYml();
  });

  // Comment-only lines (leading `#`) are excluded — doctrine R-3 targets
  // executable shell, not prose. The `# ` filter trims indentation first.
  const isExecutable = (l) => !/^\s*#/.test(l);

  it('no `|| true` adjacent to npm audit', () => {
    const lines = yml.split('\n').filter(isExecutable);
    const offenders = lines.filter(
      (l) => /npm\s+audit/i.test(l) && /\|\|\s*true/.test(l)
    );
    expect(offenders).toEqual([]);
  });

  it('no `|| true` adjacent to trivy or gitleaks', () => {
    const lines = yml.split('\n').filter(isExecutable);
    const offenders = lines.filter(
      (l) => /(trivy|gitleaks)/i.test(l) && /\|\|\s*true/.test(l)
    );
    expect(offenders).toEqual([]);
  });

  it('Trivy step does not pin exit-code: "0"', () => {
    // Search for the trivy block specifically; allow exit-code: "1" or default.
    const trivyExitZero = /aquasecurity\/trivy-action[\s\S]{0,400}exit-code:\s*["']?0["']?/i.test(yml);
    expect(trivyExitZero).toBe(false);
  });

  it('Trivy filters to HIGH+CRITICAL severity', () => {
    expect(yml).toMatch(/aquasecurity\/trivy-action[\s\S]{0,400}severity:\s*["']?HIGH,CRITICAL["']?/i);
  });

  it('Gitleaks step is present', () => {
    expect(yml).toMatch(/gitleaks\/gitleaks-action/);
  });
});
