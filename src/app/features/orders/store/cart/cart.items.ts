import type { ProductItem, ProductItems } from '@core/models/models';
import type { Category } from '@core/models/enums';

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
 * inputs are left untouched): quantity and price summed; for M2 lines the
 * packs and loose pieces summed, with every full pack of loose pieces turned
 * into a pack.
 */
export function mergeCartItems(base: ProductItem, added: ProductItem): ProductItem {
  const merged: ProductItem = {
    ...base,
    quantity: base.quantity + added.quantity,
    price: base.price + added.price,
  };
  // A hand-set part must not be re-priced from the list later
  if (base.manualPrice || added.manualPrice) merged.manualPrice = true;

  const hasPacks =
    base.packsNeeded !== undefined ||
    base.extraPiecesNeeded !== undefined ||
    added.packsNeeded !== undefined ||
    added.extraPiecesNeeded !== undefined;
  if (!hasPacks) return merged;

  const packs = (base.packsNeeded ?? 0) + (added.packsNeeded ?? 0);
  const pieces = (base.extraPiecesNeeded ?? 0) + (added.extraPiecesNeeded ?? 0);
  const perPack = base.product.piece_per_pack;

  if (perPack > 0 && pieces >= perPack) {
    merged.packsNeeded = packs + Math.floor(pieces / perPack);
    merged.extraPiecesNeeded = pieces % perPack;
  } else {
    merged.packsNeeded = packs;
    merged.extraPiecesNeeded = pieces;
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
