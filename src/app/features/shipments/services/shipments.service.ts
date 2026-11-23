import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '@core/services/supabase.service';
import { unwrapResult } from '@core/services/supabase-result.util';
import {
  Shipment,
  ShipmentItem,
  ShipmentStatus,
  ShipmentWithItems,
  StockSorting,
} from '@core/models/models';
import { from, map, Observable } from 'rxjs';

/** A shipment with its lines and the sortings recorded against it. */
export type ShipmentOverview = ShipmentWithItems & {
  stock_sortings: Pick<StockSorting, 'product_id' | 'qty_a' | 'qty_b' | 'qty_waste'>[];
};

export type ShipmentHeader = Pick<Shipment, 'arrived_on' | 'name' | 'comment'> & {
  id?: number;
};

/**
 * Truck deliveries (`shipments`, `shipment_items`). Writes go through the
 * save / validate / delete RPCs so header, lines and stock change together;
 * failures are reported by the central toast.
 */
@Injectable({ providedIn: 'root' })
export class ShipmentsService {
  private supabaseService = inject(SupabaseService);

  getShipmentsObs(status: ShipmentStatus): Observable<ShipmentOverview[]> {
    return from(
      this.supabaseService.client
        .from('shipments')
        .select(
          '*, shipment_items(product_id, quantity), stock_sortings(product_id, qty_a, qty_b, qty_waste)',
        )
        .eq('status', status)
        .order('arrived_on', { ascending: false })
        .order('id', { ascending: false }),
    ).pipe(map((result) => (unwrapResult(result) ?? []) as ShipmentOverview[]));
  }

  getShipmentObs(id: number): Observable<ShipmentWithItems | null> {
    return from(
      this.supabaseService.client
        .from('shipments')
        .select('*, shipment_items(id, product_id, quantity)')
        .eq('id', id)
        .maybeSingle(),
    ).pipe(map((result) => unwrapResult(result) as ShipmentWithItems | null));
  }

  /** Creates a draft (header without id) or replaces a draft; returns its id or null. */
  async saveShipment(
    header: ShipmentHeader,
    items: Pick<ShipmentItem, 'product_id' | 'quantity'>[],
  ): Promise<number | null> {
    const { data, error } = await this.supabaseService.client.rpc('save_shipment', {
      p_shipment: header,
      p_items: items,
    });

    if (error) {
      console.error('Fail to save shipment', error);
      return null;
    }
    return data as number;
  }

  /** Adds the lines to AB stock; a shipment can be validated once. */
  async validateShipment(id: number): Promise<boolean> {
    const { error } = await this.supabaseService.client.rpc('validate_shipment', {
      p_shipment_id: id,
    });

    if (error) {
      console.error('Fail to validate shipment', error);
      return false;
    }
    return true;
  }

  /** Deletes a draft. */
  async deleteShipment(id: number): Promise<boolean> {
    const { error } = await this.supabaseService.client.rpc('delete_shipment', {
      p_shipment_id: id,
    });

    if (error) {
      console.error('Fail to delete shipment', error);
      return false;
    }
    return true;
  }
}
