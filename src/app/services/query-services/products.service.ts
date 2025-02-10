import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../supabase.service';
import { catchError, from, map, Observable, of } from 'rxjs';
import { Products } from '../../models/models';

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
