import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, WritableSignal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { Unit_id } from '@core/models/enums';
import { Product, ShipmentWithItems, StockSorting } from '@core/models/models';
import { ProductStore } from '@features/products/store/product.store';
import { ShipmentStore } from '@features/shipments/store/shipment.store';
import { ShipmentDetailComponent } from './shipment-detail.component';

function product(id: number, unit_id = Unit_id.M3): Product {
  return {
    id,
    name: `7.5x15x40${id}`,
    unit_id,
    size_id: 0,
    thickness: 7.5,
    width: 15,
    length: 400,
    m2_util: 0,
    m2_brut: 0,
    piece_per_pack: 0,
  };
}

const products = [product(1), product(2), product(3, Unit_id.M2)];
const BACKUP_KEY = 'shipment_draft_new';

type StoreFake = {
  current: WritableSignal<ShipmentWithItems | null>;
  sortings: WritableSignal<StockSorting[]>;
  sortingsLoaded: WritableSignal<boolean>;
  sortingsFailed: WritableSignal<boolean>;
  isBusy: WritableSignal<boolean>;
  save: ReturnType<typeof vi.fn>;
  loadSortings: ReturnType<typeof vi.fn>;
};

async function setUp(id: string, dialogResult: unknown = false) {
  const store: StoreFake = {
    current: signal(null),
    sortings: signal([]),
    sortingsLoaded: signal(false),
    sortingsFailed: signal(false),
    isBusy: signal(false),
    save: vi.fn().mockResolvedValue({ failed: 'error' }),
    loadSortings: vi.fn(),
  };
  const dialog = { open: vi.fn(() => ({ afterClosed: () => of(dialogResult) })) };

  await TestBed.configureTestingModule({
    imports: [ShipmentDetailComponent],
    providers: [
      {
        provide: ProductStore,
        useValue: {
          productsEntities: signal(products),
          productsEntityMap: signal(Object.fromEntries(products.map((p) => [p.id, p]))),
          fetchStocks: vi.fn(),
        },
      },
      {
        provide: ShipmentStore,
        useValue: { ...store, clearCurrent: vi.fn(), loadShipment: vi.fn() },
      },
      { provide: MatDialog, useValue: dialog },
    ],
  }).compileComponents();

  const fixture: ComponentFixture<ShipmentDetailComponent> =
    TestBed.createComponent(ShipmentDetailComponent);
  fixture.componentRef.setInput('id', id);
  fixture.detectChanges();
  return { fixture, component: fixture.componentInstance, store, dialog };
}

describe('ShipmentDetailComponent (new truck)', () => {
  let component: ShipmentDetailComponent;
  let store: StoreFake;
  let dialog: { open: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    localStorage.removeItem(BACKUP_KEY);
    ({ component, store, dialog } = await setUp('new'));
  });

  afterEach(() => localStorage.removeItem(BACKUP_KEY));

  it('starts a new draft with one empty line', () => {
    expect(component.isNew()).toBe(true);
    expect(component.isDraft()).toBe(true);
    expect(component.lines()).toHaveLength(1);
    expect(component.canSave()).toBe(false);
  });

  it('adds an empty line after a product is picked and totals the m³', () => {
    const key = component.lines()[0].key;
    component.selectProduct(key, products[0]);
    component.setQuantity(key, '49');

    expect(component.lines()).toHaveLength(2);
    expect(component.draftPieces()).toBe(49);
    expect(component.draftM3()).toBeCloseTo(49 * 0.045, 6);
  });

  it('takes m³ on a line and keeps the nearest whole pieces', () => {
    const key = component.lines()[0].key;
    component.selectProduct(key, products[0]);
    const line = () => component.lines().find((l) => l.key === key)!;
    expect(component.canTypeM3(line())).toBe(true);

    component.toggleM3(line());
    expect(component.m3Text()[key]).toBe('0.045'); // the 1 piece picked so far
    component.setM3(key, '4'); // 88.9 pieces of 0.045 m³
    expect(line().quantity).toBe(89);
    expect(component.lineM3(line())).toBeCloseTo(4.005, 6);
    expect(component.draftItems()).toEqual([{ product_id: 1, quantity: 89 }]);

    // back to pieces: the converted count stays
    component.toggleM3(line());
    expect(component.isM3(line())).toBe(false);
    expect(line().quantity).toBe(89);
  });

  it('refuses m³ that gives no whole piece', () => {
    const key = component.lines()[0].key;
    component.selectProduct(key, products[0]);
    component.name.set('Kamion 1');
    const line = () => component.lines().find((l) => l.key === key)!;
    component.toggleM3(line());
    component.setM3(key, '0.01');

    expect(line().quantity).toBe(0);
    expect(component.missing()).toEqual(['QTY']);
  });

  it('accepts a decimal comma in m³', () => {
    const key = component.lines()[0].key;
    component.selectProduct(key, products[0]);
    component.toggleM3(component.lines()[0]);
    component.setM3(key, '4,');
    expect(component.m3Text()[key]).toBe('4,'); // kept as typed
    component.setM3(key, '4,5'); // 100 pieces
    expect(component.lines()[0].quantity).toBe(100);
  });

  it('starts m³ empty (0 pieces) when the pieces were invalid', () => {
    const key = component.lines()[0].key;
    component.selectProduct(key, products[0]);
    component.setQuantity(key, '2.5');
    component.toggleM3(component.lines()[0]);
    expect(component.m3Text()[key]).toBe('');
    expect(component.lines()[0].quantity).toBe(0);
  });

  it('forgets the m³ text when the product is changed', () => {
    const key = component.lines()[0].key;
    component.selectProduct(key, products[0]);
    component.toggleM3(component.lines()[0]);
    component.clearProduct(key);
    expect(component.m3Text()).toEqual({});
  });

  it('offers no M2 products', () => {
    component.setQuery(component.lines()[0].key, '7');
    expect(component.options().map((p) => p.id)).toEqual([1, 2]);
  });

  it('says what is missing and saves once complete', async () => {
    expect(component.missing()).toEqual(['NAME', 'LINE']);

    const key = component.lines()[0].key;
    component.selectProduct(key, products[0]);
    component.name.set('Kamion 1');
    component.setQuantity(key, '0');
    expect(component.missing()).toEqual(['QTY']);

    component.setQuantity(key, '20');
    expect(component.canSave()).toBe(true);

    await component.saveDraft();
    expect(store.save).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Kamion 1' }),
      [{ product_id: 1, quantity: 20 }],
      {},
    );
  });

  it('lets an untouched page go without asking', async () => {
    expect(await component.confirmLeave()).toBe(true);
    expect(dialog.open).not.toHaveBeenCalled();
  });

  it('asks before leaving typed lines, and keeps them when the answer is no', async () => {
    component.name.set('Kamion 1');
    expect(component.dirty()).toBe(true);

    expect(await component.confirmLeave()).toBe(false);
    expect(dialog.open).toHaveBeenCalledTimes(1);
  });

  it('keeps an unsaved new truck in localStorage', () => {
    const key = component.lines()[0].key;
    component.name.set('Kamion 1');
    component.selectProduct(key, products[1]);
    TestBed.tick();

    const backup = JSON.parse(localStorage.getItem(BACKUP_KEY) ?? 'null');
    expect(backup).toEqual(
      expect.objectContaining({ name: 'Kamion 1', lines: [{ product_id: 2, quantity: 1 }] }),
    );
  });
});

describe('ShipmentDetailComponent (draft changed by someone else)', () => {
  const draft: ShipmentWithItems = {
    id: 7,
    arrived_on: '2026-11-23',
    name: 'Mine',
    comment: '',
    status: 'draft',
    created_at: '',
    updated_at: 'v1',
    validated_at: null,
    shipment_items: [{ product_id: 1, quantity: 5 }],
  };
  const theirs: ShipmentWithItems = { ...draft, name: 'Theirs', updated_at: 'v2' };

  async function editAndHitConflict(loadTheirs: boolean) {
    const ctx = await setUp('7', loadTheirs);
    ctx.store.current.set(draft);
    ctx.fixture.detectChanges();
    expect(ctx.component.name()).toBe('Mine');

    ctx.component.name.set('Mine, edited');
    ctx.store.save.mockResolvedValue({ failed: 'conflict' });
    await ctx.component.saveDraft();
    expect(ctx.store.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 7, updated_at: 'v1' }),
      expect.anything(),
      {},
    );

    // the store reloads the draft: their version arrives
    ctx.store.current.set(theirs);
    ctx.fixture.detectChanges();
    return ctx;
  }

  it('keeps the unsaved edits when the user does not load the other version', async () => {
    const { component, dialog } = await editAndHitConflict(false);
    expect(dialog.open).toHaveBeenCalledTimes(1);
    expect(component.name()).toBe('Mine, edited');
    expect(component.shipment()?.updated_at).toBe('v2'); // the next save replaces theirs
  });

  it('loads the other version when the user chooses it', async () => {
    const { component } = await editAndHitConflict(true);
    expect(component.name()).toBe('Theirs');
    expect(component.dirty()).toBe(false);
  });
});

describe('ShipmentDetailComponent (validated truck)', () => {
  const validated: ShipmentWithItems = {
    id: 5,
    arrived_on: '2026-11-23',
    name: 'Test',
    comment: '',
    status: 'validated',
    created_at: '2026-11-23T10:00:00Z',
    validated_at: '2026-11-23T11:00:00Z',
    validator: { name: 'Ruben' },
    shipment_items: [{ product_id: 1, quantity: 250 }],
  };

  it('waits for the sortings before offering Sort, and reloads them on every dialog close', async () => {
    const { fixture, component, store, dialog } = await setUp('5');
    store.current.set(validated);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.progress-row')).toBeNull();
    expect(el.querySelector('mat-spinner')).not.toBeNull();

    store.sortingsLoaded.set(true);
    fixture.detectChanges();
    const sortButton = el.querySelector<HTMLButtonElement>('.progress-action button')!;
    expect(sortButton.disabled).toBe(false);
    // the test translator shows keys; the name is passed as its parameter
    expect(el.textContent).toContain('SHIPMENTS.VALIDATED_BY');

    store.loadSortings.mockClear();
    component.openSorting(products[0], 250);
    expect(dialog.open).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ data: { product: products[0], shipmentId: 5, truckRemaining: 250 } }),
    );
    // the dialog closed without saving (backdrop / cancel): still reloaded
    expect(store.loadSortings).toHaveBeenCalledWith(5);
  });

  it('disables Sort once a line is fully sorted', async () => {
    const { fixture, store } = await setUp('5');
    store.current.set(validated);
    store.sortings.set([
      {
        id: 1,
        product_id: 1,
        shipment_id: 5,
        qty_a: 200,
        qty_b: 50,
        qty_waste: 0,
        comment: '',
        created_at: '2026-11-23T12:00:00Z',
      },
    ]);
    store.sortingsLoaded.set(true);
    fixture.detectChanges();

    const sortButton = fixture.nativeElement.querySelector('.progress-action button') as HTMLButtonElement;
    expect(sortButton.disabled).toBe(true);
  });
});
