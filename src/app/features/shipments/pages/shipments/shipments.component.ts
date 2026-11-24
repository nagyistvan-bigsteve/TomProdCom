import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule } from '@ngx-translate/core';
import { ShipmentStatus } from '@core/models/models';
import { ProductStore } from '@features/products/store/product.store';
import { ShipmentStore } from '@features/shipments/store/shipment.store';
import { ShipmentCard, toShipmentCard, filterShipmentCards } from '@features/shipments/shipment.util';
import { isGradable } from '@shared/utils/stock.util';
import { AppDatePipe } from '@shared/pipes/app-date.pipe';

@Component({
  selector: 'app-shipments',
  imports: [
    AppDatePipe,
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatButtonToggleModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    TranslateModule,
  ],
  templateUrl: './shipments.component.html',
  styleUrl: './shipments.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShipmentsComponent {
  readonly store = inject(ShipmentStore);
  private readonly productStore = inject(ProductStore);

  readonly search = signal('');
  /** Validated tab: only trucks with pieces still to sort. */
  readonly onlyToSort = signal(false);

  readonly cards = computed<ShipmentCard[]>(() => {
    const products = this.productStore.productsEntityMap();
    const gradable = (id: number) => !!products[id] && isGradable(products[id]);
    return this.store.shipments().map((s) => toShipmentCard(s, products, gradable));
  });

  readonly visibleCards = computed(() =>
    filterShipmentCards(this.cards(), this.search(), this.onlyToSort()),
  );

  /**
   * A search or "to sort" is active. It runs over the loaded pages only, so
   * the page says so while older trucks are not loaded yet.
   */
  readonly filtering = computed(() => !!this.search().trim() || this.onlyToSort());

  constructor() {
    this.store.loadList(this.store.status());
  }

  setStatus(status: ShipmentStatus): void {
    this.onlyToSort.set(false);
    this.store.loadList(status);
  }
}
