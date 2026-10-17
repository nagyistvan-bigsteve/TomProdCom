import { describe, it, expect } from 'vitest';
import type { OrderResponse } from '@core/models/models';
import {
  filterByDateRange,
  filterBySearch,
  filterByStatus,
  moveOrder,
  orderListStats,
  selectVisibleOrders,
  sortOrders,
} from './order.computed';

function makeOrder(overrides: Partial<OrderResponse> = {}): OrderResponse {
  return {
    id: 1,
    sortOrder: 0,
    clientId: 1,
    dateOrderPlaced: new Date(2026, 9, 1, 10),
    expectedDelivery: new Date(2026, 9, 10, 6),
    dateOrderDelivered: null as unknown as Date,
    untilDeliveryDate: false,
    forFirstHour: false,
    totalAmount: 100,
    totalAmountFinal: 100,
    totalQuantity: 1,
    paidAmount: 0,
    deliveryFee: 0,
    comment: '',
    voucher: '',
    operator: { id: 'u1', name: 'Ana' },
    delivery_address: 'Str. Lunga 1',
    ...overrides,
  };
}

const ids = (orders: OrderResponse[]) => orders.map((order) => order.id);
const today = new Date(2026, 9, 13, 12);

describe('filterByStatus', () => {
  const open = makeOrder({ id: 1 });
  const closed = makeOrder({ id: 2, dateOrderDelivered: new Date(2026, 9, 5) });
  const dueToday = makeOrder({ id: 3, expectedDelivery: new Date(2026, 9, 13, 6) });
  const deliveredToday = makeOrder({
    id: 4,
    expectedDelivery: new Date(2026, 9, 13, 6),
    dateOrderDelivered: new Date(2026, 9, 13),
  });
  // Same day of the month and weekday pattern, different month
  const sameDayNextMonth = makeOrder({
    id: 5,
    expectedDelivery: new Date(2026, 10, 13, 6),
  });
  const all = [open, closed, dueToday, deliveredToday, sameDayNextMonth];

  it('"all" keeps everything', () => {
    expect(ids(filterByStatus(all, 'all', today))).toEqual([1, 2, 3, 4, 5]);
  });

  it('"open" keeps orders that are not delivered', () => {
    expect(ids(filterByStatus(all, 'open', today))).toEqual([1, 3, 5]);
  });

  it('"closed" keeps delivered orders', () => {
    expect(ids(filterByStatus(all, 'closed', today))).toEqual([2, 4]);
  });

  it('"expectedToday" needs the exact calendar date and an undelivered order', () => {
    expect(ids(filterByStatus(all, 'expectedToday', today))).toEqual([3]);
  });
});

describe('filterBySearch', () => {
  const names: Record<number, string> = { 1: 'Popescu Ion', 2: 'Kovács Béla' };
  const clientName = (id: number) => names[id];
  const orders = [
    makeOrder({ id: 1, clientId: 1, delivery_address: 'Brasov, Str. Lunga 1' }),
    makeOrder({ id: 2, clientId: 2, delivery_address: 'Sfantu Gheorghe' }),
    makeOrder({ id: 3, clientId: 99, delivery_address: null as unknown as string }),
  ];

  it('returns everything for an empty or blank search', () => {
    expect(filterBySearch(orders, '', clientName)).toBe(orders);
    expect(filterBySearch(orders, '   ', clientName)).toBe(orders);
  });

  it('matches the client name, ignoring case', () => {
    expect(ids(filterBySearch(orders, 'POPESCU', clientName))).toEqual([1]);
  });

  it('matches the delivery address', () => {
    expect(ids(filterBySearch(orders, 'gheorghe', clientName))).toEqual([2]);
  });

  it('copes with an unknown client and a missing address', () => {
    expect(ids(filterBySearch(orders, 'lunga', clientName))).toEqual([1]);
  });
});

describe('filterByDateRange', () => {
  const orders = [
    makeOrder({ id: 1, expectedDelivery: new Date(2026, 9, 9, 6) }),
    makeOrder({ id: 2, expectedDelivery: new Date(2026, 9, 10, 6) }),
    makeOrder({ id: 3, expectedDelivery: new Date(2026, 9, 12, 6) }),
    makeOrder({ id: 4, expectedDelivery: new Date(2026, 9, 13, 6) }),
  ];

  it('is inactive until both ends are chosen', () => {
    expect(filterByDateRange(orders, new Date(2026, 9, 10), null)).toBe(orders);
    expect(filterByDateRange(orders, null, new Date(2026, 9, 10))).toBe(orders);
  });

  it('includes the whole last day and does not change the given dates', () => {
    const start = new Date(2026, 9, 10);
    const end = new Date(2026, 9, 12);

    expect(ids(filterByDateRange(orders, start, end))).toEqual([2, 3]);
    expect(end.getHours()).toBe(0);
  });
});

describe('sortOrders', () => {
  it('sorts by expected delivery, without changing the input', () => {
    const orders = [
      makeOrder({ id: 1, expectedDelivery: new Date(2026, 9, 12) }),
      makeOrder({ id: 2, expectedDelivery: new Date(2026, 9, 10) }),
    ];

    expect(ids(sortOrders(orders, 'delivery'))).toEqual([2, 1]);
    expect(ids(orders)).toEqual([1, 2]);
  });

  it('sorts by creation date', () => {
    const orders = [
      makeOrder({ id: 1, dateOrderPlaced: new Date(2026, 9, 3) }),
      makeOrder({ id: 2, dateOrderPlaced: new Date(2026, 9, 1) }),
    ];

    expect(ids(sortOrders(orders, 'creation'))).toEqual([2, 1]);
  });

  it('sorts by the admin position', () => {
    const orders = [
      makeOrder({ id: 1, sortOrder: 2 }),
      makeOrder({ id: 2, sortOrder: 0 }),
      makeOrder({ id: 3, sortOrder: 1 }),
    ];

    expect(ids(sortOrders(orders, 'admin'))).toEqual([2, 3, 1]);
  });

  it('on the same day puts "first hour" first and "until date" last', () => {
    const sameDay = new Date(2026, 9, 10, 6);
    const orders = [
      makeOrder({ id: 1, expectedDelivery: sameDay, untilDeliveryDate: true }),
      makeOrder({ id: 2, expectedDelivery: sameDay }),
      makeOrder({ id: 3, expectedDelivery: sameDay, forFirstHour: true }),
    ];

    expect(ids(sortOrders(orders, 'delivery'))).toEqual([3, 2, 1]);
  });
});

describe('selectVisibleOrders', () => {
  it('applies status, search and date range together, then sorts', () => {
    const names: Record<number, string> = { 1: 'Popescu', 2: 'Ionescu' };
    const orders = [
      makeOrder({ id: 1, clientId: 1, expectedDelivery: new Date(2026, 9, 12, 6) }),
      makeOrder({ id: 2, clientId: 1, expectedDelivery: new Date(2026, 9, 10, 6) }),
      // delivered: removed by the "open" filter even though it is in range
      makeOrder({
        id: 3,
        clientId: 1,
        expectedDelivery: new Date(2026, 9, 11, 6),
        dateOrderDelivered: new Date(2026, 9, 11),
      }),
      // other client: removed by the search
      makeOrder({ id: 4, clientId: 2, expectedDelivery: new Date(2026, 9, 11, 6) }),
      // out of range
      makeOrder({ id: 5, clientId: 1, expectedDelivery: new Date(2026, 9, 20, 6) }),
    ];

    const visible = selectVisibleOrders(
      orders,
      {
        filter: 'open',
        sort: 'delivery',
        searchText: 'pope',
        dateRangeStart: new Date(2026, 9, 10),
        dateRangeEnd: new Date(2026, 9, 12),
      },
      (id) => names[id],
      today,
    );

    expect(ids(visible)).toEqual([2, 1]);
  });
});

describe('orderListStats', () => {
  it('counts the orders and sums final amount plus delivery fee', () => {
    const stats = orderListStats([
      makeOrder({ totalAmountFinal: 100, deliveryFee: 20 }),
      makeOrder({ totalAmountFinal: 50, deliveryFee: 0 }),
    ]);

    expect(stats).toEqual({ numberOfOrders: 2, totalPrice: 170 });
  });

  it('is zero for an empty list', () => {
    expect(orderListStats([])).toEqual({ numberOfOrders: 0, totalPrice: 0 });
  });
});

describe('moveOrder', () => {
  it('moves one row and leaves the input untouched', () => {
    const orders = [makeOrder({ id: 1 }), makeOrder({ id: 2 }), makeOrder({ id: 3 })];

    expect(ids(moveOrder(orders, 0, 2))).toEqual([2, 3, 1]);
    expect(ids(moveOrder(orders, 2, 0))).toEqual([3, 1, 2]);
    expect(ids(orders)).toEqual([1, 2, 3]);
  });
});
