import { Price2, Product } from '../../../models/models';

export function computePricesForProduct(
  selectedProductId: number | null,
  productsMap: Record<string | number, Product>,
  allPrices: Price2[],
): Price2[] {
  if (selectedProductId === null) return [];
  const product = productsMap[selectedProductId];
  if (!product) return [];
  const unic = allPrices.filter((p) => p.product_id === product.id);
  return unic.length > 0
    ? unic
    : allPrices.filter(
        (p) =>
          p.unit_id === product.unit_id &&
          p.size_id === product.size_id &&
          !p.product_id,
      );
}
