import {
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
  ViewChild,
} from '@angular/core';
import { AddClientComponent } from '@features/clients/components/add-client/add-client.component';
import { TranslateModule } from '@ngx-translate/core';
import { Client } from '@core/models/models';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import {
  MatAutocompleteModule,
  MatAutocompleteTrigger,
} from '@angular/material/autocomplete';
import { MatOptionModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { ClientStore } from '@features/clients/store/client.store';
import { toSignal } from '@angular/core/rxjs-interop';
import { ENTER_ANIMATION } from '@core/models/animations';
import { ClientHistoryComponent } from '@features/clients/components/client-history/client-history.component';

@Component({
  selector: 'app-clients',
  imports: [
    AddClientComponent,
    ClientHistoryComponent,
    TranslateModule,
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatAutocompleteModule,
    MatOptionModule,
    MatIconModule,
    MatButtonModule,
    MatButtonToggleModule,
  ],
  templateUrl: './clients.component.html',
  styleUrl: './clients.component.scss',
  animations: ENTER_ANIMATION,
})
export class ClientsComponent {
  @ViewChild(MatAutocompleteTrigger) autocomplete!: MatAutocompleteTrigger;

  readonly clientStore = inject(ClientStore);

  clientSearch = new FormControl<string | Client>('');

  readonly searchValue = toSignal(this.clientSearch.valueChanges, {
    initialValue: '',
  });

  filteredClients = computed(() => {
    const searchValue = this.searchValue();
    const allClients = this.clientStore.clientsEntities();

    if (!searchValue || typeof searchValue !== 'string') {
      return allClients;
    }

    const search = this.normalize(searchValue);
    if (!search) return allClients;

    return allClients.filter((client) =>
      this.normalize(client.name).includes(search),
    );
  });

  showClientHistory = signal(false);
  showClientDetails = signal(false);

  readonly activeTabValue = computed(() => {
    if (this.showClientHistory()) return 'history';
    if (this.showClientDetails()) return 'details';
    return null;
  });

  constructor() {
    effect(() => {
      const currentClient = this.clientStore.client();
      if (currentClient && this.clientSearch.value !== currentClient) {
        this.clientSearch.setValue(currentClient, { emitEvent: false });
      }
    });

    effect(() => {
      const isSelected = this.clientStore.isClientSelected();
      if (isSelected) {
        if (
          !untracked(() => this.showClientHistory()) &&
          !untracked(() => this.showClientDetails())
        ) {
          this.showClientHistory.set(true);
        }
      } else {
        this.showClientHistory.set(false);
        this.showClientDetails.set(false);
      }
    });
  }

  setTab(value: string): void {
    this.showClientHistory.set(value === 'history');
    this.showClientDetails.set(value === 'details');
  }

  displayClientLabel(client: Client | string | null): string {
    if (!client) return '';
    return typeof client === 'string' ? client : client.name;
  }

  selectClient(client: Client): void {
    this.clientStore.setClientId(client.id);
    this.clientSearch.setValue(client, { emitEvent: false });
  }

  clearClient(): void {
    this.clientStore.setClientId(-1);
    this.clientSearch.setValue('');
    setTimeout(() => {
      this.autocomplete?.closePanel();
    });
  }

  private normalize(text: string): string {
    return text
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .trim();
  }
}
