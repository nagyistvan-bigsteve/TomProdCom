import { ProductItems, UsedPricesInOrder } from '@core/models/models';
import type { StoredCart } from './cart.persistence';
import type { OfferCarryOver } from './offer-carry-over';

export interface CartSlice {
  readonly productItems: ProductItems;
  readonly lastUpdated: string | null;
  readonly usedPriceCategories: UsedPricesInOrder;
  readonly pricingClientId: number | null;
  /** Set when the cart was filled from an offer ("Creare comandă"). */
  readonly sourceOffer: OfferCarryOver | null;
  /** An older saved cart the user has not yet chosen to restore or discard. */
  readonly pendingRestore: StoredCart | null;
}

export const initialCartSlice: CartSlice = {
  productItems: [],
  lastUpdated: null,
  usedPriceCategories: [],
  pricingClientId: null,
  sourceOffer: null,
  pendingRestore: null,
};
