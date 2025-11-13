import {
  Component,
  DestroyRef,
  inject,
  OnInit,
  effect,
  Input,
} from '@angular/core';
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
  @Input() withoutForwardButton: boolean = false;
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
      validators: [
        Validators.required,
        Validators.pattern(
          /^(?:\+?(?:3[0-9]{1,2}|4[0-9]{1,2}|2[0-9]|1[0-9]|7[0-9])\s?|0)(?:\s?\d[\s\-()]?){6,12}\d$/
        ),
      ],
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
  });

  clientTypes = Object.values(ClientType).filter(
    (value) => typeof value === 'number'
  );

  constructor() {
    effect(() => {
      if (this.clientStore.client()) {
        const client = {
          name: this.clientStore.client()?.name!,
          type: this.clientStore.client()?.type!,
          phone: this.clientStore.client()?.phone!,
          address: this.clientStore.client()?.address!,
          code: this.clientStore.client()?.code!,
          other_details: this.clientStore.client()?.other_details!,
        };
        this.clientForm.setValue(client);
      } else {
        const client = {
          name: '',
          type: ClientType.PF,
          phone: '',
          address: '',
          code: '',
          other_details: '',
        };
        this.clientForm.setValue(client);
      }
    });
  }

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

  updateClient() {
    if (this.clientForm.valid) {
      const updatedClient: Partial<Client> = this.clientForm.value;
      updatedClient.id = this.clientStore.client()?.id!;

      this.clientsService
        .updateClient(updatedClient as Client)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((response) => {
          if (response) {
            this.clientStore.setClient(updatedClient as Client);
          }
        });
    }
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
