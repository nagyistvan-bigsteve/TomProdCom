import { Category, Unit_id } from '@core/models/enums';
import {
  GradedStock,
  Product,
  ShipmentItem,
  Stock,
  StockCategory,
} from '@core/models/models';
import { ProductUtil, pieceVolumeM3 } from './product.util';

/** Products longer than this (cm) have no A/B split: only AB stock. */
export const MAX_GRADED_LENGTH_CM = 700;

/** Grades in display order. */
export const STOCK_CATEGORIES: readonly StockCategory[] = [
  Category.A,
  Category.B,
  Category.AB,
];

type GradeRuleProduct = Pick<Product, 'unit_id' | 'length'>;

/** Stock of the product is tracked per grade (not M2, at most 7 m). */
export function isGradable(product: GradeRuleProduct): boolean {
  return (
    product.unit_id !== Unit_id.M2 &&
    (product.length ?? 0) <= MAX_GRADED_LENGTH_CM
  );
}

/**
 * The grade an item sold at `category` is booked and deducted from, or `null`
 * when the product's stock is not tracked (M2). Mirrors the SQL function
 * `public.stock_category_for` in supabase/migrations/*_graded_stock.sql:
 * longer than 7 m → AB, T (terrace) → A, otherwise the category itself.
 */
export function stockCategoryFor(
  product: GradeRuleProduct,
  category: Category,
): StockCategory | null {
  if (product.unit_id === Unit_id.M2) return null;
  if ((product.length ?? 0) > MAX_GRADED_LENGTH_CM) return Category.AB;
  if (category === Category.T) return Category.A;
  if (category === Category.A || category === Category.B) return category;
  return Category.AB;
}

/** The grades a product holds stock in, in display order. */
export function stockCategoriesOf(product: GradeRuleProduct): StockCategory[] {
  if (product.unit_id === Unit_id.M2) return [];
  return isGradable(product) ? [...STOCK_CATEGORIES] : [Category.AB];
}

/** Pieces not booked by open orders; negative when more is ordered than held. */
export function availableStock(stock: Pick<Stock, 'stock' | 'booked_stock'> | undefined): number {
  return stock ? stock.stock - stock.booked_stock : 0;
}

/** Groups stock rows by product and grade. */
export function groupStocksByProduct(stocks: Stock[]): Record<number, GradedStock> {
  const result: Record<number, GradedStock> = {};
  for (const stock of stocks) {
    (result[stock.product_id] ??= {})[stock.category_id] = stock;
  }
  return result;
}

/** Sum of all grades of a product. */
export function totalStock(graded: GradedStock | undefined): number {
  if (!graded) return 0;
  return STOCK_CATEGORIES.reduce((sum, c) => sum + (graded[c]?.stock ?? 0), 0);
}

export type SortingInput = { a: number; b: number; waste: number };

export type SortingError =
  | 'EMPTY'
  | 'NEGATIVE'
  | 'NOT_WHOLE'
  | 'MORE_THAN_TRUCK'
  | 'MORE_THAN_AB';

/** Pieces a sorting takes out of AB. */
export function sortingTotal(input: SortingInput): number {
  return (input.a || 0) + (input.b || 0) + (input.waste || 0);
}

/**
 * Why a sorting cannot be saved, or `null` when it can. Same checks as
 * `record_sorting`. `truckRemaining` is given when sorting from a truck: the
 * pieces of the product left on it (received minus already sorted).
 */
export function validateSorting(
  abStock: number,
  input: SortingInput,
  truckRemaining: number | null = null,
): SortingError | null {
  const values = [input.a || 0, input.b || 0, input.waste || 0];
  if (values.some((v) => v < 0)) return 'NEGATIVE';
  if (values.some((v) => !Number.isInteger(v))) return 'NOT_WHOLE';
  const total = sortingTotal(input);
  if (total <= 0) return 'EMPTY';
  if (truckRemaining !== null && total > truckRemaining) return 'MORE_THAN_TRUCK';
  if (total > abStock) return 'MORE_THAN_AB';
  return null;
}

/** Most pieces a sorting may take: the AB stock, and from a truck also what is left on it. */
export function sortingLimit(abStock: number, truckRemaining: number | null = null): number {
  const limit = truckRemaining === null ? abStock : Math.min(abStock, truckRemaining);
  return Math.max(0, limit);
}

/**
 * How many AB pieces already ordered by customers (booked) a sorting of
 * `total` pieces takes away: the part of `total` beyond AB free
 * (stock − booked), at most the booked pieces. Sorting is allowed anyway;
 * the dialog warns.
 */
export function bookedAbShortfall(
  ab: Pick<Stock, 'stock' | 'booked_stock'> | undefined,
  total: number,
): number {
  if (!ab || total <= 0) return 0;
  const free = Math.max(availableStock(ab), 0);
  return Math.min(Math.max(ab.booked_stock, 0), Math.max(0, total - free));
}

/**
 * Stock is a count of pieces (bundles): BUC and bundle products, and M3
 * products with a width. An M3 product without a width is sold by volume
 * (stock in m³) and M2 in m², so both may hold decimals. Mirrors the check in
 * `public.set_stock` (supabase/migrations/*_set_stock_whole_pieces.sql).
 */
export function countsWholePieces(product: Pick<Product, 'unit_id' | 'width'>): boolean {
  if (product.unit_id === Unit_id.BUC || product.unit_id === Unit_id.BOUNDLE) return true;
  return product.unit_id === Unit_id.M3 && product.width != null;
}

/** Products whose stock is shown and summed in m³ (M3 and bundles). */
export function hasVolume(product: Pick<Product, 'unit_id'>): boolean {
  return product.unit_id === Unit_id.M3 || product.unit_id === Unit_id.BOUNDLE;
}

type VolumeProduct = Pick<Product, 'unit_id' | 'width' | 'thickness' | 'length'>;

/**
 * Stock can be typed in m³ and is converted to pieces: M3 and bundle products
 * counted in whole pieces whose dimensions are all known. Stock is still
 * stored in pieces.
 */
export function m3InputAllowed(product: VolumeProduct): boolean {
  if (!hasVolume(product) || !countsWholePieces(product)) return false;
  const volume = pieceVolumeM3(product);
  return Number.isFinite(volume) && volume > 0;
}

/**
 * Whole pieces (bundles) nearest to `m3`, e.g. 4 m³ of 7.5×15×400 (0.045 m³
 * a piece, 88.9 pieces) → 89.
 * NaN when the product cannot be typed in m³ or `m3` is not a number; a
 * negative `m3` gives a negative count, so the usual checks refuse it.
 */
export function piecesFromM3(product: VolumeProduct, m3: number): number {
  if (!m3InputAllowed(product) || !Number.isFinite(m3)) return NaN;
  // + 0 turns a -0 (from a small negative m³) into 0
  return Math.round(m3 / pieceVolumeM3(product)) + 0;
}

/** Typed m³ as a number; a decimal comma (RO/HU keyboards) is accepted. Empty → NaN. */
export function parseM3(text: string): number {
  const value = text.trim().replace(',', '.');
  return value === '' ? NaN : Number(value);
}

/**
 * m³ as the text of an input: at most 3 decimals and a decimal comma, the
 * way RO and HU write it ("6.997" would read as six thousand). `parseM3`
 * reads it back.
 */
export function formatM3Input(m3: number): string {
  return String(+m3.toFixed(3)).replace('.', ',');
}

const productUtil = new ProductUtil();

/**
 * Total volume of shipment lines. Only M3 and bundle products count (as on
 * the products page); lines of unknown products or without dimensions count 0.
 */
export function shipmentTotalM3(
  items: Pick<ShipmentItem, 'product_id' | 'quantity'>[],
  products: Record<number, Product | undefined>,
): number {
  return items.reduce((sum, item) => {
    const product = products[item.product_id];
    if (!product || !hasVolume(product)) return sum;
    if (!product.width || !product.thickness || !product.length) return sum;
    return sum + productUtil.calculateM3Quantity(product, item.quantity || 0);
  }, 0);
}
