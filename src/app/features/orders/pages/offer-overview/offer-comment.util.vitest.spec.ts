import { describe, it, expect } from 'vitest';
import { appendCommentLine } from './offer-comment.util';

describe('appendCommentLine', () => {
  it('starts a new line after a comment without a line break', () => {
    expect(appendCommentLine('E2E oferta', 'Transport: 25 RON')).toBe(
      'E2E oferta\nTransport: 25 RON\n',
    );
  });

  it('does not add a second line break', () => {
    expect(appendCommentLine('Taxare inversa - fără TVA\n', 'Transport: 25 RON')).toBe(
      'Taxare inversa - fără TVA\nTransport: 25 RON\n',
    );
  });

  it('adds no empty first line to an empty comment', () => {
    expect(appendCommentLine('', 'Transport: 25 RON')).toBe('Transport: 25 RON\n');
  });
});
