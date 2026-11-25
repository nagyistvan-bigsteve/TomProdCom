import { describe, it, expect } from 'vitest';
import type { ProductItem } from '@core/models/models';
import { Category, Unit_id } from '@core/models/enums';
import { mergeCartItems, mergeDuplicateItems, replaceCartItem } from './cart.items';

const line = (quantity: number, price: number) =>
  ({ quantity, price }) as unknown as ProductItem;

const item = (id: number, category: Category, quantity: number, price: number): ProductItem =>
  ({ product: { id, unit_id: Unit_id.BUC, piece_per_pack: 0 }, category, quantity, price }) as unknown as ProductItem;

/** An M2 line of a tile with 0.5 m² gross per piece and 10 pieces per pack. */
const tile = (
  pieces: number,
  price: number,
  breakdown?: { packsNeeded?: number; extraPiecesNeeded?: number },
): ProductItem =>
  ({
    product: { id: 1, unit_id: Unit_id.M2, m2_brut: 0.5, piece_per_pack: 10 },
    category: Category.A,
    quantity: pieces * 0.5,
    price,
    ...breakdown,
  }) as unknown as ProductItem;

describe('mergeCartItems', () => {
  it('sums quantity and price', () => {
    const merged = mergeCartItems(item(1, Category.A, 2, 200), item(1, Category.A, 3, 300));
    expect(merged.quantity).toBe(5);
    expect(merged.price).toBe(500);
    expect(merged.packsNeeded).toBeUndefined();
  });

  it('leaves both inputs untouched', () => {
    const base = tile(14, 200, { packsNeeded: 1, extraPiecesNeeded: 4 });
    const added = tile(4, 300, { packsNeeded: 0, extraPiecesNeeded: 4 });
    mergeCartItems(base, added);
    expect(base.quantity).toBe(7);
    expect(base.packsNeeded).toBe(1);
    expect(base.extraPiecesNeeded).toBe(4);
  });

  it('M2: packs and loose pieces under a full pack', () => {
    const merged = mergeCartItems(
      tile(13, 1, { packsNeeded: 1, extraPiecesNeeded: 3 }),
      tile(24, 1, { packsNeeded: 2, extraPiecesNeeded: 4 }),
    );
    expect(merged.packsNeeded).toBe(3);
    expect(merged.extraPiecesNeeded).toBe(7);
  });

  it('M2: loose pieces that exactly fill a pack become a pack', () => {
    const merged = mergeCartItems(
      tile(5, 1, { packsNeeded: 0, extraPiecesNeeded: 5 }),
      tile(5, 1, { packsNeeded: 0, extraPiecesNeeded: 5 }),
    );
    expect(merged.packsNeeded).toBe(1);
    expect(merged.extraPiecesNeeded).toBe(0);
  });

  it('M2: carries the pieces over a full pack', () => {
    const merged = mergeCartItems(
      tile(18, 1, { packsNeeded: 1, extraPiecesNeeded: 8 }),
      tile(6, 1, { extraPiecesNeeded: 6 }),
    );
    expect(merged.packsNeeded).toBe(2);
    expect(merged.extraPiecesNeeded).toBe(4);
  });

  it('M2: a line without a breakdown (loaded from an offer) still merges right', () => {
    const merged = mergeCartItems(tile(20, 1), tile(10, 1, { packsNeeded: 1, extraPiecesNeeded: 0 }));
    expect(merged.quantity).toBe(15);
    expect(merged.packsNeeded).toBe(3);
    expect(merged.extraPiecesNeeded).toBe(0);
  });

  it('keeps the line hand-priced when either part was', () => {
    const manual = { ...item(1, Category.A, 1, 500), manualPrice: true };
    expect(mergeCartItems(item(1, Category.A, 1, 100), manual).manualPrice).toBe(true);
    expect(mergeCartItems(manual, item(1, Category.A, 1, 100)).manualPrice).toBe(true);
    expect(
      mergeCartItems(item(1, Category.A, 1, 100), item(1, Category.A, 1, 100)).manualPrice,
    ).toBeUndefined();
  });
});

describe('mergeDuplicateItems', () => {
  it('merges all lines of the product and grade, not only two', () => {
    const items = [
      item(1, Category.A, 1, 100),
      item(2, Category.A, 5, 50),
      item(1, Category.A, 2, 200),
      item(1, Category.A, 3, 300),
    ];

    const result = mergeDuplicateItems(items, 1, Category.A);

    expect(result).toHaveLength(2);
    expect(result[0].quantity).toBe(6);
    expect(result[0].price).toBe(600);
    expect(result[1]).toBe(items[1]);
  });

  it('keeps other grades of the same product apart', () => {
    const items = [item(1, Category.A, 1, 100), item(1, Category.B, 2, 150)];
    expect(mergeDuplicateItems(items, 1, Category.A)).toBe(items);
  });

  it('returns the same array when there is nothing to merge', () => {
    const items = [item(1, Category.A, 1, 100)];
    expect(mergeDuplicateItems(items, 1, Category.A)).toBe(items);
  });
});

describe('replaceCartItem', () => {
  it('returns a new array so the cart total is recomputed', () => {
    const a = line(10, 300);
    const b = line(7, 210);
    const items = [a, b];

    const result = replaceCartItem(items, b, line(6, 180));

    expect(result).not.toBe(items);
    expect(result.reduce((sum, i) => sum + i.price, 0)).toBe(480);
  });

  it('replaces only the given line and keeps the order', () => {
    const a = line(1, 1);
    const b = line(2, 2);
    const c = line(3, 3);
    const next = line(9, 9);

    expect(replaceCartItem([a, b, c], b, next)).toEqual([a, next, c]);
  });

  it('leaves the original array untouched', () => {
    const a = line(1, 1);
    const items = [a];

    replaceCartItem(items, a, line(5, 5));

    expect(items[0]).toBe(a);
  });
});
