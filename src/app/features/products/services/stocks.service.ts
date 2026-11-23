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

  /** Overwrites one grade's stock (inventory correction). */
  updateStockObs(id: number, stock: number): Observable<void> {
    return from(
      this.supabaseService.client
        .from('stocks')
        .update({ stock })
        .eq('id', id),
    ).pipe(
      map(({ error }) => {
        if (error) throw error;
      }),
    );
  }
}
