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
import {
  OrderItemsResponse,
  OrderResponse,
  ProductItems,
} from '../../../models/models';
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
import { useProductStore } from '../../../services/store/product-store';
import { ProductsService } from '../../../services/query-services/products.service';
import { Category } from '../../../models/enums';
import { ClientsService } from '../../../services/query-services/client.service';
import { Router } from '@angular/router';
import { useClientStore } from '../../../services/store/client-store';
import { FormsModule } from '@angular/forms';

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
    FormsModule,
  ],
  templateUrl: './order-details.component.html',
  styleUrl: './order-details.component.scss',
})
export class OrderDetailsComponent implements OnInit {
  @ViewChild('confirmDeliveredDialog')
  confirmDeliveredDialog!: TemplateRef<any>;
  @ViewChild('confirmTransformOfferDialog')
  confirmTransformOfferDialog!: TemplateRef<any>;
  @ViewChild('confirmTransformExactOfferDialog')
  confirmTransformExactOfferDialog!: TemplateRef<any>;

  @Output() closeDetails = new EventEmitter<void>();

  @Input() order: OrderResponse | undefined;
  @Input() justOffers: boolean = false;

  orderItems: OrderItemsResponse[] | undefined;
  deleteOffer: boolean = false;

  private readonly productStore = inject(useProductStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly orderService = inject(OrdersService);
  private readonly productService = inject(ProductsService);
  private readonly clientService = inject(ClientsService);
  private readonly clientStore = inject(useClientStore);
  private readonly router = inject(Router);
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

  transformExactOfferToOrder(order: OrderResponse): void {
    const dialogRef = this._dialog.open(this.confirmTransformExactOfferDialog, {
      width: '300px',
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (result === true) {
          this.orderService.transformOfferToOrder(order.id).then(() => {
            this.router.navigate(['orders']);
          });
        }
      });
  }

  transformOfferToOrder(order: OrderResponse): void {
    const dialogRef = this._dialog.open(this.confirmTransformOfferDialog, {
      width: '300px',
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (result === true) {
          const productIds: number[] = this.orderItems!.map(
            (item) => item.product.id
          );
          this.clientService.getClientById(order.client.id).then((client) => {
            if (!client) {
              return;
            }
            this.productService
              .getProductsByIds(productIds)
              .then((products) => {
                if (!products) {
                  return;
                }
                const productItems: ProductItems = this.orderItems!.map(
                  (item) => {
                    return {
                      product: products.find(
                        (product) => product.id === item.product.id
                      )!,
                      quantity: item.quantity,
                      price: item.price,
                      category:
                        Category[item.category.name as keyof typeof Category],
                    };
                  }
                );
                this.clientStore.setClient(client);
                this.productStore.setProductItems(productItems);
                if (this.deleteOffer) {
                  this.orderService.deleteOrder(order.id);
                }
                this.router.navigate(['offer/overview']);
              });
          });
        }
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
