import { Component, inject, signal } from '@angular/core';
import {
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { AuthError } from '@supabase/supabase-js';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { useAuthStore } from '@core/store/auth-store';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-signup',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    TranslateModule,
  ],
  templateUrl: './signup.component.html',
  styleUrls: ['./signup.component.scss'],
})
export class SignupComponent {
  private router = inject(Router);
  private authStore = inject(useAuthStore);
  private translateService = inject(TranslateService);

  showPassword = signal(false);

  signupForm = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
    name: new FormControl(''),
    password: new FormControl('', [
      Validators.required,
      Validators.minLength(6),
    ]),
  });

  togglePassword() {
    this.showPassword.update(v => !v);
  }

  async signUp() {
    if (!this.signupForm.valid) return;

    const { success, error } = await this.authStore.signup(
      this.signupForm.value.email!,
      this.signupForm.value.password!,
      this.signupForm.value.name!
    );

    if (error instanceof AuthError) {
      this.showAlert(this.translateService.instant('ALERT.SIGN_UP_FAIL') + error.message);
      return;
    }

    if (error instanceof Error) {
      this.showAlert(this.translateService.instant('ALERT.SAVE_ACCOUNT_FAIL') + error.message);
      return;
    }

    if (success) {
      this.showAlert(this.translateService.instant('ALERT.ACCOUNT_CREATED'));
      this.router.navigate(['/wait-to-approve']);
    }
  }

  private showAlert(message: string) {
    alert(message);
  }
}
