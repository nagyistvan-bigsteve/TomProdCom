import { Component, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { LoginComponent } from '@features/auth/components/login/login.component';
import { SignupComponent } from '@features/auth/components/signup/signup.component';
import { TranslateModule } from '@ngx-translate/core';
import { ENTER_ANIMATION } from '@core/models/animations';

@Component({
  selector: 'app-page-auth',
  standalone: true,
  imports: [
    MatButtonModule,
    MatIconModule,
    LoginComponent,
    SignupComponent,
    TranslateModule,
  ],
  templateUrl: './auth-page.component.html',
  styleUrls: ['./auth-page.component.scss'],
  animations: [ENTER_ANIMATION],
})
export class AuthPageComponent {
  private isSignupMode = signal(false);

  isSignup() {
    return this.isSignupMode();
  }

  setMode(signup: boolean) {
    this.isSignupMode.set(signup);
  }

  toggleFromLogin() {
    this.isSignupMode.set(!this.isSignupMode());
  }
}
