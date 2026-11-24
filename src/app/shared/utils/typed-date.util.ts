/**
 * Reads a date typed by hand in the UI language's order: Romanian day first
 * (1.12.2026, 01.12.2026, 1/12/26), Hungarian year first (2026.12.01,
 * 2026. 12. 1.). Returns null for an empty text and an invalid Date
 * (`isNaN(getTime())`) for text that is not a real calendar day, such as
 * 31.02.2026 or 12/31/2026 in Romanian.
 */
export function parseTypedDate(text: string, yearFirst: boolean): Date | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const parts = trimmed.split(/[.\/\-\s]+/).filter(Boolean);
  if (parts.length !== 3 || parts.some((part) => !/^\d+$/.test(part))) {
    return new Date(NaN);
  }

  const [first, second, third] = parts;
  const yearText = yearFirst ? first : third;
  const month = Number(second);
  const day = Number(yearFirst ? third : first);

  if (yearText.length !== 2 && yearText.length !== 4) return new Date(NaN);
  const year = yearText.length === 2 ? 2000 + Number(yearText) : Number(yearText);

  const date = new Date(year, month - 1, day);
  const isRealDay =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day;
  return isRealDay ? date : new Date(NaN);
}

/** The date when it is a real day, otherwise null (empty or unparseable input). */
export function validDateOrNull(date: Date | null | undefined): Date | null {
  return date instanceof Date && !isNaN(date.getTime()) ? date : null;
}

/** Whether a date picker locale writes the year first (Hungarian). */
export function isYearFirstLocale(locale: string): boolean {
  return locale.toLowerCase().startsWith('hu');
}
