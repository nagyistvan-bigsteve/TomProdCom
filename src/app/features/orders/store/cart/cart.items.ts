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
    if ((base.product.m2_brut ?? 0) > 0) {
      const { packsNeeded, extraPiecesNeeded } = m2PacksFromQuantity(base.product, merged.quantity);
      merged.packsNeeded = packsNeeded;
      merged.extraPiecesNeeded = extraPiecesNeeded;
    } else {
      // No gross m² per piece to work from: keep the two breakdowns, summed
      merged.packsNeeded = (base.packsNeeded ?? 0) + (added.packsNeeded ?? 0);
      merged.extraPiecesNeeded = (base.extraPiecesNeeded ?? 0) + (added.extraPiecesNeeded ?? 0);
    }
  }
  return merged;
}

/**
 * Every line moved to `category` at the price `priceOf` gives it ("Total A" /
 * "Total B" arrows); a line it gives no price for (0) stays as it is. Moved
 * lines are list-priced again (`manualPrice` cleared). Lines that end up with
 * the same product and grade are merged once, at the end, so no merged line
 * is later overwritten with the price of one of its parts.
 */
export function regradeItems(
  items: ProductItems,
  category: Category,
  priceOf: (item: ProductItem) => number,
): ProductItems {
  let result = items.map((item) => {
    const price = priceOf(item);
    return price ? { ...item, category, price, manualPrice: false } : item;
  });
  const products = new Set(result.filter((i) => i.category === category).map((i) => i.product.id));
  for (const id of products) result = mergeDuplicateItems(result, id, category);
  return result;
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
