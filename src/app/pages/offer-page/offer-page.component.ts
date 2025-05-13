import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { ENTER_ANIMATION } from '../../models/animations';

@Component({
  selector: 'app-offer-page',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './offer-page.component.html',
  styleUrl: './offer-page.component.scss',
  animations: ENTER_ANIMATION,
})
export class OfferPageComponent {
  private router = inject(Router);

  toCreateOfferPage(): void {
    this.router.navigate(['/offer/create']);
  }
}
