# Informativa privacy — Operatori della dashboard FactoryMind

_Ai sensi dell'art. 13 del Reg. UE 2016/679 (GDPR) e del D.Lgs. 196/2003
come modificato dal D.Lgs. 101/2018_

## 1. Titolare del trattamento

Titolare del trattamento dei dati personali trattati nella dashboard
FactoryMind è **[DA_COMPILARE — Ragione sociale Cliente]** (il Cliente),
nella persona del legale rappresentante, con sede in [DA_COMPILARE], P.IVA
[DA_COMPILARE], email di contatto [DA_COMPILARE].

Il Cliente si avvale di **FactoryMind — Renan Augusto Macena**, Mozzecane
(VR), come **Responsabile del trattamento** ai sensi dell'art. 28 GDPR per
la fornitura della piattaforma software. I dettagli dei rapporti Titolare /
Responsabile sono disciplinati dal Data Processing Agreement allegato al
contratto di servizio.

**Responsabile della Protezione dei Dati (DPO)** — se presente: contattabile
all'indirizzo [DA_COMPILARE]. La nomina del DPO è obbligatoria solo nei
casi indicati dall'art. 37 GDPR.

## 2. Categorie di interessati e dati trattati

La dashboard FactoryMind tratta i seguenti dati personali dei lavoratori
utenti del sistema (operatori, supervisori, amministratori):

- **Dati identificativi**: nome, cognome, email aziendale, ruolo
  organizzativo, matricola interna;
- **Credenziali di accesso**: hash della password (scrypt con salt),
  token di sessione (JWT, refresh token), chiave API nel caso di
  integrazioni macchina-macchina;
- **Dati di attività**: log degli accessi alla dashboard, azioni eseguite
  (acknowledge allarmi, emissione attestazioni, configurazione device),
  indirizzo IP pubblico di connessione, user agent del browser;
- **Dati di preferenze**: lingua, timezone, layout dashboard.

Non vengono trattate categorie particolari di dati (art. 9 GDPR) né dati
relativi a condanne penali (art. 10 GDPR).

**Dati di produzione NON personali**: FactoryMind raccoglie inoltre
telemetrie delle macchine (stati RUN/IDLE/DOWN, cicli, allarmi, velocità,
temperatura). Questi dati sono di proprietà del Cliente e per loro natura
**non costituiscono dati personali**, salvo casi residuali in cui un
identificativo macchina possa essere ricondotto al singolo operatore
tramite piano turni. In tali casi si applicano le tutele dell'art. 4 L.
300/1970 come modificato dal D.Lgs. 151/2015 (v. punto 5).

## 3. Finalità del trattamento e basi giuridiche

| Finalità | Base giuridica |
|---|---|
| Autenticazione e autorizzazione all'uso della dashboard | Esecuzione del contratto di lavoro con il Titolare (art. 6 par. 1 lett. b GDPR) |
| Monitoraggio dell'attività produttiva e generazione di report operativi | Legittimo interesse del datore di lavoro all'organizzazione ed efficienza dell'attività (art. 6 par. 1 lett. f GDPR) |
| Audit log per tracciabilità e sicurezza (anti-frode, forensic) | Obbligo di legge (art. 5 par. 2 GDPR — principio di accountability) e legittimo interesse |
| Emissione attestazione Piano 4.0 / 5.0 | Obbligo di legge (credito d'imposta L. 232/2016 e D.L. 19/2024) |
| Notifica email di allarmi critici | Legittimo interesse alla continuità operativa |

## 4. Destinatari dei dati

I dati sono accessibili esclusivamente a:

- personale autorizzato del Titolare, nei limiti del principio di necessità;
- **Renan Augusto Macena** in qualità di Responsabile del trattamento, per
  le attività di manutenzione, supporto tecnico, backup, monitoraggio del
  servizio;
- fornitori di servizi cloud eventualmente utilizzati (es. hosting, SMTP),
  vincolati da accordi contrattuali conformi all'art. 28 GDPR.

Non è previsto trasferimento di dati verso Paesi extra-UE. Qualora il
Titolare scelga un hosting extra-UE, dovrà stipulare clausole contrattuali
standard (SCC) ex Decisione UE 2021/914.

## 5. Controllo a distanza dei lavoratori (art. 4 L. 300/1970)

La dashboard consente, per sua natura, un controllo indiretto sull'attività
produttiva dei lavoratori. Ai sensi dell'art. 4 L. 300/1970 come modificato
dal D.Lgs. 151/2015, l'utilizzo è lecito solo se:

- sussiste una delle finalità consentite (esigenze organizzative e
  produttive, sicurezza del lavoro, tutela del patrimonio aziendale); **e**
- è stato stipulato accordo collettivo con le RSA/RSU; oppure, in mancanza,
  è stata ottenuta autorizzazione da parte dell'Ispettorato Territoriale
  del Lavoro (ITL).

Il Titolare dichiara di aver adempiuto agli obblighi di informativa e, ove
dovuto, di aver stipulato accordo sindacale o ottenuto autorizzazione ITL.

## 6. Periodo di conservazione

| Categoria | Retention |
|---|---|
| Dati identificativi account utente | Per la durata del rapporto di lavoro + 2 anni dopo la cessazione |
| Log di accesso e audit log | 13 mesi dalla registrazione (durata massima di tracciamento consentita dall'art. 4 L. 300/1970 secondo le linee guida Garante Privacy) |
| Refresh token e token di sessione | 30 giorni dalla emissione oppure fino a revoca, il più breve dei due |
| Backup di sicurezza | 30 giorni dal backup, con sovrascrittura |
| Attestazioni Piano 4.0/5.0 emesse | 10 anni (termine fiscale di accertamento ex DPR 600/1973) |

Al termine dei periodi indicati i dati sono cancellati o anonimizzati in
modo irreversibile.

## 7. Diritti dell'interessato

In qualità di interessato, Lei ha diritto di:

- chiedere l'accesso ai propri dati (art. 15 GDPR) — endpoint self-service
  disponibile: `/api/users/me/export`;
- chiedere la rettifica dei dati inesatti (art. 16);
- chiedere la cancellazione dei dati nei casi previsti (art. 17) — endpoint:
  `DELETE /api/users/me` (con grace period di 30 giorni per eventuale
  ripensamento);
- chiedere la limitazione del trattamento (art. 18);
- chiedere la portabilità dei dati (art. 20) — file JSON scaricabile
  tramite l'endpoint export;
- opporsi al trattamento per motivi legati alla sua situazione (art. 21);
- proporre reclamo al **Garante per la protezione dei dati personali**
  (https://www.garanteprivacy.it — Piazza Venezia 11, 00187 Roma) ex art. 77
  GDPR.

Per esercitare i diritti può scrivere all'indirizzo del Titolare indicato
al punto 1, oppure utilizzare gli endpoint self-service della dashboard
(sezione "Il mio account").

## 8. Natura obbligatoria del conferimento

Il conferimento dei dati identificativi è necessario per consentire
l'accesso alla dashboard. Il rifiuto comporta l'impossibilità di utilizzare
il sistema e, pertanto, di svolgere le mansioni assegnate che richiedano
l'interazione con FactoryMind.

## 9. Decisioni automatizzate e profilazione

FactoryMind non assume decisioni automatizzate aventi effetti giuridici o
analogamente significativi (art. 22 GDPR) sugli interessati. Il sistema di
manutenzione predittiva produce raccomandazioni, ma la decisione finale
(fermo macchina, intervento tecnico, riassegnazione turni) resta in capo
alla persona responsabile.

## 10. Sicurezza del trattamento

Il Titolare, con il supporto del Responsabile, adotta misure tecniche e
organizzative adeguate ex art. 32 GDPR:

- crittografia dei canali (HTTPS/TLS 1.3, MQTT/TLS);
- hashing scrypt delle password;
- autenticazione con JWT firmato e rotazione dei refresh token;
- rate-limit sulle API;
- audit log immutabile;
- backup cifrato;
- security headers HTTP (CSP, HSTS, X-Frame-Options) conformi alle linee
  guida OWASP Secure Headers.

---

Data ultima revisione: [DA_COMPILARE]

Versione: 1.0
