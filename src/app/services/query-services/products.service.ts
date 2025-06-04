import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../supabase.service';
import { catchError, from, map, Observable, of, switchMap } from 'rxjs';
import {
  Price,
  PriceResponse,
  Product,
  Products,
  Stock,
} from '../../models/models';
import { Category, Size_id, Unit_id } from '../../models/enums';

@Injectable({
  providedIn: 'root',
})
export class ProductsService {
  private supabaseService = inject(SupabaseService);

  getProducts(): Observable<Products> {
    return from(this.supabaseService.client.from('products').select('*')).pipe(
      map(({ data }) => data ?? []), // Ensure an empty array if null
      catchError((error) => {
        console.error('Error fetching products:', error);
        return of([]); // Return an empty array on error
      })
    );
  }

  async addProduct(product: Product): Promise<boolean> {
    try {
      const { error } = await this.supabaseService.client
        .from('products')
        .insert(product);

      if (error) throw error;

      return true;
    } catch (error) {
      console.error('Fail to add product', error);
      return false;
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

  async getProductStock(id: number, category: Category): Promise<Stock | null> {
    try {
      const { data, error } = await this.supabaseService.client
        .from('stocks')
        .select('*')
        .eq('product_id', id)
        .eq('category_id', category)
        .single();

      if (error) throw error;

      return data as Stock;
    } catch (error) {
      console.error('Fail to fetch stock', error);
      return null;
    }
  }

  async updateStock(id: number, stock: number): Promise<boolean> {
    try {
      const { error } = await this.supabaseService.client
        .from('stocks')
        .update({ stock })
        .eq('id', id);

      if (error) throw error;

      return true;
    } catch (error) {
      console.error('Fail to update stock', error);
      return false;
    }
  }

  async getProductsByFilter(
    unit_id: Unit_id,
    size_id: Size_id
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

  async getPrice(
    unit_id: Unit_id,
    category: Category,
    size_id: Size_id
  ): Promise<Price | null> {
    try {
      const { data, error } = await this.supabaseService.client
        .from('prices')
        .select('*')
        .eq('unit_id', unit_id)
        .eq('size_id', size_id)
        .eq('category_id', category)
        .single();

      if (error) throw error;

      return data as Price;
    } catch (error) {
      console.error('Fail to fetch price by filter', error);
      return null;
    }
  }

  async getUnicPriceList(): Promise<PriceResponse[] | []> {
    try {
      const { data, error } = await this.supabaseService.client
        .from('prices')
        .select(
          `price_id,
          unit_id,
          category_id,
          size_id,
          price,
          product:product_id (id, name)`
        )
        .not('product_id', 'is', null);

      if (error) throw error;

      return (data ?? []).map(
        (price): PriceResponse => ({
          price_id: price.price_id,
          unit_id: price.unit_id,
          category_id: price.category_id,
          size_id: price.size_id,
          price: price.price,
          product: Array.isArray(price.product)
            ? price.product[0]
            : price.product || { id: 0, name: '' },
        })
      );
    } catch (error) {
      console.error('Fail to fetch unic prices', error);
      return [];
    }
  }

  async changePrice(id: number, new_price: number): Promise<boolean> {
    try {
      const { error } = await this.supabaseService.client
        .from('prices')
        .update({ price: new_price })
        .eq('price_id', id);

      if (error) throw error;

      return true;
    } catch (error) {
      console.error('Fail to update price', error);
      return false;
    }
  }

  async addPrice(price: Price): Promise<boolean> {
    try {
      const { error } = await this.supabaseService.client
        .from('prices')
        .insert(price);

      if (error) throw error;

      return true;
    } catch (error) {
      console.error('Fail to add price', error);
      return false;
    }
  }

  getPrices(product: Product): Observable<Price[]> {
    return from(
      this.supabaseService.client
        .from('prices')
        .select('*')
        .or(`product_id.eq.${product.id}`)
    ).pipe(
      switchMap(({ data }) => {
        // If there is a price entry with product_id, return only that
        if (data && data.length > 0) {
          return of(data);
        }

        // Otherwise, fetch prices where product_id is NULL and match unit_id & size_id
        return from(
          this.supabaseService.client.from('prices').select('*').match({
            unit_id: product.unit_id,
            size_id: product.size_id,
          })
        ).pipe(map(({ data }) => data ?? []));
      }),
      catchError((error) => {
        console.error('Error fetching product prices:', error);
        return of([]);
      })
    );
  }
}
