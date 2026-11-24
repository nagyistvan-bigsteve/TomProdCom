import { Language } from '@core/models/enums';

export type DateFormatKind = 'date' | 'dateTime' | 'short';

/**
 * Date formats per UI language, each country's own convention:
 * Romanian 24.11.2026, Hungarian 2026.11.24.
 */
const DATE_FORMATS: Record<Language, Record<DateFormatKind, string>> = {
  [Language.RO]: { date: 'dd.MM.yyyy', dateTime: 'dd.MM.yyyy HH:mm', short: 'dd.MM' },
  [Language.HU]: { date: 'yyyy.MM.dd', dateTime: 'yyyy.MM.dd HH:mm', short: 'MM.dd' },
};

/** Angular `formatDate` pattern for a language. */
export function dateFormatFor(language: Language, kind: DateFormatKind = 'date'): string {
  return (DATE_FORMATS[language] ?? DATE_FORMATS[Language.RO])[kind];
}

/** Locale given to the date picker, so it shows dates like the rest of the app. */
export function datePickerLocale(language: Language): string {
  return language === Language.HU ? 'hu-HU' : 'ro-RO';
}

/**
 * Angular `number` digits for a money amount: whole amounts without decimals
 * (960), anything with cents with two (2.155,50, never 2.155,5).
 */
export function moneyDigits(value: number | null | undefined): string {
  const cents = Math.round((value ?? 0) * 100);
  return cents % 100 === 0 ? '1.0-0' : '1.2-2';
}
