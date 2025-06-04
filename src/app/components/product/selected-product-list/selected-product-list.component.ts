import {
  Component,
  DestroyRef,
  inject,
  Input,
  OnInit,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { MatDividerModule } from '@angular/material/divider';
import { MatAccordion, MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { useProductStore } from '../../../services/store/product-store';
import { Price, Product, ProductItem } from '../../../models/models';
import { Category, Unit_id } from '../../../models/enums';
import { ProductsService } from '../../../services/query-services/products.service';
import { ProductUtil } from '../../../services/utils/product.util';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-selected-product-list',
  imports: [
    CommonModule,
    TranslateModule,
    MatDividerModule,
    MatAccordion,
    MatExpansionModule,
    MatIconModule,
    MatDialogModule,
    MatButtonModule,
    FormsModule,
  ],
  templateUrl: './selected-product-list.component.html',
  styleUrl: './selected-product-list.component.scss',
})
export class SelectedProductListComponent implements OnInit {
  @ViewChild('confirmDeleteDialog') confirmDeleteDialog!: TemplateRef<any>;
  @Input() isInOverview: boolean = false;

  totalPrice: number = 0;

  editingItem: ProductItem | null = null;
  editableQuantity: number | null = null;

  private router = inject(Router);
  private _dialog = inject(MatDialog);
  private location = inject(Location);
  private destroyRef = inject(DestroyRef);
  private productService = inject(ProductsService);
  private productUtil = inject(ProductUtil);
  readonly productStore = inject(useProductStore);

  ngOnInit(): void {
    this.getTotalPrice();
  }

  getTotalPrice(): void {
    if (this.productStore.productItems()) {
      this.totalPrice = 0;
      this.productStore.productItems()?.forEach((item) => {
        this.totalPrice = this.totalPrice + item.price;
      });
    }
  }

  changeCategory(event: any, item: ProductItem): void {
    event.stopPropagation();

    this.getPrice(this.updateCategory(item.category), item);
  }

  enableEdit(event: any, item: ProductItem): void {
    event.stopPropagation();

    this.editingItem = item;
    this.editableQuantity = item.quantity;
  }

  saveQuantity(item: ProductItem): void {
    if (this.editableQuantity != null) {
      if (item.product.unit_id === Unit_id.M2) {
        this.productService
          .getPrice(item.product.unit_id, item.category, item.product.size_id)
          .then((newPrice) => {
            const { price, packsNeeded, extraPiecesNeeded, totalPiecesNeeded } =
              this.productUtil.calculatePrice(
                item.product,
                newPrice?.price!,
                this.editableQuantity!,
                false
              );

            const updates: Partial<ProductItem> = {
              price,
              packsNeeded,
              extraPiecesNeeded,
              quantity: totalPiecesNeeded * (item.product.m2_brut / 10),
            };

            this.productStore.updateProductItem(
              item.product.id,
              item.category,
              updates
            );

            this.editingItem = null;
            this.editableQuantity = null;

            this.getTotalPrice();
          });
      } else {
        const price = (item.price / item.quantity) * this.editableQuantity;

        item.quantity = this.editableQuantity;

        this.productStore.updateQuantity(
          item.product.id,
          item.category,
          item.quantity,
          price
        );

        this.editingItem = null;
        this.editableQuantity = null;

        this.getTotalPrice();
      }
    }
  }

  goBack(): void {
    this.location.back();
  }

  goToCreateOfferPage(): void {
    this.router.navigate(['/offer/create']);
  }

  goToClientPage(): void {
    if (!localStorage.getItem('client_data')) {
      this.router.navigate(['/offer/client']);
    } else {
      this.router.navigate(['/offer/overview']);
    }
  }

  confirmDelete(item: ProductItem): void {
    const dialogRef = this._dialog.open(this.confirmDeleteDialog, {
      width: '300px',
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (result === true) {
          this.productStore.deleteProductById(item.product.id, item.category);
          this.getTotalPrice();
        }
      });
  }

  private getPrice(newCategory: Category, item: ProductItem): void {
    this.productService
      .getPrice(item.product.unit_id, newCategory, item.product.size_id)
      .then((newPrice) => {
        if (!newPrice) {
          this.getPrice(this.updateCategory(newCategory), item);
        } else {
          const actualNewPrice = this.productUtil.calculatePrice(
            item.product,
            newPrice.price,
            item.quantity,
            false
          ).price;

          this.productStore.updateProductItem(item.product.id, item.category, {
            category: newCategory,
            price: actualNewPrice,
          });
        }

        this.getTotalPrice();
      });
  }

  private updateCategory(category: Category): Category {
    let newCategory = category + 1;
    if (newCategory > Category.T) {
      newCategory = Category.A;
    }

    return newCategory;
  }
}
