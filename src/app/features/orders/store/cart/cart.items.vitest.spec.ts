import { describe, it, expect } from 'vitest';
import type { ProductItem } from '@core/models/models';
import { replaceCartItem } from './cart.items';

const line = (quantity: number, price: number) =>
  ({ quantity, price }) as unknown as ProductItem;

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
