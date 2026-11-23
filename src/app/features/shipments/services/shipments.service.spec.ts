import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { SupabaseService } from '@core/services/supabase.service';
import { DRAFT_CHANGED, ShipmentsService } from './shipments.service';

function setUp(result: { data?: unknown; error: unknown }) {
  const rpc = vi.fn().mockResolvedValue({ data: result.data ?? null, error: result.error });
  TestBed.configureTestingModule({
    providers: [{ provide: SupabaseService, useValue: { client: { rpc } } }],
  });
  vi.spyOn(console, 'error').mockImplementation(() => {});
  return { rpc, service: TestBed.inject(ShipmentsService) };
}

describe('ShipmentsService', () => {
  it('saves a draft with its version and returns the id', async () => {
    const { rpc, service } = setUp({ data: 7, error: null });
    const header = {
      id: 7,
      updated_at: '2026-11-23T10:00:00.123456+00:00',
      arrived_on: '2026-11-23',
      name: 'Kamion',
      comment: '',
    };
    const items = [{ product_id: 1, quantity: 20 }];

    expect(await service.saveShipment(header, items)).toEqual({ id: 7, code: null });
    expect(rpc).toHaveBeenCalledWith('save_shipment', { p_shipment: header, p_items: items });
  });

  it('reports why a save failed, so a changed draft can be reloaded', async () => {
    const { service } = setUp({ error: { code: DRAFT_CHANGED } });
    expect(
      await service.saveShipment({ arrived_on: '2026-11-23', name: 'K', comment: '' }, []),
    ).toEqual({ id: null, code: DRAFT_CHANGED });
  });

  it('validates and deletes through their RPCs', async () => {
    const { rpc, service } = setUp({ error: null });
    expect(await service.validateShipment(5)).toBe(true);
    expect(await service.deleteShipment(6)).toBe(true);
    expect(rpc).toHaveBeenCalledWith('validate_shipment', { p_shipment_id: 5 });
    expect(rpc).toHaveBeenCalledWith('delete_shipment', { p_shipment_id: 6 });
  });
});
