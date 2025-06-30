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
    this.route.queryParams.subscribe((params) => {
      this.token = params['token'];
      if (!this.token) {
        this.goToAuthPage();
      }
    });
  }

  goToAuthPage(): void {
    this.router.navigate(['/auth']);
  }

  async resetPassword() {
    if (!this.checkPasswords()) {
      return;
    }

    const { data, error } =
      await this.supabaseService.client.auth.exchangeCodeForSession(
        this.token!
      );

    console.error(error);

    if (data) {
      const { error } = await this.supabaseService.client.auth.updateUser(
        this.resetPasswordForm.value.password as UserAttributes
      );

      if (error) {
        this.showAlert(
          this.translateService.instant('RESET_PASSWORD.RESET_ERROR') +
            error.message
        );
        return;
      }

      this.showAlert(
        this.translateService.instant('RESET_PASSWORD.RESET_SUCCESS')
      );
      this.router.navigate(['/auth']);
    } else {
      this.showAlert(
        this.translateService.instant('RESET_PASSWORD.INVALID_LINK')
      );
    }
  }

  showAlert(message: string) {
    alert(message);
  }

  checkPasswords(): boolean {
    if (this.resetPasswordForm.invalid) {
      return false;
    }

    const { password, confirmPassword } = this.resetPasswordForm.value;

    if (password !== confirmPassword) {
      this.showAlert(this.translateService.instant('RESET_PASSWORD.MISMATCH'));
      return false;
    }

    return true;
  }
}
