import { Injectable } from '@angular/core';
import type {
  M2Quantities,
  Price2,
  Product,
  ProductItems,
  UsedPricesInOrder,
} from '@core/models/models';
import { Category, Unit_id } from '@core/models/enums';

/** Price rule amounts (SPEC 10.3), in RON. */
export const B_BOARD_DISCOUNT = 50;
export const B_DISCOUNT_THICKNESS = 2.5;
export const TVA_M3_DISCOUNT = 100;
export const TVA_BUNDLE_DISCOUNT = 5;

/**
 * The price rows a product is priced from (SPEC 10.1): its own rows when it
 * has any (`product_id` = the product, of its unit), otherwise the general
 * rows of its unit and size. A product with own rows never falls back to the
 * general ones; own rows of another unit (left from a unit change) do not count.
 * The one place that decides this; every price lookup goes through it.
 */
export function priceRowsForProduct(
  product: Pick<Product, 'id' | 'unit_id' | 'size_id'>,
  prices: readonly Price2[],
): Price2[] {
  const hasOwnRows = prices.some((p) => p.product_id === product.id && p.unit_id === product.unit_id);
  return hasOwnRows
    ? prices.filter((p) => p.product_id === product.id && p.unit_id === product.unit_id)
    : prices.filter(
        (p) =>
          !p.product_id && p.unit_id === product.unit_id && p.size_id === product.size_id,
      );
}

/** The price row of a product in one grade (SPEC 10.1), undefined when it has none. */
export function findBasePrice(
  product: Pick<Product, 'id' | 'unit_id' | 'size_id'>,
  category: Category,
  prices: readonly Price2[],
): Price2 | undefined {
  return priceRowsForProduct(product, prices).find((p) => p.category_id === category);
}

/**
 * The manual adjustment (offer overview "final price") the price rows hold
 * for a product in a grade: the product's own row first, then the row of its
 * unit and size; 0 when none.
 */
export function rowAdjustment(
  rows: UsedPricesInOrder,
  product: Pick<Product, 'id' | 'unit_id' | 'size_id'>,
  category: Category,
): number {
  const matching = rows.filter(
    (r) => r.category === category && r.unit === product.unit_id && r.size === product.size_id,
  );
  const row =
    matching.find((r) => r.productId === product.id) ?? matching.find((r) => !r.productId);
  return row?.discount ?? 0;
}

/** The grades in the order the cart's grade button steps through them. */
export const CATEGORY_CYCLE: readonly Category[] = [
  Category.A,
  Category.AB,
  Category.B,
  Category.T,
];

/** The grade after `category` in `CATEGORY_CYCLE`, back to A after T. */
export function nextCategory(category: Category): Category {
  const index = CATEGORY_CYCLE.indexOf(category);
  return CATEGORY_CYCLE[(index + 1) % CATEGORY_CYCLE.length];
}

/**
 * The first grade, from `start` on and stepping like the grade button, that
 * has a price; null when no grade has one. Each grade is tried once, so a
 * product without any price cannot loop forever.
 */
export function firstPricedCategory(
  start: Category,
  hasPrice: (category: Category) => boolean,
): Category | null {
  let category = start;
  for (let tried = 0; tried < CATEGORY_CYCLE.length; tried++) {
    if (hasPrice(category)) return category;
    category = nextCategory(category);
  }
  return null;
}

/** Applies the Category B board discount: −50 RON/m³ when unit=M3, category=B, thickness=2.5 cm. */
export function applyBDiscount(
  unitPrice: number,
  unitId: Unit_id,
  categoryId: Category,
  thickness: number | null,
): number {
  if (
    unitId === Unit_id.M3 &&
    categoryId === Category.B &&
    thickness === B_DISCOUNT_THICKNESS
  ) {
    return unitPrice - B_BOARD_DISCOUNT;
  }
  return unitPrice;
}

/**
 * Unit price of an item when a final price is typed for its price row. A
 * general row keeps the 2.5 cm category B board discount (the board costs
 * typed − 50); a product row's price already includes it
 * (calculateActualPrice), so it is taken as is.
 */
export function unitPriceForTypedRow(
  finalPrice: number,
  isProductRow: boolean,
  product: Pick<Product, 'unit_id' | 'thickness'>,
  category: Category,
): number {
  if (isProductRow) return finalPrice;
  return applyBDiscount(finalPrice, product.unit_id, category, product.thickness);
}

/** Applies the TVA reverse-charge discount: −100 RON/m³ for M3, −5 RON/bundle for BUNDLE. */
export function applyTvaDiscount(
  unitPrice: number,
  unitId: Unit_id,
  isTva: boolean,
): number {
  if (!isTva) return unitPrice;
  if (unitId === Unit_id.M3) return unitPrice - TVA_M3_DISCOUNT;
  if (unitId === Unit_id.BOUNDLE) return unitPrice - TVA_BUNDLE_DISCOUNT;
  return unitPrice;
}

/**
 * The unit price a product is charged from its list price, before any manual
 * adjustment (SPEC 10.3): Category B board discount, then TVA discount.
 */
export function effectiveUnitPrice(
  listPrice: number,
  product: Pick<Product, 'unit_id' | 'thickness'>,
  category: Category,
  isTva: boolean,
): number {
  const price = applyBDiscount(listPrice, product.unit_id, category, product.thickness);
  return applyTvaDiscount(price, product.unit_id, isTva);
}

/**
 * Computes the effective display unit price for a price row in the offer overview panel.
 *
 * The −50 B board discount is applied ONLY for product-specific rows (product_id set)
 * where the named product has thickness 2.5 cm. Generic rows (product_id = null) always
 * show the raw DB price minus TVA — the per-item −50 adjustment is handled automatically
 * by getExactPrice / compareSavedPrice and should not affect the panel display.
 */
export function calculateActualPrice(
  price: Price2,
  isTva: boolean,
  cartItems: ProductItems,
): number {
  let basePrice = price.price;

  const hasEligible25Item =
    price.product_id !== null &&
    cartItems.some(
      (item) =>
        item.category === Category.B &&
        item.product.unit_id === Unit_id.M3 &&
        item.product.thickness === B_DISCOUNT_THICKNESS &&
        price.product_id === item.product.id,
    );

  if (hasEligible25Item) {
    basePrice = applyBDiscount(
      basePrice,
      price.unit_id,
      price.category_id,
      B_DISCOUNT_THICKNESS,
    );
  }

  return applyTvaDiscount(basePrice, price.unit_id, isTva);
}

/** A bundle holds this many boards of its size (volume = 10 × one board). */
export const BOARDS_PER_BUNDLE = 10;

/**
 * Volume of one piece in m³ (`width × thickness × length` in cm / 1,000,000),
 * of one bundle for bundle products. 0 or NaN when a dimension is missing.
 */
export function pieceVolumeM3(
  product: Pick<Product, 'unit_id' | 'width' | 'thickness' | 'length'>,
): number {
  const { unit_id, width, thickness, length } = product;
  const multiplier = unit_id === Unit_id.BOUNDLE ? BOARDS_PER_BUNDLE : 1;
  return ((width! * thickness! * length!) / 1_000_000) * multiplier;
}

/**
 * m³ of `quantity` of a product (SPEC 10.5): pieces × piece volume (a bundle
 * is 10 boards). A product without a width is sold by volume, so its quantity
 * is already m³. Not rounded: a total is rounded once (`roundM3`), so many
 * small lines are not rounded away. The one volume rule for the cart, order
 * details, the saved `total_quantity` and the PDF.
 */
export function lineVolumeM3(
  product: Pick<Product, 'unit_id' | 'width' | 'thickness' | 'length'>,
  quantity: number,
): number {
  return product.width ? pieceVolumeM3(product) * quantity : quantity;
}

/** An m³ total rounded to 3 decimals (litres), as it is saved and shown. */
export function roundM3(volume: number): number {
  return Math.round(volume * 1000) / 1000;
}

/** Whether a unit's lines count in the m³ total: not M2 and not BUC (SPEC 10.5). */
export function countsInVolumeTotal(unitId: Unit_id): boolean {
  return unitId !== Unit_id.M2 && unitId !== Unit_id.BUC;
}

/** m² of an M3 product without a width (a slab): `m³ / thickness in m`; 0 without a thickness. */
export function m2FromM3(quantityM3: number, thicknessCm: number | null): number {
  return thicknessCm ? quantityM3 / (thicknessCm / 100) : 0;
}

/**
 * The pack breakdown of an M2 line worked out from its stored quantity (gross
 * m² = pieces × m2_brut): for lines that come without one (an offer loaded
 * into the cart) and for merged lines, so packs always match the quantity.
 */
export function m2PacksFromQuantity(
  product: Pick<Product, 'm2_brut' | 'piece_per_pack'>,
  quantity: number,
): { pieces: number; packsNeeded: number; extraPiecesNeeded: number } {
  const m2Brut = product.m2_brut!;
  const pieces = m2Brut > 0 ? Math.round(quantity / m2Brut) : 0;
  const perPack = product.piece_per_pack!;
  return perPack > 0
    ? { pieces, packsNeeded: Math.floor(pieces / perPack), extraPiecesNeeded: pieces % perPack }
    : { pieces, packsNeeded: 0, extraPiecesNeeded: pieces };
}

/** Usable m² of an M2 line: all its pieces × m2_util (per piece). */
export function m2NetArea(
  product: Pick<Product, 'm2_util' | 'piece_per_pack'>,
  packs: number | null | undefined,
  extraPieces: number | null | undefined,
): number {
  return ((packs ?? 0) * product.piece_per_pack! + (extraPieces ?? 0)) * product.m2_util!;
}

/** The quantity an M2 line stores: its pieces in gross m² (`pieces × m2_brut`). */
export function m2BrutQuantity(product: Pick<Product, 'm2_brut'>, pieces: number): number {
  return pieces * product.m2_brut!;
}

/** An M2 line's pack breakdown as stored in `packs_pieces`: "3p + 2b", "0p + 4b", "2p"; '' when none. */
export function packsPiecesLabel(
  packs: number | null | undefined,
  extraPieces: number | null | undefined,
): string {
  if (!packs && !extraPieces) return '';
  return `${packs || 0}p` + (extraPieces ? ` + ${extraPieces}b` : '');
}

@Injectable({
  providedIn: 'root',
})
export class ProductUtil {
  calculatePrice(
    product: Product,
    price: number,
    quantity: number,
    m2_quantity?: M2Quantities,
  ): {
    price: number;
    packsNeeded: number;
    extraPiecesNeeded: number;
    totalPiecesNeeded: number;
  } {
    let packsNeeded = 0;
    let extraPiecesNeeded = 0;
    let totalPiecesNeeded = 0;
    let calculatedPrice = 0;

    if (!product || !price)
      return {
        price: 0,
        packsNeeded: 0,
        extraPiecesNeeded: 0,
        totalPiecesNeeded: 0,
      };

    if (
      product.unit_id === Unit_id.BUC ||
      product.unit_id === Unit_id.BOUNDLE
    ) {
      calculatedPrice = +quantity * price;
    }

    if (product.unit_id === Unit_id.M3) {
      calculatedPrice = product.width
        ? pieceVolumeM3(product) * price * +quantity
        : price * +quantity;
    }

    if (product.unit_id === Unit_id.M2) {
      const result = this.calculateM2Price(
        product,
        quantity,
        m2_quantity!,
        price,
      );

      calculatedPrice = result.calculatedPrice;
      packsNeeded = result.packsNeeded;
      extraPiecesNeeded = result.extraPiecesNeeded;
      totalPiecesNeeded = result.totalPiecesNeeded;
    }

    return {
      price: calculatedPrice,
      packsNeeded,
      extraPiecesNeeded,
      totalPiecesNeeded,
    };
  }

  calculateM2Price(
    product: Product,
    quantity: number,
    mode: M2Quantities,
    price: number,
  ) {
    const piecesPerPack = product.piece_per_pack!;
    const m2BrutPerPiece = product.m2_brut!;

    let totalPiecesNeeded = 0;
    let packsNeeded = 0;

    switch (mode) {
      case 'BRUT':
        totalPiecesNeeded = Math.ceil(quantity / m2BrutPerPiece);
        break;

      case 'NET':
        totalPiecesNeeded = Math.ceil(quantity / product.m2_util!);
        break;

      case 'BUC':
        totalPiecesNeeded = Math.ceil(quantity);
        break;

      case 'PAC':
        totalPiecesNeeded = Math.ceil(quantity * piecesPerPack);
        break;
    }

    packsNeeded ||= Math.floor(totalPiecesNeeded / piecesPerPack);
    const extraPiecesNeeded = totalPiecesNeeded % piecesPerPack;

    const calculatedPrice = totalPiecesNeeded * m2BrutPerPiece * price;

    return {
      totalPiecesNeeded,
      packsNeeded,
      extraPiecesNeeded,
      calculatedPrice,
    };
  }

  calculateM3Quantity(product: Product, buc: number): number {
    return buc * pieceVolumeM3(product);
  }

  /** The cart's m³ total: the same per-line rule as a saved order (`orderTotals`). */
  calculateTotalQuantity(products: ProductItems): number {
    return roundM3(
      products.reduce(
        (sum, item) =>
          countsInVolumeTotal(item.product.unit_id)
            ? sum + lineVolumeM3(item.product, item.quantity)
            : sum,
        0,
      ),
    );
  }
}
