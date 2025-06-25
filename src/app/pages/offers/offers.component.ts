import { Component, DestroyRef, inject, signal, Signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrderTableComponent } from '../../components/orders/order-table/order-table.component';
import { OrderResponse } from '../../models/models';
import { OrderDetailsComponent } from '../../components/orders/order-details/order-details.component';
import { ENTER_ANIMATION } from '../../models/animations';
import { ReactiveStorageService } from '../../services/utils/reavtive-storage.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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

  private readonly storage = inject(ReactiveStorageService);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.storage
      .getValue$('on-details-page')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        if (!value) {
          this.deselectOrder();
        }
      });
  }

  selectedOrder(order: OrderResponse): void {
    this.order = order;
    this.storage.setValue('on-details-page', 'true');
  }

  deselectOrder(): void {
    this.order = null;
    this.storage.removeValue('on-details-page');
  }
}
