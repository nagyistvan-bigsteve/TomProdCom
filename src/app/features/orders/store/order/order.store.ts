import { computed, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  type,
  withComputed,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import {
  entityConfig,
  removeEntity,
  setAllEntities,
  updateEntities,
  updateEntity,
  withEntities,
} from '@ngrx/signals/entities';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { tapResponse } from '@ngrx/operators';
import { pipe, switchMap, tap } from 'rxjs';
import { OrderResponse } from '@core/models/models';
import { withBusy } from '@core/store/custom-features/with-busy/with-busy.feature';
import {
  setBusy,
  setIdle,
} from '@core/store/custom-features/with-busy/with-busy.updaters';
import { ClientStore } from '@features/clients/store/client.store';
import { OrdersService } from '@features/orders/services/orders.service';
import {
  moveOrder,
  orderListStats,
  selectVisibleOrders,
} from './order.computed';
import {
  initialOrderSlice,
  OrderTableFilter,
  OrderTableSort,
} from './order.slice';

const orderConfig = entityConfig({
  entity: type<OrderResponse>(),
  collection: 'orders',
  selectId: (order) => order.id,
});

/**
 * The order / offer list: the loaded rows, the table's filter, sort, search
 * and date range, and the list-level actions (pay, delete, reorder).
 */
export const OrderStore = signalStore(
  { providedIn: 'root' },
  withState(initialOrderSlice),
  withBusy(),
  withEntities(orderConfig),
  withProps(() => ({
    _ordersService: inject(OrdersService),
    _clientStore: inject(ClientStore),
  })),
  withComputed((store) => {
    const visibleOrders = computed(() =>
      selectVisibleOrders(
        store.ordersEntities(),
        {
          filter: store.tableFilterType(),
          sort: store.tableSortType(),
          searchText: store.searchText(),
          dateRangeStart: store.dateRangeStart(),
          dateRangeEnd: store.dateRangeEnd(),
        },
        (clientId) => store._clientStore.clientsEntityMap()[clientId]?.name,
        new Date(),
      ),
    );

    return {
      visibleOrders,
      stats: computed(() => orderListStats(visibleOrders())),
    };
  }),
  withMethods((store) => {
    // `silent` refreshes the rows without the loading state, so the table
    // stays on screen (used after a drag-and-drop)
    const fetch = rxMethod<{ justOffers: boolean; silent: boolean }>(
      pipe(
        tap(({ silent }) => {
          if (!silent) patchState(store, setBusy());
        }),
        switchMap(({ justOffers, silent }) =>
          store._ordersService.getOrders(justOffers).pipe(
            tapResponse({
              next: (orders) =>
                patchState(store, setAllEntities(orders, orderConfig)),
              // The app-wide API error toast informs the user
              error: (error) => console.error('Error fetching orders:', error),
              finalize: () => {
                if (!silent) patchState(store, setIdle());
              },
            }),
          ),
        ),
      ),
    );

    return {
      /** Opens the list for orders or offers with the default filter and sort. */
      init(justOffers: boolean): void {
        patchState(
          store,
          { ...initialOrderSlice, justOffers },
          setAllEntities([] as OrderResponse[], orderConfig),
        );
        fetch({ justOffers, silent: false });
      },

      setFilter(tableFilterType: OrderTableFilter): void {
        patchState(store, { tableFilterType });
      },

      setSort(tableSortType: OrderTableSort): void {
        patchState(store, { tableSortType });
      },

      setSearchText(searchText: string): void {
        patchState(store, { searchText });
      },

      setDateRange(dateRangeStart: Date | null, dateRangeEnd: Date | null): void {
        patchState(store, { dateRangeStart, dateRangeEnd });
      },

      /** Records the new total paid amount of an order. */
      async pay(orderId: number, paidAmount: number): Promise<boolean> {
        const paid = await store._ordersService.orderIsPaid(orderId, paidAmount);

        if (paid) {
          patchState(
            store,
            updateEntity({ id: orderId, changes: { paidAmount } }, orderConfig),
          );
        }

        return paid;
      },

      /**
       * Moves an order or offer to the deleted list (restorable for 10 days,
       * then purged).
       */
      async delete(orderId: number): Promise<boolean> {
        const deleted = await store._ordersService.setDeletionForOrder(orderId);

        if (deleted) {
          patchState(store, removeEntity(orderId, orderConfig));
        }

        return deleted;
      },

      /**
       * Saves the admin order after a row was dragged. Positions are the row
       * indexes of the currently visible list.
       */
      async reorder(previousIndex: number, currentIndex: number): Promise<boolean> {
        const reordered = moveOrder(
          store.visibleOrders(),
          previousIndex,
          currentIndex,
        );
        const position = new Map(reordered.map((order, index) => [order.id, index]));

        // Show the new order right away; the reload below confirms it
        patchState(
          store,
          updateEntities(
            {
              ids: [...position.keys()],
              changes: (order) => ({ sortOrder: position.get(order.id)! }),
            },
            orderConfig,
          ),
        );

        const saved = await store._ordersService.saveAdminSortOrder(reordered);
        fetch({ justOffers: store.justOffers(), silent: true });

        return saved;
      },
    };
  }),
);
