import {
  Component,
  DestroyRef,
  EventEmitter,
  inject,
  Input,
  OnInit,
  Output,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import { OrderItemsResponse, OrderResponse } from '../../../models/models';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { OrdersService } from '../../../services/query-services/orders.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { MatDividerModule } from '@angular/material/divider';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

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
    MatDialogModule,
  ],
  templateUrl: './order-details.component.html',
  styleUrl: './order-details.component.scss',
})
export class OrderDetailsComponent implements OnInit {
  @ViewChild('confirmDeliveredDialog')
  confirmDeliveredDialog!: TemplateRef<any>;
  @Output() closeDetails = new EventEmitter<void>();
  @Input() order: OrderResponse | undefined;

  orderItems: OrderItemsResponse[] | undefined;

  readonly destroyRef = inject(DestroyRef);
  readonly orderService = inject(OrdersService);
  private snackBar = inject(MatSnackBar);
  private translateService = inject(TranslateService);
  private _dialog = inject(MatDialog);

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
        this.translateService
          .get(['SNACKBAR.GENERAL.UPDATE_ERROR', 'SNACKBAR.BUTTONS.CLOSE'])
          .subscribe((translations) => {
            this.snackBar.open(
              translations['SNACKBAR.GENERAL.UPDATE_ERROR'],
              translations['SNACKBAR.BUTTONS.CLOSE'],
              { duration: 3000 }
            );
          });
        return;
      }
      this.orderItems![index].itemStatus = status;
    });
  }

  confirmDelivered(id: number): void {
    const dialogRef = this._dialog.open(this.confirmDeliveredDialog, {
      width: '300px',
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (result === true) {
          this.orderIsDelivered(id);
        }
      });
  }

  orderIsDelivered(id: number) {
    this.orderService.orderIsDelivered(id).then((status) => {
      if (status) {
        this.translateService
          .get(['SNACKBAR.ORDER.UPDATE_SUCCESS', 'SNACKBAR.BUTTONS.CLOSE'])
          .subscribe((translations) => {
            this.snackBar.open(
              translations['SNACKBAR.ORDER.UPDATE_SUCCESS'],
              translations['SNACKBAR.BUTTONS.CLOSE'],
              { duration: 3000 }
            );
          });
        this.closeDetails.emit();
      } else {
        this.translateService
          .get(['SNACKBAR.GENERAL.UPDATE_ERROR', 'SNACKBAR.BUTTONS.CLOSE'])
          .subscribe((translations) => {
            this.snackBar.open(
              translations['SNACKBAR.GENERAL.UPDATE_ERROR'],
              translations['SNACKBAR.BUTTONS.CLOSE'],
              { duration: 3000 }
            );
          });
      }
    });
  }
}
