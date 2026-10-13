import { OrderResponse } from '@core/models/models';
import { OrderTableFilter, OrderTableSort } from './order.slice';

export interface OrderListCriteria {
  filter: OrderTableFilter;
  sort: OrderTableSort;
  searchText: string;
  dateRangeStart: Date | null;
  dateRangeEnd: Date | null;
}

export interface OrderListStats {
  numberOfOrders: number;
  totalPrice: number;
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear()
  );
}

export function filterByStatus(
  orders: OrderResponse[],
  filter: OrderTableFilter,
  today: Date,
): OrderResponse[] {
  switch (filter) {
    case 'all':
      return orders;
    case 'open':
      return orders.filter((order) => order.dateOrderDelivered == null);
    case 'closed':
      return orders.filter((order) => order.dateOrderDelivered != null);
    case 'expectedToday':
      return orders.filter(
        (order) =>
          !order.dateOrderDelivered &&
          isSameCalendarDay(new Date(order.expectedDelivery), today),
      );
  }
}

/** Matches the client name or the delivery address, case-insensitively. */
export function filterBySearch(
  orders: OrderResponse[],
  searchText: string,
  clientName: (clientId: number) => string | undefined,
): OrderResponse[] {
  const search = searchText.toLowerCase().trim();
  if (!search) return orders;

  return orders.filter((order) => {
    const name = clientName(order.clientId)?.toLowerCase() ?? '';
    const address = order.delivery_address?.toLowerCase() ?? '';
    return name.includes(search) || address.includes(search);
  });
}

/** Keeps orders whose expected delivery falls within the range (both days included). */
export function filterByDateRange(
  orders: OrderResponse[],
  start: Date | null,
  end: Date | null,
): OrderResponse[] {
  if (!start || !end) return orders;

  const from = start.getTime();
  const endOfDay = new Date(end);
  endOfDay.setHours(23, 59, 59, 999);
  const until = endOfDay.getTime();

  return orders.filter((order) => {
    const expected = new Date(order.expectedDelivery).getTime();
    return expected >= from && expected <= until;
  });
}

/**
 * Sorts by the chosen key; ties go to "first hour" orders first, then to
 * orders without the "until delivery date" flag. Returns a new array.
 */
export function sortOrders(
  orders: OrderResponse[],
  sort: OrderTableSort,
): OrderResponse[] {
  const key = (order: OrderResponse): number => {
    switch (sort) {
      case 'delivery':
        return new Date(order.expectedDelivery).getTime();
      case 'creation':
        return new Date(order.dateOrderPlaced).getTime();
      case 'admin':
        return order.sortOrder;
    }
  };

  return [...orders].sort((a, b) => {
    const keyA = key(a);
    const keyB = key(b);
    if (keyA !== keyB) return keyA - keyB;

    const firstHourDiff = Number(b.forFirstHour) - Number(a.forFirstHour);
    if (firstHourDiff !== 0) return firstHourDiff;

    return Number(a.untilDeliveryDate) - Number(b.untilDeliveryDate);
  });
}

export function selectVisibleOrders(
  orders: OrderResponse[],
  criteria: OrderListCriteria,
  clientName: (clientId: number) => string | undefined,
  today: Date,
): OrderResponse[] {
  const byStatus = filterByStatus(orders, criteria.filter, today);
  const bySearch = filterBySearch(byStatus, criteria.searchText, clientName);
  const byDate = filterByDateRange(
    bySearch,
    criteria.dateRangeStart,
    criteria.dateRangeEnd,
  );

  return sortOrders(byDate, criteria.sort);
}

export function orderListStats(orders: OrderResponse[]): OrderListStats {
  return {
    numberOfOrders: orders.length,
    totalPrice: orders.reduce(
      (sum, order) => sum + order.totalAmountFinal + order.deliveryFee,
      0,
    ),
  };
}

/** The list after moving one row, as the drag-and-drop table reports it. */
export function moveOrder(
  orders: OrderResponse[],
  previousIndex: number,
  currentIndex: number,
): OrderResponse[] {
  const moved = [...orders];
  const [order] = moved.splice(previousIndex, 1);
  if (order) moved.splice(currentIndex, 0, order);
  return moved;
}
