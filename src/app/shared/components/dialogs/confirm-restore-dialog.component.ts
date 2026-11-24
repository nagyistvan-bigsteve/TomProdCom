import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { TranslateModule } from '@ngx-translate/core';
import { AppDatePipe } from '@shared/pipes/app-date.pipe';

@Component({
  selector: 'app-confirm-restore-dialog',
  standalone: true,
  imports: [AppDatePipe, MatDialogModule, MatButtonModule, TranslateModule],
  template: `
    <h2 mat-dialog-title>{{ 'RESTORE_DIALOG.TITLE' | translate }}</h2>

    <mat-dialog-content>
      <p>{{ 'RESTORE_DIALOG.MESSAGE' | translate }}</p>
      <p class="text-muted last-updated">
        {{ 'RESTORE_DIALOG.LAST_UPDATED' | translate }}:
        {{ data.lastUpdated | appDate: 'dateTime' }}
      </p>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="close(false)">
        {{ 'RESTORE_DIALOG.DISCARD' | translate }}
      </button>
      <button mat-raised-button color="primary" (click)="close(true)">
        {{ 'RESTORE_DIALOG.KEEP' | translate }}
      </button>
    </mat-dialog-actions>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [
    `
      .last-updated {
        font-size: 0.85rem;
        opacity: 0.7;
      }
    `,
  ],
})
export class ConfirmRestoreDialogComponent {
  data = inject<{ lastUpdated: Date }>(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<ConfirmRestoreDialogComponent>);

  close(keep: boolean): void {
    this.dialogRef.close(keep);
  }
}
