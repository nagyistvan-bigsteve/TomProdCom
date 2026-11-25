import type { ProductItem, ProductItems } from '@core/models/models';
import { Category, Unit_id } from '@core/models/enums';
import { m2PacksFromQuantity } from '@shared/utils/product.util';

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

/**
 * Two lines of the same product and grade as one line (a new object, the
 * inputs are left untouched): quantity and price summed. For M2 lines the
 * packs and loose pieces are worked out again from the summed quantity, so
 * they match it even when a line came without a breakdown (loaded from an
 * offer) and loose pieces that fill a pack become a pack.
 */
export function mergeCartItems(base: ProductItem, added: ProductItem): ProductItem {
  const merged: ProductItem = {
    ...base,
    quantity: base.quantity + added.quantity,
    price: base.price + added.price,
  };
  // A hand-set part must not be re-priced from the list later
  if (base.manualPrice || added.manualPrice) merged.manualPrice = true;

  if (base.product.unit_id === Unit_id.M2) {
    const { packsNeeded, extraPiecesNeeded } = m2PacksFromQuantity(base.product, merged.quantity);
    merged.packsNeeded = packsNeeded;
    merged.extraPiecesNeeded = extraPiecesNeeded;
  }
  return merged;
}

/**
 * The cart with every line of `productId` + `category` merged into one, kept
 * at the place of the first of them. A new array when something was merged,
 * the same array otherwise.
 */
export function mergeDuplicateItems(
  items: ProductItems,
  productId: string | number,
  category: Category,
): ProductItems {
  const isMatch = (item: ProductItem) =>
    item.product.id === productId && item.category === category;
  const matches = items.filter(isMatch);
  if (matches.length < 2) return items;

  const merged = matches.reduce(mergeCartItems);
  return items.flatMap((item) => {
    if (!isMatch(item)) return [item];
    return item === matches[0] ? [merged] : [];
  });
}
