import { describe, it, expect } from 'vitest';
import { Language } from '@core/models/enums';
import { dateFormatFor, datePickerLocale, moneyDigits } from './display-format.util';

describe('dateFormatFor', () => {
  it('uses day first for Romanian', () => {
    expect(dateFormatFor(Language.RO)).toBe('dd.MM.yyyy');
    expect(dateFormatFor(Language.RO, 'dateTime')).toBe('dd.MM.yyyy HH:mm');
    expect(dateFormatFor(Language.RO, 'short')).toBe('dd.MM');
  });

  it('uses year first for Hungarian', () => {
    expect(dateFormatFor(Language.HU)).toBe('yyyy.MM.dd');
    expect(dateFormatFor(Language.HU, 'dateTime')).toBe('yyyy.MM.dd HH:mm');
    expect(dateFormatFor(Language.HU, 'short')).toBe('MM.dd');
  });

  it('falls back to Romanian for an unknown language', () => {
    expect(dateFormatFor('xx' as Language)).toBe('dd.MM.yyyy');
  });
});

describe('datePickerLocale', () => {
  it('maps the UI language to a date picker locale', () => {
    expect(datePickerLocale(Language.RO)).toBe('ro-RO');
    expect(datePickerLocale(Language.HU)).toBe('hu-HU');
  });
});

describe('moneyDigits', () => {
  it('shows whole amounts without decimals', () => {
    expect(moneyDigits(960)).toBe('1.0-0');
    expect(moneyDigits(0)).toBe('1.0-0');
    expect(moneyDigits(null)).toBe('1.0-0');
  });

  it('shows two decimals when there are cents', () => {
    expect(moneyDigits(2155.5)).toBe('1.2-2');
    expect(moneyDigits(112.25)).toBe('1.2-2');
  });

  it('ignores floating-point noise', () => {
    expect(moneyDigits(0.1 + 0.2 + 99.7)).toBe('1.0-0');
  });
});
