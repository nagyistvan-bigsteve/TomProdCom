import { describe, it, expect } from 'vitest';
import { Category, Size_id, Unit_id } from '@core/models/enums';
import type { Price2, Product, ProductItem, ProductItems } from '@core/models/models';
import {
  applyBDiscount,
  applyTvaDiscount,
  calculateActualPrice,
  ProductUtil,
} from './product.util';

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
  it('does NOT apply −50 when every 2.5 cm cart item already has a dedicated row in expandedPrices', () => {
    const genericRow = makePrice2({ product_id: null as any, price: 1300 });
    // Both 2.5 cm items have their own product-specific rows
    const expandedPrices: Price2[] = [
      makePrice2({ product_id: 10, price: 1200 }),
      makePrice2({ product_id: 20, price: 1200 }),
    ];
    const cartItems: ProductItem[] = [
      makeCartItem(10, 2.5),
      makeCartItem(20, 2.5),
    ];
    // PJ+TVA: 1300 − 0 (no B discount for generic) − 100 (TVA) = 1200
    expect(calculateActualPrice(genericRow, true, expandedPrices, cartItems)).toBe(1200);
  });

  it('applies −50 when at least one 2.5 cm cart item has no dedicated row', () => {
    const genericRow = makePrice2({ product_id: null as any, price: 1300 });
    // Only product 10 has a dedicated row; product 99 uses the generic row
    const expandedPrices: Price2[] = [makePrice2({ product_id: 10, price: 1200 })];
    const cartItems: ProductItem[] = [
      makeCartItem(10, 2.5),
      makeCartItem(99, 2.5), // uses generic row
    ];
    // PJ+TVA: 1300 − 50 − 100 = 1150
    expect(calculateActualPrice(genericRow, true, expandedPrices, cartItems)).toBe(1150);
  });

  it('does NOT apply −50 when all M3 B cart items have thickness != 2.5', () => {
    const genericRow = makePrice2({ product_id: null as any, price: 1300 });
    const cartItems: ProductItem[] = [makeCartItem(99, 5)]; // 5 cm board
    // PJ+TVA: 1300 − 0 (no B discount, wrong thickness) − 100 = 1200
    expect(calculateActualPrice(genericRow, true, [], cartItems)).toBe(1200);
  });

  it('returns base price without TVA for PF client', () => {
    const genericRow = makePrice2({ product_id: null as any, price: 1300 });
    const cartItems: ProductItem[] = [makeCartItem(99, 5)];
    expect(calculateActualPrice(genericRow, false, [], cartItems)).toBe(1300);
  });
});

describe('calculateActualPrice — product-specific row (product_id set)', () => {
  it('applies −50 for the matching product when thickness is 2.5', () => {
    const specificRow = makePrice2({ product_id: 242, price: 1200 });
    const cartItems: ProductItem[] = [makeCartItem(242, 2.5, false)]; // nedimensionat
    // PJ+TVA: 1200 − 50 − 100 = 1050
    expect(calculateActualPrice(specificRow, true, [specificRow], cartItems)).toBe(1050);
  });

  it('PF client: only B discount, no TVA', () => {
    const specificRow = makePrice2({ product_id: 242, price: 1200 });
    const cartItems: ProductItem[] = [makeCartItem(242, 2.5, false)];
    // PF: 1200 − 50 = 1150
    expect(calculateActualPrice(specificRow, false, [specificRow], cartItems)).toBe(1150);
  });

  it('does NOT apply −50 for a product with thickness != 2.5', () => {
    const specificRow = makePrice2({ product_id: 77, price: 2100 });
    const cartItems: ProductItem[] = [makeCartItem(77, 5, true)]; // 5 cm board
    // PJ+TVA: 2100 − 0 (thickness != 2.5) − 100 = 2000
    expect(calculateActualPrice(specificRow, true, [specificRow], cartItems)).toBe(2000);
  });

  it('does NOT apply −50 when no cart items match the product_id', () => {
    const specificRow = makePrice2({ product_id: 999, price: 1200 });
    const cartItems: ProductItem[] = [makeCartItem(1, 2.5)]; // different product
    // PJ+TVA: 1200 − 0 (no matching item) − 100 = 1100
    expect(calculateActualPrice(specificRow, true, [specificRow], cartItems)).toBe(1100);
  });
});
