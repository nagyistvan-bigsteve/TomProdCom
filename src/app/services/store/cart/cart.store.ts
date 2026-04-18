import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withState,
} from '@ngrx/signals';
import { ProductItem, ProductItems } from '../../../models/models';
import { Category } from '../../../models/enums';
import { MatDialog } from '@angular/material/dialog';
import { computed, inject } from '@angular/core';
import { ConfirmRestoreDialogComponent } from '../../../components/dialog/confirm-restore-dialog.component';
import { Location } from '@angular/common';
import { CartSlice, initialCartSlice } from './cart.slice';

const STORAGE_KEY = 'product_items_data';
const STALE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

export const CartStore = signalStore(
  { providedIn: 'root' },
  withState<CartSlice>(initialCartSlice),
  withComputed((store) => ({
    cartTotal: computed(() =>
      store.productItems().reduce((sum, item) => sum + item.price, 0),
    ),
  })),
  withMethods((store) => {
    const persistState = () => {
      const state = {
        productItems: store.productItems(),
        lastUpdated: store.lastUpdated(),
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    };

    return {
      setProductItems(productItems: ProductItems) {
        patchState(store, {
          productItems,
          lastUpdated: new Date().toLocaleString('sv-SE'),
        });

        persistState();
      },

      addProductItem(productItem: ProductItem) {
        const currentItems = store.productItems() || [];
        let updatedItems: ProductItems;

        updatedItems = [productItem, ...currentItems];

        patchState(store, {
          productItems: updatedItems,
          lastUpdated: new Date().toLocaleString('sv-SE'),
        });

        persistState();
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
        });

        persistState();

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
          });

          persistState();
        }
      },

      deleteProductItems() {
        patchState(store, {
          productItems: [],
          lastUpdated: new Date().toLocaleString('sv-SE'),
        });

        persistState();
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
        });

        persistState();
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
        });

        persistState();
      },
    };
  }),

  withHooks((store) => {
    return {
      onInit() {
        const dialog = inject(MatDialog);
        const location = inject(Location);
        const storedData = localStorage.getItem(STORAGE_KEY);

        if (!storedData) return;

        try {
          const parsedData = JSON.parse(storedData);
          const lastUpdated = parsedData.lastUpdated
            ? new Date(parsedData.lastUpdated)
            : null;
          const now = new Date();
          const ageMs = lastUpdated
            ? now.getTime() - lastUpdated.getTime()
            : Infinity;

          if (ageMs > STALE_THRESHOLD_MS) {
            if (
              !location.path().includes('offer') ||
              location.path() === 'offers'
            ) {
              localStorage.removeItem(STORAGE_KEY);
              return;
            }

            dialog
              .open(ConfirmRestoreDialogComponent, {
                data: { lastUpdated },
                disableClose: true,
              })
              .afterClosed()
              .subscribe((keepData: boolean) => {
                if (keepData) {
                  patchState(store, parsedData);
                } else {
                  localStorage.removeItem(STORAGE_KEY);
                }
              });
          } else {
            patchState(store, parsedData);
          }
        } catch (e) {
          console.error('Failed to parse stored product data', e);
          localStorage.removeItem(STORAGE_KEY);
        }
      },
      onDestroy() {},
    };
  }),
);
