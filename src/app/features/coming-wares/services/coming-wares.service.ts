import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '@core/services/supabase.service';
import {
  ComingWares,
  ComingWaresItem,
  ComingWaresItemResponse,
  Product,
} from '@core/models/models';
import { Category } from '@core/models/enums';
import { unwrapResult } from '@core/services/supabase-result.util';
import { from, map, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ComingWaresService {
  private supabaseService = inject(SupabaseService);

  async getAllComingWares(verifieds: boolean): Promise<ComingWares[] | null> {
    try {
      const { data, error } = await this.supabaseService.client
        .from('coming_wares')
        .select('*')
        .order('expected_delivery', { ascending: true })
        .eq('verified', verifieds);

      if (error) throw error;

      return data as ComingWares[];
    } catch (error) {
      console.error('Fail to fetch the coming wares', error);
      return null;
    }
  }

  getComingWaresItemsById(id: number): Observable<ComingWaresItemResponse[]> {
    return from(
      this.supabaseService.client
        .from('coming_wares_items')
        .select(
          `id, 
          order_id,
          product:product_id!inner (id, name, unit_id), 
          category:category!inner (name), 
          quantity,
          for_order,
          is_correct,
          comment`
        )
        .eq('order_id', id)
    ).pipe(
      map((result) => {
        return (unwrapResult(result) ?? []).map(
          (item): ComingWaresItemResponse => ({
            id: item.id,
            order_id: item.order_id,
            product: Array.isArray(item.product)
              ? item.product[0]
              : item.product || { id: 0, name: '', unit_id: 0 },
            category: Array.isArray(item.category)
              ? item.category[0]
              : item.category || { name: '' },
            quantity: item.quantity,
            for_order: item.for_order,
            is_correct: item.is_correct,
            comment: item.comment,
          })
        );
      })
    );
  }

  // Marks the shipment verified and adds its correct warehouse items to stock
  // in one transaction. Fails for a shipment that is already verified.
  async verifyComingWares(id: number): Promise<boolean> {
    const { error } = await this.supabaseService.client.rpc(
      'verify_coming_wares',
      { p_wares_id: id },
    );

    if (error) {
      console.error('Fail to verify the coming wares', error);
      return false;
    }

    return true;
  }

  async addCommentOnItem(id: number, comment: string): Promise<boolean> {
    try {
      const { error } = await this.supabaseService.client
        .from('coming_wares_items')
        .update({ comment })
        .eq('id', id)
        .single();

      if (error) throw error;

      return true;
    } catch (error) {
      console.error('Fail to update the item comment', error);
      return false;
    }
  }

  async itemIsCorrect(id: number, isCorrect: boolean | null): Promise<boolean> {
    try {
      const { error } = await this.supabaseService.client
        .from('coming_wares_items')
        .update({ is_correct: isCorrect })
        .eq('id', id)
        .single();

      if (error) throw error;

      return true;
    } catch (error) {
      console.error('Fail to update the item status', error);
      return false;
    }
  }

  async placeOrder(
    expected_delivery: Date,
    name: string,
    total_quantity: number,
    all_for_order: boolean,
    comment: string,
    products: {
      product: Product;
      category: Category;
      quantity: number;
      for_order: boolean;
    }[]
  ): Promise<boolean> {
    // One transaction: the shipment and its items are saved together
    const { error } = await this.supabaseService.client.rpc(
      'place_coming_wares',
      {
        p_wares: {
          expected_delivery,
          name,
          total_quantity,
          all_for_order,
          comment,
        },
        p_items: products.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
          category: item.category,
          for_order: item.for_order,
        })),
      },
    );

    if (error) {
      console.error('Fail to save the coming wares', error);
      return false;
    }

    return true;
  }

  async deleteComingWares(order_id: number): Promise<boolean> {
    const { error } = await this.supabaseService.client.rpc(
      'delete_coming_wares',
      { p_wares_id: order_id },
    );

    if (error) {
      console.error('Fail to delete the coming wares', error);
      return false;
    }

    return true;
  }
}
