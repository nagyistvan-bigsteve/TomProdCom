import { Component, effect, inject, signal } from '@angular/core';
import { ClientStore } from '../../../services/store/client/client.store';
import { OrdersService } from '../../../services/query-services/orders.service';
import { OrderResponse } from '../../../models/models';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { ENTER_ANIMATION } from '../../../models/animations';
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
    localStorage.removeItem('on-order-details-page');

    effect(() => {
      const client = this.clientStore.client();
      if (!client?.id) return;

      this.orderService.getClientOrders(client.id).subscribe((orders) => {
        this.orders.set(orders);
      });
    });
  }

  goToDetailsPage(order: OrderResponse) {
    localStorage.setItem('on-order-details-page', JSON.stringify(order));

    this.router.navigate(['/orders'], {
      queryParams: { fromHistory: true },
    });
  }
}
