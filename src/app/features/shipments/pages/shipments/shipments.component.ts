import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule } from '@ngx-translate/core';
import { ShipmentStatus } from '@core/models/models';
import { ProductStore } from '@features/products/store/product.store';
import { ShipmentStore } from '@features/shipments/store/shipment.store';
import { sortedPercent } from '@features/shipments/shipment.util';
import { isGradable, shipmentTotalM3 } from '@shared/utils/stock.util';

@Component({
  selector: 'app-shipments',
  imports: [
    CommonModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
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
  private readonly router = inject(Router);

  readonly cards = computed(() => {
    const products = this.productStore.productsEntityMap();
    const gradable = (id: number) => !!products[id] && isGradable(products[id]);
    return this.store.shipments().map((s) => ({
      shipment: s,
      lines: s.shipment_items.length,
      pieces: s.shipment_items.reduce((sum, i) => sum + i.quantity, 0),
      m3: shipmentTotalM3(s.shipment_items, products),
      sortedPercent: sortedPercent(s.shipment_items, s.stock_sortings, gradable),
    }));
  });

  constructor() {
    this.store.loadList(this.store.status());
  }

  setStatus(status: ShipmentStatus): void {
    this.store.loadList(status);
  }

  open(id: number | 'new'): void {
    this.router.navigate(['/shipments', id]);
  }
}
