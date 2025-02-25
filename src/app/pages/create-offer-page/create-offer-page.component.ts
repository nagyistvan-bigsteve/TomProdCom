import { Component } from '@angular/core';
import { ProductSelectComponent } from '../../components/product-list/product-list.component';
import { Product, ProductItem } from '../../models/models';
import { TranslateModule } from '@ngx-translate/core';
import { SelectedProductComponent } from '../../components/selected-product/selected-product.component';
import { MatButtonModule } from '@angular/material/button';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { ENTER_ANIMATION } from '../../models/animations';
import { SelectedProductListComponent } from '../../components/selected-product-list/selected-product-list.component';
import { OverwriteDialogComponent } from '../../components/overwrite-dialog/overwrite-dialog.component';
import { DialogRef } from '@angular/cdk/dialog';
import { MatDialog } from '@angular/material/dialog';

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
  ],
  standalone: true,
  templateUrl: './create-offer-page.component.html',
  styleUrl: './create-offer-page.component.scss',
  animations: ENTER_ANIMATION,
})
export class CreateOfferPageComponent {
  selectedProduct: Product | undefined = undefined;
  productList: ProductItem[] = [];
  selectProductOn: boolean = true;

  constructor(private dialog: MatDialog) {}

  getSelectedProduct(product: Product): void {
    this.selectedProduct = product;
  }

  addProductToList(item: ProductItem): void {
    // if (
    //   this.productList.find((product) => {
    //     product.category === item.category &&
    //       product.product.name === item.product.name;
    //   })
    // ) {

    // } else {
    //   this.productList.push(item);
    // }
    const existingProduct = this.productList.find(
      (product) =>
        product.category === item.category &&
        product.product.name === item.product.name
    );

    if (existingProduct) {
      const dialogRef = this.dialog.open(OverwriteDialogComponent, {
        data: { productName: item.product.name },
      });

      dialogRef.afterClosed().subscribe((result: any) => {
        if (result === 'overwrite') {
          // Overwrite existing product
          const index = this.productList.indexOf(existingProduct);
          this.productList[index] = item;
        } else if (result === 'add') {
          // Add quantity or details to the existing product
          existingProduct.quantity += item.quantity;
          existingProduct.price += item.price;
        }
        // If 'cancel', do nothing
      });
    } else {
      this.productList.push(item);
    }
  }
}
