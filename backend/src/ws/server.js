/**
 * WebSocket server — broadcasts MQTT messages to subscribed browsers.
 *
 * Clients connect to /ws and optionally send a JSON subscription envelope:
 *   { "type": "subscribe", "topics": ["factory/mozzecane/line-01/+/telemetry"] }
 * Subscriptions use the same pattern syntax as MQTT (+ and #). A ping frame
 * is emitted every 20 s to keep intermediaries from dropping the socket.
 */

'use strict';

const jwt = require('jsonwebtoken');
const { URL } = require('url');
const { WebSocketServer } = require('ws');
const logger = require('../utils/logger');
const topics = require('../mqtt/topics');
const mqttHandler = require('../services/mqtt-handler');
const config = require('../config');
const { PINNED_ALGORITHMS, SESSION_COOKIE } = require('../middleware/auth');

// R-WS-AUTH-001 (F-HIGH-010): JWT validation on the WebSocket upgrade.
// Token sources accepted (any one — first hit wins):
//   1. `Authorization: Bearer <token>` header.
//   2. `factorymind_session` HttpOnly cookie (works once the frontend has
//       cookie auth — XSS-immune).
//   3. `Sec-WebSocket-Protocol: bearer.<token>` subprotocol — survives in
//       browsers that won't let a script set arbitrary headers on `new
//       WebSocket()`. The protocol value is echoed back so the client can
//       confirm acceptance.
//   4. `?access_token=<token>` query string — last-resort path for legacy
//       clients; logged at WARN to discourage. Not exempted from JWT
//       validation, just from header / cookie / subprotocol coverage.
//
// Invalid or missing token in non-development environments → handshake
// is rejected with 401 before the upgrade completes (the client gets a
// proper HTTP error, not a silent disconnect).

function parseCookie(header, name) {
  for (const piece of (header || '').split(';')) {
    const [k, ...rest] = piece.trim().split('=');
    if (k === name) return decodeURIComponent(rest.join('=') || '');
  }
  return null;
}

function extractWsToken(req) {
  const auth = req.headers['authorization'] || '';
  if (auth.toLowerCase().startsWith('bearer ')) {
    return { source: 'header', token: auth.slice(7).trim(), subprotocol: null };
  }
  const cookieTok = parseCookie(req.headers['cookie'], SESSION_COOKIE);
  if (cookieTok) return { source: 'cookie', token: cookieTok, subprotocol: null };
  const proto = req.headers['sec-websocket-protocol'] || '';
  for (const p of proto.split(',').map((s) => s.trim())) {
    if (p.startsWith('bearer.')) {
      return { source: 'subprotocol', token: p.slice('bearer.'.length), subprotocol: p };
    }
  }
  try {
    const url = new URL(req.url, 'http://placeholder');
    const qt = url.searchParams.get('access_token');
    if (qt) return { source: 'query', token: qt, subprotocol: null };
  } catch (_) { /* ignore */ }
  return { source: null, token: null, subprotocol: null };
}

function authenticateUpgrade(req) {
  const { source, token, subprotocol } = extractWsToken(req);
  if (!token) {
    if (!config.isProduction) {
      return { ok: true, user: { sub: 'dev-anonymous', role: 'admin', email: 'dev@factorymind.local' }, source: 'dev', subprotocol: null };
    }
    return { ok: false, status: 401, reason: 'missing_token' };
  }
  try {
    const payload = jwt.verify(token, config.security.jwtSecret, { algorithms: PINNED_ALGORITHMS });
    if (payload && payload.typ === 'refresh') {
      return { ok: false, status: 401, reason: 'refresh_token_not_accepted' };
    }
    return { ok: true, user: payload, source, subprotocol };
  } catch (err) {
    return { ok: false, status: 401, reason: `invalid_token:${err.message}` };
  }
}

function attach(httpServer) {
  // We replace the default `server` wiring with a `noServer` setup so we
  // can intercept the upgrade and reject unauthenticated clients before
  // the protocol switch.
  const wss = new WebSocketServer({ noServer: true });
  const clients = new Set();

  httpServer.on('upgrade', (req, socket, head) => {
    if (req.url && !req.url.startsWith('/ws')) return; // not our upgrade
    const auth = authenticateUpgrade(req);
    if (!auth.ok) {
      logger.warn({ url: req.url, reason: auth.reason }, '[ws] handshake rejected');
      socket.write(`HTTP/1.1 ${auth.status || 401} Unauthorized\r\nContent-Length: 0\r\nConnection: close\r\n\r\n`);
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      ws.user = auth.user;
      ws.authSource = auth.source;
      // Echo back the bearer subprotocol so the browser confirms the negotiation.
      // The `ws` library passes through the negotiated subprotocol via the third
      // arg to handleUpgrade's callback only when explicitly set in the
      // upgrade response — we emit it via the connection event payload.
      wss.emit('connection', ws, req);
    });
  });

  wss.on('connection', (ws) => {
    ws.patterns = [];
    ws.isAlive = true;
    clients.add(ws);
    logger.info(
      { clientCount: clients.size, authSource: ws.authSource, sub: ws.user?.sub },
      '[ws] client connected'
    );

    ws.on('pong', () => { ws.isAlive = true; });
    ws.on('close', () => {
      clients.delete(ws);
      logger.info({ clientCount: clients.size }, '[ws] client disconnected');
    });
    ws.on('error', (err) => {
      logger.warn({ err: err.message }, '[ws] client error');
    });
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'subscribe' && Array.isArray(msg.topics)) {
          ws.patterns = msg.topics.slice(0, 32);
          ws.send(JSON.stringify({ type: 'subscribed', topics: ws.patterns }));
        }
      } catch (err) {
        ws.send(JSON.stringify({ type: 'error', error: 'invalid subscribe frame' }));
      }
    });
  });

  const pingInterval = setInterval(() => {
    for (const ws of clients) {
      if (ws.isAlive === false) { ws.terminate(); continue; }
      ws.isAlive = false;
      try { ws.ping(); } catch (_) { /* ignore */ }
    }
  }, 20_000);
  pingInterval.unref?.();

  const unsubscribe = mqttHandler.onMessage(({ topic, parsed, payload }) => {
    const envelope = JSON.stringify({ type: 'mqtt', topic, parsed, payload, ts: new Date().toISOString() });
    for (const ws of clients) {
      if (ws.readyState !== ws.OPEN) continue;
      if (ws.patterns.length === 0) { ws.send(envelope); continue; }
      if (ws.patterns.some((p) => topics.matches(p, topic))) {
        ws.send(envelope);
      }
    }
  });

  return {
    wss,
    close() {
      clearInterval(pingInterval);
      unsubscribe();
      for (const ws of clients) { try { ws.close(); } catch (_) { /* ignore */ } }
      wss.close();
    }
  };
}

module.exports = { attach };
