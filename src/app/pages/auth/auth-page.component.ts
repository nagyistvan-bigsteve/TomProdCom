import { Component, signal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { CommonModule } from '@angular/common';
import { LoginComponent } from '../../components/auth/login/login.component';
import { SignupComponent } from '../../components/auth/signup/signup.component';

@Component({
  selector: 'app-page-auth',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    LoginComponent,
    SignupComponent,
  ],
  templateUrl: './auth-page.component.html',
  styleUrls: ['./auth-page.component.scss'],
})
export class AuthPageComponent {
  private isSignupMode = signal(false);

  isSignup() {
    return this.isSignupMode();
  }

  toggleFromLogin() {
    this.isSignupMode.set(!this.isSignupMode());
  }

  toggleMode(event: Event) {
    event.preventDefault();
    this.isSignupMode.set(!this.isSignupMode());
  }
}
