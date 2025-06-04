import {
  Component,
  DestroyRef,
  inject,
  model,
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
import { SelectedProductListComponent } from '../../components/product/selected-product-list/selected-product-list.component';
import { ClientDetailsComponent } from '../../components/client/client-details/client-details.component';
import { TranslateModule } from '@ngx-translate/core';
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
import { Unit_id } from '../../models/enums';

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

  comment: string = '';
  voucher: string = '';
  expectedDeliveryDate: Date = new Date(
    this.currentDate.getTime() + 3 * 24 * 60 * 60 * 1000
  );
  untilDeliveryDate: boolean = false;
  forFirstHour: boolean = false;

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
              totalOrderQuantity
            )
            .then(() => {
              this.productStore.deleteProductItems();
              this.clientStore.deleteClient();
              this.voucher = '';
              this.comment = '';

              this.router.navigate(['/orders']);
            });
        }
      });
  }
}
