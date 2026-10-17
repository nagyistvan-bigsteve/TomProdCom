import { computed, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { tapResponse } from '@ngrx/operators';
import { firstValueFrom, forkJoin, pipe, switchMap, tap } from 'rxjs';
import { OrderItemsResponse, OrderResponse } from '@core/models/models';
import { withBusy } from '@core/store/custom-features/with-busy/with-busy.feature';
import {
  setBusy,
  setIdle,
} from '@core/store/custom-features/with-busy/with-busy.updaters';
import {
  NewOrderItem,
  OrderItemChanges,
  OrdersService,
} from '@features/orders/services/orders.service';
import {
  applyVoucher,
  OrderItemForTotals,
  orderTotals,
  OrderTotals,
} from './order-details.computed';

interface OrderDetailsState {
  order: OrderResponse | null;
  items: OrderItemsResponse[];
}

/**
 * One order or offer with its line items, and every change made from the
 * details screen. Provided by OrderDetailsComponent, so each opened order has
 * its own instance.
 */
export const OrderDetailsStore = signalStore(
  withState<OrderDetailsState>({ order: null, items: [] }),
  withBusy(),
  withProps(() => ({ _ordersService: inject(OrdersService) })),
  withComputed((store) => ({
    isLoaded: computed(() => store.order() !== null),
  })),
  withMethods((store) => {
    const sortById = (items: OrderItemsResponse[]) =>
      [...items].sort((a, b) => a.id - b.id);

    const reloadItems = async (): Promise<void> => {
      const order = store.order();
      if (!order) return;

      const items = await firstValueFrom(
        store._ordersService.getOrderItemsById(order.id),
      );
      patchState(store, { items: sortById(items) });
    };

    const applyTotals = (totals: OrderTotals) => {
      const order = store.order();
      if (order) patchState(store, { order: { ...order, ...totals } });
    };

    // Totals of the current items with one of them replaced or removed
    const totalsAfter = (
      items: OrderItemForTotals[],
    ): OrderTotals => orderTotals(items, store.order()?.voucher);

    return {
      load: rxMethod<number>(
        pipe(
          tap(() => patchState(store, { order: null, items: [] }, setBusy())),
          switchMap((orderId) =>
            forkJoin({
              order: store._ordersService.getOrderById(orderId),
              items: store._ordersService.getOrderItemsById(orderId),
            }).pipe(
              tapResponse({
                next: ({ order, items }) =>
                  patchState(store, { order, items: sortById(items) }),
                // The app-wide API error toast informs the user
                error: (error) => console.error('Error loading the order:', error),
                finalize: () => patchState(store, setIdle()),
              }),
            ),
          ),
        ),
      ),

      /**
       * Adds a line item. `product` is what the totals need to know about it
       * (unit and dimensions).
       */
      async addItem(
        item: NewOrderItem,
        product: OrderItemForTotals['product'],
      ): Promise<boolean> {
        const order = store.order();
        if (!order) return false;

        const totals = totalsAfter([
          ...store.items(),
          {
            price: item.price,
            quantity: item.quantity,
            packsPieces: item.packs_pieces,
            product,
          },
        ]);

        const added = await store._ordersService.addOrderItem(order.id, item, totals);
        if (added) {
          applyTotals(totals);
          await reloadItems();
        }

        return added;
      },

      async updateItem(itemId: number, changes: OrderItemChanges): Promise<boolean> {
        const totals = totalsAfter(
          store.items().map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  quantity: changes.quantity ?? item.quantity,
                  price: changes.price ?? item.price,
                  packsPieces: changes.packs_pieces ?? item.packsPieces,
                }
              : item,
          ),
        );

        const updated = await store._ordersService.updateOrderItem(
          itemId,
          changes,
          totals,
        );
        if (updated) {
          applyTotals(totals);
          await reloadItems();
        }

        return updated;
      },

      async deleteItem(itemId: number): Promise<boolean> {
        const totals = totalsAfter(store.items().filter((item) => item.id !== itemId));

        const deleted = await store._ordersService.deleteOrderItem(itemId, totals);
        if (deleted) {
          applyTotals(totals);
          patchState(store, {
            items: store.items().filter((item) => item.id !== itemId),
          });
        }

        return deleted;
      },

      async setItemStatus(itemId: number, itemStatus: boolean): Promise<boolean> {
        const saved = await store._ordersService.orderItemStatusUpdate(
          itemId,
          itemStatus,
        );
        if (saved) {
          patchState(store, {
            items: store
              .items()
              .map((item) => (item.id === itemId ? { ...item, itemStatus } : item)),
          });
        }

        return saved;
      },

      /** Saves the comment and the voucher; the final amount follows the voucher. */
      async saveCommentAndVoucher(comment: string, voucher: string): Promise<boolean> {
        const order = store.order();
        if (!order) return false;

        const totalAmountFinal = applyVoucher(order.totalAmount ?? 0, voucher);
        const saved = await store._ordersService.updateOrderCommentAndVoucher(
          order.id,
          comment,
          voucher,
          totalAmountFinal,
        );
        if (saved) {
          patchState(store, {
            order: { ...order, comment, voucher, totalAmountFinal },
          });
        }

        return saved;
      },

      async markDelivered(): Promise<boolean> {
        const order = store.order();
        return order ? store._ordersService.orderIsDelivered(order.id) : false;
      },

      async transformToOrder(): Promise<boolean> {
        const order = store.order();
        return order ? store._ordersService.transformOfferToOrder(order.id) : false;
      },

      /** Moves the order or offer to the deleted list (restorable for 10 days). */
      async moveToDeleted(): Promise<boolean> {
        const order = store.order();
        return order ? store._ordersService.setDeletionForOrder(order.id) : false;
      },
    };
  }),
);
