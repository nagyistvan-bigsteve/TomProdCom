import { OrderResponse } from '@core/models/models';

export const ORDER_SELECT = `id,
    client_id,
    date_order_placed,
    sort_order,
    expected_delivery,
    date_order_delivered,
    until_delivery_date,
    total_quantity,
    for_first_hour,
    total_amount,
    total_amount_final,
    paid_amount,
    delivery_fee,
    comment,
    voucher,
    operator:operator_id ( id, name ),
    delivery_address,
    deleted_at,
    just_offer
    `;

type Operator = OrderResponse['operator'];

export interface OrderRow {
  id: number;
  client_id: number;
  date_order_placed: Date;
  sort_order: number;
  expected_delivery: Date;
  date_order_delivered: Date;
  until_delivery_date: boolean;
  total_quantity: number;
  for_first_hour: boolean;
  total_amount: number;
  total_amount_final: number;
  paid_amount: number;
  delivery_fee: number;
  comment: string;
  voucher: string;
  operator: Operator | Operator[] | null;
  delivery_address: string;
  deleted_at: Date | null;
  just_offer: boolean | null;
}

export function mapOrderRow(order: OrderRow): OrderResponse {
  return {
    id: order.id,
    sortOrder: order.sort_order,
    clientId: order.client_id,
    operator: Array.isArray(order.operator)
      ? order.operator[0]
      : order.operator || ({ id: 0, name: '' } as unknown as Operator),
    dateOrderPlaced: order.date_order_placed,
    untilDeliveryDate: order.until_delivery_date,
    forFirstHour: order.for_first_hour,
    expectedDelivery: order.expected_delivery,
    dateOrderDelivered: order.date_order_delivered,
    totalAmount: order.total_amount,
    totalAmountFinal: order.total_amount_final,
    totalQuantity: order.total_quantity,
    paidAmount: order.paid_amount,
    deliveryFee: order.delivery_fee,
    comment: order.comment,
    voucher: order.voucher,
    delivery_address: order.delivery_address,
    justOffer: order.just_offer === true,
    ...(order.deleted_at ? { deletedAt: order.deleted_at } : {}),
  };
}
