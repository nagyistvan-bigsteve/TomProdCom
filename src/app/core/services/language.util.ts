import { Language } from '@core/models/enums';

/** The stored language, or Romanian when nothing valid is stored. */
export function parseLanguage(stored: string | null): Language {
  return Object.values(Language).includes(stored as Language)
    ? (stored as Language)
    : Language.RO;
}
