import { Component, OnInit, signal } from '@angular/core';
import { OrderTableComponent } from '../../components/orders/order-table/order-table.component';
import { OrderResponse } from '../../models/models';
import { OrderDetailsComponent } from '../../components/orders/order-details/order-details.component';
import { ENTER_ANIMATION } from '../../models/animations';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CommonModule } from '@angular/common';

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
export class OrdersComponent implements OnInit {
  order: OrderResponse | null = null;
  isLoading = signal(true);

  ngOnInit(): void {
    if (localStorage.getItem('on-order-details-page')) {
      this.order = JSON.parse(localStorage.getItem('on-order-details-page')!);
    }
    this.isLoading.set(false);
  }

  selectedOrder(order: OrderResponse): void {
    this.order = order;
    localStorage.setItem('on-order-details-page', JSON.stringify(order));
  }

  deselectOrder(): void {
    this.order = null;
    localStorage.removeItem('on-order-details-page');
  }
}
