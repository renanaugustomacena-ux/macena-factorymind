-- =============================================================================
-- 008 — idempotency su (device, anno, piano) per /api/attestazione/pdf
--
-- R-ATTESTAZIONE-IDEMPOTENCY-001 (chiusura F-MED-DATA-003).
--
-- Motivazione: l'endpoint POST /api/devices/:id/attestazione/pdf è una
-- super-azione contabile — emette un PDF firmabile col commercialista e
-- inserisce una riga nel registro fiscale. Una doppia esecuzione accidentale
-- (rete instabile, doppio click, retry automatico del client) produce due
-- numeri univoci differenti per lo stesso (macchinario, anno, piano), con
-- effetti pratici di confusione fiscale e potenziale revoca a posteriori.
--
-- Invariante target: per un (device_id, anno_fiscale, plan), esiste al più
-- una attestazione NON revocata. Le revoche storiche restano nello storico
-- (revocata_il NOT NULL → escluse dall'indice univoco parziale).
--
-- Note di compatibilità retroattiva:
--   - `plan` viene aggiunto NOT NULL DEFAULT 'piano-4.0'. Tutte le righe
--     pre-008 si auto-migrano a 'piano-4.0' (l'unico piano disponibile fino
--     al 2024); dal 2025 alcune emissioni saranno 'piano-5.0' e dovranno
--     specificarlo esplicitamente.
--   - `content_sha256` resta NULL per le righe pre-008. La logica route
--     tratta NULL come "contenuto sconosciuto" e procede con generazione
--     fresca (mai cache hit) per quelle righe — degradazione sicura.
--   - L'unique index parziale è IF NOT EXISTS, idempotente per re-run.
--
-- Doctrine compliance:
--   - H-14 (migrations forward-only): rispettata. Non aggiungiamo DROP.
--   - Rollback: se mai necessario, una nuova migration 0NN_drop_idempotency
--     dovrà droppare l'indice + colonne; non roll-backable in-place.
-- =============================================================================

ALTER TABLE attestazioni
  ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'piano-4.0',
  ADD COLUMN IF NOT EXISTS content_sha256 TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_attestazioni_idempotency
  ON attestazioni (device_id, anno_fiscale, plan)
  WHERE revocata_il IS NULL;

COMMENT ON COLUMN attestazioni.plan IS
  'Piano fiscale: piano-4.0 (legge 232/2016 e successive) o piano-5.0
   (legge 207/2024). Distinguere è obbligatorio: lo stesso macchinario può
   produrre due attestazioni per lo stesso anno se rientra in entrambi i
   regimi (es. asset 2024 con frazione di credito 4.0 + frazione 5.0).';

COMMENT ON COLUMN attestazioni.content_sha256 IS
  'Hash SHA-256 del contenuto canonico (destinatario + report + anno + plan).
   Distinto da pdf_hash, che include numero univoco + emessa_il (e quindi
   varia per ogni emissione). Usato dal route POST /pdf per riconoscere
   ripetizioni a contenuto identico e restituire il PDF cached invece di
   ri-generarlo.';

COMMENT ON INDEX uq_attestazioni_idempotency IS
  'R-ATTESTAZIONE-IDEMPOTENCY-001: vincolo a livello DB che impedisce
   doppia emissione non revocata per (device, anno, piano). Le righe
   revocate sono escluse, permettendo re-emissione legittima dopo
   revoca esplicita (motivo_revoca obbligatorio, vincolato dal CHECK
   revoca_consistency).';
