import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { ProductSelectComponent } from '../../components/product-list/product-list.component';
import { Product, ProductItem } from '../../models/models';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { SelectedProductComponent } from '../../components/selected-product/selected-product.component';
import { MatButtonModule } from '@angular/material/button';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { ENTER_ANIMATION, LEAVE_ANIMATION } from '../../models/animations';
import { SelectedProductListComponent } from '../../components/selected-product-list/selected-product-list.component';
import { OverwriteDialogComponent } from '../../components/overwrite-dialog/overwrite-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { OverlayModule } from '@angular/cdk/overlay';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

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
export class CreateOfferPageComponent implements OnInit {
  selectedProduct: Product | undefined = undefined;
  productList: ProductItem[] = [];
  selectProductOn: boolean = true;
  readonly #translateService = inject(TranslateService);
  readonly #destroyRef = inject(DestroyRef);
  private _snackBar = inject(MatSnackBar);
  private _dialog = inject(MatDialog);

  ngOnInit(): void {
    if (sessionStorage.getItem('offer-products')) {
      this.productList = JSON.parse(sessionStorage.getItem('offer-products')!);
    }
  }

  getSelectedProduct(product: Product): void {
    this.selectedProduct = product;
  }

  addProductToList(item: ProductItem): void {
    const existingProduct = this.productList.find(
      (product) =>
        product.category === item.category &&
        product.product.name === item.product.name
    );

    if (existingProduct) {
      const dialogRef = this._dialog.open(OverwriteDialogComponent, {
        data: { productName: item.product.name },
      });

      dialogRef
        .afterClosed()
        .pipe(takeUntilDestroyed(this.#destroyRef))
        .subscribe((result: any) => {
          if (result === 'overwrite') {
            const index = this.productList.indexOf(existingProduct);
            this.productList[index] = item;

            sessionStorage.setItem(
              'offer-products',
              JSON.stringify(this.productList)
            );
            this.openSnackBar(
              this.#translateService.instant(
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

            sessionStorage.setItem(
              'offer-products',
              JSON.stringify(this.productList)
            );
            this.openSnackBar(
              this.#translateService.instant(
                'OFFER_PAGE.CREATE_OFFER.SUCCESS_BAR.ADD'
              ) + item.product.name
            );
          }
        });
    } else {
      this.productList.push(item);

      sessionStorage.setItem(
        'offer-products',
        JSON.stringify(this.productList)
      );
      this.openSnackBar(
        this.#translateService.instant(
          'OFFER_PAGE.CREATE_OFFER.SUCCESS_BAR.ADD'
        ) + item.product.name
      );
    }
  }

  openSnackBar(message: string) {
    this._snackBar.open(message);
  }
}
