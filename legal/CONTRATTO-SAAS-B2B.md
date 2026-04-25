# Contratto di erogazione del servizio FactoryMind (SaaS B2B)

**Tra**

**[DA_COMPILARE — Ragione sociale Fornitore]**, nella persona del suo legale
rappresentante **Renan Augusto Macena**, nato a [luogo] il [data], codice
fiscale [DA_COMPILARE], con sede operativa in Mozzecane (VR), Via
[DA_COMPILARE], in seguito indicato come "**Fornitore**"

**e**

**[DA_COMPILARE — Ragione sociale Cliente]**, P.IVA [DA_COMPILARE], con sede
in [DA_COMPILARE], nella persona del suo legale rappresentante
[DA_COMPILARE], in seguito indicato come "**Cliente**"

**premesso che**

- il Fornitore ha sviluppato e commercializza la piattaforma software
  "**FactoryMind**", un sistema di Industrial IoT per il monitoraggio
  dell'OEE (Overall Equipment Effectiveness) di macchinari industriali,
  erogato in modalità Software as a Service (SaaS);
- il Cliente è una impresa manifatturiera interessata a utilizzare
  FactoryMind per monitorare i propri impianti produttivi e generare la
  documentazione tecnica richiesta per il credito d'imposta beni strumentali
  ex art. 1 commi 9-13 L. 232/2016 (Piano Transizione 4.0) e/o per la
  Transizione 5.0 (D.L. 19/2024 conv. L. 56/2024);

si conviene e si stipula quanto segue.

---

## Art. 1 — Premesse e allegati

Le premesse e gli allegati costituiscono parte integrante del presente
contratto. Sono allegati:

- Allegato A — Scheda tecnica di FactoryMind con architettura, protocolli
  di interconnessione supportati e livello di sicurezza;
- Allegato B — Data Processing Agreement ex art. 28 Reg. UE 2016/679;
- Allegato C — Service Level Agreement (SLA);
- Allegato D — Tabella prezzi, scadenze di fatturazione e metodi di
  pagamento.

## Art. 2 — Oggetto

Con il presente contratto il Fornitore concede al Cliente il diritto non
esclusivo e non trasferibile di utilizzare FactoryMind per le proprie
finalità aziendali interne, secondo il piano tariffario sottoscritto
(Allegato D) e nei limiti del numero di macchine monitorate indicato.

Sono compresi:

- accesso alla dashboard web e alla API;
- aggiornamenti correttivi e di sicurezza del software;
- emissione di attestazione tecnica Piano 4.0/5.0 secondo i requisiti
  dell'Allegato 1 Circolare MISE/AdE 4/E/2017 e del D.M. MIMIT-MASE
  24/07/2024 (per la Transizione 5.0);
- supporto tecnico secondo l'SLA (Allegato C).

Sono esclusi:

- personalizzazioni software oltre la configurazione standard;
- installazione in sede presso il Cliente (qualora richiesta, viene
  fatturata a parte secondo listino);
- perizia giurata di ingegnere/perito industriale prevista per investimenti
  superiori a € 300.000 ex art. 1 co. 11 L. 232/2016 (resta onere del
  Cliente ingaggiare il professionista iscritto all'albo).

## Art. 3 — Durata e recesso

Il contratto ha durata di dodici (12) mesi decorrenti dalla data di
attivazione del servizio, tacitamente rinnovato per analoghi periodi salvo
disdetta comunicata con preavviso di sessanta (60) giorni mediante PEC
all'indirizzo indicato.

Ciascuna parte può recedere in qualsiasi momento per giusta causa (art. 1455
c.c.) con comunicazione PEC motivata. Il Cliente ha diritto di recedere senza
indennizzo entro quattordici (14) giorni dall'attivazione (cooling-off
contrattuale).

In caso di cessazione:

- il Cliente può esportare tutti i propri dati in formato JSON tramite
  l'endpoint `/api/users/me/export` fino a trenta (30) giorni dopo la
  cessazione;
- allo scadere dei 30 giorni il Fornitore cancella i dati del Cliente dai
  sistemi di produzione; i backup vengono ruotati secondo il piano di
  retention indicato nel DPA (Allegato B).

## Art. 4 — Corrispettivi

Il Cliente si impegna a versare il canone indicato nell'Allegato D alle
scadenze ivi previste (tipicamente mensile anticipato, con emissione di
fattura elettronica via SDI ex D.Lgs. 127/2015 e conservazione sostitutiva
DPCM 3/12/2013).

In caso di ritardo nei pagamenti oltre trenta (30) giorni il Fornitore può
sospendere il servizio previa diffida PEC, senza che ciò costituisca
inadempimento contrattuale ai propri obblighi.

Interessi di mora: tasso legale ex D.Lgs. 231/2002 aggiornato.

## Art. 5 — Livelli di servizio

Il Fornitore garantisce i livelli di servizio descritti nell'Allegato C,
sinteticamente:

- **Tier Standard**: disponibilità mensile minima 99,5%, ticket di supporto
  gestiti entro 4 ore lavorative, finestre di manutenzione preavvisate con
  almeno 48 ore;
- **Tier Enterprise**: disponibilità mensile minima 99,9%, supporto 24/7,
  RPO ≤ 1 h, RTO ≤ 4 h.

Se il livello effettivo mensile scende sotto la soglia, il Cliente ha
diritto a credito di servizio secondo la scala dell'Allegato C, limite
massimo 20% del canone del mese.

## Art. 6 — Proprietà intellettuale e dati

- **Software**: resta di proprietà esclusiva del Fornitore. Il codice
  sorgente self-hosted (distribuito separatamente sotto licenza MIT) non
  conferisce diritto all'uso del servizio SaaS né al marchio "FactoryMind".
- **Dati del Cliente**: restano di proprietà del Cliente. Il Fornitore
  agisce come Responsabile del trattamento (art. 28 GDPR) secondo il DPA
  (Allegato B).
- Il Cliente concede al Fornitore licenza limitata di elaborare i dati
  esclusivamente per l'erogazione del servizio, per il supporto tecnico,
  per la prevenzione frodi e per analisi aggregate e anonimizzate sulla
  qualità del servizio.

## Art. 7 — Responsabilità e limitazione

Il Fornitore risponde dei danni diretti causati al Cliente per dolo o colpa
grave fino a un importo massimo pari al canone effettivamente corrisposto
dal Cliente nei dodici (12) mesi precedenti l'evento dannoso.

Restano esclusi, nei limiti ex art. 1229 c.c.:

- danni indiretti, perdita di profitto, perdita di contratti con terzi,
  danni reputazionali;
- interruzioni di servizio causate da eventi di forza maggiore, attacchi
  informatici di entità straordinaria, guasti della rete del Cliente;
- errori o inesattezze nei dati forniti dal Cliente.

L'attestazione Piano 4.0/5.0 emessa dal Fornitore è documento tecnico basato
sui dati raccolti. La responsabilità fiscale verso l'Agenzia delle Entrate
resta in capo al Cliente; il suo commercialista è tenuto a verificare la
completezza della documentazione prima di inoltrare richieste di credito.

## Art. 8 — Obblighi del Cliente

Il Cliente si impegna a:

- utilizzare FactoryMind solo per finalità lecite e conformi al presente
  contratto;
- non effettuare reverse engineering, non cedere credenziali a terzi, non
  integrare il servizio in offerte commerciali proprie senza accordo scritto;
- rispettare i limiti del piano tariffario (numero di macchine, linee, utenti)
  e notificare al Fornitore qualsiasi scostamento strutturale;
- adempiere agli obblighi in materia di controllo a distanza dei lavoratori
  (art. 4 L. 300/1970 modificato da D.Lgs. 151/2015), informando i lavoratori
  secondo l'informativa privacy allegata e, ove richiesto, stipulando
  accordo sindacale o ottenendo autorizzazione da ITL.

## Art. 9 — Protezione dei dati personali

Le parti si impegnano a rispettare il Reg. UE 2016/679 (GDPR) e il D.Lgs.
196/2003 come modificato dal D.Lgs. 101/2018. Il Cliente agisce come
Titolare del trattamento dei dati dei propri lavoratori e clienti; il
Fornitore agisce come Responsabile del trattamento. Il rapporto è disciplinato
dal DPA allegato (Allegato B).

## Art. 10 — Riservatezza

Le parti si impegnano a mantenere riservate tutte le informazioni di natura
confidenziale acquisite in ragione del presente rapporto (art. 98 D.Lgs.
30/2005 — know-how, informazioni commerciali, dati di produzione). L'obbligo
permane per cinque (5) anni dopo la cessazione del contratto.

## Art. 11 — Modifiche

Eventuali modifiche al presente contratto sono valide solo se in forma
scritta e sottoscritte da entrambe le parti. Non si considerano modifiche:
l'evoluzione funzionale del software, l'aggiunta di funzionalità, gli
aggiornamenti della scheda tecnica (Allegato A) e degli SLA (Allegato C)
purché non deteriorino il livello di servizio contrattualmente garantito.

## Art. 12 — Foro competente e legge applicabile

Per qualsiasi controversia derivante dal presente contratto è
esclusivamente competente il **Foro di Verona**. Il contratto è regolato
dalla legge italiana.

Prima di adire il foro, le parti si impegnano a tentare una soluzione
amichevole con mediazione ex D.Lgs. 28/2010, obbligatoria nei casi previsti.

## Art. 13 — Clausole vessatorie

Ai sensi e per gli effetti degli artt. 1341 e 1342 c.c., il Cliente dichiara
di aver letto e di approvare specificamente le seguenti clausole: art. 3
(durata e recesso), art. 5 (SLA), art. 7 (limitazione responsabilità), art.
8 (obblighi), art. 12 (foro competente).

---

**Data** _______________________________

**Il Fornitore** (Renan Augusto Macena)

_______________________________________

**Il Cliente** ([DA_COMPILARE])

_______________________________________
