import { Product, ShipmentItem, StockSorting } from '@core/models/models';
import { shipmentTotalM3 } from '@shared/utils/stock.util';
import type { ShipmentOverview } from '@features/shipments/services/shipments.service';

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

/**
 * Share of received pieces already sorted, 0–100 (lines that cannot be
 * graded excluded), or `null` when there is nothing to sort: no gradable
 * lines, or the products are not loaded yet.
 */
export function sortedPercent(
  items: Pick<ShipmentItem, 'product_id' | 'quantity'>[],
  sortings: SortedQty[],
  isGradable: (productId: number) => boolean,
): number | null {
  const lines = shipmentProgress(items.filter((i) => isGradable(i.product_id)), sortings);
  const received = lines.reduce((s, l) => s + l.received, 0);
  if (received === 0) return null;
  const sorted = lines.reduce((s, l) => s + Math.min(l.sorted, l.received), 0);
  return Math.round((sorted / received) * 100);
}

/** One card of the shipments list. */
export type ShipmentCard = {
  shipment: ShipmentOverview;
  lines: number;
  pieces: number;
  m3: number;
  /** null = nothing to sort (no gradable lines) or products not loaded yet. */
  sortedPercent: number | null;
};

export function toShipmentCard(
  shipment: ShipmentOverview,
  products: Record<number, Product | undefined>,
  isGradable: (productId: number) => boolean,
): ShipmentCard {
  return {
    shipment,
    lines: shipment.shipment_items.length,
    pieces: shipment.shipment_items.reduce((sum, i) => sum + i.quantity, 0),
    m3: shipmentTotalM3(shipment.shipment_items, products),
    sortedPercent: sortedPercent(shipment.shipment_items, shipment.stock_sortings, isGradable),
  };
}

/** Lower case without accents, so "Kamion Ö" matches "kamion o". */
function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

/**
 * Cards whose truck name contains `search` (case and accent insensitive);
 * with `onlyToSort`, only trucks with pieces still to sort.
 */
export function filterShipmentCards(
  cards: ShipmentCard[],
  search: string,
  onlyToSort: boolean,
): ShipmentCard[] {
  const query = fold(search.trim());
  return cards.filter(
    (card) =>
      (!query || fold(card.shipment.name).includes(query)) &&
      (!onlyToSort || (card.sortedPercent !== null && card.sortedPercent < 100)),
  );
}

/** Header fields of the draft form. */
export type DraftHeader = { arrivedOn: string; name: string; comment: string };

/**
 * A comparable fingerprint of the draft form: equal fingerprints mean nothing
 * was changed. Empty lines are ignored; lines keep their order.
 */
export function draftFingerprint(header: DraftHeader, lines: DraftLine[]): string {
  return JSON.stringify({
    arrivedOn: header.arrivedOn,
    name: header.name.trim(),
    comment: header.comment.trim(),
    lines: lines.filter((l) => l.product).map((l) => [l.product!.id, l.quantity]),
  });
}

export type MissingField = 'NAME' | 'DATE' | 'LINE' | 'QTY';

/** What still stops the draft from being saved; empty when it can be saved. */
export function missingForSave(header: DraftHeader, lines: DraftLine[]): MissingField[] {
  const missing: MissingField[] = [];
  if (!header.arrivedOn) missing.push('DATE');
  if (!header.name.trim()) missing.push('NAME');
  if (invalidLines(lines).length) missing.push('QTY');
  else if (!toShipmentItems(lines).length) missing.push('LINE');
  return missing;
}

/** An unsaved new truck kept in localStorage, so a reload does not lose it. */
export type DraftBackup = DraftHeader & {
  lines: { product_id: number; quantity: number }[];
  savedAt: string;
};

/** Reads a backup written by `toDraftBackup`; anything malformed gives `null`. */
export function parseDraftBackup(raw: string | null): DraftBackup | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<DraftBackup>;
    if (
      typeof value !== 'object' || value === null ||
      typeof value.arrivedOn !== 'string' ||
      typeof value.name !== 'string' ||
      typeof value.comment !== 'string' ||
      typeof value.savedAt !== 'string' ||
      !Array.isArray(value.lines) ||
      !value.lines.every(
        (l) => l && Number.isInteger(l.product_id) && typeof l.quantity === 'number',
      )
    ) {
      return null;
    }
    return value as DraftBackup;
  } catch {
    return null;
  }
}

/** The form as a backup; lines without a product are left out. */
export function toDraftBackup(header: DraftHeader, lines: DraftLine[], now: Date): DraftBackup {
  return {
    ...header,
    lines: lines
      .filter((l) => l.product)
      .map((l) => ({ product_id: l.product!.id, quantity: l.quantity })),
    savedAt: now.toISOString(),
  };
}
