import { Category, Size_id, Unit_id } from '@core/models/enums';
import {
  OrderItemsResponse,
  Price2,
  Product,
  UsedPricesInOrder,
} from '@core/models/models';
import { computePricesForProduct } from '@features/products/store/product.computed';
import {
  applyBDiscount,
  applyTvaDiscount,
  effectiveUnitPrice,
} from '@shared/utils/product.util';

/**
 * One row of the price panel: base (list) price plus the adjustment that gives
 * the final unit price. `mixed` marks a row whose lines carry different
 * adjustments, so there is no single final price to show.
 */
export type PriceRow = UsedPricesInOrder[number] & { mixed?: boolean };

/** What pricing an order's lines needs besides the lines themselves. */
export interface PricingContext {
  productsMap: Record<string | number, Product>;
  prices: Price2[];
  isTva: boolean;
}

/** Line total for a product at a unit price (ProductUtil.calculatePrice). */
export type LinePriceFn = (product: Product, unitPrice: number, quantity: number) => number;

const PRICE_TOLERANCE = 0.01;

/**
 * Unit price of a saved line, worked back from its line total: price per m³
 * for an M3 board with a width, otherwise price per unit of quantity.
 */
export function unitPriceFromLine(
  item: Pick<OrderItemsResponse, 'price' | 'quantity'> & {
    product: Pick<OrderItemsResponse['product'], 'unit_id' | 'width' | 'thickness' | 'length'>;
  },
): number {
  if (!item.quantity) return 0;

  if (item.product.unit_id === Unit_id.M3 && item.product.width) {
    const volumePerPiece =
      (item.product.width * item.product.thickness * item.product.length) / 1_000_000;
    return item.price / (item.quantity * volumePerPiece);
  }

  return item.price / item.quantity;
}

function categoryOf(item: OrderItemsResponse): Category {
  return Category[item.category.name as keyof typeof Category];
}

function priceEntryFor(product: Product, category: Category, ctx: PricingContext) {
  return computePricesForProduct(product.id, ctx.productsMap, ctx.prices).find(
    (p) => p.category_id === category,
  );
}

/**
 * The list unit price a line is charged before any manual adjustment
 * (SPEC 10.3: 2.5 cm B board discount, then TVA), or null when the product
 * has no list price in that category.
 */
export function itemListPrice(
  product: Product,
  category: Category,
  ctx: PricingContext,
): number | null {
  const entry = priceEntryFor(product, category, ctx);
  if (!entry) return null;

  return effectiveUnitPrice(entry.price, product, category, ctx.isTva);
}

function sameRow(a: PriceRow, b: PriceRow): boolean {
  return (
    a.unit === b.unit &&
    a.category === b.category &&
    a.size === b.size &&
    (a.productId ?? null) === (b.productId ?? null)
  );
}

/** Whether a line is priced by a row (a general row skips products that have their own row). */
function rowMatchesItem(
  row: PriceRow,
  rows: PriceRow[],
  item: OrderItemsResponse,
  product: Product,
): boolean {
  if (categoryOf(item) !== row.category || product.unit_id !== row.unit) return false;

  if (row.productId) return product.id === row.productId;
  if (product.size_id !== row.size) return false;

  return !rows.some(
    (r) => r.productId === product.id && r.unit === row.unit && r.category === row.category,
  );
}

/**
 * Price rows for the lines of a saved order, the same rows the offer overview
 * shows: one per unit / category / size, or one per product when the product
 * has its own price or `perProduct` is on.
 *
 * The base price is what the overview panel shows: the list price with TVA,
 * and the 2.5 cm B adjustment only on product rows. The adjustment
 * (`discount`) is how far the lines are from their own list price, so 2.5 cm
 * B boards priced from a general row (charged 50 less) are not an
 * adjustment. Lines without a list price are measured against the row's base.
 *
 * M2 lines are left out: their price depends on the pack breakdown and
 * cannot be worked back to one unit price.
 */
export function buildOrderPriceRows(
  items: OrderItemsResponse[],
  ctx: PricingContext,
  perProduct: boolean,
): PriceRow[] {
  const rows: (PriceRow & { offsets: number[] })[] = [];

  items.forEach((item) => {
    const product = ctx.productsMap[item.product.id];
    if (!product || product.unit_id === Unit_id.M2) return;

    const category = categoryOf(item);
    const entry = priceEntryFor(product, category, ctx);
    const ownRow = perProduct || !!entry?.product_id;
    const unitPrice = unitPriceFromLine(item);

    const key: PriceRow = {
      unit: product.unit_id,
      category,
      size: product.size_id ?? Size_id.UNDEFINED,
      productId: ownRow ? product.id : undefined,
      price: 0,
      discount: 0,
    };

    let row = rows.find((r) => sameRow(r, key));
    if (!row) {
      let base = unitPrice;
      if (entry) {
        base = ownRow
          ? applyBDiscount(entry.price, product.unit_id, category, product.thickness)
          : entry.price;
        base = applyTvaDiscount(base, product.unit_id, ctx.isTva);
      }
      row = { ...key, price: base, offsets: [] };
      rows.push(row);
    }

    const listPrice = itemListPrice(product, category, ctx) ?? row.price;
    row.offsets.push(unitPrice - listPrice);
  });

  return rows
    .map(({ offsets, ...row }) => {
      const first = offsets[0];
      const mixed = offsets.some((o) => Math.abs(o - first) > PRICE_TOLERANCE);
      const discount = mixed ? 0 : Math.round(first * 100) / 100;
      return { ...row, discount, mixed };
    })
    .sort((a, b) => a.unit - b.unit);
}

/**
 * New line totals for the lines priced by the given rows. Each matching line
 * gets its own list price plus the row's adjustment (SPEC 10.3: B board
 * discount → TVA → manual adjustment); a line without a list price gets the
 * row's final price. Rows still marked mixed and lines whose total does not
 * change are skipped.
 */
export function repriceItems(
  items: OrderItemsResponse[],
  rows: PriceRow[],
  rowIndexes: Iterable<number>,
  ctx: PricingContext,
  linePrice: LinePriceFn,
): { id: number; price: number }[] {
  const changes = new Map<number, number>();

  for (const index of rowIndexes) {
    const row = rows[index];
    if (!row || row.mixed) continue;

    items.forEach((item) => {
      const product = ctx.productsMap[item.product.id];
      if (!product || !rowMatchesItem(row, rows, item, product)) return;

      const listPrice = itemListPrice(product, row.category, ctx) ?? row.price;
      const price = linePrice(product, listPrice + row.discount, item.quantity);
      if (Math.abs(price - item.price) >= PRICE_TOLERANCE) {
        changes.set(item.id, price);
      }
    });
  }

  return [...changes].map(([id, price]) => ({ id, price }));
}
