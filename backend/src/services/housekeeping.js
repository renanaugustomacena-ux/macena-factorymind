/**
 * Scheduler per `factorymind_housekeeping()`.
 *
 * Esegue la funzione Postgres definita in migration 005 a intervalli
 * regolari. Applica retention GDPR:
 *   - audit_log oltre 13 mesi (limite art. 4 Statuto Lavoratori)
 *   - refresh_tokens scaduti/revocati oltre 30 giorni
 *   - utenti hard-delete dopo 30 giorni dal soft-delete (art. 17 GDPR)
 *
 * Quando disponibile pg_cron (installazione DBA), preferirlo: in quel caso
 * impostare FM_HOUSEKEEPING_INTERVAL_HOURS=0 per disabilitare lo scheduler
 * applicativo ed evitare esecuzioni duplicate.
 *
 * Il primo run avviene 60 secondi dopo il boot (evita tempesta su restart),
 * poi con cadenza regolare. Il job è best-effort: un errore logga ma non
 * crasha il processo.
 */

'use strict';

const { pool } = require('../db/pool');
const logger = require('../utils/logger');

const DEFAULT_INTERVAL_HOURS = 24;
const INITIAL_DELAY_MS = 60_000;

let timer = null;
let disposing = false;

async function runOnce() {
  const started = Date.now();
  try {
    const { rows } = await pool.query('SELECT task, rows_affected FROM factorymind_housekeeping()');
    logger.info(
      {
        duration_ms: Date.now() - started,
        tasks: rows
      },
      '[housekeeping] run completato'
    );
    return rows;
  } catch (err) {
    logger.warn(
      { err: err.message, duration_ms: Date.now() - started },
      '[housekeeping] run fallito (nessun impatto runtime)'
    );
    return null;
  }
}

function start(intervalHours = Number(process.env.FM_HOUSEKEEPING_INTERVAL_HOURS || DEFAULT_INTERVAL_HOURS)) {
  if (intervalHours <= 0) {
    logger.info('[housekeeping] scheduler applicativo disabilitato (interval <= 0)');
    return;
  }
  if (timer) return;

  const periodMs = Math.floor(intervalHours * 3_600_000);
  const initial = setTimeout(() => {
    runOnce().catch(() => undefined);
    timer = setInterval(() => runOnce().catch(() => undefined), periodMs);
    timer.unref?.();
  }, INITIAL_DELAY_MS);
  initial.unref?.();

  logger.info({ intervalHours }, '[housekeeping] scheduler avviato');
}

function stop() {
  disposing = true;
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

module.exports = { start, stop, runOnce, _state: () => ({ running: !!timer, disposing }) };
