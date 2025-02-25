import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-offer-page',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './offer-page.component.html',
  styleUrl: './offer-page.component.scss',
})
export class OfferPageComponent {
  readonly #router = inject(Router);

  toCreateOfferPage(): void {
    this.#router.navigate(['/offer/create']);
  }
}
