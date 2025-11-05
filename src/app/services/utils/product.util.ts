import { Injectable } from '@angular/core';
import { Product } from '../../models/models';
import { Unit_id } from '../../models/enums';

@Injectable({
  providedIn: 'root',
})
export class ProductUtil {
  calculatePrice(
    product: Product,
    price: number,
    quantity: number,
    m2_isBrut?: boolean
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
      let m2_unit = m2_isBrut ? product.m2_brut : product.m2_util;

      totalPiecesNeeded = Math.ceil(
        +quantity / (m2_unit / product.piece_per_pack)
      );

      packsNeeded = Math.floor(totalPiecesNeeded / product.piece_per_pack);

      extraPiecesNeeded = totalPiecesNeeded % product.piece_per_pack;

      calculatedPrice = totalPiecesNeeded * (product.m2_brut / 10) * price;
    }

    return {
      price: calculatedPrice,
      packsNeeded,
      extraPiecesNeeded,
      totalPiecesNeeded,
    };
  }
}
