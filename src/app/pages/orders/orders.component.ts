import { Component } from '@angular/core';
import { OrderTableComponent } from '../../components/orders/order-table/order-table.component';
import { OrderResponse } from '../../models/models';
import { OrderDetailsComponent } from '../../components/orders/order-details/order-details.component';
import { ENTER_ANIMATION } from '../../models/animations';

@Component({
  selector: 'app-orders',
  imports: [OrderTableComponent, OrderDetailsComponent],
  templateUrl: './orders.component.html',
  styleUrl: './orders.component.scss',
  animations: [ENTER_ANIMATION],
})
export class OrdersComponent {
  order: OrderResponse | null = null;

  selectedOrder(order: OrderResponse): void {
    this.order = order;
  }

  deselectOrder(): void {
    this.order = null;
  }
}
