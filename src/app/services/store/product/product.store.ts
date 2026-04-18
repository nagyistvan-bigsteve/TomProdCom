import {
  addEntity,
  setAllEntities,
  updateEntity,
  withEntities,
} from '@ngrx/signals/entities';
import { Price2, Product, Stock } from '../../../models/models';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { withBusy } from '../custom-features/with-busy/with-busy.feature';
import { computed, inject } from '@angular/core';
import { ProductsService } from '../../query-services/products.service';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { Observable, pipe, switchMap, tap } from 'rxjs';
import { setBusy, setIdle } from '../custom-features/with-busy/with-busy.updaters';
import { tapResponse } from '@ngrx/operators';
import { PricesService } from '../../query-services/prices.service';
import { StocksService } from '../../query-services/stocks.service';
import { NotificationService } from '../../utils/notification.service';
import { Category } from '../../../models/enums';
import {
  initialProductSlice,
  priceConfig,
  productConfig,
  stockConfig,
} from './product.slice';
import { computePricesForProduct } from './product.computed';

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
    };
  }),
  withMethods((store) => ({
    setSelectedProduct: (id: number) =>
      patchState(store, { selectedProductId: id }),

    clearSelectedProduct: () =>
      patchState(store, { selectedProductId: null }),

    fetchProducts: rxMethod<void>(
      pipe(
        tap(() => patchState(store, setBusy())),
        switchMap(() =>
          store._productService.getProducts().pipe(
            tapResponse({
              next: (products) =>
                patchState(store, setAllEntities(products, productConfig)),
              error: (error) => console.error(error),
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
              error: (error) => console.error(error),
              finalize: () => patchState(store, setIdle()),
            }),
          ),
        ),
      ),
    ),

    fetchStocks: rxMethod<void>(
      pipe(
        tap(() => patchState(store, setBusy())),
        switchMap(() =>
          store._stockService.getAllStocksObs().pipe(
            tapResponse({
              next: (stocks) =>
                patchState(store, setAllEntities(stocks, stockConfig)),
              error: (error) => console.error(error),
              finalize: () => patchState(store, setIdle()),
            }),
          ),
        ),
      ),
    ),

    addProductAndReturn(product: Product): Observable<Product> {
      return store._productService.addProductObs(product).pipe(
        tap({
          next: (newProduct) => {
            patchState(store, addEntity(newProduct, productConfig));
            store._notify.success('SNACKBAR.PRODUCT.SUCCESS.ADD');
          },
          error: (error) => {
            console.error(error);
            store._notify.error('SNACKBAR.PRODUCT.ERROR.ADD');
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
                store._notify.success('SNACKBAR.PRODUCT.SUCCESS.UPDATE');
              },
              error: (error) => {
                console.error(error);
                store._notify.error('SNACKBAR.PRODUCT.ERROR.UPDATE');
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
                store._notify.error('SNACKBAR.PRICE.ERROR.UPDATE');
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
                store._notify.error('SNACKBAR.PRICE.ERROR.ADD');
              },
              finalize: () => patchState(store, setIdle()),
            }),
          ),
        ),
      ),
    ),

    updateStock: rxMethod<{ id: number; stock: number; product_id: number }>(
      pipe(
        tap(() => patchState(store, setBusy())),
        switchMap(({ id, stock, product_id }) =>
          store._stockService.updateStockObs(id, stock).pipe(
            tapResponse({
              next: () => {
                patchState(
                  store,
                  updateEntity({ id: product_id, changes: { stock } }, stockConfig),
                );
                store._notify.success('SNACKBAR.STOCK.SUCCESS.UPDATE');
              },
              error: (error) => {
                console.error(error);
                store._notify.error('SNACKBAR.STOCK.ERROR.UPDATE');
              },
              finalize: () => patchState(store, setIdle()),
            }),
          ),
        ),
      ),
    ),

    addStockAndReturn(stock: Partial<Stock>): Observable<Stock> {
      return store._stockService.addStockObs(stock).pipe(
        tap({
          next: (newStock) => {
            patchState(store, addEntity(newStock, stockConfig));
          },
          error: (error) => console.error(error),
        }),
      );
    },

    addToProductStock(product_id: number, amount: number): void {
      store._stockService.addToProductStock(product_id, amount);
      const current = store.stocksEntityMap()[product_id];
      if (current) {
        patchState(
          store,
          updateEntity(
            { id: product_id, changes: { stock: current.stock + amount } },
            stockConfig,
          ),
        );
      }
    },
  })),
  withHooks((store) => ({
    onInit: () => {
      store.fetchProducts();
      store.fetchPrices();
      store.fetchStocks();
    },
  })),
);
