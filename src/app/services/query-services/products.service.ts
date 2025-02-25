import { inject, Injectable, ɵɵsetComponentScope } from '@angular/core';
import { SupabaseService } from '../supabase.service';
import { catchError, from, map, Observable, of, switchMap } from 'rxjs';
import { Price, Product, Products } from '../../models/models';

@Injectable({
  providedIn: 'root',
})
export class ProductsService {
  readonly #supabaseService = inject(SupabaseService);

  getProducts(): Observable<Products> {
    return from(this.#supabaseService.client.from('products').select('*')).pipe(
      map(({ data }) => data ?? []), // Ensure an empty array if null
      catchError((error) => {
        console.error('Error fetching products:', error);
        return of([]); // Return an empty array on error
      })
    );
  }

  getPrices(product: Product): Observable<Price[]> {
    return from(
      this.#supabaseService.client
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
          this.#supabaseService.client.from('prices').select('*').match({
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

  // getUnits() {
  //   return from(this.#supabaseService.client.from('units').select('*')).pipe(
  //     map(({ data }) => data ?? []), // Ensure an empty array if null
  //     catchError((error) => {
  //       console.error('Error fetching products:', error);
  //       return of([]); // Return an empty array on error
  //     })
  //   );
  // }

  // async function getTables() {
  //   const { data, error } = await supabase.rpc('pg_tables'); // Fetches table names
  //   console.log('Tables:', data);
  // }

  // getProductGroups()
}
