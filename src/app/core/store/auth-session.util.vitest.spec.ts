import { describe, it, expect } from 'vitest';
import { shouldResetCachedAuth } from './auth-session.util';

describe('shouldResetCachedAuth', () => {
  it('keeps the cached state when the session is valid', () => {
    expect(
      shouldResetCachedAuth({ success: true, isAuthenticated: true }),
    ).toBe(false);
  });

  it('resets the cached state when Supabase reports no session', () => {
    expect(
      shouldResetCachedAuth({ success: true, isAuthenticated: false }),
    ).toBe(true);
  });

  it('keeps the cached state when the check itself failed (e.g. offline)', () => {
    expect(
      shouldResetCachedAuth({ success: false, isAuthenticated: false }),
    ).toBe(false);
  });
});
