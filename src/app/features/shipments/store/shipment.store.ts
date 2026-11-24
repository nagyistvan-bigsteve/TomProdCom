import { effect, inject, untracked } from '@angular/core';
import {
  patchState,
  signalStore,
  withHooks,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { tapResponse } from '@ngrx/operators';
import { pipe, switchMap, tap } from 'rxjs';
import {
  ShipmentItem,
  ShipmentStatus,
  ShipmentWithItems,
  StockSorting,
} from '@core/models/models';
import { useAuthStore } from '@core/store/auth-store';
import { withBusy } from '@core/store/custom-features/with-busy/with-busy.feature';
import { setBusy, setIdle } from '@core/store/custom-features/with-busy/with-busy.updaters';
import { ProductStore } from '@features/products/store/product.store';
import { SortingsService } from '@features/products/services/sortings.service';
import { NotificationService } from '@shared/utils/notification.service';
import {
  DRAFT_CHANGED,
  SHIPMENTS_PAGE_SIZE,
  ShipmentHeader,
  ShipmentOverview,
  ShipmentsService,
} from '@features/shipments/services/shipments.service';

type ShipmentState = {
  status: ShipmentStatus;
  shipments: ShipmentOverview[];
  /** Pages of the list loaded so far (`SHIPMENTS_PAGE_SIZE` each). */
  page: number;
  hasMore: boolean;
  listFailed: boolean;
  current: ShipmentWithItems | null;
  sortings: StockSorting[];
  /** The sortings of `current` have been loaded at least once. */
  sortingsLoaded: boolean;
  sortingsFailed: boolean;
};

const initialState: ShipmentState = {
  status: 'draft',
  shipments: [],
  page: 0,
  hasMore: false,
  listFailed: false,
  current: null,
  sortings: [],
  sortingsLoaded: false,
  sortingsFailed: false,
};

/** `rows` appended to `list`, without ids already in it. */
export function appendNew(list: ShipmentOverview[], rows: ShipmentOverview[]): ShipmentOverview[] {
  const seen = new Set(list.map((s) => s.id));
  return [...list, ...rows.filter((s) => !seen.has(s.id))];
}

/** What `save` reports: the id, or why it failed (`conflict` = changed by someone else). */
export type SaveOutcome = { id: number } | { failed: 'conflict' | 'error' };

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
  withMethods((store) => {
    /**
     * Bumped by `reset()`: a response to a request started before it (e.g.
     * the previous user's list still loading at sign-out) is dropped.
     */
    let generation = 0;
    const current = <T>(handler: (value: T) => void) => {
      const startedIn = generation;
      return (value: T) => {
        if (startedIn === generation) handler(value);
      };
    };

    const fetchPage = rxMethod<{ status: ShipmentStatus; page: number }>(
      pipe(
        tap(() => patchState(store, { listFailed: false }, setBusy())),
        switchMap(({ status, page }) =>
          store._service.getShipmentsObs(status, page).pipe(
            tapResponse({
              next: current((rows: ShipmentOverview[]) =>
                patchState(store, (state) => ({
                  // offset pages can overlap when trucks are added meanwhile
                  shipments: page === 0 ? rows : appendNew(state.shipments, rows),
                  page,
                  hasMore: rows.length === SHIPMENTS_PAGE_SIZE,
                })),
              ),
              error: (error) => {
                console.error(error);
                patchState(store, { listFailed: true });
              },
              finalize: () => patchState(store, setIdle()),
            }),
          ),
        ),
      ),
    );

    return {
      /** Loads the first page of a status; the old list is cleared so it never shows under the wrong tab. */
      loadList(status: ShipmentStatus): void {
        patchState(store, { status, shipments: [], page: 0, hasMore: false });
        fetchPage({ status, page: 0 });
      },

      loadMore(): void {
        if (!store.hasMore() || store.isBusy()) return;
        fetchPage({ status: store.status(), page: store.page() + 1 });
      },

      /**
       * Loads one shipment. A reload of the shipment already shown keeps it on
       * screen until the new version arrives (no spinner flash).
       */
      loadShipment: rxMethod<number>(
        pipe(
          tap((id) => {
            if (store.current()?.id !== id) {
              patchState(store, {
                current: null,
                sortings: [],
                sortingsLoaded: false,
                sortingsFailed: false,
              });
            }
            patchState(store, setBusy());
          }),
          switchMap((id) =>
            store._service.getShipmentObs(id).pipe(
              tapResponse({
                next: current((shipment: ShipmentWithItems | null) =>
                  patchState(store, { current: shipment }),
                ),
                error: (error) => console.error(error),
                finalize: () => patchState(store, setIdle()),
              }),
            ),
          ),
        ),
      ),

      loadSortings: rxMethod<number>(
        pipe(
          tap(() => patchState(store, { sortingsFailed: false })),
          switchMap((id) =>
            store._sortings.getSortingsByShipmentObs(id).pipe(
              tapResponse({
                next: current((sortings: StockSorting[]) =>
                  patchState(store, { sortings, sortingsLoaded: true }),
                ),
                error: (error) => {
                  console.error(error);
                  patchState(store, { sortingsFailed: true });
                },
              }),
            ),
          ),
        ),
      ),

      clearCurrent(): void {
        patchState(store, {
          current: null,
          sortings: [],
          sortingsLoaded: false,
          sortingsFailed: false,
        });
      },

      /** Back to the empty state (sign-out or another user signing in). */
      reset(): void {
        generation++;
        patchState(store, initialState);
      },
    };
  }),
  withMethods((store) => ({
    /**
     * Saves the draft. Input stays in the form on failure. A draft changed by
     * someone else meanwhile (SA007) is reloaded so the form shows it. A saved
     * draft is reloaded too, for its new version (`updated_at`).
     */
    async save(
      header: ShipmentHeader,
      items: Pick<ShipmentItem, 'product_id' | 'quantity'>[],
      options: { quiet?: boolean } = {},
    ): Promise<SaveOutcome> {
      patchState(store, setBusy());
      try {
        const { id, code } = await store._service.saveShipment(header, items);
        if (id === null) {
          if (code === DRAFT_CHANGED && header.id) {
            store.loadShipment(header.id);
            return { failed: 'conflict' };
          }
          return { failed: 'error' };
        }
        if (!options.quiet) store._notify.success('SHIPMENTS.SAVED');
        store.loadShipment(id);
        return { id };
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
          store.loadSortings(id);
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
          store._notify.success('SORTING.UNDONE');
        }
        // reload either way: on failure the list may simply be out of date
        store.loadSortings(shipmentId);
        return ok;
      } finally {
        patchState(store, setIdle());
      }
    },
  })),
  withHooks((store) => ({
    onInit: () => {
      const authStore = inject(useAuthStore);
      let userId = authStore.id();
      // another user's trucks must not stay on screen after a sign-out / sign-in
      effect(() => {
        const id = authStore.id();
        if (id !== userId) {
          userId = id;
          untracked(() => store.reset());
        }
      });
    },
  })),
);
