import {
  Component,
  DestroyRef,
  inject,
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
import { SelectedProductListComponent } from '../../components/product/selected-product-list/selected-product-list.component';
import { ClientDetailsComponent } from '../../components/client/client-details/client-details.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { useProductStore } from '../../services/store/product-store';
import { useClientStore } from '../../services/store/client-store';
import { useAuthStore } from '../../services/store/auth-store';
import { OrdersService } from '../../services/query-services/orders.service';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { provideNativeDateAdapter } from '@angular/material/core';
import { Router } from '@angular/router';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Category, ClientType, Unit_id } from '../../models/enums';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import { Price2 } from '../../models/models';

@Component({
  selector: 'app-offer-overview',
  standalone: true,
  providers: [provideNativeDateAdapter()],
  imports: [
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
})
export class OfferOverviewPageComponent {
  @ViewChild('confirmOfferDialog') confirmOfferDialog!: TemplateRef<any>;

  readonly currentDate = new Date();
  readonly productStore = inject(useProductStore);
  readonly clientStore = inject(useClientStore);
  readonly authStore = inject(useAuthStore);
  private router = inject(Router);
  private ordersService = inject(OrdersService);
  private _dialog = inject(MatDialog);
  private destroyRef = inject(DestroyRef);
  private translateService = inject(TranslateService);

  isLoaded: boolean = false;

  comment: string = '';
  voucher: string = '';
  justOffer: boolean = false;
  expectedDeliveryDate: Date = new Date(
    this.currentDate.getTime() + 3 * 24 * 60 * 60 * 1000
  );
  untilDeliveryDate: boolean = false;
  forFirstHour: boolean = false;

  usedPriceCategories: {
    unit: Unit_id;
    category: Category;
    price: number[];
    discount: number;
  }[] = [];

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
    return this.productStore
      .productItems()
      .reduce((sum, product) => sum + product.price, 0);
  }

  updateDiscount(category: Category, unit: Unit_id, discount: number) {
    this.usedPriceCategories = this.usedPriceCategories.map((p) =>
      p.category === category && p.unit === unit
        ? { ...p, discount: p.discount + discount }
        : p
    );
  }

  getPriceList(prices: Price2[]): void {
    const isClientPJ: boolean =
      this.clientStore.client()?.type === ClientType.PJ;

    let copyForDiscount = this.usedPriceCategories;
    this.usedPriceCategories = [];

    prices.sort((a, b) => a.unit_id - b.unit_id);

    prices.forEach((price) => {
      if (
        !this.usedPriceCategories.find(
          (p) => p.category === price.category_id && p.unit === price.unit_id
        )
      ) {
        let actualPrice: number[] = [];
        let exactCategory = prices.filter(
          (p) =>
            p.category_id === price.category_id && p.unit_id === price.unit_id
        );

        exactCategory = exactCategory.filter(
          (obj, index, self) =>
            index === self.findIndex((t) => t.price === obj.price)
        );

        exactCategory.forEach((catPrice) => {
          if (catPrice.product_id) {
            if (catPrice.unit_id === Unit_id.BOUNDLE) {
              actualPrice.push(
                isClientPJ ? catPrice.price - 5 : catPrice.price
              );
            } else if (catPrice.unit_id === Unit_id.M3) {
              actualPrice.push(
                isClientPJ ? catPrice.price - 100 : catPrice.price
              );
            } else {
              actualPrice.push(catPrice.price);
            }
          } else {
            if (catPrice.unit_id === Unit_id.M3) {
              actualPrice.push(
                isClientPJ ? catPrice.price - 100 : catPrice.price
              );
            }
          }
        });

        this.usedPriceCategories.push({
          category: price.category_id,
          unit: price.unit_id,
          price: actualPrice,
          discount: copyForDiscount.find(
            (p) => p.category === price.category_id && p.unit === price.unit_id
          )
            ? copyForDiscount.find(
                (p) =>
                  p.category === price.category_id && p.unit === price.unit_id
              )!.discount
            : 0,
        });
      }
    });
  }

  loaded(): void {
    this.isLoaded = true;
  }

  confirmOffer() {
    const dialogRef = this._dialog.open(this.confirmOfferDialog, {
      width: '300px',
    });
    let totalOrderQuantity = 0;

    this.productStore.productItems().forEach((item) => {
      const { unit_id, width, thickness, length } = item.product;

      if (unit_id !== Unit_id.M2 && unit_id !== Unit_id.BUC) {
        const volumeM3 = (width * thickness * length) / 1_000_000;
        const multiplier = unit_id === Unit_id.BOUNDLE ? 10 : 1;

        totalOrderQuantity += item.quantity * volumeM3 * multiplier;
      }
    });

    if (this.clientStore.client()?.type === ClientType.PJ) {
      this.comment = 'PJ discount \n';
    }

    this.usedPriceCategories.forEach((p) => {
      if (p.discount) {
        let category = this.translateService.instant(
          'OFFER_PAGE.CREATE_OFFER.PRICE_CATEGORY.' + p.category
        );
        let unit = this.translateService.instant(
          'OFFER_PAGE.CREATE_OFFER.UNIT_FILTER.FILTER_OPTIONS.' + p.unit
        );

        this.comment +=
          category + ' - ' + unit + ' (' + p.discount + ' RON/' + unit + ')\n';
      }
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
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
              this.justOffer
            )
            .then(() => {
              this.productStore.deleteProductItems();
              this.clientStore.deleteClient();
              this.voucher = '';
              this.comment = '';

              if (!this.justOffer) {
                this.router.navigate(['/orders']);
              } else {
                this.router.navigate(['offers']);
              }
            });
        } else {
          this.comment = '';
        }
      });
  }
}
