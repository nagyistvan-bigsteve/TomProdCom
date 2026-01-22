import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { ENTER_ANIMATION } from '../../models/animations';
import { StocksService } from '../../services/query-services/stocks.service';

@Component({
  selector: 'app-offer-page',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './start-page.component.html',
  styleUrl: './start-page.component.scss',
  animations: ENTER_ANIMATION,
})
export class StartPageComponent {
  private router = inject(Router);

  toCreateOfferPage(): void {
    this.router.navigate(['/offer/create']);
  }

  toProductListPage(): void {
    this.router.navigate(['/products']);
  }
}
