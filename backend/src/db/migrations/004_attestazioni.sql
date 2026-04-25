-- Migration 004 — Persistenza attestazioni Piano Transizione 4.0 / 5.0
--
-- Ogni volta che l'endpoint /api/devices/:id/attestazione/pdf genera un PDF,
-- una riga viene inserita qui. Consente:
--   1. Verifica successiva via /api/attestazione/:numero/verify (hash match)
--   2. Revoca in caso di dati errati (campo revocata_il)
--   3. Tracciabilità fiscale (numero univoco + hash non ripudiabile)
--
-- Idempotenza: la migration usa IF NOT EXISTS. Safe da ripetere.

CREATE TABLE IF NOT EXISTS attestazioni (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero          TEXT NOT NULL UNIQUE,
    tenant_id       UUID,
    device_id       UUID REFERENCES devices(id) ON DELETE RESTRICT,
    anno_fiscale    INTEGER NOT NULL,

    -- Destinatario del documento (ragione sociale, P.IVA, sede, legale rappresentante)
    destinatario    JSONB NOT NULL,

    -- Output strutturato di generateAttestazione() — fonte di verità per il PDF
    report          JSONB NOT NULL,

    -- Hash SHA-256 del payload completo (destinatario + report + numero + emessa_il).
    -- Stesso algoritmo usato dal renderer: ricomputabile per verifica non ripudio.
    pdf_hash        TEXT NOT NULL,

    -- Esito di eleggibilità al credito d'imposta (true = ammesso)
    eleggibile      BOOLEAN NOT NULL,

    -- Utente che ha emesso l'attestazione (per audit)
    emessa_da       UUID REFERENCES users(id) ON DELETE SET NULL,
    emessa_il       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Revoca: se il documento è invalidato successivamente (dati errati, etc.)
    revocata_il     TIMESTAMPTZ,
    revocata_da     UUID REFERENCES users(id) ON DELETE SET NULL,
    motivo_revoca   TEXT,

    CONSTRAINT revoca_consistency
        CHECK ((revocata_il IS NULL AND revocata_da IS NULL AND motivo_revoca IS NULL)
            OR (revocata_il IS NOT NULL AND motivo_revoca IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_attestazioni_device ON attestazioni(device_id);
CREATE INDEX IF NOT EXISTS idx_attestazioni_tenant ON attestazioni(tenant_id);
CREATE INDEX IF NOT EXISTS idx_attestazioni_anno   ON attestazioni(anno_fiscale);
CREATE INDEX IF NOT EXISTS idx_attestazioni_emessa ON attestazioni(emessa_il DESC);

COMMENT ON TABLE attestazioni IS
  'Archivio non ripudiabile delle attestazioni Piano 4.0/5.0 emesse. '
  'Numero univoco + hash SHA-256 consentono verifica fiscale successiva.';
COMMENT ON COLUMN attestazioni.pdf_hash IS
  'SHA-256 di { numero, emessa_il, destinatario, report } serializzato in '
  'ordine canonico di chiavi. Ricomputabile via endpoint /api/attestazione/:numero/verify.';
