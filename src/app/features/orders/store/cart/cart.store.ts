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

import { computed, effect, inject, untracked } from '@angular/core';
import { useAuthStore } from '@core/store/auth-store';

import {
  readFromLocalStorage,
  syncToLocalStorage,
} from '@core/store/local-storage-sync';
import {
  CART_STORAGE_KEY,
  decideStoredCart,
  SavedCart,
  toStoredCart,
} from './cart.persistence';
import { CartSlice, initialCartSlice } from './cart.slice';
import { mergeDuplicateItems, replaceCartItem } from './cart.items';
import type { OfferCarryOver } from './offer-carry-over';


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
      /**
       * Fills the cart from an offer ("Creare comandă"): its items, plus what
       * the overview prefills and which offer the new order replaces.
       */
      setProductItems(productItems: ProductItems, sourceOffer: OfferCarryOver | null = null) {
        patchState(store, {
          productItems,
          sourceOffer,
          lastUpdated: new Date().toLocaleString('sv-SE'),
          pendingRestore: null,
        });
      },

      /** Unties the cart from the offer it was loaded from: the offer stays as it is. */
      clearSourceOffer() {
        patchState(store, { sourceOffer: null });
      },

      /** Replaces one cart line (duplicate dialog → "overwrite"). */
      replaceProductItem(replaced: ProductItem, item: ProductItem) {
        patchState(store, {
          productItems: replaceCartItem(store.productItems(), replaced, item),
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

        const updatedItems = mergeDuplicateItems(currentItems, productId, category);

        if (updatedItems !== currentItems) {
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
          sourceOffer: null,
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

    /**
     * Back to an empty cart, and the saved cart removed from localStorage
     * (`lastUpdated` null): on sign-out or when another user signs in, so the
     * next person on a shared device does not get it.
     */
    reset(): void {
      patchState(store, initialCartSlice);
    },
  })),

  withHooks((store) => ({
    onInit() {
      const authStore = inject(useAuthStore);
      const stored = readFromLocalStorage<SavedCart>(CART_STORAGE_KEY);

      if (stored) {
        switch (decideStoredCart(stored, new Date(), authStore.id())) {
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

        const saved: SavedCart = {
          ...toStoredCart({
            productItems: store.productItems(),
            lastUpdated: store.lastUpdated(),
            usedPriceCategories: store.usedPriceCategories(),
            pricingClientId: store.pricingClientId(),
            sourceOffer: store.sourceOffer(),
          }),
          ownerId: authStore.id(),
        };
        return saved;
      });

      // A cart belongs to the user who built it: sign-out or another user
      // signing in empties it (a reload of the same user keeps it). The owner
      // saved with it covers a sign-out while this store was not running.
      let userId = authStore.id();
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
