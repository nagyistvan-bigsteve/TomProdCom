import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withProps, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { tapResponse } from '@ngrx/operators';
import { pipe, switchMap, tap } from 'rxjs';
import {
  ShipmentItem,
  ShipmentStatus,
  ShipmentWithItems,
  StockSorting,
} from '@core/models/models';
import { withBusy } from '@core/store/custom-features/with-busy/with-busy.feature';
import { setBusy, setIdle } from '@core/store/custom-features/with-busy/with-busy.updaters';
import { ProductStore } from '@features/products/store/product.store';
import { SortingsService } from '@features/products/services/sortings.service';
import { NotificationService } from '@shared/utils/notification.service';
import {
  ShipmentHeader,
  ShipmentOverview,
  ShipmentsService,
} from '@features/shipments/services/shipments.service';

type ShipmentState = {
  status: ShipmentStatus;
  shipments: ShipmentOverview[];
  current: ShipmentWithItems | null;
  sortings: StockSorting[];
};

const initialState: ShipmentState = {
  status: 'draft',
  shipments: [],
  current: null,
  sortings: [],
};

/** Truck deliveries: list, one opened shipment and the sortings recorded against it. */
export const ShipmentStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withBusy(),
  withProps(() => ({
    _service: inject(ShipmentsService),
    _sortings: inject(SortingsService),
    _productStore: inject(ProductStore),
    _notify: inject(NotificationService),
  })),
  withMethods((store) => ({
    loadList: rxMethod<ShipmentStatus>(
      pipe(
        tap((status) => patchState(store, { status }, setBusy())),
        switchMap((status) =>
          store._service.getShipmentsObs(status).pipe(
            tapResponse({
              next: (shipments) => patchState(store, { shipments }),
              error: (error) => console.error(error),
              finalize: () => patchState(store, setIdle()),
            }),
          ),
        ),
      ),
    ),

    loadShipment: rxMethod<number>(
      pipe(
        tap(() => patchState(store, { current: null, sortings: [] }, setBusy())),
        switchMap((id) =>
          store._service.getShipmentObs(id).pipe(
            tapResponse({
              next: (current) => patchState(store, { current }),
              error: (error) => console.error(error),
              finalize: () => patchState(store, setIdle()),
            }),
          ),
        ),
      ),
    ),

    loadSortings: rxMethod<number>(
      pipe(
        switchMap((id) =>
          store._sortings.getSortingsByShipmentObs(id).pipe(
            tapResponse({
              next: (sortings) => patchState(store, { sortings }),
              error: (error) => console.error(error),
            }),
          ),
        ),
      ),
    ),

    clearCurrent(): void {
      patchState(store, { current: null, sortings: [] });
    },
  })),
  withMethods((store) => ({
    /** Saves the draft; returns its id, or null on failure (input stays in the form). */
    async save(
      header: ShipmentHeader,
      items: Pick<ShipmentItem, 'product_id' | 'quantity'>[],
    ): Promise<number | null> {
      patchState(store, setBusy());
      try {
        const id = await store._service.saveShipment(header, items);
        if (id !== null) store._notify.success('SHIPMENTS.SAVED');
        return id;
      } finally {
        patchState(store, setIdle());
      }
    },

    /** Validates the draft: its pieces enter AB stock. */
    async validate(id: number): Promise<boolean> {
      patchState(store, setBusy());
      try {
        const ok = await store._service.validateShipment(id);
        if (ok) {
          store._productStore.fetchStocks();
          store._notify.success('SHIPMENTS.VALIDATED');
          store.loadShipment(id);
        }
        return ok;
      } finally {
        patchState(store, setIdle());
      }
    },

    async remove(id: number): Promise<boolean> {
      patchState(store, setBusy());
      try {
        const ok = await store._service.deleteShipment(id);
        if (ok) store._notify.success('SHIPMENTS.DELETED');
        return ok;
      } finally {
        patchState(store, setIdle());
      }
    },

    /** Undoes a sorting of this shipment: its pieces go back into AB. */
    async undoSorting(sortingId: number, shipmentId: number): Promise<boolean> {
      patchState(store, setBusy());
      try {
        const ok = await store._sortings.deleteSorting(sortingId);
        if (ok) {
          store._productStore.fetchStocks();
          store.loadSortings(shipmentId);
          store._notify.success('SORTING.UNDONE');
        }
        return ok;
      } finally {
        patchState(store, setIdle());
      }
    },
  })),
);
