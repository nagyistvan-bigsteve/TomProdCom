export interface OrderSlice {
  readonly currentOrderId: number;
  readonly tableSortType: 'delivery' | 'creation' | 'admin';
  readonly tableFilterType: 'all' | 'open' | 'closed' | 'expectedToday';
  readonly justOffers: boolean;
}

export const initialOrderSlice: OrderSlice = {
  currentOrderId: -1,
  tableSortType: 'delivery',
  tableFilterType: 'open',
  justOffers: false,
};
