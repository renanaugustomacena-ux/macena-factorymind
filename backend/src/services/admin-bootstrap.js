/**
 * Bootstrap di un utente amministratore a partire dall'ambiente.
 *
 * Motivazione. L'installer interattivo (install.sh) chiede all'operatore
 * di scegliere email + password dell'admin e scrive queste variabili in
 * .env: FM_ADMIN_EMAIL e FM_ADMIN_PASSWORD_HASH (hash scrypt salt:hash in
 * base64). Senza questo servizio, il seed demo (002_seed_demo.sql) inietta
 * un admin fisso `admin@factorymind.local / FactoryMind2026!` che sarebbe
 * identico in ogni installazione — rischio massivo di takeover via
 * scansioni di massa.
 *
 * Comportamento:
 *   1. Se FM_ADMIN_EMAIL + FM_ADMIN_PASSWORD_HASH sono presenti,
 *      upsert di un utente admin con quelle credenziali e, in produzione,
 *      disabilita l'utente di seed (demo admin) per evitare residuali.
 *   2. In produzione, se tali variabili NON sono presenti, emette un
 *      warning severo e (con FM_REQUIRE_CUSTOM_ADMIN=true) rifiuta il boot.
 *   3. In sviluppo, se l'admin seed esiste con l'hash default,
 *      logga un avviso per ricordare di ruotarlo prima del deploy.
 *
 * Formato FM_ADMIN_PASSWORD_HASH (allineato con install.sh):
 *     scrypt$<salt_b64>$<hash_b64>
 * oppure, per retrocompatibilità con pipeline legacy:
 *     <salt_hex>:<hash_hex>
 */

'use strict';

const crypto = require('crypto');
const { pool } = require('../db/pool');
const logger = require('../utils/logger');
const config = require('../config');

const SEED_ADMIN_EMAIL = 'admin@factorymind.local';
const SEED_ADMIN_HASH_PREFIX = '85c8a02d508bfcf8';  // primi 16 hex chars del seed

function parseHashEnvelope(raw) {
  if (!raw || typeof raw !== 'string') return null;

  // Nuovo formato: scrypt$salt_b64$hash_b64
  if (raw.startsWith('scrypt$')) {
    const parts = raw.split('$');
    if (parts.length !== 3) return null;
    const [, saltB64, hashB64] = parts;
    try {
      const salt = Buffer.from(saltB64, 'base64');
      const hash = Buffer.from(hashB64, 'base64');
      if (salt.length === 0 || hash.length !== 64) return null;
      return { saltHex: salt.toString('hex'), hashHex: hash.toString('hex') };
    } catch { return null; }
  }

  // Retrocompatibilità: salt_hex:hash_hex
  if (raw.includes(':') && /^[0-9a-f]+:[0-9a-f]+$/i.test(raw)) {
    const [saltHex, hashHex] = raw.split(':');
    if (hashHex.length !== 128) return null;
    return { saltHex, hashHex };
  }

  return null;
}

function generateRandomHash() {
  // Non ci serve: non vogliamo MAI generare l'hash dal codice, solo leggerlo.
  // Ritorniamo un hash impossibile da indovinare per forzare un reset esplicito.
  return crypto.randomBytes(64).toString('hex');
}

async function ensureAdmin() {
  const email = (process.env.FM_ADMIN_EMAIL || '').trim().toLowerCase();
  const hashEnv = process.env.FM_ADMIN_PASSWORD_HASH;
  const requireCustom = process.env.FM_REQUIRE_CUSTOM_ADMIN === 'true';

  if (!email || !hashEnv) {
    if (config.isProduction || requireCustom) {
      const msg =
        '[admin-bootstrap] FM_ADMIN_EMAIL o FM_ADMIN_PASSWORD_HASH non configurati. ' +
        'In produzione questo è obbligatorio — impostali via install.sh o manualmente ' +
        'in .env prima di avviare. Avvio annullato per prevenire uso di credenziali default.';
      logger.error(msg);
      throw new Error(msg);
    }
    // Ambiente di sviluppo: logga warning ma non blocca il boot.
    logger.warn(
      '[admin-bootstrap] FM_ADMIN_EMAIL non configurato: l\'unico admin disponibile ' +
      `sarà ${SEED_ADMIN_EMAIL} con password di default "FactoryMind2026!". ` +
      'NON usare in produzione. Esegui install.sh per scegliere credenziali proprie.'
    );
    return { action: 'skip', reason: 'no-env' };
  }

  const parsed = parseHashEnvelope(hashEnv);
  if (!parsed) {
    logger.error(
      '[admin-bootstrap] FM_ADMIN_PASSWORD_HASH malformato. Atteso: "scrypt$<salt_b64>$<hash_b64>" ' +
      'oppure "<salt_hex>:<hash_hex>". Boot annullato.'
    );
    throw new Error('FM_ADMIN_PASSWORD_HASH malformato');
  }

  // Upsert: se esiste un utente con questa email lo aggiorniamo al nuovo hash;
  // altrimenti ne creiamo uno nuovo con ruolo admin.
  try {
    await pool.query('BEGIN');
    const existing = await pool.query(
      'SELECT id, role, password_hash FROM users WHERE lower(email) = $1 LIMIT 1',
      [email]
    );

    if (existing.rows.length === 0) {
      await pool.query(
        `INSERT INTO users (email, full_name, role, facility_scope,
                            password_salt, password_hash, active,
                            password_changed_at)
         VALUES ($1, $2, 'admin', ARRAY[]::TEXT[], $3, $4, TRUE, NOW())`,
        [email, 'Administrator', parsed.saltHex, parsed.hashHex]
      );
      logger.info({ email }, '[admin-bootstrap] admin utente creato');
    } else {
      await pool.query(
        `UPDATE users
            SET password_salt = $2,
                password_hash = $3,
                role = 'admin',
                active = TRUE,
                password_changed_at = NOW(),
                failed_login_count = 0,
                locked_until = NULL
          WHERE id = $1`,
        [existing.rows[0].id, parsed.saltHex, parsed.hashHex]
      );
      logger.info({ email }, '[admin-bootstrap] admin utente aggiornato');
    }

    // Disattiva il seed admin se non è lo stesso utente configurato.
    if (email !== SEED_ADMIN_EMAIL) {
      const disabled = await pool.query(
        `UPDATE users
            SET active = FALSE,
                password_hash = $1
          WHERE lower(email) = $2
            AND password_hash LIKE $3 || '%'
            AND active = TRUE
          RETURNING id`,
        [generateRandomHash(), SEED_ADMIN_EMAIL, SEED_ADMIN_HASH_PREFIX]
      );
      if (disabled.rows.length > 0) {
        logger.warn(
          { disabled_user: SEED_ADMIN_EMAIL },
          '[admin-bootstrap] admin di seed disattivato (password di default neutralizzata)'
        );
      }
    }

    await pool.query('COMMIT');
    return { action: existing.rows.length === 0 ? 'created' : 'updated' };
  } catch (err) {
    await pool.query('ROLLBACK').catch(() => undefined);
    throw err;
  }
}

/**
 * Verifica a caldo che il seed admin in produzione non usi ancora l'hash
 * di default. Restituisce un report, non lancia — il caller decide cosa fare.
 */
async function detectDefaultSeedAdmin() {
  const { rows } = await pool.query(
    `SELECT email, active FROM users
      WHERE lower(email) = $1
        AND password_hash LIKE $2 || '%'
        AND active = TRUE`,
    [SEED_ADMIN_EMAIL, SEED_ADMIN_HASH_PREFIX]
  );
  return {
    present: rows.length > 0,
    email: rows[0]?.email || null
  };
}

module.exports = {
  ensureAdmin,
  detectDefaultSeedAdmin,
  _internals: { parseHashEnvelope }
};
