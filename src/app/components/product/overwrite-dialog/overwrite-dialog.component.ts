import { Component, Inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-overwrite-dialog',
  imports: [MatDialogModule, MatButtonModule, TranslateModule],
  templateUrl: './overwrite-dialog.component.html',
  styleUrl: './overwrite-dialog.component.scss',
})
export class OverwriteDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<OverwriteDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { productName: string }
  ) {}

  onAdd() {
    this.dialogRef.close('add');
  }

  onOverwrite() {
    this.dialogRef.close('overwrite');
  }

  onCancel() {
    this.dialogRef.close('cancel');
  }
}
