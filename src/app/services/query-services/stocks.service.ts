import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../supabase.service';
import { ProductWithStock, Stock } from '../../models/models';

@Injectable({
  providedIn: 'root',
})
export class StocksService {
  private supabaseService = inject(SupabaseService);

  /**
   * Get the current stock of a product by id
   *
   * @param product_id - the id of the product we want to find
   * @returns the stock entry or null in case of an error
   */
  async getProductStock(product_id: number): Promise<Stock | null> {
    try {
      const { data, error } = await this.supabaseService.client
        .from('stocks')
        .select('*')
        .eq('product_id', product_id)
        .single();

      if (error) throw error;

      return data as Stock;
    } catch (error) {
      console.error('Fail to fetch stock', error);
      return null;
    }
  }

  /**
   * Get all the products (expect m2) combined with stocks
   *
   * @returns a `ProductWithStock` array or null in case of an error
   */
  async getStocksWithProductNames(): Promise<ProductWithStock[] | null> {
    try {
      const { data, error } = await this.supabaseService.client
        .from('products')
        .select(
          `id,
            name,
            unit_id,
            size_id,
            thickness,
            width,
            length,
            m2_util,
            m2_brut,
            piece_per_pack,
            stock:stocks!inner (
                id,
                product_id,
                stock,
                booked_stock
            )
           `,
        )
        .neq('unit_id', '2');

      if (error) throw error;

      const stocks = data?.map((row) => ({
        id: row.id,
        name: row.name,
        unit_id: row.unit_id,
        size_id: row.size_id,
        thickness: row.thickness,
        width: row.width,
        length: row.length,
        m2_util: row.m2_util,
        m2_brut: row.m2_brut,
        piece_per_pack: row.piece_per_pack,
        stock: Array.isArray(row.stock) ? row.stock[0] : row.stock,
      }));

      return stocks as ProductWithStock[];
    } catch (error) {
      console.error('Fail to fetch stocks with product names', error);
      return null;
    }
  }

  /**
   * Update a stock entry. Override the current stock number
   *
   * @param id - the stock entry identifier
   * @param stock - the stock object we want to save
   * @returns a boolean to flag succession
   */
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

  /**
   * Adds a new entry to the stocks table
   *
   * @param stock - the stock entry we want to add
   * @returns the response object or null in case of an error
   */
  async addStock(stock: Partial<Stock>): Promise<Stock | null> {
    try {
      const { data, error } = await this.supabaseService.client
        .from('stocks')
        .insert(stock)
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Fail to add stock', error);
      return null;
    }
  }

  /**
   * Adds a stock to the existing number of stock
   * If the current stock is 50 and the stock parameter is 35 then the new stock will be 85
   *
   * @param product_id - the product id
   * @param stock - the number we want to add to the existing stock
   * @returns a `boolean` to flag success
   */
  async addToProductStock(product_id: number, stock: number): Promise<boolean> {
    try {
      const { data, error } = await this.supabaseService.client.rpc(
        'add_to_product_stock',
        {
          p_product_id: product_id,
          p_amount: stock,
        },
      );

      if (error) {
        throw error;
      }

      return data === true;
    } catch (error) {
      console.error('Fail to update stock', error);
      return false;
    }
  }

  /**
   * Update a stock entry. Override the current booked stock number
   *
   * @param id - the stock entry identifier
   * @param stock - the stock object we want to save
   * @returns a boolean to flag succession
   */
  async updateBookedStock(id: number, booked_stock: number): Promise<boolean> {
    try {
      const { error } = await this.supabaseService.client
        .from('stocks')
        .update({ booked_stock })
        .eq('id', id);

      if (error) throw error;

      return true;
    } catch (error) {
      console.error('Fail to update booked stock', error);
      return false;
    }
  }

  async addToBookedStock(
    product_id: number,
    booked_stock: number,
  ): Promise<boolean> {
    try {
      const { data, error } = await this.supabaseService.client.rpc(
        'add_to_product_booked_stock',
        {
          p_product_id: product_id,
          p_amount: booked_stock,
        },
      );

      if (error) {
        throw error;
      }

      return data === true;
    } catch (error) {
      console.error('Fail to update booked stock', error);
      return false;
    }
  }

  async bookedStockSold(
    product_id: number,
    sold_stock: number,
  ): Promise<boolean> {
    try {
      const { data, error } = await this.supabaseService.client.rpc(
        'product_booked_stock_sold',
        {
          p_product_id: product_id,
          p_amount: sold_stock,
        },
      );

      if (error) {
        throw error;
      }

      return data === true;
    } catch (error) {
      console.error('Fail to update stock after sold', error);
      return false;
    }
  }
}
