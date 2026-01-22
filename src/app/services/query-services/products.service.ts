import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../supabase.service';
import { catchError, from, map, Observable, of } from 'rxjs';
import { Product, Products } from '../../models/models';
import { Size_id, Unit_id } from '../../models/enums';
import { StocksService } from './stocks.service';

@Injectable({
  providedIn: 'root',
})
export class ProductsService {
  private supabaseService = inject(SupabaseService);
  private stockService = inject(StocksService);

  getProducts(): Observable<Products> {
    return from(this.supabaseService.client.from('products').select('*')).pipe(
      map(({ data }) => data ?? []), // Ensure an empty array if null
      catchError((error) => {
        console.error('Error fetching products:', error);
        return of([]); // Return an empty array on error
      }),
    );
  }

  async getProductsByIds(ids: number[]): Promise<Products | null> {
    try {
      const { data, error } = await this.supabaseService.client
        .from('products')
        .select('*')
        .in('id', ids);

      if (error) throw error;

      return data as Products;
    } catch (error) {
      console.error('Fail to fetch products by ids', error);
      return null;
    }
  }

  async addProduct(product: Product): Promise<Product | null> {
    try {
      const { data, error } = await this.supabaseService.client
        .from('products')
        .insert(product)
        .select()
        .single();

      if (error) throw error;

      this.stockService.addStock({
        product_id: data.id,
        stock: 0,
        booked_stock: 0,
      });

      return data;
    } catch (error) {
      console.error('Fail to add product', error);
      return null;
    }
  }

  async updateProduct(product: Product): Promise<boolean> {
    try {
      const { error } = await this.supabaseService.client
        .from('products')
        .update(product)
        .eq('id', product.id);

      if (error) throw error;

      return true;
    } catch (error) {
      console.error('Fail to update product', error);
      return false;
    }
  }

  async getProductsByFilter(
    unit_id: Unit_id,
    size_id: Size_id,
  ): Promise<Products | null> {
    try {
      const { data, error } = await this.supabaseService.client
        .from('products')
        .select('*')
        .eq('unit_id', unit_id)
        .eq('size_id', size_id);

      if (error) throw error;

      return data as Products;
    } catch (error) {
      console.error('Fail to fetch products by filter', error);
      return null;
    }
  }
}
