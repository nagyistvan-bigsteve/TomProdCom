import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../supabase.service';
import { catchError, from, map, Observable, of, switchMap } from 'rxjs';
import {
  Price2,
  PriceResponse2,
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

  async addToProductStock(
    id: number,
    category: Category,
    stock: number
  ): Promise<boolean> {
    try {
      const currentStock = await this.getProductStock(id, category);

      if (currentStock) {
        stock = stock + currentStock.stock;

        const { error } = await this.supabaseService.client
          .from('stocks')
          .update({ stock })
          .eq('product_id', id)
          .eq('category_id', category);

        if (error) throw error;

        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.error('Fail to update stock', error);
      return false;
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

  async addStock(stock: Partial<Stock>): Promise<boolean> {
    try {
      const { error } = await this.supabaseService.client
        .from('stocks')
        .insert(stock);

      if (error) throw error;

      return true;
    } catch (error) {
      console.error('Fail to add stock', error);
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

  async getPrice(
    unit_id: Unit_id,
    category: Category,
    size_id: Size_id
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
          product:product_id (id, name)`
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
        })
      );
    } catch (error) {
      console.error('Fail to fetch unic prices', error);
      return [];
    }
  }

  async getProductsWithoutPrice(): Promise<Products | []> {
    try {
      const { data, error } = await this.supabaseService.client.rpc(
        'products_without_prices'
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
        .eq('price_id', id);

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

  getPrices(product: Product): Observable<Price2[]> {
    return from(
      this.supabaseService.client
        .from('prices_new')
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
          this.supabaseService.client.from('prices_new').select('*').match({
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
