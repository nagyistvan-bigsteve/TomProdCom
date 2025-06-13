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
  Price,
  Product,
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
import { Category, Unit_id } from '../../../models/enums';
import { ClientsService } from '../../../services/query-services/client.service';
import { Router } from '@angular/router';
import { useClientStore } from '../../../services/store/client-store';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ProductUtil } from '../../../services/utils/product.util';

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
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
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
  @ViewChild('editOfferDialog')
  editOfferDialog!: TemplateRef<any>;

  @Output() closeDetails = new EventEmitter<void>();

  @Input() order: OrderResponse | undefined;
  @Input() justOffers: boolean = false;

  orderItems: OrderItemsResponse[] | undefined;
  deleteOffer: boolean = false;
  showPrice: boolean = false;
  editMode: boolean = false;
  selectedOffer: OrderItemsResponse | null = null;

  editForm: FormGroup | null = null;
  categories: { value: Category; label: string }[] = [];

  private readonly productStore = inject(useProductStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly orderService = inject(OrdersService);
  private readonly productService = inject(ProductsService);
  private readonly productUtil = inject(ProductUtil);
  private readonly clientService = inject(ClientsService);
  private readonly clientStore = inject(useClientStore);
  private readonly router = inject(Router);
  private snackBar = inject(MatSnackBar);
  private translateService = inject(TranslateService);
  private _dialog = inject(MatDialog);
  private fb = inject(FormBuilder);

  ngOnInit(): void {
    this.fetchOrderItems();
  }

  fetchOrderItems(): void {
    this.orderService
      .getOrderItemsById(this.order?.id as number)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((orderItems) => {
        this.orderItems = orderItems.sort((a, b) => a.id - b.id);
      });
  }

  callNumber(phone: string) {
    window.location.href = `tel:${phone}`;
  }

  closeDetailsComponent() {
    this.closeDetails.emit();
  }

  editItem(item: OrderItemsResponse, order: OrderResponse) {
    this.productService.getProductsByIds([item.product.id]).then((product) => {
      if (product) {
        this.productService
          .getPrices(product[0])
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe((prices) => {
            this.categories = prices.map((value) => ({
              value: value.category_id,
              label: Category[value.category_id],
            }));

            this.selectedOffer = item;
            this.openEditDialog(order, item, product[0], prices);
          });
      }
    });
  }

  openEditDialog(
    order: OrderResponse,
    item: OrderItemsResponse,
    product: Product,
    prices: Price[]
  ): void {
    this.editForm = this.fb.group({
      quantity: [item.quantity, [Validators.required, Validators.min(0)]],
      category: [this.getCategoryId(item.category.name), Validators.required],
    });

    const dialogRef = this._dialog.open(this.editOfferDialog, {
      width: '300px',
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (result) {
          const price = prices.find(
            (price) => price.category_id === this.editForm?.value.category
          )!.price;
          const newPrice = this.productUtil.calculatePrice(
            product,
            price,
            this.editForm?.value.quantity,
            true
          );

          const category = this.editForm?.value.category;
          const quantity = +this.editForm?.value.quantity;

          const newOrderPrice = order.totalAmount - item.price + newPrice.price;
          let newOrderPriceFinal = newOrderPrice;

          const { unit_id, width, thickness, length } = product;

          let totalQuantity = order.totalQuantity;

          if (unit_id !== Unit_id.M2 && unit_id !== Unit_id.BUC) {
            const volumeM3 = (width * thickness * length) / 1_000_000;
            const multiplier = unit_id === Unit_id.BOUNDLE ? 10 : 1;

            totalQuantity =
              totalQuantity - item.quantity * volumeM3 * multiplier;
            totalQuantity = totalQuantity + quantity * volumeM3 * multiplier;
          }

          if (order.voucher && order.voucher.includes('%')) {
            const discountPercent =
              parseFloat(order.voucher.replace('%', '')) / 100;
            newOrderPriceFinal -= newOrderPrice * discountPercent;
          } else {
            const discountValue = parseFloat(order.voucher);
            if (!isNaN(discountValue)) {
              newOrderPriceFinal -= discountValue;
            }
          }

          if (product.unit_id === Unit_id.M2) {
            const packsPieces =
              (newPrice.packsNeeded ? `${newPrice.packsNeeded}p` : '') +
              (newPrice.extraPiecesNeeded
                ? ` + ${newPrice.extraPiecesNeeded}b`
                : '');

            this.orderService
              .editOrderItem(
                item.id,
                order.id,
                {
                  category_id: category,
                  quantity: newPrice.totalPiecesNeeded * (product.m2_brut / 10),
                  packs_pieces: packsPieces,
                  price: newPrice.price,
                },
                {
                  total_amount: newOrderPrice,
                  total_amount_final: newOrderPriceFinal,
                }
              )
              .then((response) => {
                if (response) {
                  this.fetchOrderItems();
                }
              });
          } else {
            this.orderService
              .editOrderItem(
                item.id,
                order.id,
                {
                  category_id: category,
                  quantity,
                  price: newPrice.price,
                },
                {
                  total_quantity: totalQuantity,
                  total_amount: newOrderPrice,
                  total_amount_final: newOrderPriceFinal,
                }
              )
              .then((response) => {
                if (response) {
                  this.fetchOrderItems();
                }
              });
          }
          this.selectedOffer = null;
        }
      });
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

  getCategoryId(name: string): number {
    return Category[name as keyof typeof Category];
  }
}
