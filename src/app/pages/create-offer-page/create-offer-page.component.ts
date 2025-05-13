import { Component, DestroyRef, inject } from '@angular/core';
import { ProductSelectComponent } from '../../components/product/product-list/product-list.component';
import { Product, ProductItem } from '../../models/models';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { SelectedProductComponent } from '../../components/product/selected-product/selected-product.component';
import { MatButtonModule } from '@angular/material/button';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { ENTER_ANIMATION, LEAVE_ANIMATION } from '../../models/animations';
import { SelectedProductListComponent } from '../../components/product/selected-product-list/selected-product-list.component';
import { OverwriteDialogComponent } from '../../components/product/overwrite-dialog/overwrite-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { OverlayModule } from '@angular/cdk/overlay';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { useProductStore } from '../../services/store/product-store';

@Component({
  selector: 'app-create-offer-page',
  imports: [
    ProductSelectComponent,
    TranslateModule,
    SelectedProductComponent,
    CommonModule,
    MatButtonModule,
    MatIconModule,
    SelectedProductListComponent,
    MatSnackBarModule,
    OverlayModule,
  ],
  standalone: true,
  templateUrl: './create-offer-page.component.html',
  styleUrl: './create-offer-page.component.scss',
  animations: [ENTER_ANIMATION, LEAVE_ANIMATION],
})
export class CreateOfferPageComponent {
  selectedProduct: Product | undefined = undefined;
  selectProductOn: boolean = true;
  private translateService = inject(TranslateService);
  private destroyRef = inject(DestroyRef);
  private _snackBar = inject(MatSnackBar);
  private _dialog = inject(MatDialog);
  readonly productStore = inject(useProductStore);

  getSelectedProduct(product: Product): void {
    this.selectedProduct = product;
  }

  addProductToList(item: ProductItem): void {
    const existingProduct = this.productStore
      .productItems()
      .find(
        (product) =>
          product.category === item.category &&
          product.product.name === item.product.name
      );

    if (existingProduct) {
      const productList = this.productStore.productItems();

      const dialogRef = this._dialog.open(OverwriteDialogComponent, {
        data: { productName: item.product.name },
      });

      dialogRef
        .afterClosed()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((result: any) => {
          if (result === 'overwrite') {
            const index = this.productStore
              .productItems()
              .indexOf(existingProduct);
            productList[index] = item;

            this.productStore.setProductItems(productList);
            this.openSnackBar(
              this.translateService.instant(
                'OFFER_PAGE.CREATE_OFFER.SUCCESS_BAR.OVERWRITE'
              ) + item.product.name
            );
          } else if (result === 'add') {
            existingProduct.quantity += item.quantity;
            existingProduct.price += item.price;
            if (item.extraPiecesNeeded) {
              if (existingProduct.extraPiecesNeeded) {
                if (
                  existingProduct.extraPiecesNeeded + item.extraPiecesNeeded >
                  existingProduct.product.piece_per_pack
                ) {
                  existingProduct.extraPiecesNeeded =
                    (existingProduct.extraPiecesNeeded +
                      item.extraPiecesNeeded) %
                    existingProduct.product.piece_per_pack;
                  existingProduct.packsNeeded
                    ? (existingProduct.packsNeeded += 1)
                    : (existingProduct.packsNeeded = 1);
                } else {
                  existingProduct.extraPiecesNeeded += item.extraPiecesNeeded;
                }
              } else {
                existingProduct.extraPiecesNeeded = item.extraPiecesNeeded;
              }
            }
            if (item.packsNeeded) {
              existingProduct.packsNeeded
                ? (existingProduct.packsNeeded += item.packsNeeded)
                : (existingProduct.packsNeeded = item.packsNeeded);
            }

            this.productStore.updateProductItem(
              existingProduct.product.id,
              existingProduct.category,
              existingProduct
            );

            this.openSnackBar(
              this.translateService.instant(
                'OFFER_PAGE.CREATE_OFFER.SUCCESS_BAR.ADD'
              ) + item.product.name
            );
          }
        });
    } else {
      this.productStore.addProductItem(item);

      this.openSnackBar(
        this.translateService.instant(
          'OFFER_PAGE.CREATE_OFFER.SUCCESS_BAR.ADD'
        ) + item.product.name
      );
    }
  }

  openSnackBar(message: string) {
    this._snackBar.open(message);
  }
}
