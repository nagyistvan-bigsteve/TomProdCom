import { describe, it, expect } from 'vitest';
import { Unit_id } from '@core/models/enums';
import {
  applyVoucher,
  itemVolumeM3,
  OrderItemForTotals,
  orderTotals,
} from './order-details.computed';

function makeItem(overrides: Partial<OrderItemForTotals> = {}): OrderItemForTotals {
  return {
    price: 100,
    quantity: 10,
    packsPieces: '',
    product: { unit_id: Unit_id.M3, width: 15, thickness: 2.5, length: 400 },
    ...overrides,
  };
}

describe('applyVoucher', () => {
  it('leaves the amount alone without a voucher', () => {
    expect(applyVoucher(1000, '')).toBe(1000);
    expect(applyVoucher(1000, null)).toBe(1000);
    expect(applyVoucher(1000, '   ')).toBe(1000);
  });

  it('takes a percentage off', () => {
    expect(applyVoucher(1000, '15%')).toBe(850);
  });

  it('takes a fixed amount off', () => {
    expect(applyVoucher(1000, '200')).toBe(800);
  });

  it('ignores a leading minus sign', () => {
    expect(applyVoucher(1000, '-200')).toBe(800);
    expect(applyVoucher(1000, '-10%')).toBe(900);
  });

  it('never goes below zero and rounds to 2 decimals', () => {
    expect(applyVoucher(100, '250')).toBe(0);
    expect(applyVoucher(10, '33.333%')).toBe(6.67);
  });

  it('ignores a voucher that is not a number', () => {
    expect(applyVoucher(1000, 'abc')).toBe(1000);
  });
});

describe('itemVolumeM3', () => {
  it('computes width × thickness × length in m³ times the quantity', () => {
    // 15 × 2.5 × 400 cm = 0.015 m³ per piece; × 10 = 0.15
    expect(itemVolumeM3(makeItem())).toBe(0.15);
  });

  it('counts a bundle as 10 pieces', () => {
    const bundle = makeItem({
      product: { unit_id: Unit_id.BOUNDLE, width: 15, thickness: 2.5, length: 400 },
      quantity: 2,
    });
    // 0.015 × 2 = 0.03, × 10 = 0.3
    expect(itemVolumeM3(bundle)).toBeCloseTo(0.3, 10);
  });

  it('rounds each item to 3 decimals', () => {
    const item = makeItem({
      quantity: 1,
      product: { unit_id: Unit_id.M3, width: 12.3, thickness: 2.3, length: 401 },
    });
    // 12.3 × 2.3 × 401 / 1e6 = 0.01134429
    expect(itemVolumeM3(item)).toBe(0.011);
  });

  it('uses the quantity for products sold by volume (no width)', () => {
    const item = makeItem({
      quantity: 2.5,
      product: { unit_id: Unit_id.M3, width: null as unknown as number, thickness: 0, length: 0 },
    });
    expect(itemVolumeM3(item)).toBe(2.5);
  });

  it('counts 0 for items with a pack breakdown', () => {
    expect(itemVolumeM3(makeItem({ packsPieces: '3p + 2b' }))).toBe(0);
  });
});

describe('orderTotals', () => {
  const items = [
    makeItem({ price: 600 }), // 0.15 m³
    makeItem({
      price: 400,
      quantity: 12,
      packsPieces: '2p + 2b',
      product: { unit_id: Unit_id.M2, width: 0, thickness: 0, length: 0 },
    }), // M2: no volume
  ];

  it('sums the prices and the volumes, skipping M2 items', () => {
    expect(orderTotals(items, '')).toEqual({
      totalAmount: 1000,
      totalAmountFinal: 1000,
      totalQuantity: 0.15,
    });
  });

  it('applies the voucher to the final amount only', () => {
    expect(orderTotals(items, '10%')).toEqual({
      totalAmount: 1000,
      totalAmountFinal: 900,
      totalQuantity: 0.15,
    });
  });

  it('is zero for an order without items', () => {
    expect(orderTotals([], '200')).toEqual({
      totalAmount: 0,
      totalAmountFinal: 0,
      totalQuantity: 0,
    });
  });
});
