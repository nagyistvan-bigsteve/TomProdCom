import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Client } from '../../models/models';

@Injectable({
  providedIn: 'root',
})
export class ClientDataService {
  private clientSource = new BehaviorSubject<Client | null>(null);
  client$ = this.clientSource.asObservable();

  setClient(client: Client) {
    this.clientSource.next(client);
  }
}
