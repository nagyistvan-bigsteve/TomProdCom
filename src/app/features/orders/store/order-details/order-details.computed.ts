import { Unit_id } from '@core/models/enums';
import { OrderItemsResponse } from '@core/models/models';

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
 * Volume of one line item in m³, as order details has always counted it:
 * items with a pack breakdown (M2) count 0, items without a width count their
 * quantity, a bundle is 10 pieces; each item's volume is rounded to 3 decimals.
 */
export function itemVolumeM3(item: OrderItemForTotals): number {
  if (item.packsPieces) return 0;
  if (!item.product.width) return item.quantity;

  const volume =
    ((item.product.width * item.product.thickness * item.product.length) /
      1_000_000) *
    item.quantity;
  const rounded = Math.round(volume * 1000) / 1000;

  return item.product.unit_id === Unit_id.BOUNDLE ? rounded * 10 : rounded;
}

/** Order totals for a list of line items and the order's voucher. */
export function orderTotals(
  items: OrderItemForTotals[],
  voucher: string | null | undefined,
): OrderTotals {
  let totalAmount = 0;
  let totalQuantity = 0;

  items.forEach((item) => {
    totalAmount += item.price;
    totalQuantity += item.product.unit_id !== Unit_id.M2 ? itemVolumeM3(item) : 0;
  });

  return {
    totalAmount,
    totalAmountFinal: applyVoucher(totalAmount, voucher),
    totalQuantity,
  };
}
