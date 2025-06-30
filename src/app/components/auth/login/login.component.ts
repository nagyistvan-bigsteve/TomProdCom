import { Component, EventEmitter, inject, Output } from '@angular/core';
import {
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { ENTER_ANIMATION } from '../../../models/animations';
import { useAuthStore } from '../../../services/store/auth-store';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { SupabaseService } from '../../../services/supabase.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    TranslateModule,
  ],
  animations: [ENTER_ANIMATION],
})
export class LoginComponent {
  @Output() toggleAuth = new EventEmitter<void>();

  private router = inject(Router);
  private authStore = inject(useAuthStore);
  private translateService = inject(TranslateService);
  private supabaseService = inject(SupabaseService);

  loginForm = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [
      Validators.required,
      Validators.minLength(6),
    ]),
  });

  async login() {
    if (this.loginForm.invalid) return;

    const { email, password } = this.loginForm.value;

    const { success, error } = await this.authStore.login(email!, password!);

    if (error) {
      this.showAlert(this.translateService.instant('ALERT.INCORRECT_LOG_IN'));
      return;
    }

    if (success) {
      if (!this.authStore.approved()) {
        this.showAlert(this.translateService.instant('ALERT.PENDING_APPROVAL'));
        this.router.navigate(['/wait-to-approve']);
        await this.authStore.logout();
        return;
      }

      this.router.navigate(['/offer']);
    }
  }

  showAlert(message: string) {
    alert(message);
  }

  async resetPassword() {
    const email = this.loginForm.get('email')?.value;
    if (!email) {
      this.showAlert(
        this.translateService.instant('RESET_PASSWORD.ENTER_EMAIL_FIRST')
      );
      return;
    }

    const { error } =
      await this.supabaseService.client.auth.resetPasswordForEmail(email);
    if (error) {
      this.showAlert(
        this.translateService.instant('RESET_PASSWORD.EMAIL_SENT_ERROR')
      );
    } else {
      this.showAlert(
        this.translateService.instant('RESET_PASSWORD.EMAIL_SENT_SUCCESS')
      );
    }
  }
}
