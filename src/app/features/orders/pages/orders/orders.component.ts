import { Component, computed, inject, input, signal } from '@angular/core';
import { OrderTableComponent } from '@features/orders/components/order-table/order-table.component';
import { OrderResponse } from '@core/models/models';
import { OrderDetailsComponent } from '@features/orders/components/order-details/order-details.component';
import { ENTER_ANIMATION } from '@core/models/animations';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CommonModule, Location } from '@angular/common';
import { Router } from '@angular/router';
import { parseOrderId } from '@features/orders/pages/order-id.util';

@Component({
  selector: 'app-orders',
  imports: [
    CommonModule,
    OrderTableComponent,
    OrderDetailsComponent,
    MatProgressSpinnerModule,
  ],
  templateUrl: './orders.component.html',
  styleUrl: './orders.component.scss',
  animations: [ENTER_ANIMATION],
})
export class OrdersComponent {
  /** `?orderId=` — the open order; survives a reload and works with Back. */
  readonly orderId = input<string>();
  /** `?fromHistory=true` — opened from client history; closing goes back there. */
  readonly fromHistory = input<string>();

  readonly selectedOrderId = computed(() => parseOrderId(this.orderId()));
  isLoading = signal(true);

  private readonly router = inject(Router);
  private readonly location = inject(Location);

  selectedOrder(order: OrderResponse): void {
    this.router.navigate([], {
      queryParams: { orderId: order.id },
      queryParamsHandling: 'merge',
    });
  }

  deselectOrder(): void {
    if (this.fromHistory()) {
      this.location.back();
      return;
    }

    this.router.navigate([], {
      queryParams: { orderId: null },
      queryParamsHandling: 'merge',
    });
  }
}
