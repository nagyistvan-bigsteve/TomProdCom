import {
  Component,
  computed,
  effect,
  inject,
  signal,
  ViewChild,
} from '@angular/core';
import { AddClientComponent } from '../../components/client/add-client/add-client.component';
import { TranslateModule } from '@ngx-translate/core';
import { MatExpansionModule } from '@angular/material/expansion';
import { Client } from '../../models/models';
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
import { ClientStore } from '../../services/store/client/client.store';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  ENTER_AND_LEAVE_ANIMATION,
  ENTER_ANIMATION,
} from '../../models/animations';
import { ClientHistoryComponent } from '../../components/client/client-history/client-history.component';

@Component({
  selector: 'app-clients',
  imports: [
    AddClientComponent,
    ClientHistoryComponent,
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

    if (!search) {
      return allClients;
    }

    return allClients.filter((client) =>
      this.normalize(client.name).includes(search),
    );
  });

  showClientHistory = signal(false);
  showClientDetails = signal(false);

  constructor() {
    effect(() => {
      const currentClient = this.clientStore.client();
      if (currentClient && this.clientSearch.value !== currentClient) {
        this.clientSearch.setValue(currentClient, { emitEvent: false });
      }
    });
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
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }
}
