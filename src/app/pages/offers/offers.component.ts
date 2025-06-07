import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrderTableComponent } from '../../components/orders/order-table/order-table.component';
import { OrderResponse } from '../../models/models';
import { OrderDetailsComponent } from '../../components/orders/order-details/order-details.component';
import { ENTER_ANIMATION } from '../../models/animations';

@Component({
  selector: 'app-offers',
  imports: [CommonModule, OrderTableComponent, OrderDetailsComponent],
  templateUrl: './offers.component.html',
  styleUrl: './offers.component.scss',
  animations: [ENTER_ANIMATION],
})
export class OffersComponent {
  order: OrderResponse | null = null;

  selectedOrder(order: OrderResponse): void {
    this.order = order;
  }

  deselectOrder(): void {
    this.order = null;
  }
}
