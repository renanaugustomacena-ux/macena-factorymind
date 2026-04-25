/**
 * useT — hook leggero per accedere alle traduzioni senza caricare
 * react-i18next. Riusa il resolver puro in `@/locales` e aggiunge:
 *
 *  - lettura del locale attivo (memoizzato, cambiabile via cambio state
 *    applicativo o preferenza browser),
 *  - supporto a interpolazione `{{chiave}}` senza parsing costosi,
 *  - fallback automatico all'italiano se la chiave manca.
 *
 * La scelta di non dipendere da react-i18next è motivata dalla semplicità
 * del sito (3 lingue, nessuna pluralizzazione, nessuna formattazione
 * locale dinamica) e dall'impatto su bundle size (i18next + plugin
 * superano i 30 KB gzipped, mentre questo hook aggiunge meno di 1 KB).
 */

import { useCallback, useMemo } from 'react';
import { DEFAULT_LOCALE, resolveLocale, t as rawT, type Locale } from '@/locales';

export interface TranslateFn {
  (key: string, vars?: Record<string, string | number>): string;
  locale: Locale;
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name) => {
    if (Object.prototype.hasOwnProperty.call(vars, name)) {
      return String(vars[name]);
    }
    return match;
  });
}

export function useT(preferredLocale?: Locale | string): TranslateFn {
  const active = useMemo<Locale>(() => {
    if (preferredLocale && typeof preferredLocale === 'string') {
      return resolveLocale(preferredLocale);
    }
    if (typeof navigator !== 'undefined' && navigator.language) {
      return resolveLocale(navigator.language);
    }
    return DEFAULT_LOCALE;
  }, [preferredLocale]);

  const fn = useCallback<TranslateFn>(
    ((key: string, vars?: Record<string, string | number>) => {
      const raw = rawT(active, key);
      return interpolate(raw, vars);
    }) as TranslateFn,
    [active]
  );

  (fn as TranslateFn).locale = active;
  return fn;
}

export default useT;
