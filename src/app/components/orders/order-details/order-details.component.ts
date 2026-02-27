import {
  ChangeDetectorRef,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  EventEmitter,
  inject,
  Input,
  OnInit,
  Output,
  signal,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import {
  OrderItemsResponse,
  OrderResponse,
  Price2,
  Product,
  ProductItems,
  Products,
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
import { Router } from '@angular/router';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ProductUtil } from '../../../services/utils/product.util';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { FilterUtil } from '../../../services/utils/filter.util';
import { PricesService } from '../../../services/query-services/prices.service';
import { OrderPdfComponent } from '../../pdf/order-pdf/order-pdf.component';
import { OrderPdfGeneratorUtil } from '../../../services/utils/order-pdf-generator.util';
import { ClientStore } from '../../../services/store/client/client.store';

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
    MatProgressSpinnerModule,
    MatChipsModule,
    MatAutocompleteModule,
    OrderPdfComponent,
  ],
  templateUrl: './order-details.component.html',
  styleUrl: './order-details.component.scss',
})
export class OrderDetailsComponent implements OnInit {
  @ViewChild('input') input: ElementRef<HTMLInputElement> | null = null;
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
  selectedOffer: OrderItemsResponse | null = null;

  selectedCategory: Category = Category.A;
  categoryEnum = Category;
  myControl = new FormControl('');

  selectedProduct: any = {
    id: null,
    name: '',
    unit_id: null,
    size_id: null,
    length: null,
    thickness: null,
    width: null,
    m2_brut: null,
    m2_util: null,
    piece_per_pack: null,
  };
  isProductSelectet: boolean = false;
  products: Products = [];
  filteredOptions: Products = [];
  selectedProductQuantity: number = 1;
  selectedProductPrice: Price2[] | undefined;
  enableCategory: { enable: boolean; category: Category }[] = [
    { enable: false, category: Category.A },
    {
      enable: false,
      category: Category.AB,
    },
    {
      enable: false,
      category: Category.B,
    },
    {
      enable: false,
      category: Category.T,
    },
  ];
  isPrinting = signal(false);
  isLoading = signal(false);

  orderComment: string = '';

  private readonly productStore = inject(useProductStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly orderService = inject(OrdersService);
  private readonly productService = inject(ProductsService);
  private readonly pricesService = inject(PricesService);
  private readonly productUtil = inject(ProductUtil);
  private readonly router = inject(Router);
  private readonly changeDetection = inject(ChangeDetectorRef);
  private readonly orderPdfGenerator = inject(OrderPdfGeneratorUtil);
  readonly clientStore = inject(ClientStore);
  private filterUtil = inject(FilterUtil);
  private snackBar = inject(MatSnackBar);
  private translateService = inject(TranslateService);
  private _dialog = inject(MatDialog);

  client = computed(
    () => this.clientStore.clientsEntityMap()[this.order?.clientId!],
  );

  ngOnInit(): void {
    this.fetchOrderItems();
    this.fetchProducts();
    this.orderComment = this.order!.comment;
  }

  fetchProducts(): void {
    this.productService
      .getProducts()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((products) => {
        this.products = products;
      });
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

  openInMapsApp(address: string) {
    window.location.href = `geo:0,0?q=${encodeURIComponent(address)}`;
  }

  async print() {
    this.isLoading.set(true);
    this.isPrinting.set(true);
    this.changeDetection.detectChanges();

    this.orderPdfGenerator
      .print(this.orderItems!, this.order!, this.justOffers)
      .then(() => {
        this.isLoading.set(false);
        this.isPrinting.set(false);
        this.changeDetection.detectChanges();
      });
  }

  closeDetailsComponent() {
    this.closeDetails.emit();
  }

  openEditDialog(): void {
    const dialogRef = this._dialog.open(this.editOfferDialog, {
      width: '350px',
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (result) {
          this.updateOrderComment(this.orderComment);
        }
      });
  }

  addOrderItem(): void {
    const { price, packsNeeded, extraPiecesNeeded, totalPiecesNeeded } =
      this.productUtil.calculatePrice(
        this.selectedProduct,
        this.findExistingCategories()!,
        this.selectedProductQuantity,
        'BRUT',
      );

    let packsPieces = '';

    if (totalPiecesNeeded) {
      packsPieces =
        packsNeeded || extraPiecesNeeded
          ? (packsNeeded ? packsNeeded + 'p' : '0p') +
            (extraPiecesNeeded ? ' + ' + extraPiecesNeeded + 'b' : '')
          : '';

      this.selectedProductQuantity =
        totalPiecesNeeded *
        (this.selectedProduct.m2_brut / this.selectedProduct.piece_per_pack);
    }

    this.orderService
      .addOrderItem(this.order!, {
        product: this.selectedProduct,
        orderId: this.order!.id,
        quantity: this.selectedProductQuantity,
        category: { name: this.selectedCategory.toString() },
        price,
        packsPieces,
      })
      .then((result) => {
        if (result) {
          this.fetchOrderItems();
          setTimeout(() => {
            const total = this.getUpdateOrderTotals();
            this.orderService.updateOrderTotals(
              this.order!.id,
              total.totalAmount,
              total.totalAmountFinal,
              total.totalQuantity,
            );
            this.order!.totalAmount = total.totalAmount;
            this.order!.totalAmountFinal = total.totalAmountFinal;
            this.order!.totalQuantity = total.totalQuantity;
          }, 250);
        }
      });
  }

  deleteOrderItem(item: OrderItemsResponse): void {
    this.orderService.deleteOrderItem(item).then((result) => {
      if (result) {
        this.fetchOrderItems();
        setTimeout(() => {
          const total = this.getUpdateOrderTotals();
          this.orderService.updateOrderTotals(
            this.order!.id,
            total.totalAmount,
            total.totalAmountFinal,
            total.totalQuantity,
          );
          this.order!.totalAmount = total.totalAmount;
          this.order!.totalAmountFinal = total.totalAmountFinal;
          this.order!.totalQuantity = total.totalQuantity;
        }, 250);
      }
    });
  }

  optionSelected(product: Product): void {
    this.isProductSelectet = true;
    this.selectedProduct = product;

    this.pricesService.getPricesForProduct(product).then((prices) => {
      if (prices) {
        this.selectedProductPrice = prices;
        this.findExistingCategories();
      }
    });
  }

  findExistingCategories(): undefined | number {
    const isTva: boolean = this.client() ? this.client().tva : false;

    if (!this.selectedProductPrice || !this.selectedProductPrice!.length) {
      return;
    }

    this.enableCategory.forEach((categoryItem) => {
      categoryItem.enable = this.selectedProductPrice!.find(
        (price) => price.category_id === categoryItem.category,
      )?.price
        ? true
        : false;
    });

    const price = this.selectedProductPrice!.find(
      (price) => price.category_id === this.selectedCategory,
    );

    if (price) {
      if (isTva) {
        if (price.product_id) {
          if (price.unit_id === Unit_id.BOUNDLE) {
            return price.price - 5;
          }
          if (price.unit_id === Unit_id.M3) {
            return price.price - 100;
          }
        } else {
          if (price.unit_id === Unit_id.M3) {
            return price.price - 100;
          }
        }
      }
      return price?.price ? price.price : undefined;
    }
    return undefined;
  }

  filter(): void {
    this.filteredOptions = this.filterUtil.productFilter(
      this.input,
      this.products,
    );
  }

  displayProductLabel(product: Product): string {
    return product ? product.name : '';
  }

  private updateOrderComment(newComment: string) {
    this.orderService.updateOrderComment(this.order!.id, newComment);
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
              { duration: 3000 },
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
            localStorage.removeItem('on-order-details-page');
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
            (item) => item.product.id,
          );
          this.productService.getProductsByIds(productIds).then((products) => {
            if (!products) {
              return;
            }
            const productItems: ProductItems = this.orderItems!.map((item) => {
              return {
                product: products.find(
                  (product) => product.id === item.product.id,
                )!,
                quantity: item.quantity,
                price: item.price,
                category: Category[item.category.name as keyof typeof Category],
              };
            });
            this.clientStore.setClientId(
              this.clientStore.clientsEntityMap()[order.clientId].id,
            );
            this.productStore.setProductItems(productItems);
            if (this.deleteOffer) {
              this.orderService.permanentlyDeleteOrder(order.id);
            }
            localStorage.removeItem('on-order-details-page');

            this.router.navigate(['offer/overview']);
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
              { duration: 3000 },
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
              { duration: 3000 },
            );
          });
      }
    });
  }

  isPercentageVoucher(voucher: string): boolean {
    return voucher.includes('%');
  }

  private getUpdateOrderTotals(): {
    totalAmount: number;
    totalAmountFinal: number;
    totalQuantity: number;
  } {
    let totalQuantity = 0;
    let totalAmount = 0;

    this.orderItems?.forEach((item) => {
      totalAmount += item.price;
      totalQuantity +=
        item.product.unit_id !== Unit_id.M2 ? this.getTotalMQ(item) : 0;
    });

    let totalAmountFinal = totalAmount;

    if (this.order?.voucher) {
      totalAmountFinal = this.getVoucher(totalAmount);
    }

    return { totalAmount, totalAmountFinal, totalQuantity };
  }

  getVoucher(totalAmount: number): number {
    let total = totalAmount;
    if (this.order?.voucher.includes('-')) {
      this.order.voucher = this.order?.voucher.replace('-', '');
    }
    if (this.order?.voucher.includes('%')) {
      const discountPercent =
        parseFloat(this.order.voucher.replace('%', '')) / 100;
      total -= total * discountPercent;
    } else {
      const discountValue = parseFloat(this.order!.voucher);
      if (!isNaN(discountValue)) {
        total -= discountValue;
      }
    }

    return total;
  }

  getCategoryId(name: string): number {
    return Category[name as keyof typeof Category];
  }

  getTotalMQ(item: OrderItemsResponse): number {
    if (item.packsPieces) {
      return 0;
    }

    if (item.product.width) {
      let quntity = +new Intl.NumberFormat('en-US', {
        minimumIntegerDigits: 1,
        minimumFractionDigits: 0,
        maximumFractionDigits: 3,
      }).format(
        ((item.product.width * item.product.thickness * item.product.length) /
          1000000) *
          item.quantity,
      );

      if (item.product.unit_id === Unit_id.BOUNDLE) {
        quntity = quntity * 10;
      }

      return quntity;
    } else {
      return item.quantity;
    }
  }
}
