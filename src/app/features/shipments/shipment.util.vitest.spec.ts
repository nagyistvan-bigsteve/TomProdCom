import { describe, it, expect } from 'vitest';
import { Unit_id } from '@core/models/enums';
import type { Product } from '@core/models/models';
import {
  DraftLine,
  invalidLines,
  shipmentProgress,
  sortedPercent,
  toShipmentItems,
  withTrailingEmptyLine,
} from './shipment.util';

function product(id: number): Product {
  return {
    id,
    name: `P${id}`,
    unit_id: Unit_id.M3,
    size_id: 0,
    thickness: 7.5,
    width: 15,
    length: 400,
    m2_util: 0,
    m2_brut: 0,
    piece_per_pack: 0,
  };
}

const line = (key: number, p: Product | null, quantity: number): DraftLine => ({
  key,
  product: p,
  quantity,
});

describe('toShipmentItems', () => {
  it('drops empty lines and sums the same product', () => {
    expect(
      toShipmentItems([
        line(1, product(1), 20),
        line(2, product(2), 5),
        line(3, product(1), 29),
        line(4, null, 0),
      ]),
    ).toEqual([
      { product_id: 1, quantity: 49 },
      { product_id: 2, quantity: 5 },
    ]);
  });

  it('skips zero, negative and fractional quantities', () => {
    expect(toShipmentItems([line(1, product(1), 0), line(2, product(2), -3), line(3, product(3), 1.5)])).toEqual([]);
    expect(invalidLines([line(1, product(1), 0), line(2, null, 0), line(3, product(3), 2)]).map((l) => l.key)).toEqual([1]);
  });
});

describe('withTrailingEmptyLine', () => {
  let key = 100;
  const next = () => ++key;

  it('adds an empty line when the last one has a product', () => {
    const lines = withTrailingEmptyLine([line(1, product(1), 3)], next);
    expect(lines).toHaveLength(2);
    expect(lines[1].product).toBeNull();
  });

  it('keeps a single trailing empty line and starts an empty draft with one', () => {
    const lines = [line(1, product(1), 3), line(2, null, 0)];
    expect(withTrailingEmptyLine(lines, next)).toBe(lines);
    expect(withTrailingEmptyLine([], next)).toHaveLength(1);
  });
});

describe('shipmentProgress / sortedPercent', () => {
  const items = [
    { product_id: 1, quantity: 49 },
    { product_id: 2, quantity: 10 },
  ];
  const sortings = [
    { product_id: 1, qty_a: 30, qty_b: 5, qty_waste: 0 },
    { product_id: 1, qty_a: 10, qty_b: 4, qty_waste: 0 },
    { product_id: 2, qty_a: 12, qty_b: 0, qty_waste: 0 }, // more than this truck brought
  ];

  it('tracks received, sorted and remaining per line', () => {
    expect(shipmentProgress(items, sortings)).toEqual([
      { product_id: 1, received: 49, sorted: 49, remaining: 0 },
      { product_id: 2, received: 10, sorted: 12, remaining: 0 },
    ]);
  });

  it('caps each line at what it received', () => {
    expect(sortedPercent(items, sortings, () => true)).toBe(100);
    expect(sortedPercent(items, sortings.slice(0, 1), () => true)).toBe(Math.round((35 / 59) * 100));
  });

  it('ignores lines that cannot be graded', () => {
    expect(sortedPercent(items, [], (id) => id === 2)).toBe(0);
    expect(sortedPercent(items, [], () => false)).toBe(100);
  });
});
