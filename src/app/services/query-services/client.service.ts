import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../supabase.service';
import { catchError, from, map, Observable, of, switchMap } from 'rxjs';
import { Client } from '../../models/models';

@Injectable({
  providedIn: 'root',
})
export class ClientsService {
  readonly #supabaseService = inject(SupabaseService);

  getClients(): Observable<Client[]> {
    return from(this.#supabaseService.client.from('clients').select('*')).pipe(
      map(({ data }) => data ?? []),
      catchError((error) => {
        console.error('Error fetching products:', error);
        return of([]);
      })
    );
  }

  addClient(client: Client): Observable<boolean> {
    return from(
      this.#supabaseService.client.from('clients').insert([client])
    ).pipe(
      map(() => {
        return true;
      }),
      catchError((error) => {
        console.error('Error adding client:', error);
        return of(false);
      })
    );
  }

  updateClient(client: Client): Observable<boolean> {
    console.log(client);
    return from(
      this.#supabaseService.client
        .from('clients')
        .update(client)
        .eq('id', client.id)
        .select()
        .single()
    ).pipe(
      map(() => true),
      catchError((error) => {
        console.error('Error updating client:', error);
        return of(false);
      })
    );
  }
}
