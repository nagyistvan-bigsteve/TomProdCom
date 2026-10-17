import { Injectable } from '@angular/core';
import type { M2Quantities, Price2, Product, ProductItems } from '@core/models/models';
import { Category, Unit_id } from '@core/models/enums';

/** Price rule amounts (SPEC 10.3), in RON. */
export const B_BOARD_DISCOUNT = 50;
export const B_DISCOUNT_THICKNESS = 2.5;
export const TVA_M3_DISCOUNT = 100;
export const TVA_BUNDLE_DISCOUNT = 5;

/** Applies the Category B board discount: −50 RON/m³ when unit=M3, category=B, thickness=2.5 cm. */
export function applyBDiscount(
  unitPrice: number,
  unitId: Unit_id,
  categoryId: Category,
  thickness: number,
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
      if (!product.width) {
        calculatedPrice = price * +quantity;
      } else {
        calculatedPrice =
          ((product.width * product.length * product.thickness) / 1000000) *
          price *
          +quantity;
      }
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
    const piecesPerPack = product.piece_per_pack;
    const m2BrutPerPiece = product.m2_brut;

    let totalPiecesNeeded = 0;
    let packsNeeded = 0;

    switch (mode) {
      case 'BRUT':
        totalPiecesNeeded = Math.ceil(quantity / m2BrutPerPiece);
        break;

      case 'NET':
        totalPiecesNeeded = Math.ceil(quantity / product.m2_util);
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
    const { unit_id, width, thickness, length } = product;

    const volumeM3 = (width * thickness * length) / 1_000_000;
    const multiplier = unit_id === Unit_id.BOUNDLE ? 10 : 1;

    return buc * volumeM3 * multiplier;
  }

  calculateTotalQuantity(products: ProductItems): number {
    let totalOrderQuantity = 0;

    products.forEach((item) => {
      const { unit_id, width, thickness, length } = item.product;

      if (unit_id !== Unit_id.M2 && unit_id !== Unit_id.BUC) {
        const volumeM3 = width ? (width * thickness * length) / 1_000_000 : 1;
        const multiplier = unit_id === Unit_id.BOUNDLE ? 10 : 1;

        totalOrderQuantity += item.quantity * volumeM3 * multiplier;
      }
    });

    return totalOrderQuantity;
  }
}
