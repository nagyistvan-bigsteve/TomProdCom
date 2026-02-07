import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateService } from '@ngx-translate/core';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private snackBar = inject(MatSnackBar);
  private translate = inject(TranslateService);

  success(key: string, params?: any) {
    const message = this.translate.instant(key, params);
    const buttonText = this.translate.instant('SNACKBAR.BUTTONS.OK');

    this.snackBar.open(message, buttonText, {
      duration: 3000,
      panelClass: ['snackbar-success'],
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
    });
  }

  error(key: string, params?: any) {
    const message = this.translate.instant(key, params);
    const buttonText = this.translate.instant('SNACKBAR.BUTTONS.CLOSE');

    this.snackBar.open(message, buttonText, {
      duration: 3000,
      panelClass: ['snackbar-error'],
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
    });
  }

  info(key: string, params?: any) {
    const message = this.translate.instant(key, params);
    const buttonText = this.translate.instant('SNACKBAR.BUTTONS.OK');

    this.snackBar.open(message, buttonText, {
      duration: 3000,
      panelClass: ['snackbar-info'],
    });
  }
}
