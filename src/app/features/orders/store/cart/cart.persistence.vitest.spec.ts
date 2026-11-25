import { describe, it, expect } from 'vitest';
import type { ProductItem } from '@core/models/models';
import { decideStoredCart, SavedCart, StoredCart, toStoredCart } from './cart.persistence';

const now = new Date('2026-10-17T12:00:00');
const USER = 'user-a';
const item = { quantity: 1, price: 10 } as unknown as ProductItem;

function stored(overrides: Partial<StoredCart> = {}): StoredCart {
  return {
    productItems: [item],
    lastUpdated: '2026-10-17 11:55:00',
    usedPriceCategories: [],
    pricingClientId: null,
    sourceOffer: null,
    ...overrides,
  };
}

describe('decideStoredCart', () => {
  it('restores a cart changed in the last 10 minutes', () => {
    expect(decideStoredCart(stored({ lastUpdated: '2026-10-17 11:50:00' }), now, USER)).toBe(
      'restore',
    );
  });

  it('asks about an older cart', () => {
    expect(decideStoredCart(stored({ lastUpdated: '2026-10-17 11:49:59' }), now, USER)).toBe(
      'ask',
    );
  });

  it('asks when the timestamp is missing', () => {
    expect(decideStoredCart(stored({ lastUpdated: null }), now, USER)).toBe('ask');
  });

  it('restores when the timestamp cannot be read, as before', () => {
    expect(decideStoredCart(stored({ lastUpdated: 'not a date' }), now, USER)).toBe('restore');
  });

  it('discards an empty cart instead of asking about it', () => {
    expect(
      decideStoredCart(stored({ productItems: [], lastUpdated: '2026-10-17 08:00:00' }), now, USER),
    ).toBe('discard');
  });

  it("discards another user's cart, however recent (shared device)", () => {
    const saved: SavedCart = { ...stored({ lastUpdated: '2026-10-17 11:59:00' }), ownerId: 'user-b' };
    expect(decideStoredCart(saved, now, USER)).toBe('discard');
  });

  it('discards an owned cart when nobody is signed in', () => {
    const saved: SavedCart = { ...stored(), ownerId: USER };
    expect(decideStoredCart(saved, now, null)).toBe('discard');
  });

  it("restores the signed-in user's own cart", () => {
    const saved: SavedCart = { ...stored({ lastUpdated: '2026-10-17 11:59:00' }), ownerId: USER };
    expect(decideStoredCart(saved, now, USER)).toBe('restore');
  });

  it('keeps a cart saved before owners were recorded, as before', () => {
    expect(decideStoredCart(stored({ lastUpdated: '2026-10-17 11:59:00' }), now, USER)).toBe(
      'restore',
    );
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
      sourceOffer: null,
    });
  });

  it('keeps the offer a cart was loaded from, so a reload does not lose it', () => {
    const sourceOffer = {
      offerId: 65,
      clientId: 3,
      deleteOnSave: true,
      deliveryFee: 25,
      expectedDelivery: '2026-12-01',
      voucher: '',
      deliveryAddress: '',
      comment: '',
    };
    expect(toStoredCart(stored({ sourceOffer })).sourceOffer).toEqual(sourceOffer);
  });
});
