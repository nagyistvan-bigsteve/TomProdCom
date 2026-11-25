import { describe, it, expect } from 'vitest';
import { Category, Size_id, Unit_id } from '@core/models/enums';
import type { Price2, Product, ProductItem, ProductItems } from '@core/models/models';
import {
  applyBDiscount,
  applyTvaDiscount,
  effectiveUnitPrice,
  calculateActualPrice,
  countsInVolumeTotal,
  findBasePrice,
  firstPricedCategory,
  lineVolumeM3,
  m2BrutQuantity,
  m2FromM3,
  m2NetArea,
  m2PacksFromQuantity,
  nextCategory,
  packsPiecesLabel,
  pieceVolumeM3,
  priceRowsForProduct,
  ProductUtil,
  roundM3,
  rowAdjustment,
  unitPriceForTypedRow,
} from './product.util';

describe('nextCategory', () => {
  it('steps A → AB → B → T → A', () => {
    expect(nextCategory(Category.A)).toBe(Category.AB);
    expect(nextCategory(Category.AB)).toBe(Category.B);
    expect(nextCategory(Category.B)).toBe(Category.T);
    expect(nextCategory(Category.T)).toBe(Category.A);
  });
});

describe('firstPricedCategory', () => {
  it('returns the start grade when it has a price', () => {
    expect(firstPricedCategory(Category.B, () => true)).toBe(Category.B);
  });

  it('skips grades without a price, wrapping after T', () => {
    const priced = new Set([Category.AB]);
    expect(firstPricedCategory(Category.B, (c) => priced.has(c))).toBe(Category.AB);
  });

  it('returns null instead of looping when no grade has a price', () => {
    let calls = 0;
    const result = firstPricedCategory(Category.A, () => {
      calls++;
      return false;
    });
    expect(result).toBeNull();
    expect(calls).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 1,
    name: 'Test product',
    unit_id: Unit_id.M3,
    size_id: 0,
    thickness: 5,
    width: 10,
    length: 200,
    m2_util: 0,
    m2_brut: 0,
    piece_per_pack: 0,
    ...overrides,
  };
}

const util = new ProductUtil();

// ---------------------------------------------------------------------------
// applyBDiscount
// ---------------------------------------------------------------------------

describe('applyBDiscount', () => {
  it('subtracts 50 for M3 + Category B + thickness 2.5', () => {
    expect(applyBDiscount(1200, Unit_id.M3, Category.B, 2.5)).toBe(1150);
  });

  it('leaves price unchanged for M3 + Category A + thickness 2.5', () => {
    expect(applyBDiscount(1200, Unit_id.M3, Category.A, 2.5)).toBe(1200);
  });

  it('leaves price unchanged for M3 + Category B + thickness 5 (not 2.5)', () => {
    expect(applyBDiscount(1300, Unit_id.M3, Category.B, 5)).toBe(1300);
  });

  it('leaves price unchanged for BUC + Category B + thickness 2.5', () => {
    expect(applyBDiscount(1200, Unit_id.BUC, Category.B, 2.5)).toBe(1200);
  });

  it('leaves price unchanged for BUNDLE + Category B + thickness 2.5', () => {
    expect(applyBDiscount(1200, Unit_id.BOUNDLE, Category.B, 2.5)).toBe(1200);
  });

  it('leaves price unchanged for M2 + Category B + thickness 2.5', () => {
    expect(applyBDiscount(1200, Unit_id.M2, Category.B, 2.5)).toBe(1200);
  });
});

// ---------------------------------------------------------------------------
// applyTvaDiscount
// ---------------------------------------------------------------------------

describe('unitPriceForTypedRow', () => {
  const board25 = makeProduct({ unit_id: Unit_id.M3, thickness: 2.5 });
  const board5 = makeProduct({ unit_id: Unit_id.M3, thickness: 5 });

  it('keeps the 2.5 cm B board discount on a general row', () => {
    expect(unitPriceForTypedRow(1100, false, board25, Category.B)).toBe(1050);
  });

  it('gives other boards and categories exactly the typed price', () => {
    expect(unitPriceForTypedRow(1100, false, board5, Category.B)).toBe(1100);
    expect(unitPriceForTypedRow(1100, false, board25, Category.A)).toBe(1100);
    expect(
      unitPriceForTypedRow(30, false, makeProduct({ unit_id: Unit_id.BUC, thickness: 2.5 }), Category.B),
    ).toBe(30);
    expect(
      unitPriceForTypedRow(30, false, makeProduct({ unit_id: Unit_id.BOUNDLE, thickness: 2.5 }), Category.B),
    ).toBe(30);
  });

  it('takes a product row price as is (it already includes the discount)', () => {
    expect(unitPriceForTypedRow(1050, true, board25, Category.B)).toBe(1050);
  });
});

describe('applyTvaDiscount', () => {
  it('subtracts 100 from M3 price when TVA is true', () => {
    expect(applyTvaDiscount(1200, Unit_id.M3, true)).toBe(1100);
  });

  it('subtracts 5 from BUNDLE price when TVA is true', () => {
    expect(applyTvaDiscount(200, Unit_id.BOUNDLE, true)).toBe(195);
  });

  it('leaves BUC price unchanged when TVA is true', () => {
    expect(applyTvaDiscount(100, Unit_id.BUC, true)).toBe(100);
  });

  it('leaves M2 price unchanged when TVA is true', () => {
    expect(applyTvaDiscount(50, Unit_id.M2, true)).toBe(50);
  });

  it('leaves M3 price unchanged when TVA is false', () => {
    expect(applyTvaDiscount(1200, Unit_id.M3, false)).toBe(1200);
  });

  it('leaves BUNDLE price unchanged when TVA is false', () => {
    expect(applyTvaDiscount(200, Unit_id.BOUNDLE, false)).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// effectiveUnitPrice — single source for list price → charged unit price
// ---------------------------------------------------------------------------

describe('effectiveUnitPrice', () => {
  const board = (thickness: number) => ({ unit_id: Unit_id.M3, thickness });

  it('applies the B board discount to a 2.5 cm M3 board', () => {
    expect(effectiveUnitPrice(1200, board(2.5), Category.B, false)).toBe(1150);
  });

  it('applies the B board discount, then TVA, for a TVA client', () => {
    expect(effectiveUnitPrice(1200, board(2.5), Category.B, true)).toBe(1050);
  });

  it('applies only TVA to a board of another thickness', () => {
    expect(effectiveUnitPrice(1300, board(5), Category.B, true)).toBe(1200);
  });

  it('applies only TVA to a 2.5 cm board in another category', () => {
    expect(effectiveUnitPrice(1300, board(2.5), Category.A, true)).toBe(1200);
  });

  it('applies the bundle TVA discount', () => {
    const bundle = { unit_id: Unit_id.BOUNDLE, thickness: 2.5 };
    expect(effectiveUnitPrice(200, bundle, Category.B, true)).toBe(195);
  });

  it('leaves M2 and BUC prices unchanged', () => {
    expect(
      effectiveUnitPrice(50, { unit_id: Unit_id.M2, thickness: 2.5 }, Category.B, true),
    ).toBe(50);
    expect(
      effectiveUnitPrice(30, { unit_id: Unit_id.BUC, thickness: 2.5 }, Category.B, true),
    ).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// Adjustment order (B discount first, then TVA) — SPEC §10.3
// ---------------------------------------------------------------------------

describe('adjustment order: B discount → TVA', () => {
  it('applies B discount before TVA for nedimensionat-style pricing', () => {
    // DB price 1200, B discount −50, TVA −100 → 1050
    const afterB = applyBDiscount(1200, Unit_id.M3, Category.B, 2.5);
    expect(afterB).toBe(1150);
    const afterTva = applyTvaDiscount(afterB, Unit_id.M3, true);
    expect(afterTva).toBe(1050);
  });

  it('generic M3 B row without TVA — no B discount unless thickness 2.5', () => {
    // Generic row priced at 1300, client PF (no TVA)
    const afterB = applyBDiscount(1300, Unit_id.M3, Category.B, 5);
    expect(afterB).toBe(1300); // no -50 for thickness 5
    const afterTva = applyTvaDiscount(afterB, Unit_id.M3, false);
    expect(afterTva).toBe(1300);
  });
});

// ---------------------------------------------------------------------------
// calculatePrice — pure formula (no business-rule adjustments inside)
// ---------------------------------------------------------------------------

describe('calculatePrice — M3 with width (dimensioned board)', () => {
  it('computes volume × price × qty', () => {
    // 10cm × 200cm × 5cm / 1_000_000 = 0.01 m³/piece; 10 pieces → 0.1 m³; price 1300 → 130
    const product = makeProduct({ unit_id: Unit_id.M3, width: 10, length: 200, thickness: 5 });
    const { price } = util.calculatePrice(product, 1300, 10);
    expect(price).toBeCloseTo(130, 5);
  });

  it('returns 0 when price is 0', () => {
    const product = makeProduct({ unit_id: Unit_id.M3, width: 10, length: 200, thickness: 5 });
    const { price } = util.calculatePrice(product, 0, 10);
    expect(price).toBe(0);
  });

  it('does NOT subtract 50 internally for 2.5cm B boards — caller must apply applyBDiscount first', () => {
    // 20cm × 400cm × 2.5cm = 20000 cm³ = 0.02 m³/piece; qty 10 → 0.2 m³; price 1150 → 230
    const product = makeProduct({ unit_id: Unit_id.M3, width: 20, length: 400, thickness: 2.5 });
    const { price: withAdjusted } = util.calculatePrice(product, 1150, 10); // caller applied -50
    const { price: withRaw } = util.calculatePrice(product, 1200, 10);      // raw without -50
    expect(withAdjusted).toBeCloseTo(230, 5);
    expect(withRaw).toBeCloseTo(240, 5);
    // pure formula: no internal -50
    expect(withRaw - withAdjusted).toBeCloseTo(10, 5); // difference = 50 × 0.2 m³ = 10
  });
});

describe('calculatePrice — M3 no-width (nedimensionat, sold by m³)', () => {
  it('computes price × qty directly when width is null/0', () => {
    const product = makeProduct({ unit_id: Unit_id.M3, width: null as any, length: 200, thickness: 2.5 });
    const { price } = util.calculatePrice(product, 1050, 2.2);
    expect(price).toBeCloseTo(2310, 2);
  });

  it('applies adjusted price (after applyBDiscount) × qty correctly', () => {
    const product = makeProduct({ unit_id: Unit_id.M3, width: null as any, length: 300, thickness: 2.5 });
    const adjusted = applyBDiscount(1200, Unit_id.M3, Category.B, 2.5); // 1150
    const { price } = util.calculatePrice(product, adjusted, 3);
    expect(price).toBeCloseTo(3450, 2); // 1150 × 3
  });
});

describe('calculatePrice — BUC and BUNDLE', () => {
  it('BUC: qty × price', () => {
    const product = makeProduct({ unit_id: Unit_id.BUC });
    const { price } = util.calculatePrice(product, 35, 40);
    expect(price).toBe(1400);
  });

  it('BUNDLE: qty × price', () => {
    const product = makeProduct({ unit_id: Unit_id.BOUNDLE });
    const { price } = util.calculatePrice(product, 200, 30);
    expect(price).toBe(6000);
  });
});

describe('calculatePrice — M2 BRUT mode', () => {
  it('rounds up pieces and multiplies by m2_brut × price', () => {
    // 5 pieces/pack, 0.8 m2_brut/piece; request 2 m² BRUT → ceil(2/0.8) = 3 pieces; 3 × 0.8 × 50 = 120
    const product = makeProduct({
      unit_id: Unit_id.M2,
      m2_brut: 0.8,
      m2_util: 0.7,
      piece_per_pack: 5,
    });
    const { price, packsNeeded, extraPiecesNeeded } = util.calculatePrice(product, 50, 2, 'BRUT');
    expect(price).toBeCloseTo(120, 5);
    expect(packsNeeded).toBe(0);
    expect(extraPiecesNeeded).toBe(3);
  });

  it('correctly counts full packs and extra pieces', () => {
    // piece_per_pack = 5, request 12 pieces BUC → 2 full packs + 2 extra; 12 × 0.8 × 50 = 480
    const product = makeProduct({
      unit_id: Unit_id.M2,
      m2_brut: 0.8,
      m2_util: 0.7,
      piece_per_pack: 5,
    });
    const { price, packsNeeded, extraPiecesNeeded } = util.calculatePrice(product, 50, 12, 'BUC');
    expect(price).toBeCloseTo(480, 5);
    expect(packsNeeded).toBe(2);
    expect(extraPiecesNeeded).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// calculateActualPrice — overview panel Alap logic
// ---------------------------------------------------------------------------

function makePrice2(overrides: Partial<Price2> = {}): Price2 {
  return {
    id: 1,
    unit_id: Unit_id.M3,
    category_id: Category.B,
    size_id: Size_id.NORMAL,
    price: 1300,
    product_id: null as any,
    ...overrides,
  };
}

function makeCartItem(
  productId: number,
  thickness: number,
  hasWidth: boolean = true,
  category: Category = Category.B,
): ProductItem {
  return {
    product: makeProduct({
      id: productId,
      unit_id: Unit_id.M3,
      thickness,
      width: hasWidth ? 15 : null as any,
      length: 400,
    }),
    quantity: 1,
    price: 0,
    category,
  };
}

describe('calculateActualPrice — generic row (product_id = null)', () => {
  it('shows the list price even when a 2.5 cm board in the cart uses the row', () => {
    // The −50 for that board is applied per item (getExactPrice), not on the row
    const genericRow = makePrice2({ product_id: null as any, price: 1300 });
    const cartItems: ProductItem[] = [
      makeCartItem(10, 2.5),
      makeCartItem(99, 5),
    ];
    // PJ+TVA: 1300 − 100 (TVA) = 1200
    expect(calculateActualPrice(genericRow, true, cartItems)).toBe(1200);
    // PF: list price unchanged
    expect(calculateActualPrice(genericRow, false, cartItems)).toBe(1300);
  });

  it('does NOT apply −50 when all M3 B cart items have thickness != 2.5', () => {
    const genericRow = makePrice2({ product_id: null as any, price: 1300 });
    const cartItems: ProductItem[] = [makeCartItem(99, 5)]; // 5 cm board
    // PJ+TVA: 1300 − 0 (no B discount, wrong thickness) − 100 = 1200
    expect(calculateActualPrice(genericRow, true, cartItems)).toBe(1200);
  });

  it('returns base price without TVA for PF client', () => {
    const genericRow = makePrice2({ product_id: null as any, price: 1300 });
    const cartItems: ProductItem[] = [makeCartItem(99, 5)];
    expect(calculateActualPrice(genericRow, false, cartItems)).toBe(1300);
  });
});

describe('calculateActualPrice — product-specific row (product_id set)', () => {
  it('applies −50 for the matching product when thickness is 2.5', () => {
    const specificRow = makePrice2({ product_id: 242, price: 1200 });
    const cartItems: ProductItem[] = [makeCartItem(242, 2.5, false)]; // nedimensionat
    // PJ+TVA: 1200 − 50 − 100 = 1050
    expect(calculateActualPrice(specificRow, true, cartItems)).toBe(1050);
  });

  it('PF client: only B discount, no TVA', () => {
    const specificRow = makePrice2({ product_id: 242, price: 1200 });
    const cartItems: ProductItem[] = [makeCartItem(242, 2.5, false)];
    // PF: 1200 − 50 = 1150
    expect(calculateActualPrice(specificRow, false, cartItems)).toBe(1150);
  });

  it('does NOT apply −50 for a product with thickness != 2.5', () => {
    const specificRow = makePrice2({ product_id: 77, price: 2100 });
    const cartItems: ProductItem[] = [makeCartItem(77, 5, true)]; // 5 cm board
    // PJ+TVA: 2100 − 0 (thickness != 2.5) − 100 = 2000
    expect(calculateActualPrice(specificRow, true, cartItems)).toBe(2000);
  });

  it('does NOT apply −50 when no cart items match the product_id', () => {
    const specificRow = makePrice2({ product_id: 999, price: 1200 });
    const cartItems: ProductItem[] = [makeCartItem(1, 2.5)]; // different product
    // PJ+TVA: 1200 − 0 (no matching item) − 100 = 1100
    expect(calculateActualPrice(specificRow, true, cartItems)).toBe(1100);
  });

  it('does NOT apply −50 when the 2.5 cm board is in the cart at another category', () => {
    const specificRow = makePrice2({ product_id: 242, price: 1200 });
    const cartItems: ProductItem[] = [
      makeCartItem(242, 2.5, true, Category.A),
    ];
    // PJ+TVA: 1200 − 0 (cart item is not category B) − 100 = 1100
    expect(calculateActualPrice(specificRow, true, cartItems)).toBe(1100);
  });
});

// ---------------------------------------------------------------------------
// Price lookup (SPEC 10.1): the one rule every lookup goes through
// ---------------------------------------------------------------------------

describe('priceRowsForProduct / findBasePrice', () => {
  const board = makeProduct({ id: 7, unit_id: Unit_id.M3, size_id: Size_id.EXTRA });
  const general = [
    makePrice2({ id: 1, category_id: Category.A, size_id: Size_id.EXTRA, price: 1500 }),
    makePrice2({ id: 2, category_id: Category.B, size_id: Size_id.EXTRA, price: 1300 }),
    makePrice2({ id: 3, category_id: Category.A, size_id: Size_id.NORMAL, price: 1400 }),
    makePrice2({ id: 4, category_id: Category.A, unit_id: Unit_id.BUC, size_id: Size_id.EXTRA, price: 20 }),
  ];

  it('uses the general rows of the product unit and size', () => {
    expect(priceRowsForProduct(board, general).map((p) => p.id)).toEqual([1, 2]);
    expect(findBasePrice(board, Category.B, general)?.price).toBe(1300);
  });

  it("uses only the product's own rows when it has any", () => {
    const prices = [...general, makePrice2({ id: 9, product_id: 7, category_id: Category.A, price: 1700 })];
    expect(priceRowsForProduct(board, prices).map((p) => p.id)).toEqual([9]);
    expect(findBasePrice(board, Category.A, prices)?.price).toBe(1700);
  });

  it('does not fall back to a general row for a grade the product has no own price in', () => {
    const prices = [...general, makePrice2({ id: 9, product_id: 7, category_id: Category.A, price: 1700 })];
    expect(findBasePrice(board, Category.B, prices)).toBeUndefined();
  });

  it('ignores own rows of another unit', () => {
    const prices = [makePrice2({ id: 9, product_id: 7, unit_id: Unit_id.BUC, category_id: Category.A })];
    expect(findBasePrice(board, Category.A, prices)).toBeUndefined();
  });

  it('returns undefined for a product without prices', () => {
    expect(findBasePrice(board, Category.A, [])).toBeUndefined();
  });
});

describe('rowAdjustment', () => {
  const product = { id: 7, unit_id: Unit_id.M3, size_id: Size_id.NORMAL };
  const row = (discount: number, productId?: number, category = Category.A) => ({
    unit: Unit_id.M3,
    category,
    size: Size_id.NORMAL,
    price: 1000,
    discount,
    ...(productId ? { productId } : {}),
  });

  it('is 0 without a matching row', () => {
    expect(rowAdjustment([], product, Category.A)).toBe(0);
    expect(rowAdjustment([row(-50, undefined, Category.B)], product, Category.A)).toBe(0);
  });

  it('takes the general row of the unit and size', () => {
    expect(rowAdjustment([row(-50)], product, Category.A)).toBe(-50);
  });

  it("prefers the product's own row over the general one, whatever the order", () => {
    expect(rowAdjustment([row(-50), row(-80, 7)], product, Category.A)).toBe(-80);
  });

  it("ignores another product's row", () => {
    expect(rowAdjustment([row(-80, 8)], product, Category.A)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Volume (SPEC 10.5): one rule for cart, order details and PDF
// ---------------------------------------------------------------------------

describe('pieceVolumeM3 / lineVolumeM3', () => {
  const board = makeProduct({ unit_id: Unit_id.M3, width: 10, thickness: 2.5, length: 400 });

  it('one piece: width × thickness × length / 1,000,000', () => {
    expect(pieceVolumeM3(board)).toBeCloseTo(0.01, 10);
  });

  it('a bundle is 10 boards', () => {
    expect(pieceVolumeM3({ ...board, unit_id: Unit_id.BOUNDLE })).toBeCloseTo(0.1, 10);
    expect(lineVolumeM3({ ...board, unit_id: Unit_id.BOUNDLE }, 3)).toBeCloseTo(0.3, 10);
  });

  it('does not round a line (only totals are rounded)', () => {
    const odd = makeProduct({ unit_id: Unit_id.M3, width: 9.7, thickness: 2.4, length: 301 });
    // 9.7 × 2.4 × 301 / 1e6 × 7 = 0.04905096
    expect(lineVolumeM3(odd, 7)).toBeCloseTo(0.04905096, 10);
  });

  it('roundM3 rounds to litres', () => {
    expect(roundM3(0.04905096)).toBe(0.049);
    expect(roundM3(0.0126)).toBe(0.013);
  });

  it('a product without a width counts its quantity (already m³)', () => {
    expect(lineVolumeM3(makeProduct({ width: 0 }), 1.25)).toBe(1.25);
  });

  it('calculateM3Quantity is pieces × piece volume', () => {
    expect(util.calculateM3Quantity(board, 50)).toBeCloseTo(0.5, 10);
  });
});

describe('countsInVolumeTotal', () => {
  it('counts M3 and bundles, not M2 or BUC', () => {
    expect(countsInVolumeTotal(Unit_id.M3)).toBe(true);
    expect(countsInVolumeTotal(Unit_id.BOUNDLE)).toBe(true);
    expect(countsInVolumeTotal(Unit_id.M2)).toBe(false);
    expect(countsInVolumeTotal(Unit_id.BUC)).toBe(false);
  });
});

describe('calculateTotalQuantity (cart m³)', () => {
  const line = (product: Product, quantity: number) =>
    ({ product, quantity, price: 0, category: Category.A }) as ProductItem;

  it('sums the m³ of M3 and bundle lines and leaves out M2 and BUC', () => {
    const items = [
      line(makeProduct({ unit_id: Unit_id.M3, width: 10, thickness: 2.5, length: 400 }), 50), // 0.5
      line(makeProduct({ unit_id: Unit_id.BOUNDLE, width: 10, thickness: 2.5, length: 400 }), 2), // 0.2
      line(makeProduct({ unit_id: Unit_id.M3, width: 0 }), 1.3), // 1.3
      line(makeProduct({ unit_id: Unit_id.M2, width: 10, thickness: 2, length: 100 }), 20),
      line(makeProduct({ unit_id: Unit_id.BUC, width: 10, thickness: 2, length: 100 }), 20),
    ];
    expect(util.calculateTotalQuantity(items)).toBeCloseTo(2.0, 10);
  });

  it('is 0 for an empty cart', () => {
    expect(util.calculateTotalQuantity([])).toBe(0);
  });

  it('does not round small lines away: 10 laths of 0.0004 m³ = 0.004 m³', () => {
    const lath = makeProduct({ unit_id: Unit_id.M3, width: 2, thickness: 2, length: 100 });
    const items = Array.from({ length: 10 }, () => line(lath, 1));
    expect(util.calculateTotalQuantity(items)).toBe(0.004);
  });
});

describe('calculatePrice — M2 NET and PAC modes', () => {
  const tile = makeProduct({ unit_id: Unit_id.M2, m2_brut: 0.8, m2_util: 0.7, piece_per_pack: 5 });

  it('NET: pieces from usable m², charged by gross m²', () => {
    // ceil(3 / 0.7) = 5 pieces = 1 pack; 5 × 0.8 × 50 = 200
    const r = util.calculatePrice(tile, 50, 3, 'NET');
    expect(r.totalPiecesNeeded).toBe(5);
    expect(r.packsNeeded).toBe(1);
    expect(r.extraPiecesNeeded).toBe(0);
    expect(r.price).toBeCloseTo(200, 5);
  });

  it('PAC: whole packs', () => {
    // 2 packs × 5 = 10 pieces; 10 × 0.8 × 50 = 400
    const r = util.calculatePrice(tile, 50, 2, 'PAC');
    expect(r.totalPiecesNeeded).toBe(10);
    expect(r.packsNeeded).toBe(2);
    expect(r.price).toBeCloseTo(400, 5);
  });

  it('PAC: a fraction of a pack rounds up to whole pieces', () => {
    // 1.5 packs × 5 = 7.5 → 8 pieces = 1 pack + 3
    const r = util.calculatePrice(tile, 50, 1.5, 'PAC');
    expect(r.totalPiecesNeeded).toBe(8);
    expect(r.packsNeeded).toBe(1);
    expect(r.extraPiecesNeeded).toBe(3);
  });
});

describe('M2 helpers', () => {
  const tile = { m2_brut: 0.288, m2_util: 0.27, piece_per_pack: 10 };

  it('m2PacksFromQuantity: packs and loose pieces from the gross m²', () => {
    // 23 pieces × 0.288 = 6.624 m²
    expect(m2PacksFromQuantity(tile, 23 * 0.288)).toEqual({ pieces: 23, packsNeeded: 2, extraPiecesNeeded: 3 });
    expect(m2PacksFromQuantity(tile, 10 * 0.288)).toEqual({ pieces: 10, packsNeeded: 1, extraPiecesNeeded: 0 });
    expect(m2PacksFromQuantity(tile, 0)).toEqual({ pieces: 0, packsNeeded: 0, extraPiecesNeeded: 0 });
  });

  it('m2PacksFromQuantity: no pack size → all loose pieces; no m2_brut → 0', () => {
    expect(m2PacksFromQuantity({ m2_brut: 0.5, piece_per_pack: 0 }, 3)).toEqual({ pieces: 6, packsNeeded: 0, extraPiecesNeeded: 6 });
    expect(m2PacksFromQuantity({ m2_brut: 0, piece_per_pack: 10 }, 3).pieces).toBe(0);
  });

  it('m2NetArea: all pieces × m2_util, also with only packs or only pieces', () => {
    expect(m2NetArea(tile, 2, 3)).toBeCloseTo(23 * 0.27, 10);
    expect(m2NetArea(tile, 2, 0)).toBeCloseTo(20 * 0.27, 10);
    expect(m2NetArea(tile, undefined, 4)).toBeCloseTo(4 * 0.27, 10);
  });

  it('m2BrutQuantity: pieces × m2_brut', () => {
    expect(m2BrutQuantity({ m2_brut: 0.8 }, 12)).toBeCloseTo(9.6, 10);
  });

  it('m2FromM3: m³ / thickness in m', () => {
    expect(m2FromM3(0.5, 2.5)).toBeCloseTo(20, 10);
  });

  it('packsPiecesLabel: the stored "Np + Mb" text', () => {
    expect(packsPiecesLabel(3, 2)).toBe('3p + 2b');
    expect(packsPiecesLabel(0, 4)).toBe('0p + 4b');
    expect(packsPiecesLabel(undefined, 4)).toBe('0p + 4b');
    expect(packsPiecesLabel(2, 0)).toBe('2p');
    expect(packsPiecesLabel(0, 0)).toBe('');
    expect(packsPiecesLabel(undefined, undefined)).toBe('');
  });
});
