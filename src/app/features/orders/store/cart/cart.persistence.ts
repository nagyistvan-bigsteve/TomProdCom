import { CartSlice } from './cart.slice';

export const CART_STORAGE_KEY = 'product_items_data';
export const STALE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

/** The part of the cart kept in localStorage. */
export type StoredCart = Pick<
  CartSlice,
  'productItems' | 'lastUpdated' | 'usedPriceCategories' | 'pricingClientId' | 'sourceOffer'
>;

/** What is written to localStorage: the cart and the user who built it. */
export type SavedCart = StoredCart & {
  /** Missing on carts saved before the owner was recorded. */
  readonly ownerId?: string | null;
};

/**
 * What to do with a cart found in localStorage at startup:
 * - `restore` — recent (10 minutes or less): load it silently;
 * - `ask` — older: ask the user when they next open an offer creation page;
 * - `discard` — nothing in it, or built by another user than the one
 *   signed in now (a shared device must not hand it to the next person).
 *
 * A cart without a readable timestamp is treated as recent, and one without
 * an owner (saved before owners were recorded) as the current user's, as before.
 */
export function decideStoredCart(
  stored: SavedCart,
  now: Date,
  currentUserId: string | null,
): 'restore' | 'ask' | 'discard' {
  if (!stored.productItems?.length) return 'discard';
  if (stored.ownerId !== undefined && stored.ownerId !== currentUserId) return 'discard';

  const lastUpdated = stored.lastUpdated ? new Date(stored.lastUpdated) : null;
  const ageMs = lastUpdated ? now.getTime() - lastUpdated.getTime() : Infinity;

  return ageMs > STALE_THRESHOLD_MS ? 'ask' : 'restore';
}

export function toStoredCart(cart: StoredCart): StoredCart {
  return {
    productItems: cart.productItems ?? [],
    lastUpdated: cart.lastUpdated ?? null,
    usedPriceCategories: cart.usedPriceCategories ?? [],
    pricingClientId: cart.pricingClientId ?? null,
    sourceOffer: cart.sourceOffer ?? null,
  };
}
