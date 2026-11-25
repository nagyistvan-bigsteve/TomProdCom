import { Component, inject, OnDestroy, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import { SupabaseService } from '@core/services/supabase.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ENTER_ANIMATION } from '@core/models/animations';

/** How long a recovery link may take to turn into a session before the page gives up. */
const LINK_WAIT_MS = 10_000;

/**
 * Whether the URL carries a Supabase recovery link that is still to be
 * exchanged (PKCE `?code=`, implicit `#access_token=`). A link Supabase
 * refused comes back with `error`, which counts as no link.
 */
export function hasRecoveryParams(search: string, hash: string): boolean {
  const query = new URLSearchParams(search);
  const fragment = new URLSearchParams(hash.replace(/^#/, ''));
  if (query.has('error') || fragment.has('error')) return false;
  return query.has('code') || fragment.has('access_token');
}

@Component({
  selector: 'app-reset-password',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslateModule,
  ],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  animations: [ENTER_ANIMATION],
})
export class ResetPasswordComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private supabaseService = inject(SupabaseService).client;
  private translateService = inject(TranslateService);

  private authSubscription: any;

  showForm = false;
  /** No usable recovery link: shown instead of the endless "verifying" spinner. */
  readonly linkMissing = signal(false);
  private linkTimeout?: ReturnType<typeof setTimeout>;
  showPassword = signal(false);
  showConfirm = signal(false);

  resetPasswordForm = new FormGroup({
    password: new FormControl('', [Validators.required, Validators.minLength(6)]),
    confirmPassword: new FormControl('', [Validators.required, Validators.minLength(6)]),
  });

  ngOnInit() {
    this.authSubscription = this.supabaseService.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'PASSWORD_RECOVERY' && session) {
          this.showForm = true;
          this.linkMissing.set(false);
        }
      },
    );

    this.supabaseService.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        this.showForm = true;
        return;
      }
      // Opened without a recovery link, or the link was refused (expired, used):
      // say so at once; otherwise give the link time to be exchanged for a session
      if (!hasRecoveryParams(window.location.search, window.location.hash)) {
        this.linkMissing.set(true);
      } else {
        this.linkTimeout = setTimeout(() => {
          if (!this.showForm) this.linkMissing.set(true);
        }, LINK_WAIT_MS);
      }
    });
  }

  ngOnDestroy() {
    this.authSubscription?.data.subscription.unsubscribe();
    clearTimeout(this.linkTimeout);
  }

  togglePassword() {
    this.showPassword.update(v => !v);
  }

  toggleConfirm() {
    this.showConfirm.update(v => !v);
  }

  goToAuthPage(): void {
    this.router.navigate(['/auth']);
  }

  async resetPassword() {
    if (!this.validatePasswords()) return;

    const password = this.resetPasswordForm.value.password!;

    try {
      const { error } = await this.supabaseService.auth.updateUser({ password });

      if (error) {
        this.showAlert(
          this.translateService.instant('RESET_PASSWORD.RESET_ERROR') + ': ' + error.message,
        );
        return;
      }

      this.showAlert(this.translateService.instant('RESET_PASSWORD.RESET_SUCCESS'));
      this.goToAuthPage();
    } catch (err: any) {
      this.showAlert(
        this.translateService.instant('RESET_PASSWORD.RESET_ERROR') + ': ' + err.message,
      );
    }
  }

  private showAlert(message: string) {
    alert(message);
  }

  private validatePasswords(): boolean {
    const { password, confirmPassword } = this.resetPasswordForm.value;

    if (this.resetPasswordForm.invalid) {
      this.showAlert(this.translateService.instant('RESET_PASSWORD.INVALID_FORM'));
      return false;
    }

    if (password !== confirmPassword) {
      this.showAlert(this.translateService.instant('RESET_PASSWORD.MISMATCH'));
      return false;
    }

    return true;
  }
}
