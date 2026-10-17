import { describe, it, expect } from 'vitest';
import { parseOrderId } from './order-id.util';

describe('parseOrderId', () => {
  it('reads a positive whole number', () => {
    expect(parseOrderId('42')).toBe(42);
  });

  it('is null when the parameter is missing', () => {
    expect(parseOrderId(undefined)).toBeNull();
    expect(parseOrderId(null)).toBeNull();
    expect(parseOrderId('')).toBeNull();
  });

  it('is null for anything that is not a valid order id', () => {
    expect(parseOrderId('abc')).toBeNull();
    expect(parseOrderId('0')).toBeNull();
    expect(parseOrderId('-3')).toBeNull();
    expect(parseOrderId('1.5')).toBeNull();
  });
});
