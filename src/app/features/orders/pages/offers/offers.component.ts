import { Component, computed, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { OrderTableComponent } from '@features/orders/components/order-table/order-table.component';
import { OrderResponse } from '@core/models/models';
import { OrderDetailsComponent } from '@features/orders/components/order-details/order-details.component';
import { ENTER_ANIMATION } from '@core/models/animations';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { parseOrderId } from '@features/orders/pages/order-id.util';

@Component({
  selector: 'app-offers',
  imports: [
    CommonModule,
    OrderTableComponent,
    OrderDetailsComponent,
    MatProgressSpinnerModule,
  ],
  templateUrl: './offers.component.html',
  styleUrl: './offers.component.scss',
  animations: [ENTER_ANIMATION],
})
export class OffersComponent {
  /** `?orderId=` — the open offer; survives a reload and works with Back. */
  readonly orderId = input<string>();

  readonly selectedOrderId = computed(() => parseOrderId(this.orderId()));
  isLoading = signal(true);

  private readonly router = inject(Router);

  selectedOrder(order: OrderResponse): void {
    this.router.navigate([], {
      queryParams: { orderId: order.id },
      queryParamsHandling: 'merge',
    });
  }

  deselectOrder(): void {
    this.router.navigate([], {
      queryParams: { orderId: null },
      queryParamsHandling: 'merge',
    });
  }
}
