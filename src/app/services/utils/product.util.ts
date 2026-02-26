import { Injectable } from '@angular/core';
import { M2Quantities, Product, ProductItems } from '../../models/models';
import { Unit_id } from '../../models/enums';

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
      calculatedPrice =
        ((product.width * product.length * product.thickness) / 1000000) *
        price *
        +quantity;

      if (!product.width) {
        calculatedPrice = price * +quantity;
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
