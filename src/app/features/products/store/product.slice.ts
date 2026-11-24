import { type } from '@ngrx/signals';
import { entityConfig } from '@ngrx/signals/entities';
import { Price2, Product, Stock } from '@core/models/models';

export interface ProductSlice {
  readonly selectedProductId: number | null;
  /** The last products load failed (separate from stock: a stock reload must not hide it). */
  readonly productsLoadFailed: boolean;
  /** The last stock load failed. */
  readonly stocksLoadFailed: boolean;
}

export const initialProductSlice: ProductSlice = {
  selectedProductId: null,
  productsLoadFailed: false,
  stocksLoadFailed: false,
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
  selectId: (stock) => stock.id,
});
