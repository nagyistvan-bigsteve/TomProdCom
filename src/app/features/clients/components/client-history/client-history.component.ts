import { Component, effect, inject, signal } from '@angular/core';
import { ClientStore } from '@features/clients/store/client.store';
import { OrdersService } from '@features/orders/services/orders.service';
import { OrderResponse } from '@core/models/models';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { ENTER_ANIMATION } from '@core/models/animations';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-client-history',
  imports: [CommonModule, MatButtonModule, TranslateModule],
  templateUrl: './client-history.component.html',
  styleUrl: './client-history.component.scss',
  animations: [ENTER_ANIMATION],
})
export class ClientHistoryComponent {
  readonly clientStore = inject(ClientStore);
  private readonly orderService = inject(OrdersService);
  private readonly router = inject(Router);

  orders = signal<OrderResponse[]>([]);
  openOrderIndex = signal<number>(-1);

  constructor() {
    effect(() => {
      const client = this.clientStore.client();
      if (!client?.id) return;

      this.orderService.getClientOrders(client.id).subscribe({
        next: (orders) => this.orders.set(orders),
        error: (error) => {
          console.error('Error fetching client orders:', error);
        },
      });
    });
  }

  goToDetailsPage(order: OrderResponse) {
    this.router.navigate(['/orders'], {
      queryParams: { orderId: order.id, fromHistory: true },
    });
  }
}
