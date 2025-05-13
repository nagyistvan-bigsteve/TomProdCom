import {
  Component,
  DestroyRef,
  EventEmitter,
  inject,
  Input,
  OnInit,
  Output,
} from '@angular/core';
import { OrderItemsResponse, OrderResponse } from '../../../models/models';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { OrdersService } from '../../../services/query-services/orders.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { MatDividerModule } from '@angular/material/divider';
import { TranslateModule } from '@ngx-translate/core';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatCheckboxModule } from '@angular/material/checkbox';

@Component({
  selector: 'app-order-details',
  imports: [
    MatIconModule,
    MatButtonModule,
    CommonModule,
    MatDividerModule,
    TranslateModule,
    MatSnackBarModule,
    MatCheckboxModule,
  ],
  templateUrl: './order-details.component.html',
  styleUrl: './order-details.component.scss',
})
export class OrderDetailsComponent implements OnInit {
  @Output() closeDetails = new EventEmitter<void>();
  @Input() order: OrderResponse | undefined;

  orderItems: OrderItemsResponse[] | undefined;

  readonly destroyRef = inject(DestroyRef);
  readonly orderService = inject(OrdersService);
  private snackBar = inject(MatSnackBar);

  ngOnInit(): void {
    this.orderService
      .getOrderItemsById(this.order?.id as number)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((orderItems) => {
        this.orderItems = orderItems;
      });
  }

  closeDetailsComponent() {
    this.closeDetails.emit();
  }

  updateItemStatus(id: number, status: boolean, index: number) {
    this.orderService.orderItemStatusUpdate(id, status).then((status) => {
      if (!status) {
        this.snackBar.open('Error during update', 'Close', {
          duration: 3000,
        });
        return;
      }
      this.orderItems![index].itemStatus = status;
    });
  }

  orderIsDelivered(id: number) {
    this.orderService.orderIsDelivered(id).then((status) => {
      if (status) {
        this.snackBar.open('Order updated successfuly', 'Close', {
          duration: 3000,
        });
        this.closeDetails.emit();
      } else {
        this.snackBar.open('Order update failed', 'Close', {
          duration: 3000,
        });
      }
    });
  }
}
