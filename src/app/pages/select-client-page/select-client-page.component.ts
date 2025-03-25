import { Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { map, Observable, startWith, switchMap, take } from 'rxjs';
import { ClientsService } from '../../services/query-services/client.service';
import { Client } from '../../models/models';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ClientType } from '../../models/enums';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatOptionModule } from '@angular/material/core';
import { AddClientComponent } from '../../components/add-client/add-client.component';

@Component({
  selector: 'select-client-page',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatAutocompleteModule,
    MatOptionModule,
    AddClientComponent,
  ],
  templateUrl: './select-client-page.component.html',
  styleUrl: './select-client-page.component.scss',
})
export class SelectClientPageComponent {
  readonly #clientsService = inject(ClientsService);

  clients$: Observable<Client[]> = this.#clientsService.getClients();
  filteredClients$: Observable<Client[]>;
  selectedClient: Client | null = null;

  clientSearch = new FormControl('');

  clientTypes = Object.values(ClientType).filter(
    (value) => typeof value === 'number'
  );

  constructor() {
    if (sessionStorage.getItem('current-client')) {
      this.selectedClient = JSON.parse(
        sessionStorage.getItem('current-client')!
      );
    }

    this.filteredClients$ = this.clientSearch.valueChanges.pipe(
      startWith(''),
      map((value) => (typeof value === 'string' ? value.toLowerCase() : '')),
      map((search) =>
        search
          ? this.#clientsService
              .getClients()
              .pipe(
                map((clients) =>
                  clients.filter((client) =>
                    client.name.toLowerCase().includes(search)
                  )
                )
              )
          : this.#clientsService.getClients()
      ),
      switchMap((obs) => obs)
    );
  }

  displayClientLabel(client: Client): string {
    return client ? client.name : '';
  }

  selectClient(client: Client) {
    sessionStorage.setItem('current-client', JSON.stringify(client));
    this.selectedClient = client;
  }
}
