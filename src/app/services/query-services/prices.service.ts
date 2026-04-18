import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../supabase.service';
import { Price2, PriceResponse2, Products } from '../../models/models';
import { Category, Size_id, Unit_id } from '../../models/enums';
import { catchError, from, map, Observable, of } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class PricesService {
  private supabaseService = inject(SupabaseService);

  getAllPricesObs(): Observable<Price2[]> {
    return from(
      this.supabaseService.client.from('prices_new').select('*'),
    ).pipe(
      map(({ data }) => data ?? []),
      catchError((error) => {
        console.error('Error fetching prices', error);
        return of([]);
      }),
    );
  }

  changePriceObs(id: number, new_price: number): Observable<Price2> {
    return from(
      this.supabaseService.client
        .from('prices_new')
        .update({ price: new_price })
        .eq('id', id)
        .select()
        .single(),
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return data as Price2;
      }),
    );
  }

  addPriceObs(price: Partial<Price2>): Observable<Price2> {
    return from(
      this.supabaseService.client
        .from('prices_new')
        .insert(price)
        .select()
        .single(),
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return data as Price2;
      }),
    );
  }
}
