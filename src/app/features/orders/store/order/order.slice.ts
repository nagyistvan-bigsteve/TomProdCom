export type OrderTableSort = 'delivery' | 'creation' | 'admin';
export type OrderTableFilter = 'all' | 'open' | 'closed' | 'expectedToday';

export interface OrderSlice {
  readonly currentOrderId: number;
  readonly tableSortType: OrderTableSort;
  readonly tableFilterType: OrderTableFilter;
  readonly justOffers: boolean;
  readonly searchText: string;
  readonly dateRangeStart: Date | null;
  readonly dateRangeEnd: Date | null;
}

export const initialOrderSlice: OrderSlice = {
  currentOrderId: -1,
  tableSortType: 'delivery',
  tableFilterType: 'open',
  justOffers: false,
  searchText: '',
  dateRangeStart: null,
  dateRangeEnd: null,
};
