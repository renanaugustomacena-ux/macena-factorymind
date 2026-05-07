/**
 * R-FRONTEND-DOCKERFILE-USER-001 — closes F-HIGH-007.
 * Asserts the production stage of frontend/Dockerfile drops privileges via
 * a USER directive, per CIS Docker Benchmark 4.1.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const DOCKERFILE = path.resolve(__dirname, '../../frontend/Dockerfile');

describe('frontend Dockerfile (R-FRONTEND-DOCKERFILE-USER-001)', () => {
  let text;

  beforeAll(() => {
    text = fs.readFileSync(DOCKERFILE, 'utf8');
  });

  it('production stage declares USER (drops privileges)', () => {
    const prodStageStart = text.indexOf('AS production');
    expect(prodStageStart).toBeGreaterThan(0);
    const prodStage = text.slice(prodStageStart);
    expect(prodStage).toMatch(/^USER\s+\S+/m);
  });

  it('production stage USER is non-root', () => {
    const prodStageStart = text.indexOf('AS production');
    const prodStage = text.slice(prodStageStart);
    const match = prodStage.match(/^USER\s+(\S+)/m);
    expect(match).not.toBeNull();
    expect(match[1]).not.toBe('root');
    expect(match[1]).not.toBe('0');
  });
});
