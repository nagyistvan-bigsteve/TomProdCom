import { Component, Inject } from '@angular/core';
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

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<EditClientDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { client: Client }
  ) {
    this.clientForm = this.fb.group({
      id: [data.client.id],
      name: [data.client.name, Validators.required],
      type: [data.client.type, Validators.required],
      phone: [data.client.phone, Validators.required],
      address: [data.client.address],
      delivery_address: [data.client.delivery_address, Validators.required],
      code: [data.client.code],
      other_details: [data.client.other_details],
    });
  }

  onSave() {
    if (this.clientForm.valid) {
      this.clientForm.value['id'] = this.data.client.id;
      this.dialogRef.close(this.clientForm.value);
    }
  }

  onCancel() {
    this.dialogRef.close();
  }
}
