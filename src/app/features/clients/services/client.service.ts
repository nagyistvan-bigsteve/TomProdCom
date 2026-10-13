import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '@core/services/supabase.service';
import { unwrapResult } from '@core/services/supabase-result.util';
import { from, map, Observable } from 'rxjs';
import { Client } from '@core/models/models';

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
      map((result) => unwrapResult(result) ?? []),
    );
  }

  // The client row and its phones are saved in one transaction; the phone
  // list is replaced as a whole.
  updateClient(client: Client): Observable<Client> {
    const { id, client_phones, ...clientData } = client;

    return from(
      this.supabaseService.client.rpc('update_client_with_phones', {
        p_client_id: id,
        p_client: clientData,
        p_phones: this.toPhoneRows(client_phones),
      }),
    ).pipe(map((result) => unwrapResult(result) as Client));
  }

  addClient(client: Client): Observable<Client> {
    const { id, client_phones, ...clientData } = client;

    return from(
      this.supabaseService.client.rpc('add_client_with_phones', {
        p_client: clientData,
        p_phones: this.toPhoneRows(client_phones),
      }),
    ).pipe(map((result) => unwrapResult(result) as Client));
  }

  private toPhoneRows(phones: Client['client_phones']) {
    return (phones ?? []).map((p) => ({ phone: p.phone, label: p.label }));
  }
}
