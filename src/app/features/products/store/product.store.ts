import {
  addEntity,
  setAllEntities,
  updateEntity,
  withEntities,
} from '@ngrx/signals/entities';
import { Price2, Product } from '@core/models/models';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { withBusy } from '@core/store/custom-features/with-busy/with-busy.feature';
import { computed, DestroyRef, effect, inject, untracked } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { useAuthStore } from '@core/store/auth-store';
import { hasSpecificApiMessage } from '@core/services/api-error.util';
import { ProductsService } from '@features/products/services/products.service';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { firstValueFrom, Observable, pipe, switchMap, tap } from 'rxjs';
import { groupStocksByProduct } from '@shared/utils/stock.util';
import { setBusy, setIdle } from '@core/store/custom-features/with-busy/with-busy.updaters';
import { tapResponse } from '@ngrx/operators';
import { PricesService } from '@features/products/services/prices.service';
import { STOCK_CHANGED, StocksService } from '@features/products/services/stocks.service';
import { NotificationService } from '@shared/utils/notification.service';
import { Category } from '@core/models/enums';
import {
  initialProductSlice,
  priceConfig,
  productConfig,
  stockConfig,
} from './product.slice';
import { computePricesForProduct } from './product.computed';

/** One grade's new stock; `expected` is the value the edit started from. */
export type StockChange = { id: number; expected: number; stock: number };

/** Coming back to the app refetches stock at most this often. */
const STOCK_REFRESH_MIN_MS = 30_000;

export const ProductStore = signalStore(
  { providedIn: 'root' },
  withState(initialProductSlice),
  withBusy(),
  withProps((_) => {
    const _productService = inject(ProductsService);
    const _priceService = inject(PricesService);
    const _stockService = inject(StocksService);
    const _notify = inject(NotificationService);
    return { _productService, _priceService, _stockService, _notify };
  }),
  withEntities(productConfig),
  withEntities(priceConfig),
  withEntities(stockConfig),
  withComputed((store) => {
    const pricesForSelected = computed(() =>
      computePricesForProduct(
        store.selectedProductId(),
        store.productsEntityMap(),
        store.pricesEntities(),
      ),
    );

    return {
      selectedProduct: computed(() => {
        const id = store.selectedProductId();
        return id !== null ? (store.productsEntityMap()[id] ?? null) : null;
      }),
      pricesForSelectedProduct: pricesForSelected,
      availableCategoriesForSelectedProduct: computed(() =>
        pricesForSelected().map((p) => p.category_id as Category),
      ),
      /** Stock rows by product id and grade (A / B / AB). */
      stocksByProduct: computed(() => groupStocksByProduct(store.stocksEntities())),
      /** Products or stock failed to load (the products page offers a retry). */
      loadFailed: computed(() => store.productsLoadFailed() || store.stocksLoadFailed()),
    };
  }),
  withMethods((store) => {
    /** When stock was last requested; throttles the foreground refresh. */
    let lastStockFetch = 0;
    return {
    setSelectedProduct: (id: number) =>
      patchState(store, { selectedProductId: id }),

    clearSelectedProduct: () =>
      patchState(store, { selectedProductId: null }),

    fetchProducts: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { productsLoadFailed: false }, setBusy())),
        switchMap(() =>
          store._productService.getProducts().pipe(
            tapResponse({
              next: (products) =>
                patchState(store, setAllEntities(products, productConfig)),
              error: (error) => {
                console.error(error);
                patchState(store, { productsLoadFailed: true });
              },
              finalize: () => patchState(store, setIdle()),
            }),
          ),
        ),
      ),
    ),

    fetchPrices: rxMethod<void>(
      pipe(
        tap(() => patchState(store, setBusy())),
        switchMap(() =>
          store._priceService.getAllPricesObs().pipe(
            tapResponse({
              next: (prices) =>
                patchState(store, setAllEntities(prices, priceConfig)),
              error: (error) => {
                console.error(error);
              },
              finalize: () => patchState(store, setIdle()),
            }),
          ),
        ),
      ),
    ),

    fetchStocks: rxMethod<void>(
      pipe(
        tap(() => {
          lastStockFetch = Date.now();
          patchState(store, { stocksLoadFailed: false }, setBusy());
        }),
        switchMap(() =>
          store._stockService.getAllStocksObs().pipe(
            tapResponse({
              next: (stocks) =>
                patchState(store, setAllEntities(stocks, stockConfig)),
              error: (error) => {
                console.error(error);
                patchState(store, { stocksLoadFailed: true });
              },
              finalize: () => patchState(store, setIdle()),
            }),
          ),
        ),
      ),
    ),

    /**
     * Reloads stock unless it was requested in the last `STOCK_REFRESH_MIN_MS`
     * (no realtime: used when a page that shows stock opens and when the app
     * comes back to the foreground).
     */
    refreshStocksIfStale(): void {
      if (Date.now() - lastStockFetch < STOCK_REFRESH_MIN_MS) return;
      this.fetchStocks();
    },
    };
  }),
  withMethods((store) => ({
    addProductAndReturn(product: Product): Observable<Product> {
      return store._productService.addProductObs(product).pipe(
        tap({
          next: (newProduct) => {
            patchState(store, addEntity(newProduct, productConfig));
            // the database created its stock rows (one per grade)
            store.fetchStocks();
            store._notify.success('SNACKBAR.PRODUCT.SUCCESS.ADD');
          },
          error: (error) => {
            console.error(error);
            if (!hasSpecificApiMessage(error)) {
              store._notify.error('SNACKBAR.PRODUCT.ERROR.ADD');
            }
          },
        }),
      );
    },

    updateProduct: rxMethod<Product>(
      pipe(
        tap(() => patchState(store, setBusy())),
        switchMap((product) =>
          store._productService.updateProductObs(product).pipe(
            tapResponse({
              next: (updatedProduct) => {
                patchState(
                  store,
                  updateEntity(
                    { id: updatedProduct.id, changes: updatedProduct },
                    productConfig,
                  ),
                );
                // a length or unit change can add grade rows in the database
                store.fetchStocks();
                store._notify.success('SNACKBAR.PRODUCT.SUCCESS.UPDATE');
              },
              error: (error) => {
                console.error(error);
                if (!hasSpecificApiMessage(error)) {
                  store._notify.error('SNACKBAR.PRODUCT.ERROR.UPDATE');
                }
              },
              finalize: () => patchState(store, setIdle()),
            }),
          ),
        ),
      ),
    ),

    changePrice: rxMethod<{ id: number; new_price: number }>(
      pipe(
        tap(() => patchState(store, setBusy())),
        switchMap(({ id, new_price }) =>
          store._priceService.changePriceObs(id, new_price).pipe(
            tapResponse({
              next: (updatedPrice) => {
                patchState(
                  store,
                  updateEntity(
                    { id: updatedPrice.id, changes: updatedPrice },
                    priceConfig,
                  ),
                );
                store._notify.success('SNACKBAR.PRICE.SUCCESS.UPDATE');
              },
              error: (error) => {
                console.error(error);
                if (!hasSpecificApiMessage(error)) {
                  store._notify.error('SNACKBAR.PRICE.ERROR.UPDATE');
                }
              },
              finalize: () => patchState(store, setIdle()),
            }),
          ),
        ),
      ),
    ),

    addPrice: rxMethod<Partial<Price2>>(
      pipe(
        tap(() => patchState(store, setBusy())),
        switchMap((price) =>
          store._priceService.addPriceObs(price).pipe(
            tapResponse({
              next: (newPrice) => {
                patchState(store, addEntity(newPrice, priceConfig));
                store._notify.success('SNACKBAR.PRICE.SUCCESS.ADD');
              },
              error: (error) => {
                console.error(error);
                if (!hasSpecificApiMessage(error)) {
                  store._notify.error('SNACKBAR.PRICE.ERROR.ADD');
                }
              },
              finalize: () => patchState(store, setIdle()),
            }),
          ),
        ),
      ),
    ),

    /**
     * Sets the stock of one or more grades (`id` is the stocks row id,
     * `expected` the value the user started editing from). Saves one after the
     * other and shows one message. Resolves to:
     *  - `'saved'` when every change was saved;
     *  - `'conflict'` when someone changed a grade meanwhile (SA006): nothing
     *    after it is saved and the stock is reloaded so the user sees the new
     *    values;
     *  - `'failed'` on any other error.
     */
    async setStocks(
      changes: StockChange[],
    ): Promise<'saved' | 'conflict' | 'failed'> {
      if (!changes.length) return 'saved';
      patchState(store, setBusy());
      try {
        for (const { id, expected, stock } of changes) {
          await firstValueFrom(store._stockService.setStockObs(id, expected, stock));
          patchState(store, updateEntity({ id, changes: { stock } }, stockConfig));
        }
        store._notify.success('SNACKBAR.STOCK.SUCCESS.UPDATE');
        return 'saved';
      } catch (error) {
        console.error(error);
        if ((error as { code?: string })?.code === STOCK_CHANGED) {
          store.fetchStocks();
          return 'conflict';
        }
        if (!hasSpecificApiMessage(error)) {
          store._notify.error('SNACKBAR.STOCK.ERROR.UPDATE');
        }
        return 'failed';
      } finally {
        patchState(store, setIdle());
      }
    },
  })),
  withHooks((store) => ({
    onInit: () => {
      const authStore = inject(useAuthStore);
      const document = inject(DOCUMENT);
      const destroyRef = inject(DestroyRef);

      const signedIn = () => !!authStore.id() && !!authStore.approved();

      // Data is readable only by an approved, signed-in user, so (re)load it
      // whenever one signs in instead of once at startup
      effect(() => {
        if (signedIn()) {
          untracked(() => {
            store.fetchProducts();
            store.fetchPrices();
            store.fetchStocks();
          });
        }
      });

      // No realtime subscription: refresh stock when the app comes back to the
      // foreground (others may have sold, delivered or sorted meanwhile)
      const onVisible = () => {
        if (document.visibilityState !== 'visible' || !signedIn()) return;
        store.refreshStocksIfStale();
      };
      document.addEventListener('visibilitychange', onVisible);
      destroyRef.onDestroy(() => document.removeEventListener('visibilitychange', onVisible));
    },
  })),
);
