# Cookie Policy — FactoryMind

_Versione 1.0 — ultima revisione: [DA_COMPILARE]_

Informativa predisposta ai sensi dell'art. 13 del Reg. UE 2016/679, della
Direttiva 2002/58/CE (ePrivacy) e del Provvedimento del Garante Privacy
8 maggio 2014 (come aggiornato dalle Linee guida del 10 giugno 2021).

## 1. Cosa sono i cookie

I cookie sono piccoli file di testo che i siti visitati inviano al browser
dell'utente, dove vengono memorizzati per essere ritrasmessi al sito stesso
alla visita successiva. Analoghi ai cookie sono il local storage, il
session storage e altri meccanismi di tracciamento lato client.

## 2. Categorie di cookie utilizzati

Il sito `factorymind.it` e la dashboard `*.factorymind.cloud` utilizzano le
seguenti categorie:

### 2.1 Cookie tecnici (SEMPRE ATTIVI — nessun consenso richiesto)

Necessari al funzionamento del servizio. Senza di essi il sito non può
funzionare correttamente.

| Cookie | Dominio | Scadenza | Finalità |
|---|---|---|---|
| `factorymind:jwt` (local storage) | dashboard | fino al logout | Token di sessione autenticata |
| `factorymind:refresh` (HttpOnly, Secure) | dashboard | 30 giorni | Refresh token per autenticazione |
| `factorymind_csrf` | dashboard | sessione | Token anti-CSRF double-submit |
| `factorymind_cookie_consent` (local storage) | landing | 12 mesi | Memorizza la scelta sui cookie |

Base giuridica: art. 6 par. 1 lett. b GDPR (esecuzione del contratto con
l'utente) e art. 122 co. 1 D.Lgs. 196/2003 (cookie tecnici non richiedono
consenso).

### 2.2 Cookie analitici (RICHIEDONO CONSENSO)

**Allo stato attuale, la landing di FactoryMind NON utilizza cookie
analitici né di profilazione.** Se in futuro verrà integrato un provider di
analytics (Plausible, Umami, Google Analytics 4), questo elenco verrà
aggiornato.

Eventuali cookie analitici verranno classificati in base al loro livello di
invasività:

- **cookie analitici anonimizzati** (es. Plausible, Umami, GA4 con IP
  anonimizzato e senza cross-site tracking): assimilabili a cookie tecnici
  ai sensi delle Linee guida Garante 2021, quindi senza consenso ma con
  informativa completa;
- **cookie analitici non anonimizzati** o **cookie di profilazione di
  terze parti** (es. pixel Facebook, Google Ads): richiedono consenso
  esplicito ex art. 122 co. 1 D.Lgs. 196/2003.

### 2.3 Cookie di profilazione

**Non utilizzati.** FactoryMind non effettua profilazione commerciale sugli
utenti della landing né sugli operatori della dashboard.

## 3. Cookie di terze parti

La landing attualmente non carica risorse di terze parti che installino
cookie. I font sono serviti direttamente dal dominio FactoryMind (non da
Google Fonts) per rispettare il principio di minimizzazione e evitare il
trasferimento extra-UE di indirizzi IP (coerentemente con la sentenza C-311/18
"Schrems II" della Corte di Giustizia UE).

Qualora in futuro vengano integrate risorse esterne (es. mappe, video
YouTube, form embeddati), l'informativa verrà aggiornata e l'utente dovrà
esprimere consenso preventivo.

## 4. Come gestire i cookie

L'utente può in qualsiasi momento:

- modificare le proprie scelte attraverso il banner cookie presente sulla
  landing (pulsante "Gestisci preferenze" accessibile in fondo alla pagina);
- bloccare o cancellare i cookie attraverso le impostazioni del proprio
  browser:
  - **Chrome**: `chrome://settings/cookies`
  - **Firefox**: Preferenze → Privacy e sicurezza → Cookie
  - **Safari**: Preferenze → Privacy → Gestisci dati dei siti web
  - **Edge**: Impostazioni → Cookie e autorizzazioni sito

Disabilitare i cookie tecnici rende inutilizzabile la dashboard.

## 5. Diritti dell'interessato

Gli utenti possono in qualunque momento esercitare i diritti previsti dagli
artt. 15-22 GDPR, come descritti nell'Informativa privacy generale, inclusa
la revoca del consenso prestato (art. 7 par. 3 GDPR).

È inoltre possibile proporre reclamo al Garante per la protezione dei dati
personali (https://www.garanteprivacy.it).

## 6. Aggiornamenti

L'informativa viene rivista in caso di modifiche tecniche o normative. La
data di ultima revisione è indicata in testa al documento. Si invita
l'utente a rileggerla periodicamente.
