import { Component, inject } from '@angular/core';
import { UserAttributes } from '@supabase/supabase-js';
import { CommonModule } from '@angular/common';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { ActivatedRoute, Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-reset-password',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    TranslateModule,
  ],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.scss',
})
export class ResetPasswordComponent {
  resetPasswordForm = new FormGroup({
    password: new FormControl('', [
      Validators.required,
      Validators.minLength(6),
    ]),
    confirmPassword: new FormControl('', [
      Validators.required,
      Validators.minLength(6),
    ]),
  });

  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private supabaseService = inject(SupabaseService);
  private translateService = inject(TranslateService);
  token: string | null = null;

  ngOnInit() {
    this.setSessionByParams();
  }

  goToAuthPage(): void {
    this.router.navigate(['/auth']);
  }

  async resetPassword() {
    if (!this.validatePasswords()) {
      return;
    }

    const password = this.resetPasswordForm.value.password!;

    const { error } = await this.supabaseService.client.auth.updateUser({
      password,
    });

    if (error) {
      this.showAlert(
        this.translateService.instant('RESET_PASSWORD.RESET_ERROR') +
          ': ' +
          error.message
      );
      return;
    }

    this.showAlert(
      this.translateService.instant('RESET_PASSWORD.RESET_SUCCESS')
    );
    this.goToAuthPage();
  }

  private showAlert(message: string) {
    alert(message);
  }

  private validatePasswords(): boolean {
    const { password, confirmPassword } = this.resetPasswordForm.value;

    if (this.resetPasswordForm.invalid) {
      this.showAlert(
        this.translateService.instant('RESET_PASSWORD.INVALID_FORM')
      );
      return false;
    }

    if (password !== confirmPassword) {
      this.showAlert(this.translateService.instant('RESET_PASSWORD.MISMATCH'));
      return false;
    }

    return true;
  }

  private setSessionByParams(): void {
    this.route.queryParams.subscribe(async (params) => {
      const access_token = params['access_token'];
      const refresh_token = params['refresh_token'];

      if (!access_token || !refresh_token) {
        this.showAlert(
          this.translateService.instant('RESET_PASSWORD.INVALID_LINK')
        );
        this.goToAuthPage();
        return;
      }

      const { error } = await this.supabaseService.client.auth.setSession({
        access_token,
        refresh_token,
      });

      if (error) {
        this.showAlert(
          this.translateService.instant('RESET_PASSWORD.SESSION_ERROR') +
            ': ' +
            error.message
        );
        this.goToAuthPage();
      }
    });
  }
}
