/**
 * i18n resource bundle — exported as a static object keyed by locale.
 *
 * Intentionally lightweight: we do NOT pull in `i18next` here. The
 * scaffold can switch to react-i18next later by installing the dep and
 * wrapping the App tree in <I18nextProvider>; the JSON files keep the
 * same shape so the migration is drop-in.
 */

import it from './it.json';
import en from './en.json';
import de from './de.json';

export type Locale = 'it' | 'en' | 'de';

export const translations = { it, en, de } as const;

export const DEFAULT_LOCALE: Locale = 'it';

export function resolveLocale(preferred?: string): Locale {
  if (!preferred) return DEFAULT_LOCALE;
  const short = preferred.toLowerCase().slice(0, 2);
  if (short === 'it' || short === 'en' || short === 'de') return short;
  return DEFAULT_LOCALE;
}

/**
 * Lookup a key like "dashboard.oee.label" on the chosen locale, falling
 * back to Italian if the path is missing. Intentionally simple — no
 * interpolation, pluralisation, or gender; ship react-i18next when those
 * are needed.
 */
export function t(locale: Locale, key: string): string {
  const path = key.split('.');
  const bundles = [translations[locale], translations[DEFAULT_LOCALE]];
  for (const bundle of bundles) {
    let cursor: unknown = bundle;
    for (const p of path) {
      if (cursor && typeof cursor === 'object' && p in (cursor as Record<string, unknown>)) {
        cursor = (cursor as Record<string, unknown>)[p];
      } else {
        cursor = undefined;
        break;
      }
    }
    if (typeof cursor === 'string') return cursor;
  }
  return key;
}
