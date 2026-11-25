import { OrderItemsResponse } from '@core/models/models';
import { countsInVolumeTotal, lineVolumeM3, roundM3 } from '@shared/utils/product.util';

/** What the totals need to know about a line item. */
export type OrderItemForTotals = Pick<
  OrderItemsResponse,
  'price' | 'quantity' | 'packsPieces'
> & {
  product: Pick<
    OrderItemsResponse['product'],
    'unit_id' | 'width' | 'thickness' | 'length'
  >;
};

export interface OrderTotals {
  totalAmount: number;
  totalAmountFinal: number;
  totalQuantity: number;
}

/**
 * Applies a voucher to an amount: "15%" takes 15 percent off, "200" takes
 * 200 RON off; a leading "-" is ignored. Never below 0, rounded to 2 decimals.
 */
export function applyVoucher(amount: number, voucher: string | null | undefined): number {
  const clean = (voucher ?? '').replace('-', '').trim();
  if (!clean) return amount;

  let total = amount;
  if (clean.includes('%')) {
    const percent = parseFloat(clean.replace('%', '')) / 100;
    if (!isNaN(percent)) total -= total * percent;
  } else {
    const value = parseFloat(clean);
    if (!isNaN(value)) total -= value;
  }

  return Math.max(0, Math.round(total * 100) / 100);
}

/**
 * Volume of one line item in m³ (`lineVolumeM3`, SPEC.md §10.5); items with a
 * pack breakdown (M2) count 0.
 */
export function itemVolumeM3(item: OrderItemForTotals): number {
  return item.packsPieces ? 0 : lineVolumeM3(item.product, item.quantity);
}

/**
 * The m³ a line adds to the order total: M2 and BUC items count 0, exactly as
 * in the cart (`calculateTotalQuantity`); others their `itemVolumeM3`. The PDF
 * shows this per line, so its lines add up to its total.
 */
export function countedVolumeM3(item: OrderItemForTotals): number {
  return countsInVolumeTotal(item.product.unit_id) ? itemVolumeM3(item) : 0;
}

/**
 * Order totals for a list of line items and the order's voucher. The m³ total
 * is the sum of `countedVolumeM3`, so an order keeps its m³ when it is edited.
 */
export function orderTotals(
  items: OrderItemForTotals[],
  voucher: string | null | undefined,
): OrderTotals {
  let totalAmount = 0;
  let totalQuantity = 0;

  items.forEach((item) => {
    totalAmount += item.price;
    totalQuantity += countedVolumeM3(item);
  });

  return {
    totalAmount,
    totalAmountFinal: applyVoucher(totalAmount, voucher),
    totalQuantity: roundM3(totalQuantity),
  };
}
