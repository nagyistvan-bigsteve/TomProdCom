import { Price2, Product } from '@core/models/models';
import { priceRowsForProduct } from '@shared/utils/product.util';

/** The price rows of a product by id (SPEC 10.1, `priceRowsForProduct`); [] when unknown. */
export function computePricesForProduct(
  selectedProductId: number | null,
  productsMap: Record<string | number, Product>,
  allPrices: Price2[],
): Price2[] {
  if (selectedProductId === null) return [];
  const product = productsMap[selectedProductId];
  if (!product) return [];
  return priceRowsForProduct(product, allPrices);
}
