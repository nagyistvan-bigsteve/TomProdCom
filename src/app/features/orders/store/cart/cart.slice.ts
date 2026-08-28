import { ProductItems, UsedPricesInOrder } from '@core/models/models';

export interface CartSlice {
  readonly productItems: ProductItems;
  readonly lastUpdated: string | null;
  readonly usedPriceCategories: UsedPricesInOrder;
  readonly pricingClientId: number | null;
}

export const initialCartSlice: CartSlice = {
  productItems: [],
  lastUpdated: null,
  usedPriceCategories: [],
  pricingClientId: null,
};
