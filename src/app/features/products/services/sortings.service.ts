import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '@core/services/supabase.service';
import { unwrapResult } from '@core/services/supabase-result.util';
import { StockSorting, TruckWithRemaining } from '@core/models/models';
import { from, map, Observable } from 'rxjs';

export type SortingRequest = {
  productId: number;
  a: number;
  b: number;
  waste: number;
  shipmentId?: number | null;
  comment?: string;
};

/**
 * Sorting AB pieces into A, B and waste (`stock_sortings`). The stock
 * movement happens in the database together with the row (`record_sorting`,
 * `delete_sorting`); failures are reported by the central toast.
 */
@Injectable({ providedIn: 'root' })
export class SortingsService {
  private supabaseService = inject(SupabaseService);

  /** Returns false when the database refused (e.g. not enough AB stock). */
  async recordSorting(request: SortingRequest): Promise<boolean> {
    const { error } = await this.supabaseService.client.rpc('record_sorting', {
      p_product_id: request.productId,
      p_qty_a: request.a,
      p_qty_b: request.b,
      p_qty_waste: request.waste,
      p_shipment_id: request.shipmentId ?? null,
      p_comment: request.comment ?? '',
    });

    if (error) {
      console.error('Fail to record sorting', error);
      return false;
    }
    return true;
  }

  /** Undoes a sorting: its pieces go back into AB. */
  async deleteSorting(id: number): Promise<boolean> {
    const { error } = await this.supabaseService.client.rpc('delete_sorting', {
      p_sorting_id: id,
    });

    if (error) {
      console.error('Fail to delete sorting', error);
      return false;
    }
    return true;
  }

  getSortingsByShipmentObs(shipmentId: number): Observable<StockSorting[]> {
    return from(
      this.supabaseService.client
        .from('stock_sortings')
        .select('*, sorter:created_by(name)')
        .eq('shipment_id', shipmentId)
        .order('created_at', { ascending: false }),
    ).pipe(map((result) => (unwrapResult(result) ?? []) as StockSorting[]));
  }

  /** Validated trucks that still have unsorted pieces of the product, oldest first. */
  async trucksWithRemaining(productId: number): Promise<TruckWithRemaining[] | null> {
    const { data, error } = await this.supabaseService.client.rpc('shipments_with_remaining', {
      p_product_id: productId,
    });

    if (error) {
      console.error('Fail to load trucks with pieces left', error);
      return null;
    }
    return (data ?? []) as TruckWithRemaining[];
  }
}
