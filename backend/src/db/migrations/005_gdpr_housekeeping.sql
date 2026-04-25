-- =============================================================================
-- 005 — GDPR data minimisation + housekeeping
--
-- Aggiunge la colonna deletion_requested_at sugli utenti (art. 17 GDPR) e
-- definisce la funzione di housekeeping che mantiene:
--   - audit_log entro 13 mesi (soglia massima tracciamento lavoratori,
--     linee guida Garante Privacy su art. 4 Statuto Lavoratori);
--   - refresh_tokens non usati/oltre expires_at oltre 30 giorni;
--   - utenti con deletion_requested_at oltre 30 giorni cancellati in hard.
--
-- La funzione è richiamabile da pg_cron (se installato) oppure da un
-- worker applicativo che esegue un SELECT factorymind_housekeeping() al
-- giorno.
-- =============================================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_users_deletion_requested_at
  ON users (deletion_requested_at)
  WHERE deletion_requested_at IS NOT NULL;

CREATE OR REPLACE FUNCTION factorymind_housekeeping()
RETURNS TABLE(task TEXT, rows_affected BIGINT) AS $$
DECLARE
  deleted_audit BIGINT := 0;
  deleted_refresh BIGINT := 0;
  deleted_users BIGINT := 0;
BEGIN
  -- 1. audit_log oltre 13 mesi (colonna canonica: created_at)
  DELETE FROM audit_log
   WHERE created_at < NOW() - INTERVAL '13 months';
  GET DIAGNOSTICS deleted_audit = ROW_COUNT;

  -- 2. refresh_tokens scaduti o revocati da oltre 30 giorni
  DELETE FROM refresh_tokens
   WHERE (revoked_at IS NOT NULL AND revoked_at < NOW() - INTERVAL '30 days')
      OR (expires_at < NOW() - INTERVAL '30 days');
  GET DIAGNOSTICS deleted_refresh = ROW_COUNT;

  -- 3. utenti con deletion_requested_at oltre 30 giorni → hard delete.
  --    Prima dell'eliminazione anonimizziamo gli audit_log associati
  --    mantenendo la riga (serve per integrità dei log di accesso) ma
  --    rimuovendo i riferimenti personali (email, IP).
  WITH to_delete AS (
    SELECT id, email FROM users
      WHERE deletion_requested_at IS NOT NULL
        AND deletion_requested_at < NOW() - INTERVAL '30 days'
  )
  UPDATE audit_log al
     SET actor_email = 'anon:' || substring(md5(al.actor_email || 'gdpr-salt') FOR 12),
         ip_address = NULL,
         actor_user_id = NULL,
         payload = jsonb_set(
           COALESCE(payload, '{}'::JSONB),
           '{anonymized}',
           to_jsonb(NOW())
         )
   FROM to_delete
   WHERE al.actor_user_id = to_delete.id;

  DELETE FROM users
   WHERE deletion_requested_at IS NOT NULL
     AND deletion_requested_at < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS deleted_users = ROW_COUNT;

  RETURN QUERY
    SELECT 'audit_log_retention'::TEXT, deleted_audit
    UNION ALL SELECT 'refresh_tokens_expired'::TEXT, deleted_refresh
    UNION ALL SELECT 'users_hard_deleted'::TEXT, deleted_users;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION factorymind_housekeeping() IS
  'GDPR art. 5 par. 1 lett. e — retention minimisation: esegue pulizia giornaliera
   di audit_log (>13 mesi), refresh_tokens scaduti e utenti cancellabili.';
