import { describe, it, expect } from 'vitest';
import { Unit_id } from '@core/models/enums';
import type { Product } from '@core/models/models';
import {
  DraftLine,
  draftFingerprint,
  filterShipmentCards,
  invalidLines,
  missingForSave,
  parseDraftBackup,
  shipmentProgress,
  sortedByProduct,
  sortedPercent,
  toDraftBackup,
  toShipmentCard,
  toShipmentItems,
  withTrailingEmptyLine,
} from './shipment.util';

function product(id: number): Product {
  return {
    id,
    name: `P${id}`,
    unit_id: Unit_id.M3,
    size_id: 0,
    thickness: 7.5,
    width: 15,
    length: 400,
    m2_util: 0,
    m2_brut: 0,
    piece_per_pack: 0,
  };
}

const line = (key: number, p: Product | null, quantity: number): DraftLine => ({
  key,
  product: p,
  quantity,
});

describe('toShipmentItems', () => {
  it('drops empty lines and sums the same product', () => {
    expect(
      toShipmentItems([
        line(1, product(1), 20),
        line(2, product(2), 5),
        line(3, product(1), 29),
        line(4, null, 0),
      ]),
    ).toEqual([
      { product_id: 1, quantity: 49 },
      { product_id: 2, quantity: 5 },
    ]);
  });

  it('skips zero, negative and fractional quantities', () => {
    expect(toShipmentItems([line(1, product(1), 0), line(2, product(2), -3), line(3, product(3), 1.5)])).toEqual([]);
    expect(invalidLines([line(1, product(1), 0), line(2, null, 0), line(3, product(3), 2)]).map((l) => l.key)).toEqual([1]);
  });
});

describe('withTrailingEmptyLine', () => {
  let key = 100;
  const next = () => ++key;

  it('adds an empty line when the last one has a product', () => {
    const lines = withTrailingEmptyLine([line(1, product(1), 3)], next);
    expect(lines).toHaveLength(2);
    expect(lines[1].product).toBeNull();
  });

  it('keeps a single trailing empty line and starts an empty draft with one', () => {
    const lines = [line(1, product(1), 3), line(2, null, 0)];
    expect(withTrailingEmptyLine(lines, next)).toBe(lines);
    expect(withTrailingEmptyLine([], next)).toHaveLength(1);
  });
});

describe('shipmentProgress / sortedPercent', () => {
  const items = [
    { product_id: 1, quantity: 49 },
    { product_id: 2, quantity: 10 },
  ];
  const sortings = [
    { product_id: 1, qty_a: 30, qty_b: 5, qty_waste: 0 },
    { product_id: 1, qty_a: 10, qty_b: 4, qty_waste: 0 },
    { product_id: 2, qty_a: 12, qty_b: 0, qty_waste: 0 }, // more than this truck brought
  ];

  it('tracks received, sorted and remaining per line', () => {
    expect(shipmentProgress(items, sortings)).toEqual([
      { product_id: 1, received: 49, sorted: 49, remaining: 0 },
      { product_id: 2, received: 10, sorted: 12, remaining: 0 },
    ]);
  });

  it('caps each line at what it received', () => {
    expect(sortedPercent(items, sortings, () => true)).toBe(100);
    expect(sortedPercent(items, sortings.slice(0, 1), () => true)).toBe(Math.round((35 / 59) * 100));
  });

  it('ignores lines that cannot be graded', () => {
    expect(sortedPercent(items, [], (id) => id === 2)).toBe(0);
    // nothing gradable (or products not loaded yet): no percentage, shown as "–"
    expect(sortedPercent(items, [], () => false)).toBeNull();
  });
});

describe('sortedByProduct', () => {
  it('sums A + B + waste per product', () => {
    const result = sortedByProduct([
      { product_id: 1, qty_a: 30, qty_b: 5, qty_waste: 1 },
      { product_id: 1, qty_a: 2, qty_b: 0, qty_waste: 0 },
      { product_id: 2, qty_a: 0, qty_b: 0, qty_waste: 4 },
    ]);
    expect([...result]).toEqual([
      [1, 38],
      [2, 4],
    ]);
  });
});

describe('invalidLines', () => {
  it('flags lines with a product and a zero, negative or fractional quantity', () => {
    const lines = [line(1, product(1), 0), line(2, product(2), 2.5), line(3, product(3), 4), line(4, null, 0)];
    expect(invalidLines(lines).map((l) => l.key)).toEqual([1, 2]);
  });
});

describe('draftFingerprint', () => {
  const header = { arrivedOn: '2026-11-23', name: 'Kamion', comment: '' };

  it('ignores surrounding spaces and the trailing empty line', () => {
    const a = draftFingerprint(header, [line(1, product(1), 5), line(2, null, 0)]);
    const b = draftFingerprint({ ...header, name: ' Kamion ' }, [line(7, product(1), 5)]);
    expect(a).toBe(b);
  });

  it('changes with any field or line', () => {
    const base = draftFingerprint(header, [line(1, product(1), 5)]);
    expect(draftFingerprint({ ...header, comment: 'x' }, [line(1, product(1), 5)])).not.toBe(base);
    expect(draftFingerprint(header, [line(1, product(1), 6)])).not.toBe(base);
    expect(draftFingerprint(header, [line(1, product(2), 5)])).not.toBe(base);
  });
});

describe('missingForSave', () => {
  it('lists name, date and lines that are missing', () => {
    expect(missingForSave({ arrivedOn: '', name: ' ', comment: '' }, [line(1, null, 0)])).toEqual([
      'DATE',
      'NAME',
      'LINE',
    ]);
  });

  it('names an invalid quantity instead of a missing line', () => {
    expect(
      missingForSave({ arrivedOn: '2026-11-23', name: 'K', comment: '' }, [line(1, product(1), 0)]),
    ).toEqual(['QTY']);
  });

  it('is empty when the draft can be saved', () => {
    expect(
      missingForSave({ arrivedOn: '2026-11-23', name: 'K', comment: '' }, [line(1, product(1), 3)]),
    ).toEqual([]);
  });
});

describe('draft backup', () => {
  const header = { arrivedOn: '2026-11-23', name: 'Kamion', comment: 'c' };

  it('round-trips through JSON without the empty lines', () => {
    const backup = toDraftBackup(header, [line(1, product(1), 5), line(2, null, 0)], new Date('2026-11-23T10:00:00Z'));
    expect(backup.lines).toEqual([{ product_id: 1, quantity: 5 }]);
    expect(parseDraftBackup(JSON.stringify(backup))).toEqual(backup);
  });

  it('rejects anything malformed', () => {
    expect(parseDraftBackup(null)).toBeNull();
    expect(parseDraftBackup('not json')).toBeNull();
    expect(parseDraftBackup('{"name":"x"}')).toBeNull();
    expect(
      parseDraftBackup(
        JSON.stringify({ ...header, savedAt: 'x', lines: [{ product_id: 'a', quantity: 1 }] }),
      ),
    ).toBeNull();
  });
});

describe('shipment cards', () => {
  const overview = (id: number, name: string, sorted: number) => ({
    id,
    name,
    arrived_on: '2026-11-23',
    comment: '',
    status: 'validated' as const,
    created_at: '',
    validated_at: '',
    shipment_items: [{ product_id: 1, quantity: 10 }],
    stock_sortings: sorted ? [{ product_id: 1, qty_a: sorted, qty_b: 0, qty_waste: 0 }] : [],
  });
  const products = { 1: product(1) };
  const cards = [
    toShipmentCard(overview(1, 'Kamion Ödön', 10), products, () => true),
    toShipmentCard(overview(2, 'Truck 2', 4), products, () => true),
  ];

  it('builds pieces, lines and sorted %', () => {
    expect(cards[1]).toEqual(
      expect.objectContaining({ lines: 1, pieces: 10, sortedPercent: 40 }),
    );
  });

  it('filters by name ignoring case and accents', () => {
    expect(filterShipmentCards(cards, 'odon', false).map((c) => c.shipment.id)).toEqual([1]);
    expect(filterShipmentCards(cards, '  ', false)).toHaveLength(2);
  });

  it('"to sort" keeps only trucks with pieces left', () => {
    expect(filterShipmentCards(cards, '', true).map((c) => c.shipment.id)).toEqual([2]);
  });
});
