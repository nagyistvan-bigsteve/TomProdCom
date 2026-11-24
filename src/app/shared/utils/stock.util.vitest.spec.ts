import { describe, it, expect } from 'vitest';
import { Category, Unit_id } from '@core/models/enums';
import type { Product, Stock } from '@core/models/models';
import {
  availableStock,
  bookedAbShortfall,
  groupStocksByProduct,
  hasVolume,
  isGradable,
  shipmentTotalM3,
  sortingLimit,
  sortingTotal,
  countsWholePieces,
  stockCategoriesOf,
  stockCategoryFor,
  totalStock,
  validateSorting,
} from './stock.util';

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 1,
    name: '7.5x15x400',
    unit_id: Unit_id.M3,
    size_id: 0,
    thickness: 7.5,
    width: 15,
    length: 400,
    m2_util: 0,
    m2_brut: 0,
    piece_per_pack: 0,
    ...overrides,
  };
}

function makeStock(overrides: Partial<Stock> = {}): Stock {
  return {
    id: 1,
    product_id: 1,
    category_id: Category.AB,
    stock: 0,
    booked_stock: 0,
    ...overrides,
  };
}

describe('stockCategoryFor', () => {
  const short = makeProduct({ length: 400 });

  it('keeps A, B and AB as they are', () => {
    expect(stockCategoryFor(short, Category.A)).toBe(Category.A);
    expect(stockCategoryFor(short, Category.B)).toBe(Category.B);
    expect(stockCategoryFor(short, Category.AB)).toBe(Category.AB);
  });

  it('takes T (terrace) from A', () => {
    expect(stockCategoryFor(short, Category.T)).toBe(Category.A);
  });

  it('takes every grade from AB when the product is longer than 7 m', () => {
    const long = makeProduct({ length: 750 });
    for (const c of [Category.A, Category.AB, Category.B, Category.T]) {
      expect(stockCategoryFor(long, c)).toBe(Category.AB);
    }
  });

  it('treats exactly 7 m as graded', () => {
    expect(stockCategoryFor(makeProduct({ length: 700 }), Category.B)).toBe(Category.B);
  });

  it('does not track M2 products', () => {
    expect(stockCategoryFor(makeProduct({ unit_id: Unit_id.M2 }), Category.A)).toBeNull();
  });

  it('applies to BUC and bundle products too', () => {
    expect(stockCategoryFor(makeProduct({ unit_id: Unit_id.BUC }), Category.T)).toBe(Category.A);
    expect(stockCategoryFor(makeProduct({ unit_id: Unit_id.BOUNDLE }), Category.B)).toBe(Category.B);
  });
});

describe('isGradable / stockCategoriesOf', () => {
  it('lists A, B, AB for a product up to 7 m', () => {
    const p = makeProduct({ length: 700 });
    expect(isGradable(p)).toBe(true);
    expect(stockCategoriesOf(p)).toEqual([Category.A, Category.B, Category.AB]);
  });

  it('lists only AB above 7 m', () => {
    const p = makeProduct({ length: 701 });
    expect(isGradable(p)).toBe(false);
    expect(stockCategoriesOf(p)).toEqual([Category.AB]);
  });

  it('lists nothing for M2', () => {
    expect(stockCategoriesOf(makeProduct({ unit_id: Unit_id.M2 }))).toEqual([]);
  });
});

describe('availableStock / totalStock / groupStocksByProduct', () => {
  it('can be negative when more is booked than held', () => {
    expect(availableStock(makeStock({ stock: 3, booked_stock: 5 }))).toBe(-2);
    expect(availableStock(undefined)).toBe(0);
  });

  it('groups rows by product and grade and sums them', () => {
    const grouped = groupStocksByProduct([
      makeStock({ id: 1, product_id: 1, category_id: Category.A, stock: 40 }),
      makeStock({ id: 2, product_id: 1, category_id: Category.B, stock: 9 }),
      makeStock({ id: 3, product_id: 1, category_id: Category.AB, stock: 49 }),
      makeStock({ id: 4, product_id: 2, category_id: Category.AB, stock: 5 }),
    ]);
    expect(grouped[1][Category.A]?.id).toBe(1);
    expect(totalStock(grouped[1])).toBe(98);
    expect(totalStock(grouped[2])).toBe(5);
    expect(totalStock(undefined)).toBe(0);
  });
});

describe('validateSorting', () => {
  it('accepts 49 AB → 40 A + 9 B', () => {
    expect(validateSorting(49, { a: 40, b: 9, waste: 0 })).toBeNull();
    expect(sortingTotal({ a: 40, b: 9, waste: 0 })).toBe(49);
  });

  it('counts waste as taken from AB', () => {
    expect(validateSorting(49, { a: 40, b: 8, waste: 1 })).toBeNull();
    expect(validateSorting(49, { a: 40, b: 9, waste: 1 })).toBe('MORE_THAN_AB');
  });

  it('rejects an empty, negative or fractional sorting', () => {
    expect(validateSorting(10, { a: 0, b: 0, waste: 0 })).toBe('EMPTY');
    expect(validateSorting(10, { a: -1, b: 2, waste: 0 })).toBe('NEGATIVE');
    expect(validateSorting(10, { a: 1.5, b: 0, waste: 0 })).toBe('NOT_WHOLE');
  });

  it('rejects any sorting when AB is empty', () => {
    expect(validateSorting(0, { a: 1, b: 0, waste: 0 })).toBe('MORE_THAN_AB');
  });

  it('from a truck, caps the sorting at what is left on it, not the whole AB stock', () => {
    // AB holds 1000249 pieces, the truck brought 250 of which 0 are sorted
    expect(validateSorting(1000249, { a: 200, b: 50, waste: 0 }, 250)).toBeNull();
    expect(validateSorting(1000249, { a: 200, b: 50, waste: 1 }, 250)).toBe('MORE_THAN_TRUCK');
  });

  it('from a truck, still needs the pieces in AB stock', () => {
    expect(validateSorting(10, { a: 20, b: 0, waste: 0 }, 250)).toBe('MORE_THAN_AB');
  });

  it('reports the truck limit before the AB limit when both are exceeded', () => {
    expect(validateSorting(5, { a: 30, b: 0, waste: 0 }, 20)).toBe('MORE_THAN_TRUCK');
  });
});

describe('sortingLimit', () => {
  it('is the AB stock without a truck', () => {
    expect(sortingLimit(49)).toBe(49);
  });

  it('is the smaller of AB stock and truck remainder', () => {
    expect(sortingLimit(1000249, 250)).toBe(250);
    expect(sortingLimit(10, 250)).toBe(10);
  });

  it('is never negative', () => {
    expect(sortingLimit(-3)).toBe(0);
    expect(sortingLimit(10, -1)).toBe(0);
  });
});

describe('shipmentTotalM3', () => {
  it('sums the volume of the lines', () => {
    const products = {
      1: makeProduct({ id: 1 }), // 7.5 x 15 x 400 cm = 0.045 m³
      2: makeProduct({ id: 2, unit_id: Unit_id.BOUNDLE, thickness: 2.5, width: 10, length: 400 }), // 0.01 m³ x 10
    };
    const total = shipmentTotalM3(
      [
        { product_id: 1, quantity: 49 },
        { product_id: 2, quantity: 2 },
      ],
      products,
    );
    expect(total).toBeCloseTo(49 * 0.045 + 2 * 0.1, 6);
  });

  it('ignores unknown products and products without dimensions', () => {
    const products = { 1: makeProduct({ id: 1, width: 0 }) };
    expect(shipmentTotalM3([{ product_id: 1, quantity: 5 }, { product_id: 9, quantity: 5 }], products)).toBe(0);
    expect(shipmentTotalM3([], products)).toBe(0);
  });

  it('counts only M3 and bundle products, like the products page', () => {
    // a piece-priced (BUC) product with dimensions adds no m³
    const products = { 1: makeProduct({ id: 1, unit_id: Unit_id.BUC }) };
    expect(shipmentTotalM3([{ product_id: 1, quantity: 49 }], products)).toBe(0);
  });
});

describe('countsWholePieces', () => {
  it('is true for pieces: BUC, bundles, M3 with a width', () => {
    expect(countsWholePieces({ unit_id: Unit_id.BUC, width: 50 })).toBe(true);
    expect(countsWholePieces({ unit_id: Unit_id.BOUNDLE, width: 3 })).toBe(true);
    expect(countsWholePieces({ unit_id: Unit_id.M3, width: 10 })).toBe(true);
  });

  it('is false for volume and area: M3 without a width, M2', () => {
    expect(countsWholePieces({ unit_id: Unit_id.M3, width: null as unknown as number })).toBe(false);
    expect(countsWholePieces({ unit_id: Unit_id.M2, width: 10 })).toBe(false);
  });
});

describe('hasVolume', () => {
  it('is true for M3 and bundles only', () => {
    expect(hasVolume({ unit_id: Unit_id.M3 })).toBe(true);
    expect(hasVolume({ unit_id: Unit_id.BOUNDLE })).toBe(true);
    expect(hasVolume({ unit_id: Unit_id.BUC })).toBe(false);
    expect(hasVolume({ unit_id: Unit_id.M2 })).toBe(false);
  });
});

describe('bookedAbShortfall', () => {
  const ab = (stock: number, booked_stock: number) => ({ stock, booked_stock });

  it('is 0 while the sorting fits in AB free', () => {
    expect(bookedAbShortfall(ab(49, 40), 9)).toBe(0);
    expect(bookedAbShortfall(ab(49, 0), 49)).toBe(0);
  });

  it('counts the booked pieces the sorting takes beyond AB free', () => {
    expect(bookedAbShortfall(ab(49, 40), 12)).toBe(3);
    expect(bookedAbShortfall(ab(49, 40), 49)).toBe(40);
  });

  it('treats an already negative AB free as 0 free', () => {
    // 10 in stock, 15 ordered: every sorted piece is one an order counts on
    expect(bookedAbShortfall(ab(10, 15), 4)).toBe(4);
  });

  it('is 0 without an AB row or for an empty sorting', () => {
    expect(bookedAbShortfall(undefined, 5)).toBe(0);
    expect(bookedAbShortfall(ab(10, 5), 0)).toBe(0);
  });
});
