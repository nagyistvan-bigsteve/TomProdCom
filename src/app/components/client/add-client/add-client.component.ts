import { Component, effect, inject, Input, signal } from '@angular/core';
import {
  FormArray,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Client } from '../../../models/models';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { CommonModule } from '@angular/common';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { ClientType } from '../../../models/enums';
import { MatIconModule } from '@angular/material/icon';
import { MatOptionModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { ENTER_ANIMATION } from '../../../models/animations';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import {
  cuiValidator,
  uniqueClientCodeValidator,
} from '../../../guards/cuiValidator';
import { ClientStore } from '../../../services/store/client/client.store';

interface PhoneFormGroup extends FormGroup<{
  phone: FormControl<string>;
  label: FormControl<string>;
}> {
  _uniqueId?: number;
}

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
  @Input() withoutForwardButton: boolean = false;

  readonly clientStore = inject(ClientStore);
  private readonly router = inject(Router);

  private phoneIdCounter = 0;

  clientForm = new FormGroup({
    name: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    type: new FormControl<ClientType>(ClientType.PF, {
      nonNullable: true,
      validators: [Validators.required],
    }),
    phones: new FormArray<PhoneFormGroup>([]),
    address: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    code: new FormControl<string>('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.pattern(/^\d{13}$/),
        uniqueClientCodeValidator(this.clientStore),
      ],
    }),
    other_details: new FormControl<string>(''),
  });

  clientTypes = Object.values(ClientType).filter(
    (value) => typeof value === 'number',
  );

  get phones(): FormArray<PhoneFormGroup> {
    return this.clientForm.get('phones') as FormArray<PhoneFormGroup>;
  }

  constructor() {
    // Setup type change validation
    this.setupTypeValidation();

    // Sync form with selected client from store
    effect(() => {
      const client = this.clientStore.client();

      if (client) {
        this.loadClientData(client);
      } else {
        this.resetForm();
      }
    });
  }

  private loadClientData(client: Client): void {
    // Clear existing phone fields
    while (this.phones.length > 0) {
      this.phones.removeAt(0);
    }

    // Populate form with client data
    this.clientForm.patchValue(
      {
        name: client.name,
        type: client.type,
        address: client.address ?? '',
        code: client.code ?? '',
        other_details: client.other_details ?? '',
      },
      { emitEvent: false },
    );

    // Add phone fields from client
    if (client.client_phones && client.client_phones.length > 0) {
      client.client_phones.forEach((phone) => {
        this.addPhoneField(phone.phone, phone.label);
      });
    } else {
      // If no phones, add one empty field
      this.addPhoneField();
    }
  }

  private setupTypeValidation(): void {
    this.clientForm.get('type')?.valueChanges.subscribe((typeValue) => {
      const codeControl = this.clientForm.get('code');

      if (typeValue === ClientType.PF) {
        codeControl?.setValidators([
          Validators.required,
          Validators.pattern(/^\d{13}$/),
          uniqueClientCodeValidator(this.clientStore),
        ]);
      } else {
        codeControl?.setValidators([
          Validators.required,
          cuiValidator(),
          uniqueClientCodeValidator(this.clientStore),
        ]);
      }

      codeControl?.updateValueAndValidity();
    });
  }

  addPhoneField(phone: string = '', label: string = ''): void {
    const phoneGroup = new FormGroup({
      label: new FormControl<string>(label, {
        nonNullable: true,
        validators: [],
      }),
      phone: new FormControl<string>(phone, {
        nonNullable: true,
        validators: [
          Validators.required,
          Validators.pattern(
            /^(?:\+|00)?\d{1,3}[\s\-]?\(?\d{1,4}\)?([\s\-]?\d{2,4}){2,4}$/,
          ),
        ],
      }),
    }) as PhoneFormGroup;

    // Add unique ID for tracking
    phoneGroup._uniqueId = this.phoneIdCounter++;

    this.phones.push(phoneGroup);
    this.clientForm.markAsDirty();
  }

  removePhoneField(index: number): void {
    if (this.phones.length > 1) {
      this.phones.removeAt(index);
    } else {
      // If it's the last one, just reset it instead of removing
      this.phones.at(0).reset({ label: '', phone: '' });
    }

    this.clientForm.markAsDirty();
  }

  // Track by function for @for loop
  trackByPhoneId(index: number, item: PhoneFormGroup): number {
    return item._uniqueId ?? index;
  }

  resetForm(): void {
    // Clear all phone fields
    while (this.phones.length > 0) {
      this.phones.removeAt(0);
    }

    // Reset the form
    this.clientForm.reset(
      {
        name: '',
        type: ClientType.PF,
        address: '',
        code: '',
        other_details: '',
      },
      { emitEvent: false },
    );

    // Add one empty phone field
    this.addPhoneField();
  }

  toOfferOverview(): void {
    this.router.navigate(['offer/overview']);
  }

  updateClient(): void {
    if (this.clientForm.valid) {
      const formValue = this.clientForm.getRawValue();
      const currentClient = this.clientStore.client();

      if (!currentClient) {
        return;
      }

      const updatedClient: Client = {
        id: currentClient.id,
        name: formValue.name,
        type: formValue.type,
        address: formValue.address || null,
        code: formValue.code || null,
        other_details: formValue.other_details || null,
        client_phones: formValue.phones
          .filter((p) => p.phone)
          .map((p, index) => ({
            id: currentClient.client_phones?.[index]?.id ?? 0,
            client_id: currentClient.id,
            phone: p.phone,
            label: p.label,
          })),
      };

      this.clientForm.markAsPristine();
      this.clientStore.updateClient(updatedClient);
    }
  }

  addClient(): void {
    if (this.clientForm.valid) {
      const formValue = this.clientForm.getRawValue();

      const newClient: Client = {
        id: 0, // Will be set by the backend
        name: formValue.name,
        type: formValue.type,
        address: formValue.address || null,
        code: formValue.code || null,
        other_details: formValue.other_details || null,
        client_phones: formValue.phones
          .filter((p) => p.phone)
          .map((p) => ({
            id: 0,
            client_id: 0,
            phone: p.phone,
            label: p.label,
          })),
      };

      this.clientForm.markAsPristine();
      this.clientStore.addClient(newClient);
    }
  }
}
