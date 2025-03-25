import { Component, inject } from '@angular/core';
import { LanguageSwitcherComponent } from '../language-swicher/language-switcher.component';
import { TranslateModule } from '@ngx-translate/core';
import { Location } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { ENTER_AND_LEAVE_ANIMATION } from '../../models/animations';

@Component({
  selector: 'app-topbar',
  imports: [
    LanguageSwitcherComponent,
    TranslateModule,
    MatIconModule,
    MatButtonModule,
  ],
  templateUrl: './topbar.component.html',
  styleUrl: './topbar.component.scss',
  animations: [ENTER_AND_LEAVE_ANIMATION],
})
export class TopbarComponent {
  readonly #location = inject(Location);

  goBack(): void {
    this.#location.back();
  }
}
