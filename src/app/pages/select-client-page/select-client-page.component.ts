import { Component, inject, OnInit } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
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
import { AddClientComponent } from '../../components/client/add-client/add-client.component';
import { TranslateModule } from '@ngx-translate/core';
import { useClientStore } from '../../services/store/client-store';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

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
    TranslateModule,
    MatIconModule,
    FormsModule,
    MatButtonModule,
  ],
  templateUrl: './select-client-page.component.html',
  styleUrl: './select-client-page.component.scss',
})
export class SelectClientPageComponent {
  private clientsService = inject(ClientsService);
  readonly clientStore = inject(useClientStore);

  clients$: Observable<Client[]> = this.clientsService.getClients();
  filteredClients$: Observable<Client[]> | undefined;

  clientSearch = new FormControl<Client>(this.clientStore.client()!);

  constructor() {
    this.filterClients();
  }

  displayClientLabel(client: Client): string {
    return client ? client.name : '';
  }

  selectClient(client: Client) {
    this.clientStore.setClient(client);
  }

  clearClient(): void {
    this.clientStore.deleteClient();
    this.clientSearch.setValue(null);
  }

  private filterClients(): void {
    this.filteredClients$ = this.clientSearch.valueChanges.pipe(
      startWith(''),
      map((value) => (typeof value === 'string' ? value.toLowerCase() : '')),
      map((search) =>
        search
          ? this.clientsService
              .getClients()
              .pipe(
                map((clients) =>
                  clients.filter((client) =>
                    client.name.toLowerCase().includes(search)
                  )
                )
              )
          : this.clientsService.getClients()
      ),
      switchMap((obs) => obs)
    );
  }
}
