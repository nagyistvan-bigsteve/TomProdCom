import {
  Component,
  DestroyRef,
  effect,
  inject,
  signal,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule } from '@angular/forms';
import { SelectedProductListComponent } from '@features/products/components/selected-product-list/selected-product-list.component';
import { ClientDetailsComponent } from '@features/clients/components/client-details/client-details.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CartStore } from '@features/orders/store/cart/cart.store';
import { useAuthStore } from '@core/store/auth-store';
import { OrdersService } from '@features/orders/services/orders.service';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { provideNativeDateAdapter } from '@angular/material/core';
import { Router } from '@angular/router';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';

import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import { Price2, ProductItem, UsedPricesInOrder } from '@core/models/models';
import { ENTER_AND_LEAVE_ANIMATION } from '@core/models/animations';
import { calculateActualPrice, ProductUtil } from '@shared/utils/product.util';
import { ClientStore } from '@features/clients/store/client.store';
import { DecimalInputDirective } from '@shared/directives/decimal-input.directive';

@Component({
  selector: 'app-offer-overview',
  standalone: true,
  providers: [provideNativeDateAdapter()],
  imports: [
    DecimalInputDirective,
    CommonModule,
    MatCardModule,
    MatListModule,
    MatTableModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    FormsModule,
    SelectedProductListComponent,
    ClientDetailsComponent,
    TranslateModule,
    MatDialogModule,
    MatDatepickerModule,
    MatCheckboxModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MatExpansionModule,
  ],
  templateUrl: './offer-overview-page.component.html',
  styleUrls: ['./offer-overview-page.component.scss'],
  animations: [ENTER_AND_LEAVE_ANIMATION],
})
export class OfferOverviewPageComponent {
  @ViewChild('confirmOfferDialog') confirmOfferDialog!: TemplateRef<any>;

  readonly currentDate = new Date();
  readonly productStore = inject(CartStore);
  readonly clientStore = inject(ClientStore);
  readonly authStore = inject(useAuthStore);
  private readonly productUtil = inject(ProductUtil);
  private router = inject(Router);
  private ordersService = inject(OrdersService);
  private _dialog = inject(MatDialog);
  private destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);

  isLoaded: boolean = false;

  delivery_address = signal('');
  isAllPriceDifferent = signal(false);

  deliveryFee: number = 0;
  comment: string = '';
  voucher: string = '';
  justOffer: boolean = false;
  expectedDeliveryDate: Date = new Date(
    this.currentDate.getTime() + 3 * 24 * 60 * 60 * 1000,
  );
  untilDeliveryDate: boolean = false;
  forFirstHour: boolean = false;
  transferPayment: boolean = false;

  usedPriceCategories: UsedPricesInOrder = [];
  private pricesCache: Price2[] = [];
  private lastClientId = signal<number | null>(null);

  constructor() {
    effect(() => {
      const currentId = this.clientStore.client()?.id ?? null;
      const previous = this.lastClientId();

      if (previous !== null && previous !== currentId) {
        this.resetForClientChange();
      } else if (previous === null && currentId !== null) {
        const storedClientId = this.productStore.pricingClientId();
        if (storedClientId !== null && storedClientId !== currentId) {
          this.resetForClientChange();
        }
      }

      this.lastClientId.set(currentId);
    });
  }

  private resetForClientChange(): void {
    this.usedPriceCategories = [];
    this.productStore.setUsedPriceCategories([]);
    this.productStore.productItems().forEach((item) => {
      if (item.manualPrice) {
        this.productStore.updateProductItem(item.product.id, item.category, {
          manualPrice: false,
        });
      }
    });
  }

  get totalPrice(): number {
    let total = this.price;
    if (this.voucher.includes('-')) {
      this.voucher = this.voucher.replace('-', '');
    }
    if (this.voucher.includes('%')) {
      const discountPercent = parseFloat(this.voucher.replace('%', '')) / 100;
      total -= total * discountPercent;
    } else {
      const discountValue = parseFloat(this.voucher);
      if (!isNaN(discountValue)) {
        total -= discountValue;
      }
    }
    return total > 0 ? total : 0;
  }

  get price(): number {
    return this.productStore.cartTotal();
  }

  toggleDifferentPrices(): void {
    this.isAllPriceDifferent.update((v) => !v);

    if (this.pricesCache.length) {
      this.getPriceList([...this.pricesCache]);
    }
  }

  // Set the final price and calculate the discount
  setFinalPrice(index: number, finalPrice: number): void {
    const row = this.usedPriceCategories[index];
    const updated = {
      ...row,
      discount: finalPrice - row.price,
    };

    const newArray = [...this.usedPriceCategories];
    newArray[index] = updated;

    this.usedPriceCategories = newArray;
    this.productStore.setUsedPriceCategories(this.usedPriceCategories);

    this.productStore.productItems().forEach((item: ProductItem) => {
      const matchesRow =
        item.category === row.category &&
        item.product.unit_id === row.unit &&
        (row.productId
          ? item.product.id === row.productId
          : item.product.size_id === row.size);

      if (matchesRow) {
        if (!row.productId) {
          const hasOwnRow = this.usedPriceCategories.some(
            (r) =>
              r.productId === item.product.id &&
              r.unit === row.unit &&
              r.category === row.category,
          );
          if (hasOwnRow) return;
        }

        const newPrice = this.productUtil.calculatePrice(
          item.product,
          finalPrice,
          item.quantity,
          'BRUT',
        ).price;
        this.productStore.updateProductItem(item.product.id, item.category, {
          price: newPrice,
          manualPrice: true,
        });
      }
    });
  }

  getProductName(productId: number): string | undefined {
    return this.productStore
      .productItems()
      .find((p) => p.product.id === productId)?.product.name;
  }

  getPriceList(prices: Price2[]): void {
    this.pricesCache = prices;

    const isTva = this.clientStore.client()?.tva ?? false;

    const previousDiscounts =
      this.usedPriceCategories.length
        ? [...this.usedPriceCategories]
        : [...this.productStore.usedPriceCategories()];

    const expandedPrices = this.expandPrices(prices);

    const usedPrices: UsedPricesInOrder = expandedPrices.map((price) => {
      const actualPrice = this.calculateActualPrice(price, isTva);

      const previous = previousDiscounts.find(
        (p) =>
          p.category === price.category_id &&
          p.unit === price.unit_id &&
          p.size === price.size_id &&
          (p.productId ?? null) === price.product_id,
      );

      return {
        category: price.category_id,
        unit: price.unit_id,
        size: price.size_id,
        price: actualPrice,
        productId: price.product_id ?? undefined,
        discount: previous?.discount ?? 0,
      };
    });

    this.usedPriceCategories = usedPrices.sort((a, b) => a.unit - b.unit);
    this.productStore.setUsedPriceCategories(this.usedPriceCategories);
  }

  loaded(): void {
    this.isLoaded = true;
  }

  confirmOffer() {
    const dialogRef = this._dialog.open(this.confirmOfferDialog, {
      width: '300px',
    });

    let totalOrderQuantity = this.getTotalQuantity();

    if (this.clientStore.client().tva) {
      this.comment = 'Taxare inversa - fără TVA\n';
    }

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (this.deliveryFee) {
          this.comment += 'Transport: ' + this.deliveryFee + 'RON' + '\n';
        }

        if (this.transferPayment) {
          this.comment +=
            this.translate.instant('OVERVIEW_PAGE.POPUP.TRANSFER_PAYMENT') +
            '\n';
        }

        if (result === true) {
          this.expectedDeliveryDate.setHours(6);
          this.ordersService
            .placeOrder(
              this.productStore.productItems(),
              this.price,
              this.totalPrice,
              this.voucher,
              this.clientStore.client()!,
              this.authStore.id()!,
              this.comment,
              this.expectedDeliveryDate!,
              this.untilDeliveryDate,
              this.forFirstHour,
              totalOrderQuantity,
              this.justOffer,
              this.delivery_address()
                ? this.delivery_address()
                : this.clientStore.client().address
                  ? this.clientStore.client().address!
                  : '',
              this.deliveryFee,
            )
            .then(() => {
              this.productStore.deleteProductItems();
              this.clientStore.setClientId(-1);
              this.voucher = '';
              this.comment = '';
              this.deliveryFee = 0;

              if (!this.justOffer) {
                localStorage.removeItem('on-order-details-page');
                this.router.navigate(['/orders']);
              } else {
                localStorage.removeItem('on-offer-details-page');
                this.router.navigate(['offers']);
              }
            });
        } else {
          this.comment = '';
        }
      });
  }

  getTotalQuantity(): number {
    return this.productUtil.calculateTotalQuantity(
      this.productStore.productItems(),
    );
  }

  private calculateActualPrice(price: Price2, isTva: boolean): number {
    return calculateActualPrice(price, isTva, this.productStore.productItems());
  }

  private expandPrices(prices: Price2[]): Price2[] {
    if (!this.isAllPriceDifferent()) return [...prices];

    const expanded: Price2[] = [];

    prices.forEach((price) => {
      const filteredProducts = this.productStore
        .productItems()
        .filter(
          (product) =>
            product.category === price.category_id &&
            product.product.unit_id === price.unit_id &&
            product.product.size_id === price.size_id &&
            price.product_id === null,
        );

      if (!filteredProducts.length) {
        expanded.push(price);
        return;
      }

      filteredProducts.forEach((product) => {
        expanded.push({
          ...price,
          product_id: product.product.id,
        });
      });
    });

    return expanded;
  }
}
