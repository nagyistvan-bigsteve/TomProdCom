import { Product, ShipmentItem, StockSorting } from '@core/models/models';

/** One editable line of a draft truck delivery. */
export type DraftLine = {
  key: number;
  product: Product | null;
  quantity: number;
};

type SortedQty = Pick<StockSorting, 'product_id' | 'qty_a' | 'qty_b' | 'qty_waste'>;

/** Lines ready to save: a product and a positive whole quantity; same product summed. */
export function toShipmentItems(
  lines: DraftLine[],
): Pick<ShipmentItem, 'product_id' | 'quantity'>[] {
  const byProduct = new Map<number, number>();
  for (const line of lines) {
    if (!line.product || !(line.quantity > 0) || !Number.isInteger(line.quantity)) continue;
    byProduct.set(line.product.id, (byProduct.get(line.product.id) ?? 0) + line.quantity);
  }
  return [...byProduct].map(([product_id, quantity]) => ({ product_id, quantity }));
}

/** Lines with a product but an invalid quantity (0, negative, fractional). */
export function invalidLines(lines: DraftLine[]): DraftLine[] {
  return lines.filter(
    (l) => l.product && !(l.quantity > 0 && Number.isInteger(l.quantity)),
  );
}

/** The draft always ends with one empty line to type into. */
export function withTrailingEmptyLine(lines: DraftLine[], nextKey: () => number): DraftLine[] {
  const last = lines[lines.length - 1];
  return last && !last.product ? lines : [...lines, { key: nextKey(), product: null, quantity: 0 }];
}

/** Pieces sorted (A + B + waste) per product. */
export function sortedByProduct(sortings: SortedQty[]): Map<number, number> {
  const result = new Map<number, number>();
  for (const s of sortings) {
    result.set(s.product_id, (result.get(s.product_id) ?? 0) + s.qty_a + s.qty_b + s.qty_waste);
  }
  return result;
}

export type LineProgress = {
  product_id: number;
  received: number;
  sorted: number;
  remaining: number;
};

/** Per line: received, sorted from this truck, still unsorted (never below 0). */
export function shipmentProgress(
  items: Pick<ShipmentItem, 'product_id' | 'quantity'>[],
  sortings: SortedQty[],
): LineProgress[] {
  const sorted = sortedByProduct(sortings);
  return items.map((item) => {
    const done = sorted.get(item.product_id) ?? 0;
    return {
      product_id: item.product_id,
      received: item.quantity,
      sorted: done,
      remaining: Math.max(0, item.quantity - done),
    };
  });
}

/** Share of received pieces already sorted, 0–100 (lines that cannot be graded excluded). */
export function sortedPercent(
  items: Pick<ShipmentItem, 'product_id' | 'quantity'>[],
  sortings: SortedQty[],
  isGradable: (productId: number) => boolean,
): number {
  const lines = shipmentProgress(items.filter((i) => isGradable(i.product_id)), sortings);
  const received = lines.reduce((s, l) => s + l.received, 0);
  if (received === 0) return 100;
  const sorted = lines.reduce((s, l) => s + Math.min(l.sorted, l.received), 0);
  return Math.round((sorted / received) * 100);
}
