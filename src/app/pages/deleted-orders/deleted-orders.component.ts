import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { TranslateModule } from '@ngx-translate/core';
import { OrdersService } from '../../services/query-services/orders.service';
import { OrderResponse } from '../../models/models';
import { ENTER_ANIMATION } from '../../models/animations';
import { ConfirmDeleteDialogComponent } from '../../components/dialog/confirm-delete-dialog.component';

interface DeletedOrderWithDays extends OrderResponse {
  daysUntilDelete: number;
  daysAgo: number;
}

@Component({
  selector: 'app-deleted-orders',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    TranslateModule,
  ],
  templateUrl: './deleted-orders.component.html',
  styleUrl: './deleted-orders.component.scss',
  animations: [ENTER_ANIMATION],
})
export class DeletedOrdersComponent {
  private readonly orderService = inject(OrdersService);
  private readonly dialog = inject(MatDialog);

  private readonly DAYS_UNTIL_PERMANENT_DELETE = 10;

  // Signals
  deletedOrders = signal<DeletedOrderWithDays[]>([]);
  isLoading = signal(true);
  isProcessing = signal(false);

  // Computed
  ordersCount = computed(() => this.deletedOrders().length);
  hasOrders = computed(() => this.ordersCount() > 0);

  constructor() {
    this.loadDeletedOrders();
  }

  private loadDeletedOrders(): void {
    this.isLoading.set(true);

    this.orderService.getDeletedOrders().subscribe({
      next: (orders) => {
        const now = new Date();
        const ordersWithDays = orders
          .map((order) => {
            const deletedDate = new Date(order.deletedAt!);
            const daysSinceDeletion = Math.floor(
              (now.getTime() - deletedDate.getTime()) / (1000 * 60 * 60 * 24),
            );
            const daysUntilDelete =
              this.DAYS_UNTIL_PERMANENT_DELETE - daysSinceDeletion;

            return {
              ...order,
              daysUntilDelete,
              daysAgo: daysSinceDeletion,
            };
          })
          .filter((order) => {
            // Auto-delete orders older than 10 days
            if (order.daysUntilDelete <= 0) {
              this.orderService.permanentlyDeleteOrder(order.id);
              return false;
            }
            return true;
          })
          .sort((a, b) => b.daysAgo - a.daysAgo); // Sort by deletion date (newest first)

        this.deletedOrders.set(ordersWithDays);
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Error loading deleted orders:', error);
        this.isLoading.set(false);
      },
    });
  }

  restoreOrder(order: DeletedOrderWithDays): void {
    const dialogRef = this.dialog.open(ConfirmDeleteDialogComponent, {
      data: {
        title: 'DELETED_ORDERS.RESTORE_TITLE',
        message: 'DELETED_ORDERS.RESTORE_MESSAGE',
        orderId: order.id,
      },
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (confirmed) {
        this.isProcessing.set(true);
        this.orderService.restoreDeletedOrder(order.id).then((success) => {
          if (success) {
            // Remove from list
            this.deletedOrders.update((orders) =>
              orders.filter((o) => o.id !== order.id),
            );
          }
          this.isProcessing.set(false);
        });
      }
    });
  }

  permanentlyDelete(order: DeletedOrderWithDays): void {
    const dialogRef = this.dialog.open(ConfirmDeleteDialogComponent, {
      data: {
        title: 'DELETED_ORDERS.PERMANENT_DELETE_TITLE',
        message: 'DELETED_ORDERS.PERMANENT_DELETE_MESSAGE',
        orderId: order.id,
        isDangerous: true,
      },
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (confirmed) {
        this.isProcessing.set(true);
        this.orderService.permanentlyDeleteOrder(order.id).then((success) => {
          if (success) {
            // Remove from list
            this.deletedOrders.update((orders) =>
              orders.filter((o) => o.id !== order.id),
            );
          }
          this.isProcessing.set(false);
        });
      }
    });
  }

  trackByOrderId(index: number, order: DeletedOrderWithDays): number {
    return order.id;
  }
}
