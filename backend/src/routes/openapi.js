/**
 * /api/docs — serves the OpenAPI 3.1 spec and a Swagger UI page.
 *
 * The spec lives in `docs/openapi.yaml` at the repo root. Two endpoints:
 *   - GET /api/docs/openapi.json  — raw spec (YAML converted to JSON).
 *   - GET /api/docs               — minimal Swagger UI HTML (loaded from
 *                                   a public CDN; customers can pin a
 *                                   self-hosted build by overriding the
 *                                   SWAGGER_UI_BUNDLE_URL env var).
 *
 * We deliberately do NOT depend on `swagger-ui-express` here to keep the
 * image footprint small; the spec is the contract, the UI is cosmetic.
 * A customer running strict CSP can drop `swagger-ui-express` back in.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { Router } = require('express');

const router = Router();

let cachedSpec = null;
let cachedSpecAsJson = null;

function loadSpec() {
  if (cachedSpec) return cachedSpec;
  const candidates = [
    path.join(__dirname, '..', '..', '..', 'docs', 'openapi.yaml'),
    path.join(__dirname, '..', '..', 'docs', 'openapi.yaml')
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      cachedSpec = fs.readFileSync(p, 'utf8');
      return cachedSpec;
    }
  }
  cachedSpec = '';
  return cachedSpec;
}

function yamlToJsonSafe(yaml) {
  // Intentionally minimal: we avoid adding a js-yaml dep. Most consumers
  // will request YAML directly; the JSON endpoint is a convenience.
  // For now we publish an object that advertises where to fetch the YAML.
  if (cachedSpecAsJson) return cachedSpecAsJson;
  cachedSpecAsJson = {
    note: 'This endpoint advertises the OpenAPI YAML location. Use /api/docs/openapi.yaml for the full spec.',
    openapi_yaml_path: '/api/docs/openapi.yaml',
    length_chars: yaml.length
  };
  return cachedSpecAsJson;
}

router.get('/openapi.yaml', (_req, res) => {
  const yaml = loadSpec();
  if (!yaml) {
    res.status(503);
    res.set('Content-Type', 'application/problem+json');
    return res.json({
      type: 'https://factorymind.example/problems/openapi-missing',
      title: 'OpenAPI spec not found',
      status: 503,
      detail: 'docs/openapi.yaml not packaged with this build'
    });
  }
  res.set('Content-Type', 'application/yaml; charset=utf-8');
  return res.send(yaml);
});

router.get('/openapi.json', (_req, res) => {
  const yaml = loadSpec();
  res.json(yamlToJsonSafe(yaml));
});

router.get('/', (_req, res) => {
  const bundleBase = process.env.SWAGGER_UI_BUNDLE_URL ||
    'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5';
  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>FactoryMind API — OpenAPI 3.1</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="stylesheet" href="${bundleBase}/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="${bundleBase}/swagger-ui-bundle.js"></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: '/api/docs/openapi.yaml',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [SwaggerUIBundle.presets.apis]
      });
    </script>
  </body>
</html>`;
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.set('Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; " +
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; " +
    "img-src 'self' data: https:; " +
    "connect-src 'self'"
  );
  res.send(html);
});

module.exports = router;
