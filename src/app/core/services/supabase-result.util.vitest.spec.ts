import { describe, it, expect } from 'vitest';
import { unwrapResult } from './supabase-result.util';

describe('unwrapResult', () => {
  it('returns the data when there is no error', () => {
    expect(unwrapResult({ data: [{ id: 1 }], error: null })).toEqual([
      { id: 1 },
    ]);
  });

  it('returns null data as-is so the caller can pick a fallback', () => {
    expect(unwrapResult({ data: null, error: null })).toBeNull();
  });

  it('throws the Supabase error instead of returning empty data', () => {
    const error = { code: '42501', message: 'permission denied' };

    expect(() => unwrapResult({ data: null, error })).toThrow();
    try {
      unwrapResult({ data: null, error });
    } catch (thrown) {
      expect(thrown).toBe(error);
    }
  });
});
