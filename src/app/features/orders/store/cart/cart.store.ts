import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withState,
} from '@ngrx/signals';
import { ProductItem, ProductItems, UsedPricesInOrder } from '@core/models/models';
import { Category } from '@core/models/enums';

import { computed } from '@angular/core';

import {
  readFromLocalStorage,
  syncToLocalStorage,
} from '@core/store/local-storage-sync';
import {
  CART_STORAGE_KEY,
  decideStoredCart,
  StoredCart,
  toStoredCart,
} from './cart.persistence';
import { CartSlice, initialCartSlice } from './cart.slice';


export const CartStore = signalStore(
  { providedIn: 'root' },
  withState<CartSlice>(initialCartSlice),
  withComputed((store) => ({
    cartTotal: computed(() =>
      store.productItems().reduce((sum, item) => sum + item.price, 0),
    ),
  })),
  withMethods((store) => {
    return {
      setProductItems(productItems: ProductItems) {
        patchState(store, {
          productItems,
          lastUpdated: new Date().toLocaleString('sv-SE'),
          pendingRestore: null,
        });

      },

      addProductItem(productItem: ProductItem) {
        const currentItems = store.productItems() || [];
        let updatedItems: ProductItems;

        updatedItems = [productItem, ...currentItems];

        patchState(store, {
          productItems: updatedItems,
          lastUpdated: new Date().toLocaleString('sv-SE'),
          pendingRestore: null,
        });

      },

      updateProductItem(
        productId: string | number,
        category: Category,
        updates: Partial<ProductItem>,
      ) {
        const currentItems = store.productItems();
        if (!currentItems) {
          return;
        }

        const updatedItems = currentItems.map((item) =>
          item.category === category && item.product.id === productId
            ? { ...item, ...updates }
            : item,
        );

        patchState(store, {
          productItems: updatedItems,
          lastUpdated: new Date().toLocaleString('sv-SE'),
          pendingRestore: null,
        });


        this.checkForDuplicatedItems(productId, updates.category);
      },

      checkForDuplicatedItems(
        productId: string | number,
        category: Category | undefined,
      ) {
        if (!category) {
          return;
        }
        const currentItems = store.productItems();
        if (!currentItems) {
          return;
        }

        const matchingItems = currentItems.filter(
          (item) => item.category === category && item.product.id === productId,
        );

        let mergedItem: ProductItem | null = null;

        if (matchingItems.length > 1) {
          const baseItem = { ...matchingItems[0] };
          const totalQuantity =
            matchingItems[0].quantity + matchingItems[1].quantity;
          const totalPrice = matchingItems[0].price + matchingItems[1].price;

          mergedItem = {
            ...baseItem,
            quantity: totalQuantity,
            price: totalPrice,
          };

          const updatedItems = [
            ...currentItems.filter(
              (item) =>
                !(item.category === category && item.product.id === productId),
            ),
            mergedItem,
          ];

          patchState(store, {
            productItems: updatedItems,
            lastUpdated: new Date().toLocaleString('sv-SE'),
            pendingRestore: null,
          });

        }
      },

      setUsedPriceCategories(categories: UsedPricesInOrder) {
        patchState(store, { usedPriceCategories: categories });
      },

      setPricingClientId(id: number | null) {
        patchState(store, { pricingClientId: id });
      },

      deleteProductItems() {
        patchState(store, {
          productItems: [],
          lastUpdated: new Date().toLocaleString('sv-SE'),
          pendingRestore: null,
          usedPriceCategories: [],
          pricingClientId: null,
        });

      },

      deleteProductById(productId: string | number, category: Category) {
        const currentItems = store.productItems();

        if (!currentItems) return;

        const updatedItems = currentItems.filter(
          (item) => item.product.id !== productId || item.category !== category,
        );

        patchState(store, {
          productItems: updatedItems,
          lastUpdated: new Date().toLocaleString('sv-SE'),
          pendingRestore: null,
        });

      },

      updateQuantity(
        productId: string | number,
        category: Category,
        quantity: number,
        price: number,
      ) {
        const currentItems = store.productItems();

        if (!currentItems) return;

        const updatedItems = currentItems.map((item) =>
          item.product.id === productId && item.category === category
            ? {
                ...item,
                quantity,
                price,
              }
            : item,
        );

        patchState(store, {
          productItems: updatedItems,
          lastUpdated: new Date().toLocaleString('sv-SE'),
          pendingRestore: null,
        });

      },
    };
  }),

  withMethods((store) => ({
    /** Loads the saved cart the user chose to keep, as if just changed. */
    restorePendingCart(): void {
      const pending = store.pendingRestore();
      if (!pending) return;

      patchState(store, {
        ...toStoredCart(pending),
        lastUpdated: new Date().toLocaleString('sv-SE'),
        pendingRestore: null,
      });
    },

    discardPendingCart(): void {
      patchState(store, { pendingRestore: null });
    },
  })),

  withHooks((store) => ({
    onInit() {
      const stored = readFromLocalStorage<StoredCart>(CART_STORAGE_KEY);

      if (stored) {
        switch (decideStoredCart(stored, new Date())) {
          case 'restore':
            patchState(store, toStoredCart(stored));
            break;
          case 'ask':
            // staleCartGuard asks when an offer creation page is opened
            patchState(store, { pendingRestore: toStoredCart(stored) });
            break;
          case 'discard':
            break;
        }
      }

      // While a decision is pending the saved cart is left untouched; a cart
      // that was never changed (or was discarded) is removed
      syncToLocalStorage(CART_STORAGE_KEY, () => {
        if (store.pendingRestore()) return undefined;
        if (store.lastUpdated() === null) return null;

        return toStoredCart({
          productItems: store.productItems(),
          lastUpdated: store.lastUpdated(),
          usedPriceCategories: store.usedPriceCategories(),
          pricingClientId: store.pricingClientId(),
        });
      });
    },
  })),
);
