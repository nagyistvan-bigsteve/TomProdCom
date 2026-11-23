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
  /** Version of the draft being edited; a changed draft is refused (SA007). */
  updated_at?: string;
};

/** Result of a save: the id, or the Postgres error code when it failed. */
export type SaveShipmentResult = { id: number | null; code: string | null };

/** Error code of `save_shipment` when the draft was changed by someone else. */
export const DRAFT_CHANGED = 'SA007';

/** Shipments per page in the list. */
export const SHIPMENTS_PAGE_SIZE = 50;

const PEOPLE = 'creator:created_by(name), validator:validated_by(name)';

/**
 * Truck deliveries (`shipments`, `shipment_items`). The tables are read-only
 * through the API: writes go through the save / validate / delete RPCs so
 * header, lines and stock change together. Failures are reported by the
 * central toast.
 */
@Injectable({ providedIn: 'root' })
export class ShipmentsService {
  private supabaseService = inject(SupabaseService);

  /** One page of shipments, newest first. */
  getShipmentsObs(status: ShipmentStatus, page = 0): Observable<ShipmentOverview[]> {
    const fromRow = page * SHIPMENTS_PAGE_SIZE;
    return from(
      this.supabaseService.client
        .from('shipments')
        .select(
          '*, shipment_items(product_id, quantity), stock_sortings(product_id, qty_a, qty_b, qty_waste)',
        )
        .eq('status', status)
        .order('arrived_on', { ascending: false })
        .order('id', { ascending: false })
        .range(fromRow, fromRow + SHIPMENTS_PAGE_SIZE - 1),
    ).pipe(map((result) => (unwrapResult(result) ?? []) as ShipmentOverview[]));
  }

  getShipmentObs(id: number): Observable<ShipmentWithItems | null> {
    return from(
      this.supabaseService.client
        .from('shipments')
        .select(`*, shipment_items(id, product_id, quantity), ${PEOPLE}`)
        .eq('id', id)
        .maybeSingle(),
    ).pipe(map((result) => unwrapResult(result) as ShipmentWithItems | null));
  }

  /** Creates a draft (header without id) or replaces a draft. */
  async saveShipment(
    header: ShipmentHeader,
    items: Pick<ShipmentItem, 'product_id' | 'quantity'>[],
  ): Promise<SaveShipmentResult> {
    const { data, error } = await this.supabaseService.client.rpc('save_shipment', {
      p_shipment: header,
      p_items: items,
    });

    if (error) {
      console.error('Fail to save shipment', error);
      return { id: null, code: error.code ?? null };
    }
    return { id: data as number, code: null };
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
