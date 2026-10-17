import { describe, it, expect } from 'vitest';
import { Language } from '@core/models/enums';
import { parseLanguage } from './language.util';

describe('parseLanguage', () => {
  it('returns a stored supported language', () => {
    expect(parseLanguage('hu')).toBe(Language.HU);
    expect(parseLanguage('ro')).toBe(Language.RO);
  });

  it('falls back to Romanian when nothing is stored', () => {
    expect(parseLanguage(null)).toBe(Language.RO);
  });

  it('falls back to Romanian for an unknown value', () => {
    expect(parseLanguage('en')).toBe(Language.RO);
    expect(parseLanguage('HU')).toBe(Language.RO);
  });
});
