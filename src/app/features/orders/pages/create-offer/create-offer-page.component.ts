import { Component, DestroyRef, inject, ChangeDetectionStrategy } from '@angular/core';
import { ProductSelectComponent } from '@features/products/components/product-list/product-list.component';
import { Product, ProductItem } from '@core/models/models';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { SelectedProductComponent } from '@features/products/components/selected-product/selected-product.component';
import { MatButtonModule } from '@angular/material/button';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { ENTER_ANIMATION, LEAVE_ANIMATION } from '@core/models/animations';
import { SelectedProductListComponent } from '@features/products/components/selected-product-list/selected-product-list.component';
import { OverwriteDialogComponent } from '@features/products/components/overwrite-dialog/overwrite-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { OverlayModule } from '@angular/cdk/overlay';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { CartStore } from '@features/orders/store/cart/cart.store';
import { mergeCartItems } from '@features/orders/store/cart/cart.items';
import { ProductStore } from '@features/products/store/product.store';
import { MatDividerModule } from '@angular/material/divider';
import { MatBadgeModule } from '@angular/material/badge';
import { BreakpointObserver } from '@angular/cdk/layout';
import { map } from 'rxjs';
import { MoneyPipe } from '@shared/pipes/money.pipe';

@Component({
  selector: 'app-create-offer-page',
  imports: [
    MoneyPipe,
    ProductSelectComponent,
    TranslateModule,
    SelectedProductComponent,
    CommonModule,
    MatButtonModule,
    MatIconModule,
    SelectedProductListComponent,
    MatSnackBarModule,
    OverlayModule,
    MatDividerModule,
    MatBadgeModule,
  ],
  standalone: true,
  templateUrl: './create-offer-page.component.html',
  styleUrl: './create-offer-page.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  animations: [ENTER_ANIMATION, LEAVE_ANIMATION],
})
export class CreateOfferPageComponent {
  selectedProduct: Product | undefined = undefined;
  selectProductOn: boolean = true;
  private translateService = inject(TranslateService);
  private destroyRef = inject(DestroyRef);
  private _snackBar = inject(MatSnackBar);
  private _dialog = inject(MatDialog);
  readonly cartStore = inject(CartStore);
  private readonly productStore = inject(ProductStore);

  readonly isDesktop = toSignal(
    inject(BreakpointObserver)
      .observe('(min-width: 960px)')
      .pipe(map((r) => r.matches)),
    { initialValue: false },
  );

  constructor() {
    // no realtime: show current stock while building the offer (skipped when
    // stock was loaded seconds ago, e.g. right after sign-in)
    this.productStore.refreshStocksIfStale();
  }

  getSelectedProduct(product: Product): void {
    this.selectedProduct = product;
  }

  addProductToList(item: ProductItem): void {
    const existingProduct = this.cartStore
      .productItems()
      .find(
        (product) =>
          product.category === item.category &&
          product.product.id === item.product.id,
      );

    if (existingProduct) {
      const dialogRef = this._dialog.open(OverwriteDialogComponent, {
        data: { productName: item.product.name },
      });

      dialogRef
        .afterClosed()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((result: any) => {
          // The cart may have changed while the dialog was open (e.g. a price
          // reload builds new line objects): act on the line as it is now
          const current = this.cartStore
            .productItems()
            .find(
              (line) =>
                line.category === item.category &&
                line.product.id === item.product.id,
            );

          if (result === 'overwrite') {
            if (current) {
              this.cartStore.replaceProductItem(current, item);
            } else {
              this.cartStore.addProductItem(item);
            }
            this.openSnackBar(
              this.translateService.instant(
                'OFFER_PAGE.CREATE_OFFER.SUCCESS_BAR.OVERWRITE',
              ) + item.product.name,
            );
          } else if (result === 'add') {
            if (current) {
              this.cartStore.replaceProductItem(current, mergeCartItems(current, item));
            } else {
              this.cartStore.addProductItem(item);
            }

            this.openSnackBar(
              this.translateService.instant(
                'OFFER_PAGE.CREATE_OFFER.SUCCESS_BAR.ADD',
              ) + item.product.name,
            );
          }
        });
    } else {
      this.cartStore.addProductItem(item);

      this.openSnackBar(
        this.translateService.instant(
          'OFFER_PAGE.CREATE_OFFER.SUCCESS_BAR.ADD',
        ) + item.product.name,
      );
    }
  }

  openSnackBar(message: string) {
    this._snackBar.open(message);
  }
}
