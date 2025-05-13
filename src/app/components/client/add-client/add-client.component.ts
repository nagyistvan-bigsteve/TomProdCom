import { Component, DestroyRef, inject, Input } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ClientsService } from '../../../services/query-services/client.service';
import { Client } from '../../../models/models';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { CommonModule } from '@angular/common';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { ClientType } from '../../../models/enums';
import { MatIconModule } from '@angular/material/icon';
import { MatOptionModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ENTER_ANIMATION } from '../../../models/animations';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { useClientStore } from '../../../services/store/client-store';

@Component({
  selector: 'app-add-client',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatSnackBarModule,
    MatFormFieldModule,
    MatCardModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatOptionModule,
    MatSelectModule,
    TranslateModule,
  ],
  templateUrl: './add-client.component.html',
  styleUrl: './add-client.component.scss',
  animations: [ENTER_ANIMATION],
})
export class AddClientComponent {
  public readonly clientStore = inject(useClientStore);

  private clientsService = inject(ClientsService);
  private snackBar = inject(MatSnackBar);
  private destroyRef = inject(DestroyRef);
  private router = inject(Router);

  clientForm = new FormGroup({
    name: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    type: new FormControl<ClientType>(ClientType.PF, {
      nonNullable: true,
      validators: [Validators.required],
    }),
    phone: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern('^[- +()0-9]+$')],
    }),
    address: new FormControl<string>(''),
    code: new FormControl<string>(''),
    other_details: new FormControl<string>(''),
    delivery_address: new FormControl<string>(''),
  });
  clientSearch = new FormControl('');

  clientTypes = Object.values(ClientType).filter(
    (value) => typeof value === 'number'
  );

  toOfferOverview(): void {
    this.router.navigate(['offer/overview']);
  }

  addClient() {
    if (this.clientForm.valid) {
      const newClient: Partial<Client> = this.clientForm.value;
      this.clientsService
        .addClient(newClient as Client)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((response) => {
          if (response) {
            newClient.id = (response as Client).id;
            this.clientStore.setClient(newClient as Client);
            this.snackBar.open('Client added successfully', 'Close', {
              duration: 3000,
            });
          }
        });
    }
  }
}
