import { Component, DestroyRef, inject, OnInit } from '@angular/core';
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
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { useClientStore } from '../../../services/store/client-store';
import { cuiValidator } from '../../../guards/cuiValidator';

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
export class AddClientComponent implements OnInit {
  public readonly clientStore = inject(useClientStore);

  private translateService = inject(TranslateService);
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
      validators: [Validators.required, Validators.pattern(/^\d{10}$/)],
    }),
    address: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    code: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^\d{13}$/)],
    }),
    other_details: new FormControl<string>(''),
    delivery_address: new FormControl<string>(''),
  });
  clientSearch = new FormControl('');

  clientTypes = Object.values(ClientType).filter(
    (value) => typeof value === 'number'
  );

  ngOnInit(): void {
    this.clientForm
      .get('type')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((typeValue) => {
        const codeControl = this.clientForm.get('code');

        if (typeValue === 1) {
          codeControl?.setValidators([
            Validators.required,
            Validators.pattern(/^\d{13}$/),
          ]);
        } else {
          codeControl?.setValidators([Validators.required, cuiValidator()]);
        }

        codeControl?.updateValueAndValidity();
      });
  }

  toOfferOverview(): void {
    this.router.navigate(['offer/overview']);
  }

  addClient() {
    if (this.clientForm.valid) {
      if (!this.clientForm.value.delivery_address) {
        this.clientForm.value.delivery_address = this.clientForm.value.address;
      }
      const newClient: Partial<Client> = this.clientForm.value;
      this.clientsService
        .addClient(newClient as Client)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((response) => {
          if (response) {
            newClient.id = (response as Client).id;
            this.clientStore.setClient(newClient as Client);
            this.translateService
              .get(['SNACKBAR.CLIENT.ADD_SUCCESS', 'SNACKBAR.BUTTONS.CLOSE'])
              .subscribe((translations) => {
                this.snackBar.open(
                  translations['SNACKBAR.CLIENT.ADD_SUCCESS'],
                  translations['SNACKBAR.BUTTONS.CLOSE'],
                  { duration: 3000 }
                );
              });
          }
        });
    }
  }
}
