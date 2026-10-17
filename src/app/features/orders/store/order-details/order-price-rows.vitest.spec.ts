import { describe, it, expect } from 'vitest';
import { Category, Size_id, Unit_id } from '@core/models/enums';
import { OrderItemsResponse, Price2, Product } from '@core/models/models';
import { ProductUtil } from '@shared/utils/product.util';
import {
  buildOrderPriceRows,
  LinePriceFn,
  PricingContext,
  repriceItems,
  unitPriceFromLine,
} from './order-price-rows';

const util = new ProductUtil();
const linePrice: LinePriceFn = (product, unitPrice, quantity) =>
  util.calculatePrice(product, unitPrice, quantity).price;

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 1,
    name: '2.5x15x400',
    unit_id: Unit_id.M3,
    size_id: Size_id.NORMAL,
    thickness: 2.5,
    width: 15,
    length: 400,
    m2_util: 0,
    m2_brut: 0,
    piece_per_pack: 0,
    ...overrides,
  };
}

function makePrice(overrides: Partial<Price2> = {}): Price2 {
  return {
    id: 1,
    unit_id: Unit_id.M3,
    category_id: Category.A,
    size_id: Size_id.NORMAL,
    price: 1500,
    product_id: null as unknown as number,
    ...overrides,
  };
}

/** A saved line priced at `unitPrice` per m³ (or per unit). */
function makeItem(
  id: number,
  product: Product,
  category: keyof typeof Category,
  quantity: number,
  unitPrice: number,
): OrderItemsResponse {
  return {
    id,
    product: {
      id: product.id,
      name: product.name,
      unit_id: product.unit_id,
      thickness: product.thickness,
      width: product.width,
      length: product.length,
    },
    orderId: 7,
    quantity,
    category: { name: category },
    price: linePrice(product, unitPrice, quantity),
    itemStatus: false,
  };
}

const board = makeProduct({ id: 1, name: '2.5x15x400', thickness: 2.5 });
const board2 = makeProduct({ id: 2, name: '5x15x400', thickness: 5 });
const beam = makeProduct({ id: 3, name: '10x10x400', thickness: 10, width: 10 });
const loose = makeProduct({ id: 4, name: 'loose m3', width: 0 });
const deck = makeProduct({ id: 5, name: 'deck', unit_id: Unit_id.M2 });
const productsMap = Object.fromEntries(
  [board, board2, beam, loose, deck].map((p) => [p.id, p]),
);

const prices: Price2[] = [
  makePrice({ id: 1, category_id: Category.A, price: 1500 }),
  makePrice({ id: 2, category_id: Category.B, price: 1200 }),
];

const ctx = (list: Price2[], isTva = false): PricingContext => ({
  productsMap,
  prices: list,
  isTva,
});

describe('unitPriceFromLine', () => {
  it('gives the price per m³ for an M3 board with a width', () => {
    const item = makeItem(1, board, 'A', 10, 1400);
    expect(unitPriceFromLine(item)).toBeCloseTo(1400, 6);
  });

  it('gives the price per unit of quantity without a width', () => {
    const item = makeItem(1, loose, 'A', 2.5, 1300);
    expect(unitPriceFromLine(item)).toBeCloseTo(1300, 6);
  });

  it('is 0 for a zero quantity', () => {
    expect(unitPriceFromLine({ ...makeItem(1, board, 'A', 1, 1400), quantity: 0 })).toBe(0);
  });
});

describe('buildOrderPriceRows', () => {
  it('groups lines by unit, category and size', () => {
    const items = [
      makeItem(1, board, 'A', 10, 1500),
      makeItem(2, board2, 'A', 5, 1500),
      makeItem(3, beam, 'B', 3, 1200),
    ];

    const rows = buildOrderPriceRows(items, ctx(prices, false), false);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ category: Category.A, price: 1500, mixed: false });
    expect(rows[0].discount).toBeCloseTo(0, 6);
    expect(rows[1]).toMatchObject({ category: Category.B, price: 1200 });
  });

  it('shows the current unit price as the final price', () => {
    const rows = buildOrderPriceRows([makeItem(1, board, 'A', 10, 1400)], ctx(prices, false), false);
    expect(rows[0].price + rows[0].discount).toBeCloseTo(1400, 6);
  });

  it('takes the TVA reverse charge off the base price', () => {
    const rows = buildOrderPriceRows([makeItem(1, board, 'A', 10, 1400)], ctx(prices, true), false);
    expect(rows[0].price).toBe(1400);
    expect(rows[0].discount).toBeCloseTo(0, 6);
  });

  it('marks a group whose lines have different unit prices as mixed', () => {
    const rows = buildOrderPriceRows([makeItem(1, board, 'A', 10, 1400), makeItem(2, board2, 'A', 5, 1500)], ctx(prices, false), false);
    expect(rows[0].mixed).toBe(true);
    expect(rows[0].discount).toBe(0);
  });

  it('leaves out M2 lines', () => {
    const rows = buildOrderPriceRows([makeItem(1, deck, 'A', 10, 80)], ctx(prices, false), false);
    expect(rows).toEqual([]);
  });

  it('gives each product its own row when per product is on', () => {
    const rows = buildOrderPriceRows([makeItem(1, board, 'B', 10, 1150), makeItem(2, board2, 'B', 5, 1200)], ctx(prices, false), true);
    expect(rows.map((r) => r.productId)).toEqual([1, 2]);
    // Product rows apply the 2.5 cm category B adjustment to the base price
    expect(rows[0].price).toBe(1150);
    expect(rows[1].price).toBe(1200);
  });

  it('gives a product with its own list price its own row', () => {
    const ownPrice = makePrice({ id: 9, category_id: Category.A, price: 1700, product_id: 3 });
    const rows = buildOrderPriceRows([makeItem(1, board, 'A', 10, 1500), makeItem(2, beam, 'A', 3, 1700)], ctx([...prices, ownPrice], false), false);
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.productId === 3)?.price).toBe(1700);
    expect(rows.find((r) => !r.productId)?.price).toBe(1500);
  });
});

describe('2.5 cm category B boards in a general row', () => {
  // List price B: 1200; a 2.5 cm board is charged 50 less
  const items = [makeItem(1, board, 'B', 10, 1150), makeItem(2, board2, 'B', 5, 1200)];

  it('are not an adjustment and do not make the row mixed', () => {
    const rows = buildOrderPriceRows(items, ctx(prices), false);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ price: 1200, discount: 0, mixed: false });
  });

  it('keep their 50 less when the row is re-priced', () => {
    const rows = buildOrderPriceRows(items, ctx(prices), false);
    rows[0] = { ...rows[0], discount: 1100 - rows[0].price };

    const changes = repriceItems(items, rows, [0], ctx(prices), linePrice);

    // 10 × 0.015 m³ × 1050 and 5 × 0.03 m³ × 1100
    expect(changes.find((c) => c.id === 1)?.price).toBeCloseTo(157.5, 6);
    expect(changes.find((c) => c.id === 2)?.price).toBeCloseTo(165, 6);
  });

  it('show the common adjustment after a re-price', () => {
    const repriced = [makeItem(1, board, 'B', 10, 1050), makeItem(2, board2, 'B', 5, 1100)];
    const rows = buildOrderPriceRows(repriced, ctx(prices), false);
    expect(rows[0]).toMatchObject({ price: 1200, mixed: false });
    expect(rows[0].discount).toBeCloseTo(-100, 6);
  });
});

describe('repriceItems', () => {
  it('reprices every line of a changed general row', () => {
    const items = [
      makeItem(1, board, 'A', 10, 1500),
      makeItem(2, loose, 'A', 2, 1500),
      makeItem(3, beam, 'B', 3, 1200),
    ];
    const rows = buildOrderPriceRows(items, ctx(prices, false), false);
    const a = rows.findIndex((r) => r.category === Category.A);
    rows[a] = { ...rows[a], discount: 1400 - rows[a].price };

    const changes = repriceItems(items, rows, [a], ctx(prices), linePrice);

    expect(changes).toHaveLength(2);
    // 10 boards × 0.015 m³ × 1400
    expect(changes.find((c) => c.id === 1)?.price).toBeCloseTo(210, 6);
    // no width: quantity × price
    expect(changes.find((c) => c.id === 2)?.price).toBeCloseTo(2800, 6);
  });

  it('lets a product row win over the general row', () => {
    const ownPrice = makePrice({ id: 9, category_id: Category.A, price: 1700, product_id: 3 });
    const items = [makeItem(1, board, 'A', 10, 1500), makeItem(2, beam, 'A', 3, 1700)];
    const rows = buildOrderPriceRows(items, ctx([...prices, ownPrice], false), false);
    const general = rows.findIndex((r) => !r.productId);
    rows[general] = { ...rows[general], discount: -100 };

    const changes = repriceItems(items, rows, [general], ctx([...prices, ownPrice]), linePrice);

    expect(changes.map((c) => c.id)).toEqual([1]);
  });

  it('reprices only the product of a changed product row', () => {
    const items = [makeItem(1, board, 'A', 10, 1500), makeItem(2, board2, 'A', 5, 1500)];
    const rows = buildOrderPriceRows(items, ctx(prices, false), true);
    rows[1] = { ...rows[1], discount: -200 };

    const changes = repriceItems(items, rows, [1], ctx(prices), linePrice);

    expect(changes).toHaveLength(1);
    expect(changes[0].id).toBe(2);
    expect(changes[0].price).toBeCloseTo(5 * 0.03 * 1300, 6);
  });

  it('skips rows that are still mixed and lines whose total does not change', () => {
    const items = [makeItem(1, board, 'A', 10, 1400), makeItem(2, board2, 'A', 5, 1500)];
    const rows = buildOrderPriceRows(items, ctx(prices, false), false);

    expect(repriceItems(items, rows, [0], ctx(prices), linePrice)).toEqual([]);

    rows[0] = { ...rows[0], mixed: false, discount: -100 };
    const changes = repriceItems(items, rows, [0], ctx(prices), linePrice);
    expect(changes.map((c) => c.id)).toEqual([2]);
  });
});
