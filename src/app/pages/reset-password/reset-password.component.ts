import { Component, inject } from '@angular/core';
import { createClient, UserAttributes } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
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

const supabase = createClient(
  environment.supabaseUrl,
  environment.supabaseAnonKey
);

@Component({
  selector: 'app-reset-password',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
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
  token: string | null = null;

  ngOnInit() {
    // Get the token from the URL query parameters
    this.route.queryParams.subscribe((params) => {
      this.token = params['token']; // This token will be part of the URL query parameters
    });
  }

  async resetPassword() {
    if (this.resetPasswordForm.invalid) return;

    const { password, confirmPassword } = this.resetPasswordForm.value;

    if (password !== confirmPassword) {
      alert("Passwords don't match.");
      return;
    }

    const { data, error } = await supabase.auth.exchangeCodeForSession(
      this.token!
    );

    console.log(error);

    // If token is available, proceed to reset password using token
    if (data) {
      const { error } = await supabase.auth.updateUser(
        password as UserAttributes
      );

      if (error) {
        alert('Error resetting password: ' + error.message);
        return;
      }

      alert('Your password has been successfully reset!');
      this.router.navigate(['/login']);
    } else {
      alert('Invalid reset link.');
    }
  }
}
