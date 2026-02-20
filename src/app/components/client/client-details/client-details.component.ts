import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatAccordion, MatExpansionModule } from '@angular/material/expansion';
import { TranslateModule } from '@ngx-translate/core';
import { MatListModule } from '@angular/material/list';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatOptionModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { Router } from '@angular/router';
import { ClientStore } from '../../../services/store/client/client.store';

@Component({
  selector: 'app-client-details',
  imports: [
    CommonModule,
    TranslateModule,
    MatAccordion,
    MatExpansionModule,
    MatListModule,
    MatDialogModule,
    MatIconModule,
    MatFormFieldModule,
    ReactiveFormsModule,
    MatInputModule,
    MatOptionModule,
    MatButtonModule,
    TranslateModule,
  ],
  templateUrl: './client-details.component.html',
  styleUrl: './client-details.component.scss',
})
export class ClientDetailsComponent {
  readonly clientStore = inject(ClientStore);

  private router = inject(Router);
  readonly dialog = inject(MatDialog);

  goToClientPage(): void {
    this.router.navigate(['offer/client']);
  }
}
