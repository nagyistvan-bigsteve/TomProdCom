import { Component, inject } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-bottom-navbar',
  imports: [MatDividerModule, MatIconModule, MatIconButton, TranslateModule],
  standalone: true,
  templateUrl: './bottom-navbar.component.html',
  styleUrl: './bottom-navbar.component.scss',
})
export class BottomNavbarComponent {
  readonly #router = inject(Router);

  toNewOfferPage() {
    this.#router.navigate(['/offer']);
  }
}
