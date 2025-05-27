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
import { TranslateModule } from '@ngx-translate/core';

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
      alert('Incorrect email or password. Please try again.');
      return;
    }

    if (success) {
      if (!this.authStore.approved()) {
        alert('Your account is pending approval.');
        this.router.navigate(['/wait-to-approve']);
        await this.authStore.logout();
        return;
      }

      this.router.navigate(['/offer']);
    }
  }

  // async resetPassword() {
  //   const email = this.loginForm.get('email')?.value;
  //   if (!email) {
  //     alert('Please enter your email first.');
  //     return;
  //   }

  //   const { error } = await supabase.auth.resetPasswordForEmail(email);
  //   if (error) {
  //     alert('Error sending password reset email.');
  //   } else {
  //     alert('Check your email for password reset instructions.');
  //   }
  // }
}
