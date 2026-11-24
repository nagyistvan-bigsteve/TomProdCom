import type { ProductItem, ProductItems } from '@core/models/models';

/**
 * The cart with `replaced` swapped for `item`, as a new array: the store's
 * signals only notice a new array, so writing into the current one would
 * leave `cartTotal()` showing the old total.
 */
export function replaceCartItem(
  items: ProductItems,
  replaced: ProductItem,
  item: ProductItem,
): ProductItems {
  return items.map((current) => (current === replaced ? item : current));
}
