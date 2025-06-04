import {
  signalStore,
  withHooks,
  withState,
  withMethods,
  patchState,
} from '@ngrx/signals';
import { ProductItems, ProductItem, Price } from '../../models/models';
import { Category } from '../../models/enums';

// Define the state interface
interface ProductDataState {
  productItems: ProductItems;
  lastUpdated: string | null;
}

// Local storage key
const STORAGE_KEY = 'product_items_data';

export const useProductStore = signalStore(
  { providedIn: 'root' },
  withState<ProductDataState>({
    productItems: [],
    lastUpdated: null,
  }),

  // Methods for state manipulation
  withMethods((store) => {
    // Helper function to persist state to localStorage
    const persistState = () => {
      const state = {
        productItems: store.productItems(),
        lastUpdated: store.lastUpdated(),
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    };

    return {
      // Set product items
      setProductItems(productItems: ProductItems) {
        patchState(store, {
          productItems,
          lastUpdated: new Date().toISOString(),
        });

        persistState();
      },

      // Add a single product item
      addProductItem(productItem: ProductItem) {
        const currentItems = store.productItems() || [];
        let updatedItems: ProductItems;

        // Add new product item
        updatedItems = [...currentItems, productItem];

        patchState(store, {
          productItems: updatedItems,
          lastUpdated: new Date().toISOString(),
        });

        persistState();
      },

      updateProductItem(
        productId: string | number,
        category: Category,
        updates: Partial<ProductItem>
      ) {
        const currentItems = store.productItems();
        if (!currentItems) {
          return;
        }

        const updatedItems = currentItems.map((item) =>
          item.category === category && item.product.id === productId
            ? { ...item, ...updates }
            : item
        );

        patchState(store, {
          productItems: updatedItems,
          lastUpdated: new Date().toISOString(),
        });

        persistState();

        this.checkForDuplicatedItems(productId, updates.category);
      },

      checkForDuplicatedItems(
        productId: string | number,
        category: Category | undefined
      ) {
        if (!category) {
          return;
        }
        const currentItems = store.productItems();
        if (!currentItems) {
          return;
        }

        const matchingItems = currentItems.filter(
          (item) => item.category === category && item.product.id === productId
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
                !(item.category === category && item.product.id === productId)
            ),
            mergedItem,
          ];

          patchState(store, {
            productItems: updatedItems,
            lastUpdated: new Date().toISOString(),
          });

          persistState();
        }
      },

      // Delete all product items
      deleteProductItems() {
        patchState(store, {
          productItems: [],
          lastUpdated: new Date().toISOString(),
        });

        persistState();
      },

      // Delete specific product by ID
      deleteProductById(productId: string | number, category: Category) {
        const currentItems = store.productItems();

        if (!currentItems) return;

        // Filter out the item with the specified ID
        const updatedItems = currentItems.filter(
          (item) => item.product.id !== productId || item.category !== category
        );

        patchState(store, {
          productItems: updatedItems,
          lastUpdated: new Date().toISOString(),
        });

        persistState();
      },

      // Update quantity for a specific product
      updateQuantity(
        productId: string | number,
        category: Category,
        quantity: number,
        price: number
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
            : item
        );

        patchState(store, {
          productItems: updatedItems,
          lastUpdated: new Date().toISOString(),
        });

        persistState();
      },
    };
  }),

  // Lifecycle hooks
  withHooks((store) => {
    return {
      onInit() {
        // Load state from localStorage on initialization
        const storedData = localStorage.getItem(STORAGE_KEY);

        if (storedData) {
          try {
            const parsedData = JSON.parse(storedData);
            patchState(store, parsedData);
          } catch (e) {
            console.error('Failed to parse stored product data', e);
            localStorage.removeItem(STORAGE_KEY);
          }
        }
      },
      onDestroy() {
        // Optional cleanup if needed
      },
    };
  })
);
