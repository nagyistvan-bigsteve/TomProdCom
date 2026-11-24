import { describe, it, expect } from 'vitest';
import { isValidCui, normalizeCui } from './cuiValidator';

describe('isValidCui', () => {
  it('accepts a CUI with the right check digit, with or without RO', () => {
    expect(isValidCui('31241122')).toBe(true);
    expect(isValidCui('RO31241122')).toBe(true);
    expect(isValidCui('18547290')).toBe(true);
  });

  it('refuses a wrong check digit', () => {
    expect(isValidCui('31241123')).toBe(false);
    expect(isValidCui('RO31241121')).toBe(false);
  });

  it('counts a remainder of 10 as check digit 0', () => {
    // 1 × 2 = 2 → 20 mod 11 = 9; 6 × 2 = 12 → 120 mod 11 = 10 → 0
    expect(isValidCui('19')).toBe(true);
    expect(isValidCui('60')).toBe(true);
    expect(isValidCui('61')).toBe(false);
  });

  it('accepts a lowercase prefix and spaces, as on fiscal certificates', () => {
    expect(isValidCui('ro31241122')).toBe(true);
    expect(isValidCui('RO 31241122')).toBe(true);
    expect(isValidCui(' 312 411 22 ')).toBe(true);
    expect(isValidCui('ro 31241121')).toBe(false);
  });

  it('refuses what is not 2 to 10 digits', () => {
    expect(isValidCui('')).toBe(false);
    expect(isValidCui('1')).toBe(false);
    expect(isValidCui('12345678901')).toBe(false);
    expect(isValidCui('RO12a4')).toBe(false);
  });
});

describe('normalizeCui', () => {
  it('removes spaces and upper-cases the prefix', () => {
    expect(normalizeCui('ro 31241122')).toBe('RO31241122');
    expect(normalizeCui(' 31241122 ')).toBe('31241122');
  });
});
