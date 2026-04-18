import { type } from '@ngrx/signals';
import { entityConfig } from '@ngrx/signals/entities';
import { Price2, Product, Stock } from '../../../models/models';

export interface ProductSlice {
  readonly selectedProductId: number | null;
}

export const initialProductSlice: ProductSlice = {
  selectedProductId: null,
};

export const productConfig = entityConfig({
  entity: type<Product>(),
  collection: 'products',
  selectId: (product) => product.id,
});

export const priceConfig = entityConfig({
  entity: type<Price2>(),
  collection: 'prices',
  selectId: (price) => price.id,
});

export const stockConfig = entityConfig({
  entity: type<Stock>(),
  collection: 'stocks',
  selectId: (stock) => stock.product_id,
});
