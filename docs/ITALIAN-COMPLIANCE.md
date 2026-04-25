# FactoryMind — Conformità Normativa Italiana

FactoryMind è progettato per essere pienamente idoneo ai principali piani di incentivo fiscale italiani per la trasformazione digitale e la sostenibilità energetica dell'industria manifatturiera. Questo documento elenca, per ciascuna normativa, il riferimento di legge, i requisiti tecnici, e il modo in cui il prodotto li soddisfa operativamente.

---

## 1. Piano Transizione 4.0

### 1.1 Fonti normative

- **Legge 11 dicembre 2016, n. 232** ("Legge di Bilancio 2017") — istituzione dell'iperammortamento e fondamento normativo del "Piano Industria 4.0".
- **Circolare Agenzia delle Entrate 4/E del 30 marzo 2017** — chiarimenti applicativi iniziali sull'iperammortamento, in particolare sull'Allegato A dei beni strumentali interconnessi.
- **Circolare MISE/Agenzia delle Entrate 9/E del 23 luglio 2018** — chiarimenti definitivi sui requisiti delle "5 caratteristiche tecnologiche obbligatorie" e delle "2 caratteristiche di interconnessione"; è il documento operativo di riferimento per la perizia giurata.
- **Legge 27 dicembre 2017, n. 205** (Legge di Bilancio 2018) — proroga iperammortamento.
- **Legge 30 dicembre 2018, n. 145** (Legge di Bilancio 2019) — proroga, con l'introduzione di percentuali decrescenti per scaglioni di investimento.
- **Legge 27 dicembre 2019, n. 160** (Legge di Bilancio 2020) — conversione dell'iperammortamento in **credito d'imposta per beni strumentali nuovi** (art. 1, commi 184-197).
- **Legge 30 dicembre 2020, n. 178** (Legge di Bilancio 2021) — rafforzamento del credito d'imposta e proroga al 2022.
- **Legge 30 dicembre 2021, n. 234** (Legge di Bilancio 2022) — proroga pluriennale e trasformazione in "Piano Transizione 4.0".
- **Legge 29 dicembre 2022, n. 197** (Legge di Bilancio 2023) — ultima proroga ordinaria prima della ridefinizione del 2024.

### 1.2 Le 5 caratteristiche tecnologiche obbligatorie

Secondo la Circolare 4/E/2017 e la 9/E/2018, ogni macchinario agevolato deve possedere tutte e cinque le seguenti caratteristiche:

1. **Controllo per mezzo di CNC (Computerized Numerical Control) o PLC (Programmable Logic Controller).** FactoryMind non aggiunge un CNC/PLC al macchinario, ma verifica e documenta la presenza del controllore tramite i protocolli OPC UA, Modbus TCP, o MQTT Sparkplug.
2. **Interconnessione ai sistemi informatici di fabbrica con caricamento da remoto di istruzioni e/o part program.** Il servizio `opcua-bridge.js` espone l'interfaccia di scrittura nodo OPC UA; il servizio `modbus-bridge.js` espone la scrittura coil/holding-register. La documentazione MQTT del topic `factory/<facility>/<line>/<machine>/commands` descrive come inviare istruzioni parametriche al macchinario.
3. **Integrazione automatizzata con il sistema logistico della fabbrica o con la rete di fornitura e/o con altre macchine del ciclo produttivo.** FactoryMind pubblica e sottoscrive eventi MQTT che consentono l'integrazione con WMS, ERP (via API REST integrata SmartERP in questa stessa stack di progetti sorelle), e con macchine adiacenti.
4. **Interfaccia uomo-macchina semplice e intuitiva.** La dashboard Grafana e il frontend React/Vite assolvono a questo requisito con visualizzazioni OEE in tempo reale, allarmi, storico cicli, e console di comando.
5. **Rispondenza ai più recenti parametri di sicurezza, salute e igiene del lavoro.** La conformità è certificata dal costruttore del macchinario (CE + dichiarazione di conformità); FactoryMind aggiunge la tracciabilità degli eventi di sicurezza (emergenze, guardie, riarmi) sul topic `alarms` e la conservazione a 30+ giorni nel bucket InfluxDB.

### 1.3 Le 2 caratteristiche ulteriori di interconnessione

Almeno due delle tre seguenti caratteristiche devono essere presenti, di cui la prima è obbligatoria:

1. **Interconnessione telematica ai sistemi aziendali via protocolli standard (TCP/IP, Modbus, OPC UA, Ethernet/IP, PROFINET, MQTT).** FactoryMind implementa nativamente OPC UA (libreria `node-opcua`), Modbus TCP (libreria `modbus-serial`), e MQTT v5 (libreria `mqtt`). Il modulo `src/services/mqtt-handler.js` orchestra la sottoscrizione a `factory/#`.
2. **Integrazione automatizzata con il sistema informativo aziendale per il caricamento a distanza di istruzioni e/o part program.** Soddisfatta dalla funzione di scrittura nodo descritta al punto 2 della sezione 1.2.
3. **Manutenzione predittiva o tele-manutenzione.** Il servizio `src/services/predictive-maintenance.js` calcola indicatori di degrado (vibrazione RMS, temperatura cuscinetti, deriva cicli) e pubblica avvisi preventivi sul topic `alarms` con severità `warning`.

### 1.4 Attestazione automatica (attestazione-generator)

Il comando `npm run attestazione -- --machine-id <id> --year 2026` genera un PDF firmabile in cui, per ogni macchinario selezionato:

- sono elencati i dati identificativi (matricola, costruttore, modello, anno di acquisto, valore di acquisto);
- sono evidenziate le 5 caratteristiche tecnologiche con la corrispondente evidenza raccolta da FactoryMind (esempio: per la caratteristica "3", viene mostrato il log MQTT dell'integrazione SmartERP dell'ultimo mese);
- sono elencate le 2 caratteristiche di interconnessione con screenshot della dashboard di telemetria e del flusso comandi;
- è allegato il log campione di telemetria a 1 Hz per almeno 5 giorni lavorativi consecutivi, sufficiente a soddisfare la prova documentale richiesta dalla circolare 9/E/2018.

Il PDF generato può essere consegnato al perito iscritto all'Albo degli Ingegneri/Periti Industriali per la perizia giurata ex art. 1, comma 11, L. 232/2016.

### 1.5 Bande di credito (per riferimento, tariffe 2023–2024)

- **Beni materiali 4.0 (Allegato A):** 20% fino a €2,5M; 10% oltre €2,5M e fino a €10M; 5% oltre €10M e fino a €20M.
- **Beni immateriali 4.0 (Allegato B):** 15% fino a €1M (decorrenza 2024 scontata al 10%).

Le percentuali sono quelle in vigore alla data di redazione del documento (aprile 2026) e possono variare con successive Leggi di Bilancio. FactoryMind mantiene aggiornato il file `backend/src/config/fiscal-rates.js` con le tariffe correnti.

---

## 2. Piano Transizione 5.0

### 2.1 Fonti normative

- **Decreto-Legge 2 marzo 2024, n. 19**, convertito con modificazioni dalla **Legge 29 aprile 2024, n. 56** — istituzione del "Piano Transizione 5.0" come evoluzione del Piano 4.0, con focus sul risparmio energetico certificato.
- **Decreto interministeriale MIMIT–MASE del 24 luglio 2024** — modalità operative, soglie di risparmio energetico, percentuali di credito per scaglione e certificazione del risparmio.
- **Circolare MIMIT 16 agosto 2024** — chiarimenti sulle modalità di calcolo del risparmio energetico e sulle strutture produttive ammissibili.

### 2.2 Soglie di risparmio energetico

Il credito d'imposta è subordinato al conseguimento di uno dei seguenti risparmi energetici misurati in termini di consumo di energia primaria:

- **≥ 3 %** di risparmio sul consumo del **processo produttivo** interessato, **oppure**
- **≥ 5 %** di risparmio sul consumo dell'**intera struttura produttiva** (sito).

### 2.3 Bande di credito per scaglione di investimento

| Scaglione di investimento | Risparmio 3–6 % / 5–10 % (processo/sito) | Risparmio 6–10 % / 10–15 % | Risparmio ≥ 10 % / ≥ 15 % |
|---------------------------|-----------------------------------------|---------------------------|---------------------------|
| Fino a € 2,5 M            | **35 %**                                | **40 %**                  | **45 %**                  |
| Oltre € 2,5 M e ≤ € 10 M  | **15 %**                                | **20 %**                  | **25 %**                  |
| Oltre € 10 M e ≤ € 50 M   | **5 %**                                 | **10 %**                  | **15 %**                  |

Nel contratto-cliente FactoryMind documentiamo esplicitamente le tre bande **5 %, 20 %, 35 %, 40 %** per gli investimenti PMI fino a € 2,5 M, coerentemente con la struttura scaglionata.

### 2.4 Coordinamento con GreenMetrics (progetto sorella)

Il progetto **GreenMetrics** è il modulo gemello per la misurazione e certificazione del risparmio energetico (Modbus TCP contatori elettrici, gas, termico; continuous aggregate Timescale; attestazione PDF generata da `internal/services/report_generator.go`).

Quando FactoryMind rileva un'installazione GreenMetrics sulla stessa rete (via discovery DNS-SD su `_greenmetrics._tcp.local`), il modulo `backend/src/services/piano5-attestazione.js`:

1. Interroga l'endpoint GreenMetrics `/api/v1/energy/baseline?facility=<id>` per il consumo di riferimento (media degli ultimi 12 mesi prima dell'intervento).
2. Interroga `/api/v1/energy/monitored?facility=<id>&from=<date>&to=<date>` per il consumo del periodo post-intervento.
3. Calcola la percentuale di risparmio secondo la formula: `risparmio% = (baseline – monitored) / baseline × 100`.
4. Verifica il superamento della soglia 3 % processo / 5 % sito.
5. Genera il PDF di attestazione Piano 5.0, accompagnato dalla relazione tecnica dell'ESCo certificata (upload richiesto separatamente).

Se GreenMetrics non è presente, il modulo emette un avviso operativo e suggerisce l'installazione o l'integrazione con contatori di terze parti via Modbus TCP.

---

## 3. Protocolli industriali standard

### 3.1 OPC UA — IEC 62541

- **Norma:** IEC 62541 (serie), "OPC unified architecture".
- **Implementazione:** libreria `node-opcua` v2.14+, compatibile con le parti 3 (Address Space), 4 (Services), 5 (Information Model), 6 (Mapping), 7 (Profiles), 8 (Data Access).
- **Security mode:** `SignAndEncrypt` con politica `Basic256Sha256`; i certificati client sono generati via `openssl ecparam` e conservati in `/opt/factorymind/certs/`.
- **Endpoint di default:** `opc.tcp://<edge-gateway>:4840`.

### 3.2 MQTT — OASIS v5.0

- **Norma:** OASIS Standard — MQTT Version 5.0 (2019).
- **Broker:** Eclipse Mosquitto 2.x, con listener TCP su 1883 (dev) e TLS 8883 (prod).
- **Topic hierarchy:** `factory/<facility>/<line>/<machine>/<kind>` dove `<kind> ∈ {telemetry, status, alarms, counters, commands}`.
- **QoS predefinito:** 0 per telemetry (latenza < affidabilità), 1 per status/alarms/commands (exactly-once non necessario, at-least-once sufficiente).
- **Sparkplug B:** supportato come opzione bridge tramite `sparkplug-payload` (per integrazioni legacy con Ignition, EMQX Neuron).

### 3.3 Modbus — IEC 61158-3/4-5

- **Fallback per macchinari datati:** supporto Modbus TCP (porta 502) via `modbus-serial`.
- **Mapping registri:** documentato in `docs/ARCHITECTURE.md`, mediante convenzione standard per holding register 40001+ e input register 30001+.

---

## 4. Sicurezza industriale — IEC 62443

- **Riferimento:** IEC 62443 (serie), "Security for Industrial Automation and Control Systems".
- **Livello target:** SL-2 (Security Level 2) per deployment on-premise tipico PMI.
- **Controlli implementati:**
  - **FR 1 (Identification and Authentication Control):** username/password su Mosquitto (passwd file), mTLS su OPC UA, JWT+scrypt sul backend REST.
  - **FR 2 (Use Control):** ACL Mosquitto per-tenant (file `mosquitto/config/acl`), RBAC PostgreSQL per il backend (ruoli `admin`, `operator`, `viewer`).
  - **FR 3 (System Integrity):** checksum SHA-256 sui part program in transito, firma HMAC sui comandi OPC UA critici.
  - **FR 4 (Data Confidentiality):** TLS 1.3 end-to-end (Mosquitto 8883, Influx 8086, Grafana 3010).
  - **FR 5 (Restricted Data Flow):** segmentazione di rete tramite docker-compose bridge; in produzione, VLAN OT dedicata e firewall stateful verso la VLAN IT.
  - **FR 6 (Timely Response to Events):** alert engine in tempo reale + escalation automatica + feed WebSocket.
  - **FR 7 (Resource Availability):** healthcheck liveness/readiness su tutti i container, persistenza su volume Docker, backup notturno PostgreSQL via `pg_dump`.

---

## 5. Privacy e GDPR

- **Normativa:** Regolamento (UE) 2016/679 (GDPR) e D.Lgs. 196/2003 come modificato dal D.Lgs. 101/2018.
- **Dati trattati:** anagrafica utenti backend (email, nome, ruolo), log di accesso, log eventi di produzione (non riconducibili a persone fisiche in quanto riferiti alle macchine).
- **Base giuridica:** esecuzione di un contratto (art. 6.1.b) per l'accesso al servizio; legittimo interesse (art. 6.1.f) per il logging di sicurezza.
- **Conservazione:** log di accesso 12 mesi (coerente con provvedimento Garante 27/11/2008 sugli amministratori di sistema), telemetria macchine 30 giorni raw + aggregati annuali.
- **Diritti dell'interessato:** accesso e cancellazione implementati via `POST /api/users/me/gdpr-export` e `DELETE /api/users/me`.

---

## 6. Altri riferimenti normativi utili

- **D.Lgs. 81/2008** — Testo Unico sulla Salute e Sicurezza sul Lavoro: gli allarmi di sicurezza macchina devono essere tracciati e conservati.
- **UNI EN ISO 9001:2015** — Sistemi di gestione della qualità: i dati OEE e l'audit trail di produzione supportano la certificazione.
- **UNI EN ISO 14001:2015** — Sistemi di gestione ambientale: integrazione opzionale con GreenMetrics copre anche i requisiti di tracciabilità dei consumi.
- **UNI EN ISO 50001:2018** — Sistemi di gestione dell'energia: copertura completa quando GreenMetrics è deployato.
- **SEMI E10** — Specification for Definition and Measurement of Equipment Reliability, Availability, and Maintainability: base per il calcolo OEE di FactoryMind.
- **VDI 2884** — "Purchase, operation and maintenance of production equipment using Life Cycle Costing": indici di disponibilità/performance/qualità allineati.

---

## 7. Note di manutenzione di questo documento

Questo file viene aggiornato:

- a ogni nuova Legge di Bilancio che modifichi le aliquote o le soglie di Piano 4.0 / Piano 5.0;
- a ogni rilascio di una nuova Circolare MIMIT o Agenzia delle Entrate che chiarisca i requisiti tecnici;
- a ogni aggiornamento delle norme tecniche citate (IEC, UNI EN ISO).

La fonte autoritativa per qualsiasi contestazione rimane il Gazzetta Ufficiale della Repubblica Italiana; questo documento ha valore operativo interno e commerciale.
