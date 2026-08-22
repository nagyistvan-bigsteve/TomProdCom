import { ProductItems } from '@core/models/models';

export interface CartSlice {
  readonly productItems: ProductItems;
  readonly lastUpdated: string | null;
}

export const initialCartSlice: CartSlice = {
  productItems: [],
  lastUpdated: null,
};
