import { Component, DestroyRef, inject, Inject } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { Client } from '../../../models/models';
import { MatInputModule } from '@angular/material/input';
import { MatOptionModule } from '@angular/material/core';
import { MatButton } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { TranslateModule } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { cuiValidator } from '../../../guards/cuiValidator';

@Component({
  selector: 'app-edit-client-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatInputModule,
    MatDialogModule,
    MatOptionModule,
    MatButton,
    MatSelectModule,
    TranslateModule,
  ],
  templateUrl: './edit-client-dialog.component.html',
  styleUrls: ['./edit-client-dialog.component.scss'],
})
export class EditClientDialogComponent {
  clientForm: FormGroup;

  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<EditClientDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { client: Client }
  ) {
    console.log(data);

    this.clientForm = this.fb.group({
      id: [data.client.id],
      name: [data.client.name, Validators.required],
      type: [data.client.type, Validators.required],
      phone: [
        data.client.phone,
        [Validators.required, Validators.pattern(/^\d{10}$/)],
      ],
      address: [data.client.address, Validators.required],
      delivery_address: [data.client.delivery_address],
      code: [
        data.client.code,
        [
          Validators.required,
          data.client.type === 1
            ? Validators.pattern(/^\d{13}$/)
            : cuiValidator(),
        ],
      ],
      other_details: [data.client.other_details],
    });

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

  onSave() {
    if (this.clientForm.valid) {
      if (!this.clientForm.value.delivery_address) {
        this.clientForm.value.delivery_address = this.clientForm.value.address;
      }
      this.clientForm.value.id = this.data.client.id;
      this.dialogRef.close(this.clientForm.value);
    }
  }

  onCancel() {
    this.dialogRef.close();
  }
}
