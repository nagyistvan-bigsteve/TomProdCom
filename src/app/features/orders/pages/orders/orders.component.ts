import { Component, inject, OnInit, signal } from '@angular/core';
import { OrderTableComponent } from '@features/orders/components/order-table/order-table.component';
import { OrderResponse } from '@core/models/models';
import { OrderDetailsComponent } from '@features/orders/components/order-details/order-details.component';
import { ENTER_ANIMATION } from '@core/models/animations';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CommonModule, Location } from '@angular/common';
import { ClientStore } from '@features/clients/store/client.store';
import { ActivatedRoute } from '@angular/router';

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
  fromHistory = signal(false);
  readonly clientStore = inject(ClientStore);
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      this.fromHistory.set(params['fromHistory']);
    });

    if (localStorage.getItem('on-order-details-page')) {
      this.order = JSON.parse(localStorage.getItem('on-order-details-page')!);
    }

    if (!this.order?.clientId) {
      this.deselectOrder();
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
    if (this.fromHistory()) {
      this.location.back();
    }
  }
}
