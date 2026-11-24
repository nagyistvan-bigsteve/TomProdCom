import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { vi } from 'vitest';
import { SupabaseService } from '@core/services/supabase.service';
import { STOCK_CHANGED, StocksService } from './stocks.service';
import { SortingsService } from './sortings.service';

function fakeSupabase(result: { data?: unknown; error: unknown }) {
  const rpc = vi.fn().mockResolvedValue({ data: result.data ?? null, error: result.error });
  return { rpc, service: { client: { rpc } } as unknown as SupabaseService };
}

describe('StocksService', () => {
  it('sets a stock through set_stock with the expected value', async () => {
    const { rpc, service } = fakeSupabase({ error: null });
    TestBed.configureTestingModule({ providers: [{ provide: SupabaseService, useValue: service }] });

    await firstValueFrom(TestBed.inject(StocksService).setStockObs(12, 9, 7));
    expect(rpc).toHaveBeenCalledWith('set_stock', { p_stock_id: 12, p_expected: 9, p_new: 7 });
  });

  it('throws the database error, e.g. "changed meanwhile"', async () => {
    const { service } = fakeSupabase({ error: { code: STOCK_CHANGED } });
    TestBed.configureTestingModule({ providers: [{ provide: SupabaseService, useValue: service }] });

    await expect(
      firstValueFrom(TestBed.inject(StocksService).setStockObs(12, 9, 7)),
    ).rejects.toEqual({ code: STOCK_CHANGED });
  });
});

describe('SortingsService', () => {
  it('records a sorting with all RPC parameters', async () => {
    const { rpc, service } = fakeSupabase({ error: null });
    TestBed.configureTestingModule({ providers: [{ provide: SupabaseService, useValue: service }] });

    const ok = await TestBed.inject(SortingsService).recordSorting({
      productId: 1,
      a: 40,
      b: 8,
      waste: 1,
      shipmentId: 5,
      comment: 'ramp',
    });
    expect(ok).toBe(true);
    expect(rpc).toHaveBeenCalledWith('record_sorting', {
      p_product_id: 1,
      p_qty_a: 40,
      p_qty_b: 8,
      p_qty_waste: 1,
      p_shipment_id: 5,
      p_comment: 'ramp',
    });
  });

  it('sends no shipment and an empty comment when none is given', async () => {
    const { rpc, service } = fakeSupabase({ error: null });
    TestBed.configureTestingModule({ providers: [{ provide: SupabaseService, useValue: service }] });

    await TestBed.inject(SortingsService).recordSorting({ productId: 1, a: 1, b: 0, waste: 0 });
    expect(rpc).toHaveBeenCalledWith(
      'record_sorting',
      expect.objectContaining({ p_shipment_id: null, p_comment: '' }),
    );
  });

  it('returns false when the database refuses', async () => {
    const { service } = fakeSupabase({ error: { code: 'SA005' } });
    TestBed.configureTestingModule({ providers: [{ provide: SupabaseService, useValue: service }] });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(await TestBed.inject(SortingsService).deleteSorting(3)).toBe(false);
  });

  it('lists trucks with pieces left, or null on failure', async () => {
    const trucks = [{ id: 9, name: 'T', arrived_on: '2026-11-20', received: 30, sorted: 10, remaining: 20 }];
    const ok = fakeSupabase({ data: trucks, error: null });
    TestBed.configureTestingModule({ providers: [{ provide: SupabaseService, useValue: ok.service }] });

    expect(await TestBed.inject(SortingsService).trucksWithRemaining(1)).toEqual(trucks);
    expect(ok.rpc).toHaveBeenCalledWith('shipments_with_remaining', { p_product_id: 1 });
  });
});
