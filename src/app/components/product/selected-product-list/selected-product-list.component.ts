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
import { Price, ProductItem } from '../../../models/models';
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
  totalPriceInA: number = 0;
  totalPriceInB: number = 0;

  editingItem: ProductItem | null = null;
  editableQuantity: number | null = null;

  prices: Price[] = [];

  private router = inject(Router);
  private _dialog = inject(MatDialog);
  private location = inject(Location);
  private destroyRef = inject(DestroyRef);
  private productService = inject(ProductsService);
  private productUtil = inject(ProductUtil);
  readonly productStore = inject(useProductStore);

  ngOnInit(): void {
    this.fetchPrices();
    this.getTotalPrice();

    setTimeout(() => {
      this.getTotalPriceInB();
      this.getTotalPriceInA();
    }, 500);
  }

  getTotalPrice(): void {
    if (this.productStore.productItems()) {
      this.totalPrice = 0;
      this.productStore.productItems()?.forEach((item) => {
        this.totalPrice = this.totalPrice + item.price;
      });
    }
  }

  getTotalPriceInB(): void {
    if (this.productStore.productItems()) {
      this.totalPriceInB = 0;
      this.productStore.productItems()?.forEach((item) => {
        let priceInB = this.getCalculatedPrice(Category.B, item);
        this.totalPriceInB =
          this.totalPriceInB + (priceInB ? priceInB : item.price);
      });
    }
  }

  getTotalPriceInA(): void {
    if (this.productStore.productItems()) {
      this.totalPriceInA = 0;
      this.productStore.productItems()?.forEach((item) => {
        let priceInA = this.getCalculatedPrice(Category.A, item);
        this.totalPriceInA =
          this.totalPriceInA + (priceInA ? priceInA : item.price);
      });
    }
  }

  changeCategory(event: any, item: ProductItem): void {
    event.stopPropagation();

    this.updateCategory(this.switchCategory(item.category), item);
  }

  enableEdit(event: any, item: ProductItem): void {
    event.stopPropagation();

    this.editingItem = item;
    this.editableQuantity = item.quantity;
  }

  saveQuantity(item: ProductItem): void {
    if (this.editableQuantity != null) {
      if (item.product.unit_id === Unit_id.M2) {
        const newPrice = this.getExactPrice(item.category, item);

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
        this.getTotalPriceInB();
        this.getTotalPriceInA();
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
        this.getTotalPriceInB();
        this.getTotalPriceInA();
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

  goToClientPageWithB(): void {
    this.productStore.productItems().forEach((item) => {
      let priceInB = this.getCalculatedPrice(Category.B, item);

      if (priceInB) {
        this.productStore.updateProductItem(item.product.id, item.category, {
          category: Category.B,
          price: this.getCalculatedPrice(Category.B, item),
        });
      }
    });

    if (!localStorage.getItem('client_data')) {
      this.router.navigate(['/offer/client']);
    } else {
      this.router.navigate(['/offer/overview']);
    }
  }

  goToClientPageWithA(): void {
    this.productStore.productItems().forEach((item) => {
      let priceInA = this.getCalculatedPrice(Category.A, item);

      if (priceInA) {
        this.productStore.updateProductItem(item.product.id, item.category, {
          category: Category.A,
          price: this.getCalculatedPrice(Category.A, item),
        });
      }
    });

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
          this.getTotalPriceInB();
          this.getTotalPriceInA();
        }
      });
  }

  private fetchPrices(): void {
    this.productService.getAllPrices().then((prices) => {
      if (!prices) {
        return;
      }

      this.prices = prices;
    });
  }

  private getCalculatedPrice(category: Category, item: ProductItem): number {
    const newPrice = this.getExactPrice(category, item);

    if (!newPrice) {
      return 0;
    }

    const calculatedNewPrice = this.productUtil.calculatePrice(
      item.product,
      newPrice.price,
      item.quantity,
      false
    ).price;

    return calculatedNewPrice;
  }

  private updateCategory(newCategory: Category, item: ProductItem): void {
    const newPrice = this.getExactPrice(newCategory, item);

    if (!newPrice) {
      this.updateCategory(this.switchCategory(newCategory), item);
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
  }

  private getExactPrice(newCategory: Category, item: ProductItem): Price {
    const unicPrice = this.prices.find(
      (price) => price.product_id === item.product.id
    );

    let exactPrice = unicPrice
      ? this.prices.find(
          (price) =>
            price.category_id === newCategory &&
            price.unit_id === item.product.unit_id &&
            price.product_id === item.product.id
        )
      : this.prices.find(
          (price) =>
            price.category_id === newCategory &&
            price.size_id === item.product.size_id &&
            price.unit_id === item.product.unit_id
        );

    return exactPrice!;
  }

  private switchCategory(category: Category): Category {
    let newCategory = category + 1;
    if (newCategory > Category.T) {
      newCategory = Category.A;
    }

    return newCategory;
  }
}
