import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '@core/services/supabase.service';
import { unwrapResult } from '@core/services/supabase-result.util';
import { Stock } from '@core/models/models';
import { from, map, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class StocksService {
  private supabaseService = inject(SupabaseService);

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

  getAllStocksObs(): Observable<Stock[]> {
    return from(
      this.supabaseService.client.from('stocks').select('*'),
    ).pipe(map((result) => unwrapResult(result) ?? []));
  }

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

  addStockObs(stock: Partial<Stock>): Observable<Stock> {
    return from(
      this.supabaseService.client
        .from('stocks')
        .insert(stock)
        .select()
        .single(),
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return data as Stock;
      }),
    );
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
