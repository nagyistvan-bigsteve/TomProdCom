import { describe, it, expect } from 'vitest';
import { mapOrderRow, OrderRow } from './order.mapper';

const row: OrderRow = {
  id: 7,
  client_id: 3,
  date_order_placed: new Date('2026-01-10T08:00:00Z'),
  sort_order: 2,
  expected_delivery: new Date('2026-01-13T06:00:00Z'),
  date_order_delivered: null as unknown as Date,
  until_delivery_date: true,
  total_quantity: 1.5,
  for_first_hour: false,
  total_amount: 1000,
  total_amount_final: 900,
  paid_amount: 100,
  delivery_fee: 50,
  comment: 'note',
  voucher: '10%',
  operator: { id: 'u1', name: 'Ana' },
  delivery_address: 'Str. Lunga 1',
  deleted_at: null,
  just_offer: false,
};

describe('mapOrderRow', () => {
  it('maps database columns to the OrderResponse shape', () => {
    expect(mapOrderRow(row)).toEqual({
      id: 7,
      clientId: 3,
      dateOrderPlaced: row.date_order_placed,
      sortOrder: 2,
      expectedDelivery: row.expected_delivery,
      dateOrderDelivered: null,
      untilDeliveryDate: true,
      totalQuantity: 1.5,
      forFirstHour: false,
      totalAmount: 1000,
      totalAmountFinal: 900,
      paidAmount: 100,
      deliveryFee: 50,
      comment: 'note',
      voucher: '10%',
      operator: { id: 'u1', name: 'Ana' },
      delivery_address: 'Str. Lunga 1',
      justOffer: false,
    });
  });

  it('takes the first operator when the join comes back as an array', () => {
    const mapped = mapOrderRow({
      ...row,
      operator: [{ id: 'u2', name: 'Béla' }],
    });

    expect(mapped.operator).toEqual({ id: 'u2', name: 'Béla' });
  });

  it('falls back to an empty operator when the join is missing', () => {
    expect(mapOrderRow({ ...row, operator: null }).operator).toEqual({
      id: 0,
      name: '',
    });
  });

  it('marks offers', () => {
    expect(mapOrderRow({ ...row, just_offer: true }).justOffer).toBe(true);
    expect(mapOrderRow({ ...row, just_offer: null }).justOffer).toBe(false);
  });

  it('exposes deletedAt only for soft-deleted orders', () => {
    const deletedAt = new Date('2026-02-01T00:00:00Z');

    expect(mapOrderRow({ ...row, deleted_at: deletedAt }).deletedAt).toBe(
      deletedAt,
    );
    expect('deletedAt' in mapOrderRow(row)).toBe(false);
  });
});
