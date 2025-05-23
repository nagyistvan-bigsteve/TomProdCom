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
              this.expectedDeliveryDate!
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
