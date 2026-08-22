import { Component, inject } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { TranslateModule } from '@ngx-translate/core';

interface DialogData {
  title: string;
  message: string;
  orderId: number;
  isDangerous?: boolean;
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, TranslateModule],
  template: `
    <h2 mat-dialog-title>{{ data.title | translate }}</h2>
    <mat-dialog-content>
      <p>{{ data.message | translate: { orderId: data.orderId } }}</p>
      @if (data.isDangerous) {
        <p class="warning-text">
          {{ 'DELETED_ORDERS.WARNING_PERMANENT' | translate }}
        </p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="close(false)">
        {{ 'DELETED_ORDERS.CANCEL' | translate }}
      </button>
      <button
        mat-raised-button
        [color]="data.isDangerous ? 'warn' : 'primary'"
        (click)="close(true)"
      >
        {{ 'DELETED_ORDERS.CONFIRM' | translate }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .warning-text {
        color: #d32f2f;
        font-weight: 500;
        margin-top: 1rem;
      }
    `,
  ],
})
export class ConfirmDeleteDialogComponent {
  data = inject<DialogData>(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<ConfirmDeleteDialogComponent>);

  close(confirmed: boolean): void {
    this.dialogRef.close(confirmed);
  }
}
