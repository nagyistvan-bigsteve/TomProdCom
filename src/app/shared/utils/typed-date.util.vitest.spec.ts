import { describe, it, expect } from 'vitest';
import { isYearFirstLocale, parseTypedDate } from './typed-date.util';

const day = (date: Date | null) =>
  date ? [date.getFullYear(), date.getMonth() + 1, date.getDate()] : null;
const isInvalid = (date: Date | null) => !!date && isNaN(date.getTime());

describe('parseTypedDate, Romanian (day first)', () => {
  it('reads the day before the month', () => {
    expect(day(parseTypedDate('1.12.2026', false))).toEqual([2026, 12, 1]);
    expect(day(parseTypedDate('5.12.2026', false))).toEqual([2026, 12, 5]);
    expect(day(parseTypedDate('15.12.2026', false))).toEqual([2026, 12, 15]);
    expect(day(parseTypedDate('01.12.2026', false))).toEqual([2026, 12, 1]);
  });

  it('accepts slashes, dashes, spaces and two-digit years', () => {
    expect(day(parseTypedDate(' 1/12/26 ', false))).toEqual([2026, 12, 1]);
    expect(day(parseTypedDate('1-12-2026', false))).toEqual([2026, 12, 1]);
  });

  it('refuses days that do not exist', () => {
    expect(isInvalid(parseTypedDate('31.02.2026', false))).toBe(true);
    expect(isInvalid(parseTypedDate('12/31/2026', false))).toBe(true);
    expect(isInvalid(parseTypedDate('0.12.2026', false))).toBe(true);
  });
});

describe('parseTypedDate, Hungarian (year first)', () => {
  it('reads year, month, day, with the locale trailing dot', () => {
    expect(day(parseTypedDate('2026.12.01', true))).toEqual([2026, 12, 1]);
    expect(day(parseTypedDate('2026. 12. 1.', true))).toEqual([2026, 12, 1]);
  });

  it('refuses day-first text', () => {
    expect(isInvalid(parseTypedDate('1.12.2026', true))).toBe(true);
  });
});

describe('parseTypedDate, bad input', () => {
  it('returns null for empty text', () => {
    expect(parseTypedDate('', false)).toBeNull();
    expect(parseTypedDate('   ', true)).toBeNull();
  });

  it('returns an invalid date for text that is not a date', () => {
    expect(isInvalid(parseTypedDate('mâine', false))).toBe(true);
    expect(isInvalid(parseTypedDate('1.12', false))).toBe(true);
    expect(isInvalid(parseTypedDate('1.12.2026.5', false))).toBe(true);
    expect(isInvalid(parseTypedDate('1.12.226', false))).toBe(true);
  });
});

describe('isYearFirstLocale', () => {
  it('is true only for Hungarian', () => {
    expect(isYearFirstLocale('hu-HU')).toBe(true);
    expect(isYearFirstLocale('ro-RO')).toBe(false);
  });
});
