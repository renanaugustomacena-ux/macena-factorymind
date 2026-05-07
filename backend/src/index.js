/**
 * FactoryMind backend — application bootstrap.
 *
 * Boot sequence:
 *   1. Validate environment (src/config).
 *   2. Spin up Express, register middleware chain + routes.
 *   3. Connect PostgreSQL pool (lazy on first query but ping asap).
 *   4. Connect InfluxDB writer; provision downsampling tasks.
 *   5. Connect MQTT broker; subscribe to factory/# hierarchy.
 *   6. Start alert engine (subscribes to the MQTT stream).
 *   7. Start OPC UA bridge (noop if disabled).
 *   8. Start Modbus bridge (noop if disabled).
 *   9. Start Sparkplug bridge ONLY when SPARKPLUG_ENABLED=true (opt-in).
 *  10. Attach WebSocket server.
 *  11. Install graceful-shutdown handler.
 */

'use strict';

const http = require('http');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const pinoHttp = require('pino-http');
const rateLimit = require('express-rate-limit');

const config = require('./config');
const logger = require('./utils/logger');

const healthRouter = require('./routes/health');
const readyRouter = require('./routes/ready');
const prometheusMetrics = require('./routes/prometheus-metrics');
const devicesRouter = require('./routes/devices');
const metricsRouter = require('./routes/metrics');
const alertsRouter = require('./routes/alerts');
const oeeRouter = require('./routes/oee');
const linesRouter = require('./routes/lines');
const facilitiesRouter = require('./routes/facilities');
const usersRouter = require('./routes/users');
const openapiRouter = require('./routes/openapi');
const attestazioneRouter = require('./routes/attestazione');
const contactRouter = require('./routes/contact');

const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { securityHeaders, apiCacheControl } = require('./middleware/securityHeaders');
const { csrfMiddleware } = require('./middleware/csrf');

const pg = require('./db/pool');
const influx = require('./services/influx-writer');
const mqtt = require('./services/mqtt-handler');
const alerts = require('./services/alert-engine');
const opcua = require('./services/opcua-bridge');
const modbus = require('./services/modbus-bridge');
const adminBootstrap = require('./services/admin-bootstrap');
const housekeeping = require('./services/housekeeping');
const wsServer = require('./ws/server');

function buildApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(pinoHttp({
    logger,
    customLogLevel(_req, res, err) {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    customProps(req) {
      // Attach W3C trace-context if present (populated by OTEL auto-instr).
      return {
        trace_id: req.headers['traceparent']?.split('-')[1] || undefined,
        service: config.service.name,
        env: config.env,
        version: config.service.version
      };
    }
  }));

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        'default-src': ["'self'"],
        'img-src': ["'self'", 'data:', 'blob:'],
        'script-src': ["'self'"],
        'style-src': ["'self'", "'unsafe-inline'"],
        'connect-src': ["'self'", 'ws:', 'wss:'],
        'frame-ancestors': ["'none'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"]
      }
    },
    crossOriginEmbedderPolicy: false, // allow typical SPA image/blob flows
    strictTransportSecurity: {
      maxAge: 31_536_000,
      includeSubDomains: true,
      preload: true
    }
  }));

  app.use(securityHeaders);

  app.use(cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (config.security.corsOrigins.includes(origin) || config.security.corsOrigins.includes('*')) {
        return cb(null, true);
      }
      cb(new Error('CORS origin not allowed'));
    },
    credentials: true
  }));

  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  app.use(apiCacheControl);

  app.use('/api', rateLimit({
    windowMs: config.security.rateLimit.windowMs,
    max: config.security.rateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      type: 'https://factorymind.example/problems/too-many-requests',
      title: 'Too Many Requests',
      status: 429,
      detail: 'Rate limit exceeded — please retry after the window resets.'
    }
  }));

  // CSRF protection for cookie-authed flows (bearer requests are exempted
  // inside the middleware, per OWASP guidance).
  app.use('/api', csrfMiddleware);

  // Liveness + readiness (separate endpoints — k8s pattern).
  app.use('/api/health', healthRouter);
  app.use('/api/ready', readyRouter);

  // OpenAPI spec + Swagger UI
  app.use('/api/docs', openapiRouter);

  // Prometheus scrape endpoint (unauthenticated by convention — must be
  // network-restricted to the monitoring subnet in production).
  app.use('/metrics', prometheusMetrics.router);

  app.use('/api/users', usersRouter);
  app.use('/api/facilities', facilitiesRouter);
  app.use('/api/lines', linesRouter);
  app.use('/api/devices', devicesRouter);
  app.use('/api/metrics', metricsRouter);
  app.use('/api/alerts', alertsRouter);
  app.use('/api/oee', oeeRouter);
  // Attestazioni Piano 4.0/5.0 (preview JSON, PDF, verify, revoke).
  // La route monta sia /api/devices/:id/attestazione/* sia /api/attestazione/*.
  app.use('/api', attestazioneRouter);
  app.use('/api/contact', contactRouter);

  app.get('/', (_req, res) => {
    res.json({
      service: 'factorymind-backend',
      message: 'FactoryMind — Monitora la Tua Produzione in Tempo Reale.',
      health: '/api/health',
      ready: '/api/ready',
      docs: '/api/docs',
      metrics: '/metrics'
    });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

async function main() {
  logger.info({ env: config.env, version: config.service.version }, '[boot] FactoryMind starting');

  // Admin bootstrap PRIMA di aprire la porta: se in produzione non troviamo
  // credenziali amministratore derivate dall'installer, falliamo subito
  // invece di esporre un seed admin con password di default.
  try {
    await adminBootstrap.ensureAdmin();
  } catch (err) {
    logger.fatal({ err: err.message }, '[boot] admin bootstrap fallito — interruzione');
    process.exit(10);
  }

  if (config.isProduction) {
    const seed = await adminBootstrap.detectDefaultSeedAdmin().catch(() => ({ present: false }));
    if (seed.present) {
      logger.fatal(
        { email: seed.email },
        '[boot] seed admin con hash di default ancora attivo in produzione — rifiuto boot'
      );
      process.exit(11);
    }
  }

  const app = buildApp();
  const server = http.createServer(app);

  // Attach WebSocket server before listening so its handshake upgrades are bound.
  const ws = wsServer.attach(server);

  await new Promise((resolve) => server.listen(config.port, resolve));
  logger.info({ port: config.port }, '[boot] HTTP + WebSocket listening');

  // Kick async subsystems; don't block HTTP serving on their readiness.
  mqtt.connect().catch((err) => logger.error({ err: err.message }, '[boot] mqtt connect failed'));
  influx.bootstrapTasks().catch((err) =>
    logger.warn({ err: err.message }, '[boot] influx bootstrap skipped')
  );
  alerts.start();
  housekeeping.start();

  // Bridges are opt-in via env.
  opcua.start([]).catch((err) => logger.warn({ err: err.message }, '[boot] opcua skipped'));
  modbus.start([]).catch((err) => logger.warn({ err: err.message }, '[boot] modbus skipped'));

  // Sparkplug bridge — loaded ONLY when SPARKPLUG_ENABLED=true. When
  // disabled (default) the sparkplug-payload dep is never imported, so the
  // gated protobufjs CVE stays unreachable.
  if (config.sparkplug?.enabled === true || process.env.SPARKPLUG_ENABLED === 'true') {
    try {
       
      const sparkplug = require('./services/sparkplug-bridge');
      sparkplug.start();
      logger.info('[boot] Sparkplug B bridge enabled');
    } catch (err) {
      // R-SPARKPLUG-LOAD-001: ERROR (not WARN) — operator opted in via
      // SPARKPLUG_ENABLED=true and the bridge failed; this is a configuration
      // or dependency problem worth paging on. Backend continues to boot
      // without the bridge enabled (graceful degradation by design).
      logger.error({ err: err.message }, '[boot] Sparkplug bridge failed to start');
    }
  } else {
    logger.info('[boot] Sparkplug B bridge disabled (SPARKPLUG_ENABLED=false)');
  }

  let shuttingDown = false;
  async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, '[shutdown] graceful shutdown initiated');
    const deadline = setTimeout(() => {
      logger.error('[shutdown] timeout — forcing exit');
      process.exit(1);
    }, 15_000);
    deadline.unref?.();

    try {
      server.close();
      ws.close();
      alerts.stop();
      housekeeping.stop();
      await Promise.allSettled([
        mqtt.close(),
        influx.flush().then(() => influx.close()),
        pg.close(),
        opcua.stop(),
        modbus.stop()
      ]);
      logger.info('[shutdown] complete');
      process.exit(0);
    } catch (err) {
      logger.error({ err: err.message }, '[shutdown] error during shutdown');
      process.exit(1);
    }
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('uncaughtException', (err) => {
    logger.fatal({ err: err.message, stack: err.stack }, '[fatal] uncaughtException');
    shutdown('uncaughtException');
  });
  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, '[fatal] unhandledRejection');
  });
}

if (require.main === module) {
  main().catch((err) => {
     
    console.error('[boot] fatal', err);
    process.exit(1);
  });
}

module.exports = { buildApp };
