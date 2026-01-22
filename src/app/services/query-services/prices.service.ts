import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../supabase.service';
import { Price2, PriceResponse2, Product, Products } from '../../models/models';
import { Category, Size_id, Unit_id } from '../../models/enums';
import { catchError, from, map, Observable, of, switchMap } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class PricesService {
  private supabaseService = inject(SupabaseService);

  /**
   * Get all data from the prices_new table
   *
   * @returns array of prices or null in case of an error
   */
  async getAllPrices(): Promise<Price2[] | null> {
    try {
      const { data, error } = await this.supabaseService.client
        .from('prices_new')
        .select('*');

      if (error) throw error;

      return data as Price2[];
    } catch (error) {
      console.error('Fail to fetch prices', error);
      return null;
    }
  }

  /**
   * Fetch prices for a specific product
   * Returns the prices by product_id or by the specific filters
   *
   * @returns array of prices for a product
   */
  async getPricesForProduct(product: Product): Promise<Price2[] | null> {
    try {
      const { data, error } = await this.supabaseService.client
        .from('prices_new')
        .select('*')
        .or(`product_id.eq.${product.id}`);

      if (error) throw error;

      if (data && data.length > 0) {
        return data;
      }

      const { data: priceData, error: priceError } =
        await this.supabaseService.client
          .from('prices_new')
          .select('*')
          .match({
            unit_id: product.unit_id,
            size_id: product.size_id,
          })
          .is('product_id', null);

      if (priceError) throw priceError;

      return priceData;
    } catch (error) {
      console.error('Error fetching product prices:', error);
      return null;
    }
  }

  /**
   *
   * @param unit_id
   * @param category
   * @param size_id
   * @returns
   */
  async getPrice(
    unit_id: Unit_id,
    category: Category,
    size_id: Size_id,
  ): Promise<Price2 | null> {
    try {
      const { data, error } = await this.supabaseService.client
        .from('prices_new')
        .select('*')
        .eq('unit_id', unit_id)
        .eq('size_id', size_id)
        .eq('category_id', category)
        .is('product_id', null)
        .single();

      if (error) throw error;

      return data as Price2;
    } catch (error) {
      console.error('Fail to fetch price by filter', error);
      return null;
    }
  }

  async getUnicPriceList(): Promise<PriceResponse2[] | []> {
    try {
      const { data, error } = await this.supabaseService.client
        .from('prices_new')
        .select(
          `id,
          unit_id,
          category_id,
          size_id,
          price,
          product:product_id (id, name)`,
        )
        .not('product_id', 'is', null);

      if (error) throw error;

      return (data ?? []).map(
        (price): PriceResponse2 => ({
          id: price.id,
          unit_id: price.unit_id,
          category_id: price.category_id,
          size_id: price.size_id,
          price: price.price,
          product: Array.isArray(price.product)
            ? price.product[0]
            : price.product || { id: 0, name: '' },
        }),
      );
    } catch (error) {
      console.error('Fail to fetch unic prices', error);
      return [];
    }
  }

  async getProductsWithoutPrice(): Promise<Products | []> {
    try {
      const { data, error } = await this.supabaseService.client.rpc(
        'products_without_prices',
      );

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Failed to fetch products without prices', error);
      return [];
    }
  }

  async changePrice(id: number, new_price: number): Promise<boolean> {
    try {
      const { error } = await this.supabaseService.client
        .from('prices_new')
        .update({ price: new_price })
        .eq('id', id);

      if (error) throw error;

      return true;
    } catch (error) {
      console.error('Fail to update price', error);
      return false;
    }
  }

  async addPrice(price: Partial<Price2>): Promise<boolean> {
    try {
      const { error } = await this.supabaseService.client
        .from('prices_new')
        .insert(price);

      if (error) throw error;

      return true;
    } catch (error) {
      console.error('Fail to add price', error);
      return false;
    }
  }
}
