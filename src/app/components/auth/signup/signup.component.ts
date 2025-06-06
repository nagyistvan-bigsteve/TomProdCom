import { Component, EventEmitter, inject, Output } from '@angular/core';
import {
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { AuthError } from '@supabase/supabase-js';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { ENTER_ANIMATION } from '../../../models/animations';
import { useAuthStore } from '../../../services/store/auth-store';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-signup',
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    TranslateModule,
  ],
  templateUrl: './signup.component.html',
  styleUrls: ['./signup.component.scss'],
  animations: [ENTER_ANIMATION],
})
export class SignupComponent {
  private router = inject(Router);
  private authStore = inject(useAuthStore);
  private translateService = inject(TranslateService);

  signupForm = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
    name: new FormControl(''),
    password: new FormControl('', [
      Validators.required,
      Validators.minLength(6),
    ]),
  });

  async signUp() {
    if (!this.signupForm.valid) {
      return;
    }

    const { success, error } = await this.authStore.signup(
      this.signupForm.value.email!,
      this.signupForm.value.password!,
      this.signupForm.value.name!
    );

    if (error instanceof AuthError) {
      this.translateService.instant('ALERT.SIGN_UP_FAIL') + error.message;
      return;
    }

    if (error instanceof Error) {
      this.showAlert(
        this.translateService.instant('ALERT.SAVE_ACCOUNT_FAIL') + error.message
      );
      return;
    }

    if (success) {
      this.showAlert(this.translateService.instant('ALERT.ACCOUNT_CREATED'));
      this.router.navigate(['/wait-to-approve']);
    }
  }

  showAlert(message: string) {
    alert(message);
  }
}
