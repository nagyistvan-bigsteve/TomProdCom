import {
  Component,
  DestroyRef,
  inject,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { AddClientComponent } from '../../components/client/add-client/add-client.component';
import { TranslateModule } from '@ngx-translate/core';
import { MatExpansionModule } from '@angular/material/expansion';
import { ClientsService } from '../../services/query-services/client.service';
import { Client } from '../../models/models';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import {
  MatAutocompleteModule,
  MatAutocompleteTrigger,
} from '@angular/material/autocomplete';
import { MatOptionModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { map, Observable, startWith, switchMap } from 'rxjs';
import { useClientStore } from '../../services/store/client-store';

@Component({
  selector: 'app-clients',
  imports: [
    AddClientComponent,
    TranslateModule,
    MatExpansionModule,
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
  templateUrl: './clients.component.html',
  styleUrl: './clients.component.scss',
})
export class ClientsComponent implements OnInit, OnDestroy {
  @ViewChild(MatAutocompleteTrigger) autocomplete!: MatAutocompleteTrigger;

  private readonly destroyRef = inject(DestroyRef);
  private readonly clientsService = inject(ClientsService);
  readonly clientStore = inject(useClientStore);

  clients: Client[] = [];

  clients$: Observable<Client[]> = this.clientsService.getClients();
  filteredClients$: Observable<Client[]> | undefined;

  clientSearch = new FormControl<Client>(this.clientStore.client()!);

  ngOnInit(): void {
    this.filterClients();

    this.clientsService
      .getClients()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((clients) => {
        if (clients) {
          this.clients = clients;
        }
      });
  }

  ngOnDestroy(): void {
    this.clientStore.deleteClient();
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
    setTimeout(() => {
      this.autocomplete.closePanel();
    });
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
