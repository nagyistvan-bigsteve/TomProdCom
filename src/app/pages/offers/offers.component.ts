import { Component, DestroyRef, inject, signal, Signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrderTableComponent } from '../../components/orders/order-table/order-table.component';
import { OrderResponse } from '../../models/models';
import { OrderDetailsComponent } from '../../components/orders/order-details/order-details.component';
import { ENTER_ANIMATION } from '../../models/animations';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

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
  order: OrderResponse | null = null;
  isLoading = signal(true);

  ngOnInit(): void {
    if (localStorage.getItem('on-offer-details-page')) {
      this.order = JSON.parse(localStorage.getItem('on-offer-details-page')!);

      if (!this.order?.clientId) {
        this.deselectOrder();
      }
    }
    this.isLoading.set(false);
  }

  selectedOrder(order: OrderResponse): void {
    this.order = order;
    localStorage.setItem('on-offer-details-page', JSON.stringify(order));
  }

  deselectOrder(): void {
    this.order = null;
    localStorage.removeItem('on-offer-details-page');
  }
}
