import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { vi } from 'vitest';
import { ProductStore } from '@features/products/store/product.store';
import { SortingsService } from '@features/products/services/sortings.service';
import { NotificationService } from '@shared/utils/notification.service';
import { DRAFT_CHANGED, ShipmentsService } from '@features/shipments/services/shipments.service';
import { appendNew, ShipmentStore } from './shipment.store';

const shipment = {
  id: 7,
  arrived_on: '2026-11-23',
  name: 'Kamion',
  comment: '',
  status: 'draft' as const,
  created_at: '',
  validated_at: null,
  shipment_items: [],
};

function setUp(saveResult: { id: number | null; code: string | null }) {
  const service = {
    saveShipment: vi.fn().mockResolvedValue(saveResult),
    validateShipment: vi.fn().mockResolvedValue(true),
    deleteShipment: vi.fn().mockResolvedValue(true),
    getShipmentObs: vi.fn(() => of(shipment)),
    getShipmentsObs: vi.fn(() => of([])),
  };
  const sortings = {
    getSortingsByShipmentObs: vi.fn(() => of([])),
    deleteSorting: vi.fn().mockResolvedValue(false),
  };
  const notify = { success: vi.fn(), error: vi.fn() };
  const productStore = { fetchStocks: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      { provide: ShipmentsService, useValue: service },
      { provide: SortingsService, useValue: sortings },
      { provide: NotificationService, useValue: notify },
      { provide: ProductStore, useValue: productStore },
    ],
  });
  return { store: TestBed.inject(ShipmentStore), service, sortings, notify, productStore };
}

describe('ShipmentStore', () => {
  it('saves, reloads the draft for its new version and is idle afterwards', async () => {
    const { store, service, notify } = setUp({ id: 7, code: null });
    const outcome = await store.save({ arrived_on: '2026-11-23', name: 'K', comment: '' }, []);

    expect(outcome).toEqual({ id: 7 });
    expect(service.getShipmentObs).toHaveBeenCalledWith(7);
    expect(notify.success).toHaveBeenCalledWith('SHIPMENTS.SAVED');
    expect(store.isBusy()).toBe(false);
  });

  it('saves quietly before validating (one message only)', async () => {
    const { store, notify } = setUp({ id: 7, code: null });
    await store.save({ arrived_on: '2026-11-23', name: 'K', comment: '' }, [], { quiet: true });
    expect(notify.success).not.toHaveBeenCalled();
  });

  it('reloads a draft someone else changed and reports a conflict', async () => {
    const { store, service } = setUp({ id: null, code: DRAFT_CHANGED });
    const outcome = await store.save({ id: 7, arrived_on: '2026-11-23', name: 'K', comment: '' }, []);

    expect(outcome).toEqual({ failed: 'conflict' });
    expect(service.getShipmentObs).toHaveBeenCalledWith(7);
    expect(store.isBusy()).toBe(false);
  });

  it('validates: stock reload, one message, shipment and sortings reloaded', async () => {
    const { store, productStore, notify, sortings } = setUp({ id: 7, code: null });
    expect(await store.validate(7)).toBe(true);

    expect(productStore.fetchStocks).toHaveBeenCalled();
    expect(notify.success).toHaveBeenCalledTimes(1);
    expect(sortings.getSortingsByShipmentObs).toHaveBeenCalledWith(7);
    expect(store.sortingsLoaded()).toBe(true);
    expect(store.isBusy()).toBe(false);
  });

  it('reloads the sortings even when an undo is refused', async () => {
    const { store, sortings } = setUp({ id: 7, code: null });
    expect(await store.undoSorting(3, 7)).toBe(false);
    expect(sortings.getSortingsByShipmentObs).toHaveBeenCalledWith(7);
  });

  it('keeps the shown shipment while it reloads', () => {
    const { store, service } = setUp({ id: 7, code: null });
    store.loadShipment(7);
    expect(store.current()?.id).toBe(7);

    service.getShipmentObs.mockReturnValue(of({ ...shipment, name: 'Renamed' }));
    store.loadShipment(7);
    expect(store.current()?.name).toBe('Renamed');
  });

  it('drops a late response that belongs to the previous user', () => {
    const { store, service } = setUp({ id: 7, code: null });
    const response = new Subject<typeof shipment>();
    service.getShipmentObs.mockReturnValue(response as never);
    store.loadShipment(7);
    store.reset();
    response.next(shipment);
    response.complete();
    expect(store.current()).toBeNull();

    // a request started after the reset is applied as usual
    service.getShipmentObs.mockReturnValue(of(shipment));
    store.loadShipment(7);
    expect(store.current()?.id).toBe(7);
  });

  it('appends a page without trucks already shown (pages can overlap)', () => {
    const a = { ...shipment, id: 1, stock_sortings: [] };
    const b = { ...shipment, id: 2, stock_sortings: [] };
    expect(appendNew([a, b], [b, { ...shipment, id: 3, stock_sortings: [] }]).map((s) => s.id)).toEqual([
      1, 2, 3,
    ]);
  });

  it('clears the list when the status changes', () => {
    const { store, service } = setUp({ id: 7, code: null });
    store.loadList('validated');
    expect(store.status()).toBe('validated');
    expect(service.getShipmentsObs).toHaveBeenCalledWith('validated', 0);
    expect(store.hasMore()).toBe(false);
  });
});
