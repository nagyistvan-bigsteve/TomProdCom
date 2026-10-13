import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '@core/services/supabase.service';
import { unwrapResult } from '@core/services/supabase-result.util';
import { from, map, Observable } from 'rxjs';
import { Product, Products } from '@core/models/models';
import { Size_id, Unit_id } from '@core/models/enums';
import { StocksService } from './stocks.service';

@Injectable({
  providedIn: 'root',
})
export class ProductsService {
  private supabaseService = inject(SupabaseService);
  private stockService = inject(StocksService);

  getProducts(): Observable<Products> {
    return from(this.supabaseService.client.from('products').select('*')).pipe(
      map((result) => unwrapResult(result) ?? []),
    );
  }

  addProductObs(product: Product): Observable<Product> {
    return from(
      this.supabaseService.client
        .from('products')
        .insert(product)
        .select()
        .single(),
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        this.stockService.addStock({
          product_id: data.id,
          stock: 0,
          booked_stock: 0,
        });
        return data as Product;
      }),
    );
  }

  updateProductObs(product: Product): Observable<Product> {
    return from(
      this.supabaseService.client
        .from('products')
        .update(product)
        .eq('id', product.id)
        .select()
        .single(),
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return data as Product;
      }),
    );
  }
}
