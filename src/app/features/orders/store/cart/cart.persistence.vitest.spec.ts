import { describe, it, expect } from 'vitest';
import type { ProductItem } from '@core/models/models';
import { decideStoredCart, StoredCart, toStoredCart } from './cart.persistence';

const now = new Date('2026-10-17T12:00:00');
const item = { quantity: 1, price: 10 } as unknown as ProductItem;

function stored(overrides: Partial<StoredCart> = {}): StoredCart {
  return {
    productItems: [item],
    lastUpdated: '2026-10-17 11:55:00',
    usedPriceCategories: [],
    pricingClientId: null,
    ...overrides,
  };
}

describe('decideStoredCart', () => {
  it('restores a cart changed in the last 10 minutes', () => {
    expect(decideStoredCart(stored({ lastUpdated: '2026-10-17 11:50:00' }), now)).toBe(
      'restore',
    );
  });

  it('asks about an older cart', () => {
    expect(decideStoredCart(stored({ lastUpdated: '2026-10-17 11:49:59' }), now)).toBe(
      'ask',
    );
  });

  it('asks when the timestamp is missing', () => {
    expect(decideStoredCart(stored({ lastUpdated: null }), now)).toBe('ask');
  });

  it('restores when the timestamp cannot be read, as before', () => {
    expect(decideStoredCart(stored({ lastUpdated: 'not a date' }), now)).toBe('restore');
  });

  it('discards an empty cart instead of asking about it', () => {
    expect(
      decideStoredCart(stored({ productItems: [], lastUpdated: '2026-10-17 08:00:00' }), now),
    ).toBe('discard');
  });
});

describe('toStoredCart', () => {
  it('keeps only the stored fields and fills in missing ones', () => {
    const extra = { ...stored(), somethingElse: true } as StoredCart;
    expect(toStoredCart(extra)).toEqual(stored());
    expect(toStoredCart({} as StoredCart)).toEqual({
      productItems: [],
      lastUpdated: null,
      usedPriceCategories: [],
      pricingClientId: null,
    });
  });
});
