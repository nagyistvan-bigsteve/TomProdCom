import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../supabase.service';
import { catchError, from, map, Observable, of, switchMap } from 'rxjs';
import { Client } from '../../models/models';

@Injectable({
  providedIn: 'root',
})
export class ClientsService {
  private supabaseService = inject(SupabaseService);

  getClients(): Observable<Client[]> {
    return from(this.supabaseService.client.from('clients').select('*')).pipe(
      map(({ data }) => data ?? []),
      catchError((error) => {
        console.error('Error fetching products:', error);
        return of([]);
      })
    );
  }

  async getClientById(id: number): Promise<Client | null> {
    try {
      const { data, error } = await this.supabaseService.client
        .from('clients')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      return data as Client;
    } catch (error) {
      console.error('Fail to fetch client by id', error);
      return null;
    }
  }

  addClient(client: Client): Observable<Client | boolean> {
    return from(
      this.supabaseService.client
        .from('clients')
        .insert([client])
        .select()
        .single()
    ).pipe(
      map((response) => {
        return response.data as unknown as Client;
      }),
      catchError((error) => {
        console.error('Error adding client:', error);
        return of(false);
      })
    );
  }

  updateClient(client: Client): Observable<boolean> {
    return from(
      this.supabaseService.client
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
