# Data Processing Agreement (DPA)

_Accordo sul trattamento dei dati personali ex art. 28 del Reg. UE 2016/679
(GDPR). Costituisce Allegato B al contratto di erogazione del servizio
FactoryMind._

## Parti

- **Titolare del trattamento**: [DA_COMPILARE — Ragione sociale Cliente]
  (il "**Titolare**"), P.IVA [DA_COMPILARE], con sede in [DA_COMPILARE];
- **Responsabile del trattamento**: Renan Augusto Macena, ditta individuale,
  con sede operativa in Mozzecane (VR), codice fiscale [DA_COMPILARE]
  (il "**Responsabile**"), fornitore della piattaforma FactoryMind.

## 1. Premesse

Il Titolare affida al Responsabile l'erogazione del servizio SaaS
FactoryMind, nel cui ambito il Responsabile tratta dati personali per
conto del Titolare. Il presente DPA disciplina tali trattamenti ex art. 28
par. 3 GDPR.

## 2. Oggetto, natura e finalità del trattamento

Il trattamento ha ad oggetto i dati personali indicati nell'Informativa
Privacy della dashboard. La natura del trattamento comprende raccolta,
registrazione, organizzazione, conservazione, estrazione, consultazione,
modifica, comunicazione mediante l'interfaccia software, cancellazione.

La finalità è esclusivamente quella di erogare il servizio e fornire il
supporto tecnico secondo le istruzioni del Titolare.

## 3. Durata

Il presente DPA decorre dalla data di attivazione del servizio e termina
alla cessazione del contratto principale. Alcuni obblighi (riservatezza,
restituzione/cancellazione dati) sopravvivono alla cessazione secondo
quanto previsto ai punti 9 e 10.

## 4. Tipologia di dati personali e categorie di interessati

- **Interessati**: lavoratori del Titolare (operatori, supervisori,
  amministratori della dashboard), eventualmente clienti B2B del Titolare
  qualora i loro identificativi aziendali siano inseriti a sistema;
- **Categorie di dati**: dati identificativi (nome, cognome, email, ruolo),
  credenziali di accesso (hash), dati di attività (log, IP, user agent),
  preferenze;
- **Categorie particolari (art. 9 GDPR)**: nessuna;
- **Dati relativi a condanne penali (art. 10 GDPR)**: nessuna.

## 5. Obblighi del Responsabile

Il Responsabile si impegna a:

1. trattare i dati personali solo su istruzione documentata del Titolare
   (il presente DPA + contratto principale + configurazioni della dashboard),
   salvo obbligo di legge a cui sia soggetto. In caso di obbligo di legge
   contraddittorio, lo comunica preventivamente al Titolare salvo divieto
   di legge stessa;
2. garantire che le persone autorizzate al trattamento siano vincolate a
   obbligo di riservatezza o soggette ad adeguato obbligo legale;
3. adottare tutte le misure richieste dall'art. 32 GDPR (sicurezza del
   trattamento): v. allegato tecnico al punto 14;
4. non ricorrere a un sub-responsabile senza autorizzazione scritta
   preventiva, generale o specifica, del Titolare (v. punto 6);
5. assistere il Titolare con misure tecniche e organizzative adeguate per
   consentire la risposta alle richieste di esercizio dei diritti
   dell'interessato (artt. 15-22 GDPR), nei limiti del possibile;
6. assistere il Titolare nel garantire il rispetto degli obblighi ex artt.
   32-36 GDPR (sicurezza, notifica violazioni, valutazione d'impatto,
   consultazione preventiva);
7. su scelta del Titolare, cancellare o restituire tutti i dati personali
   al termine della prestazione dei servizi relativi al trattamento e
   cancellare le copie esistenti, salvo diverso obbligo di legge;
8. mettere a disposizione del Titolare tutte le informazioni necessarie per
   dimostrare il rispetto degli obblighi e consentire/contribuire ad
   attività di revisione, comprese le ispezioni, effettuate dal Titolare o
   da un soggetto incaricato.

## 6. Sub-responsabili (sub-processor)

Alla data del presente DPA il Responsabile si avvale dei seguenti
sub-responsabili:

| Sub-responsabile | Servizio | Sede | Garanzie |
|---|---|---|---|
| [DA_COMPILARE — provider hosting] | Hosting cloud / infrastruttura | [UE] | ISO 27001, DPA firmato |
| [DA_COMPILARE — provider SMTP] | Invio email transazionale | [UE] | DPA firmato |
| InfluxData Inc. (solo per InfluxDB Cloud, se scelto) | Time-series DB | US-Oregon | SCC ex Dec. UE 2021/914 |

Il Titolare autorizza espressamente tali sub-responsabili. Il Responsabile
informa il Titolare con preavviso di 30 giorni di qualsiasi modifica
riguardante l'aggiunta o la sostituzione di altri sub-responsabili, dando
modo al Titolare di opporsi a tali modifiche. In caso di opposizione
motivata, le parti si impegnano a trovare un accordo; in mancanza, il
Titolare ha diritto di recedere dal contratto principale senza penali.

## 7. Notifica di violazione (data breach)

Il Responsabile notifica al Titolare senza ingiustificato ritardo, e
comunque entro **24 ore** dal momento in cui ne ha avuto conoscenza,
qualsiasi violazione dei dati personali. La notifica include almeno:

- natura della violazione, categorie e numero approssimativo di interessati
  e di registrazioni coinvolti;
- nominativo di contatto;
- probabili conseguenze;
- misure adottate o proposte per porre rimedio e mitigare.

Il termine di 24 ore è più stringente del termine di 72 ore che il Titolare
ha verso il Garante ex art. 33 GDPR, in modo da lasciargli margine di
istruttoria.

## 8. Trasferimenti extra-UE

Il Responsabile non trasferisce dati personali al di fuori del SEE senza
garanzie adeguate. I sub-responsabili extra-UE (se presenti) sono coperti
da Clausole Contrattuali Standard (SCC) ex Decisione UE 2021/914, con le
misure supplementari indicate in esito al risk assessment TIA (Transfer
Impact Assessment).

## 9. Obblighi del Titolare

Il Titolare si impegna a:

1. adempiere, in qualità di Titolare del trattamento, agli obblighi
   informativi verso gli interessati ex artt. 13-14 GDPR, utilizzando
   come base l'informativa fornita nel pacchetto `legal/` di FactoryMind;
2. stipulare, ove richiesto, accordi collettivi con RSA/RSU o ottenere
   autorizzazione ITL ex art. 4 L. 300/1970 prima di utilizzare la
   dashboard per il monitoraggio dei lavoratori;
3. gestire le richieste di esercizio dei diritti degli interessati,
   inoltrando al Responsabile quelle che richiedono il suo supporto
   tecnico;
4. fornire istruzioni chiare e documentate al Responsabile per ogni
   trattamento ulteriore rispetto a quelli standard configurati dalla
   piattaforma.

## 10. Cessazione del rapporto

Alla cessazione del contratto principale, su richiesta scritta del
Titolare, il Responsabile:

- consente al Titolare di esportare i dati tramite gli strumenti tecnici
  della dashboard entro 30 giorni dalla cessazione;
- cancella i dati dai sistemi di produzione entro i 30 giorni successivi;
- ruota i backup secondo il piano di retention standard (30 giorni
  rolling);
- conferma per iscritto la cancellazione definitiva entro 90 giorni dalla
  cessazione.

## 11. Responsabilità

Ciascuna parte risponde dei danni cagionati per propria condotta
illegittima ex art. 82 GDPR, nei limiti previsti dal contratto principale
(Allegato A — limite massimo di responsabilità). Resta ferma la
responsabilità solidale verso l'interessato ex art. 82 par. 4 GDPR,
fatto salvo il diritto di regresso.

## 12. Audit

Il Titolare ha diritto di richiedere, con preavviso ragionevole (non
inferiore a 30 giorni) e con frequenza non superiore a una volta all'anno
(salvo violazione manifesta), un audit sulle misure adottate dal
Responsabile. L'audit può essere condotto:

- mediante richiesta di documentazione (auto-assessment) — modalità
  preferenziale;
- mediante ispezione in sede, a cura di un auditor terzo indipendente con
  esperienza in compliance GDPR, vincolato da NDA con il Responsabile.

I costi dell'audit sono a carico del Titolare salvo che l'audit riveli
violazioni sostanziali degli obblighi del Responsabile.

## 13. Legge applicabile e foro competente

Il presente DPA è regolato dalla legge italiana. Per le controversie
derivanti dalla sua applicazione è competente in via esclusiva il Foro di
Verona, come previsto nel contratto principale.

## 14. Allegato tecnico — Misure di sicurezza

Il Responsabile adotta le seguenti misure, da considerarsi stato dell'arte
ai fini dell'art. 32 GDPR e periodicamente rivedute:

**Organizzative**
- Policy di sicurezza scritta e aggiornata almeno annualmente
- Accesso basato sul principio del minimo privilegio
- Audit log immutabile con retention 13 mesi
- Piano di continuità operativa e disaster recovery con RPO ≤ 1 h e RTO ≤ 4 h
  (Tier Enterprise) o RPO ≤ 6 h e RTO ≤ 24 h (Tier Standard)
- Formazione periodica del personale sul GDPR

**Tecniche**
- Cifratura in transito: TLS 1.3 per HTTPS, MQTT su TLS per i broker
- Cifratura at-rest: AES-256 per volumi di database, gestita dal provider
  di hosting con rotazione delle chiavi annuale
- Password utente: hashate con scrypt (N=16384, r=8, p=1) con salt random
- Autenticazione: JWT firmato, refresh token a rotazione, lockout dopo
  5 tentativi falliti con backoff esponenziale
- Rate-limit sulle API (120 req/min default, 5 req/h sul form contatti)
- Security headers HTTP: HSTS, CSP, X-Content-Type-Options, X-Frame-Options,
  Referrer-Policy, Permissions-Policy (preset OWASP)
- Validazione input lato server (Joi schemas) + sanitizzazione tag Flux
  con whitelist regex per prevenire injection
- Container eseguiti con utente non-root, immagini distroless o Alpine,
  scansione vulnerabilità con Trivy ad ogni build
- Secret manager (env vars + .env con permessi 600) — in produzione AWS
  Secrets Manager con rotazione automatica
- Backup cifrati, test di ripristino trimestrale documentato
- Monitoring con alert automatici su anomalie di sicurezza (login da IP
  inconsueti, picchi di errori 401/403)

---

**Data** _______________________________

**Il Titolare** ([DA_COMPILARE])

_______________________________________

**Il Responsabile** (Renan Augusto Macena)

_______________________________________
