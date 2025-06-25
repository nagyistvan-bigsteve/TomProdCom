import { Component, inject, OnInit, signal } from '@angular/core';
import { CreateComingWaresDialogComponent } from '../../components/coming-wares/create-coming-wares/create-coming-wares-dialog.component';
import { useAuthStore } from '../../services/store/auth-store';
import { ComingWares, ComingWaresItems } from '../../models/models';
import { ComingWaresService } from '../../services/query-services/coming-wares.service';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-coming-wares',
  imports: [
    CommonModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    TranslateModule,
    MatSlideToggleModule,
    MatButtonToggleModule,
    ReactiveFormsModule,
  ],
  templateUrl: './coming-wares.component.html',
  styleUrl: './coming-wares.component.scss',
})
export class ComingWaresComponent implements OnInit {
  readonly authStore = inject(useAuthStore);
  readonly #waresService = inject(ComingWaresService);
  readonly #dialog = inject(MatDialog);
  readonly #router = inject(Router);
  comingWares = signal<ComingWares[] | null>(null);
  isLoading = signal(true);
  showVerifieds = signal(false);

  async ngOnInit() {
    this.isLoading.set(true);

    this.comingWares.set(
      await this.#waresService.getAllComingWares(this.showVerifieds())
    );
    this.isLoading.set(false);
  }

  changeList(): void {
    this.showVerifieds.set(!this.showVerifieds());

    this.ngOnInit();
  }

  openCreateDialog(): void {
    this.#dialog
      .open(CreateComingWaresDialogComponent, {
        width: '800px',
      })
      .afterClosed()
      .subscribe((result) => {
        if (result) {
          if (result.all_for_order) {
            (result.items as ComingWaresItems).forEach((item) => {
              item.for_order = true;
            });
          }

          this.#waresService
            .placeOrder(
              result.expected_delivery,
              result.name,
              result.total_quantity,
              result.all_for_order,
              result.comment,
              result.items
            )
            .then(() => {
              this.ngOnInit();
            });
        }
      });
  }

  goToDetailsPage(id: number): void {
    this.#router.navigate(['/coming-wares/', id, this.showVerifieds()]);
  }
}
