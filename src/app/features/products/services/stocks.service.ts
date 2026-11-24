import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '@core/services/supabase.service';
import { unwrapResult } from '@core/services/supabase-result.util';
import { Stock } from '@core/models/models';
import { from, map, Observable } from 'rxjs';

/**
 * Queries for the `stocks` table: one row per product and grade (A / B / AB).
 * Rows are created by the database (products_stock_rows trigger); bookings and
 * deliveries are applied by the order_items triggers.
 */
@Injectable({
  providedIn: 'root',
})
export class StocksService {
  private supabaseService = inject(SupabaseService);

  getAllStocksObs(): Observable<Stock[]> {
    return from(
      this.supabaseService.client.from('stocks').select('*'),
    ).pipe(map((result) => unwrapResult(result) ?? []));
  }

  /**
   * Sets one grade's stock (inventory correction) through `set_stock`: refused
   * with SA006 when the stored value is no longer `expected` (someone changed
   * it meanwhile). Every edit is logged in `stock_adjustments`.
   */
  setStockObs(id: number, expected: number, stock: number): Observable<void> {
    return from(
      this.supabaseService.client.rpc('set_stock', {
        p_stock_id: id,
        p_expected: expected,
        p_new: stock,
      }),
    ).pipe(
      map(({ error }) => {
        if (error) throw error;
      }),
    );
  }
}

/** Error code of `set_stock` when the stock was changed meanwhile. */
export const STOCK_CHANGED = 'SA006';
