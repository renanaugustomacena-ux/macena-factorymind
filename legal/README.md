# Template legali FactoryMind

Questa directory contiene cinque template in italiano, pensati per una ditta
individuale / micro-impresa che vende il servizio FactoryMind a PMI
manifatturiere. Ogni template è scritto in un linguaggio chiaro e indica
puntualmente le norme di riferimento.

> **ATTENZIONE — LIMITE DI USO**
>
> I documenti che trova in questa cartella sono **tecnicamente corretti ma
> NON sostituiscono la consulenza di un avvocato iscritto all'albo**. Prima di
> firmare un contratto reale con un cliente, faccia rivedere i template a un
> professionista. Alcuni elementi (limite di responsabilità, foro competente,
> indennizzo per penale, accordi di non concorrenza) dipendono dalla sua
> specifica posizione contrattuale e dal rischio che è disposto ad accettare.
>
> FactoryMind / Renan Augusto Macena non assume responsabilità per l'utilizzo
> di questi template senza revisione legale qualificata.

## File nella cartella

| File | Uso |
|---|---|
| `CONTRATTO-SAAS-B2B.md` | Contratto quadro tra titolare del software e cliente PMI. Prevede le modalità di erogazione del servizio SaaS, canone, SLA, responsabilità, durata, recesso e foro. |
| `INFORMATIVA-PRIVACY-GDPR.md` | Informativa ex art. 13 Reg. UE 2016/679 per gli operatori della dashboard (dipendenti del cliente) le cui attività sono tracciate. |
| `COOKIE-POLICY.md` | Informativa cookie per la landing page e la dashboard, distinta tra cookie tecnici e cookie analytics/profilazione. |
| `DATA-PROCESSING-AGREEMENT.md` | DPA ex art. 28 Reg. UE 2016/679 — disciplina il rapporto Titolare/Responsabile del trattamento quando i dati personali dei lavoratori o dei clienti del cliente transitano su FactoryMind. |
| `TERMINI-DI-SERVIZIO.md` | Termini di servizio per la versione SaaS gestita (con distribuzione self-hosted separata governata dalla licenza MIT del codice sorgente). |

## Rendering in HTML per la landing page

I file sono scritti in Markdown per permettere la revisione testuale
(git-diff friendly). Per pubblicarli sulla landing di `factorymind.it` li
converta a HTML con lo strumento che preferisce (es. `pandoc`) e li
inserisca in `landing-page/legal/*.html`. La landing già prevede i link:

- `legal/informativa-privacy.html`
- `legal/cookie-policy.html`
- `legal/termini-di-servizio.html`
- `legal/contratto-saas.html`

## Principali riferimenti normativi citati

- Reg. UE 2016/679 (GDPR) + D.Lgs. 196/2003 modificato da D.Lgs. 101/2018
- Direttiva 2002/58/CE (ePrivacy) + Provv. Garante Privacy 8 maggio 2014
- D.Lgs. 70/2003 (commercio elettronico)
- Art. 1341, 1342, 1469-bis c.c. (clausole vessatorie tra professionisti)
- Art. 1337-1338 c.c. (responsabilità precontrattuale)
- L. 300/1970 art. 4 (controllo a distanza dei lavoratori) modificato
  dal D.Lgs. 151/2015
- Provv. Garante Privacy 1 marzo 2007 — "Linee guida sul trattamento dei dati
  personali dei lavoratori"

## Prima di usare

1. Sostituisca ogni occorrenza di `[DA_COMPILARE]` con il dato reale.
2. Dato che Renan Augusto Macena opera come freelancer (ditta individuale),
   dove il template parla di "Società" usi invece "Ditta individuale" o
   "libera professione" e adegui la denominazione fiscale.
3. Per contratti superiori a €50.000/anno o con cliente strutturato,
   faccia sempre rivedere i testi da un legale prima della firma.
