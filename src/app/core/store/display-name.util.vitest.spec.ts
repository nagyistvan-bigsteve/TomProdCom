import { describe, it, expect } from 'vitest';
import { resolveDisplayName } from './display-name.util';

describe('resolveDisplayName', () => {
  it('prefers the profile name', () => {
    expect(resolveDisplayName('Nagy Istvan', 'Meta Name', 'a@b.ro')).toBe(
      'Nagy Istvan',
    );
  });

  it('trims the returned value', () => {
    expect(resolveDisplayName('  Nagy Istvan  ')).toBe('Nagy Istvan');
  });

  it('falls back to the auth metadata name when the profile name is blank', () => {
    expect(resolveDisplayName('   ', 'Meta Name', 'a@b.ro')).toBe('Meta Name');
    expect(resolveDisplayName(null, 'Meta Name', 'a@b.ro')).toBe('Meta Name');
  });

  it('falls back to the email when no name is available', () => {
    expect(resolveDisplayName(null, undefined, 'a@b.ro')).toBe('a@b.ro');
    expect(resolveDisplayName('', '', 'a@b.ro')).toBe('a@b.ro');
  });

  it('ignores non-string metadata values', () => {
    const metadataName = 42 as unknown as string;
    expect(resolveDisplayName(null, metadataName, 'a@b.ro')).toBe('a@b.ro');
  });

  it('returns null when every candidate is empty', () => {
    expect(resolveDisplayName(null, undefined, '')).toBeNull();
    expect(resolveDisplayName()).toBeNull();
  });
});
