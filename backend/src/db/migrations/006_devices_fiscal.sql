-- =============================================================================
-- 006 — campi fiscali sulle macchine per l'attestazione Piano 4.0/5.0
--
-- Aggiunge i due campi opzionali consultati da `routes/attestazione.js`:
--   - acquisition_year      anno di acquisizione fiscale (per agganciare il
--                           credito d'imposta all'esercizio corretto)
--   - acquisition_value_eur valore di acquisizione in euro (riferimento per
--                           tetti del credito e aliquote Piano 4.0/5.0)
--
-- Entrambi sono NULLable: macchine installate prima dell'integrazione con
-- FactoryMind possono essere censite senza questi dati (verranno compilati
-- a mano dal commercialista prima dell'emissione PDF).
-- =============================================================================

ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS acquisition_year INT NULL
    CHECK (acquisition_year IS NULL OR (acquisition_year BETWEEN 1990 AND 2100)),
  ADD COLUMN IF NOT EXISTS acquisition_value_eur NUMERIC(14,2) NULL
    CHECK (acquisition_value_eur IS NULL OR acquisition_value_eur >= 0);

COMMENT ON COLUMN devices.acquisition_year IS
  'Anno fiscale di acquisizione della macchina (per credito d''imposta Piano 4.0/5.0).';
COMMENT ON COLUMN devices.acquisition_value_eur IS
  'Valore di acquisizione in euro (base imponibile del credito d''imposta).';
