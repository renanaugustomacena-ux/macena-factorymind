-- =============================================================================
-- 007 — persistenza del PDF emesso per re-download successivo
--
-- Oggi l'endpoint /api/devices/:id/attestazione/pdf restituisce il PDF in
-- streaming ma ne persiste solo l'hash. Se il cliente perde il file (cancella
-- per errore, cambia PC, fa audit fiscale dopo mesi) non può più riottenerlo
-- dal sistema — richiederebbe una nuova generazione che produrrebbe numero
-- univoco + hash diversi, rompendo la catena di non-ripudio.
--
-- Soluzione minima: colonna `pdf_bytes` BYTEA opzionale. Il PDF standard è
-- 8-12KB, quindi il costo storage è <1MB per 100 macchine × 10 anni.
-- Compressione: nessuna in DB (i PDF sono già compressi internamente con
-- Flate). Cifratura at-rest: delegata al filesystem Postgres o LUKS.
--
-- Nota GDPR: il PDF contiene dati personali del legale rappresentante. La
-- colonna segue la retention decennale fiscale (DPR 600/1973). Alla hard
-- delete di un destinatario (raro — solitamente l'azienda resta) il PDF
-- viene anonimizzato.
-- =============================================================================

ALTER TABLE attestazioni
  ADD COLUMN IF NOT EXISTS pdf_bytes BYTEA NULL,
  ADD COLUMN IF NOT EXISTS pdf_size_bytes INTEGER NULL,
  ADD COLUMN IF NOT EXISTS scaricata_count INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN attestazioni.pdf_bytes IS
  'Contenuto binario del PDF emesso. Conservato per re-download fiscale
   (termine decennale DPR 600/1973 art. 43). Nullable per retrocompatibilità
   con attestazioni pre-007.';
COMMENT ON COLUMN attestazioni.scaricata_count IS
  'Contatore download: incrementato ad ogni GET /pdf sull''attestazione.
   Traccia uso ai fini di audit (es. identificare accessi anomali).';
