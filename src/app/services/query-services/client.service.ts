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
    return from(
      this.supabaseService.client.from('clients').select(`
    *,
    client_phones (*)
  `),
    ).pipe(
      map(({ data }) => {
        return data ?? [];
      }),
      catchError((error) => {
        console.error('Error fetching products:', error);
        return of([]);
      }),
    );
  }

  updateClient(client: Client): Observable<Client> {
    const supabase = this.supabaseService.client;
    const { id, client_phones, ...clientData } = client;

    return from(
      supabase
        .from('clients')
        .update({ ...client, client_phones: undefined, id: undefined })
        .eq('id', id)
        .select()
        .single(),
    ).pipe(
      switchMap(({ data: updatedClient, error }) => {
        if (error) {
          throw error;
        }

        // 1️⃣ delete existing phones
        return from(
          supabase.from('client_phones').delete().eq('client_id', id),
        ).pipe(
          map(({ error }) => {
            if (error) {
              throw error;
            }
            return updatedClient;
          }),
        );
      }),
      switchMap((updatedClient) => {
        // 2️⃣ no phones → return client
        if (!client_phones || client_phones.length === 0) {
          return of({
            ...updatedClient,
            client_phones: [],
          } as Client);
        }

        // 3️⃣ insert new phones
        const phonesToInsert = client_phones.map((p) => ({
          client_id: id,
          phone: p.phone,
          label: p.label,
        }));

        return from(
          supabase.from('client_phones').insert(phonesToInsert).select(),
        ).pipe(
          map(({ data: phones, error }) => {
            if (error) {
              throw error;
            }

            return {
              ...updatedClient,
              client_phones: phones ?? [],
            } as Client;
          }),
        );
      }),
    );
  }

  addClient(client: Client): Observable<Client> {
    const supabase = this.supabaseService.client;

    return from(
      supabase
        .from('clients')
        .insert({ ...client, client_phones: undefined, id: undefined })
        .select()
        .single(),
    ).pipe(
      switchMap(({ data: newClinet, error }) => {
        if (error) {
          throw error;
        }

        if (!client.client_phones?.length) {
          return of(newClinet);
        }

        const phones = client.client_phones.map((p) => ({
          client_id: newClinet.id,
          phone: p.phone,
          label: p.label,
        }));

        return from(
          supabase.from('client_phones').insert(phones).select(),
        ).pipe(
          map(({ data: phones, error }) => {
            if (error) {
              throw error;
            }

            return {
              ...newClinet,
              client_phones: phones,
            } as Client;
          }),
        );
      }),
    );
  }
}
