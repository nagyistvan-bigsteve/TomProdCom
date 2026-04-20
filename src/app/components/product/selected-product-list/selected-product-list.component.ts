import {
  Component,
  DestroyRef,
  effect,
  EventEmitter,
  inject,
  Input,
  OnChanges,
  Output,
  TemplateRef,
  untracked,
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
import { CartStore } from '../../../services/store/cart/cart.store';
import { Price2, ProductItem, UsedPricesInOrder } from '../../../models/models';
import { Category, Unit_id } from '../../../models/enums';
import { ProductUtil } from '../../../services/utils/product.util';
import { FormsModule } from '@angular/forms';
import { ENTER_ANIMATION } from '../../../models/animations';
import { ClientStore } from '../../../services/store/client/client.store';
import { ProductStore } from '../../../services/store/product/product.store';

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
  animations: [ENTER_ANIMATION],
})
export class SelectedProductListComponent implements OnChanges {
  @ViewChild('confirmDeleteDialog') confirmDeleteDialog!: TemplateRef<any>;
  @Output() isLoaded = new EventEmitter<void>();
  @Output() pricesOutput = new EventEmitter<Price2[]>();
  @Input() isInOverview: boolean = false;
  @Input() discounts: UsedPricesInOrder = [];

  totalPriceInA: number = 0;
  totalPriceInB: number = 0;

  editingItem: ProductItem | null = null;
  editableQuantity: number | null = null;
  usedPrices: Price2[] = [];

  private router = inject(Router);
  private _dialog = inject(MatDialog);
  private location = inject(Location);
  private destroyRef = inject(DestroyRef);
  readonly productUtil = inject(ProductUtil);
  readonly cartStore = inject(CartStore);
  readonly clientStore = inject(ClientStore);
  readonly productStore = inject(ProductStore);

  private initialized = false;

  constructor() {
    effect(() => {
      const prices = this.productStore.pricesEntities();
      this.clientStore.isClientSelected(); // track for reactivity on client change

      if (!prices.length) return;

      untracked(() => {
        this.compareSavedPrice();
        this.getUsedPrices();
        this.getTotalPriceInB();
        this.getTotalPriceInA();
        if (!this.initialized) {
          this.initialized = true;
          this.isLoaded.emit();
        }
      });
    });
  }

  ngOnChanges(): void {
    this.compareSavedPrice();
  }

  getTotalPriceInB(): void {
    if (this.cartStore.productItems()) {
      this.totalPriceInB = 0;
      this.cartStore.productItems()?.forEach((item) => {
        let priceInB = this.getCalculatedPrice(Category.B, item);
        this.totalPriceInB =
          this.totalPriceInB + (priceInB ? priceInB : item.price);
      });
    }
  }

  getTotalPriceInA(): void {
    if (this.cartStore.productItems()) {
      this.totalPriceInA = 0;
      this.cartStore.productItems()?.forEach((item) => {
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
            newPrice,
            this.editableQuantity!,
            'BRUT',
          );

        const updates: Partial<ProductItem> = {
          price,
          packsNeeded,
          extraPiecesNeeded,
          quantity: totalPiecesNeeded * (item.product.m2_brut / 10),
        };

        this.cartStore.updateProductItem(
          item.product.id,
          item.category,
          updates,
        );

        this.editingItem = null;
        this.editableQuantity = null;

        this.getTotalPriceInB();
        this.getTotalPriceInA();
      } else {
        const price = (item.price / item.quantity) * this.editableQuantity;

        item.quantity = this.editableQuantity;

        this.cartStore.updateQuantity(
          item.product.id,
          item.category,
          item.quantity,
          price,
        );

        this.editingItem = null;
        this.editableQuantity = null;

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
    this.router.navigate(['/offer/client']);
  }

  goToClientPageWithB(): void {
    this.cartStore.productItems().forEach((item) => {
      let priceInB = this.getCalculatedPrice(Category.B, item);

      if (priceInB) {
        this.cartStore.updateProductItem(item.product.id, item.category, {
          category: Category.B,
          price: this.getCalculatedPrice(Category.B, item),
        });
      }
    });

    this.router.navigate(['/offer/client']);
  }

  goToClientPageWithA(): void {
    this.cartStore.productItems().forEach((item) => {
      let priceInA = this.getCalculatedPrice(Category.A, item);

      if (priceInA) {
        this.cartStore.updateProductItem(item.product.id, item.category, {
          category: Category.A,
          price: this.getCalculatedPrice(Category.A, item),
        });
      }
    });

    this.router.navigate(['/offer/client']);
  }

  confirmDelete(item: ProductItem | 'all'): void {
    const dialogRef = this._dialog.open(this.confirmDeleteDialog, {
      width: '300px',
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (result === true) {
          if (item !== 'all') {
            this.cartStore.deleteProductById(item.product.id, item.category);
          } else {
            this.cartStore.deleteProductItems();
          }
          this.compareSavedPrice();
          this.getUsedPrices();
          this.getTotalPriceInB();
          this.getTotalPriceInA();
        }
      });
  }

  private getUsedPrices(): void {
    const prices = this.productStore.pricesEntities();
    this.usedPrices = [];

    this.cartStore.productItems().forEach((item) => {
      const unicPrice = prices.find(
        (price) => price.product_id === item.product.id,
      );

      let exactPrice = unicPrice
        ? prices.find(
            (price) =>
              price.category_id === item.category &&
              price.unit_id === item.product.unit_id &&
              price.product_id === item.product.id,
          )
        : prices.find(
            (price) =>
              price.category_id === item.category &&
              price.size_id === item.product.size_id &&
              price.unit_id === item.product.unit_id,
          );

      if (!exactPrice) {
        return;
      }

      if (!this.usedPrices.find((p) => p.id === exactPrice.id)) {
        this.usedPrices.push(exactPrice);
      }
    });

    this.pricesOutput.emit(this.usedPrices);
  }

  private compareSavedPrice(): void {
    this.cartStore.productItems().forEach((item) => {
      let calculatedPrice = this.getCalculatedPrice(item.category, item);

      if (calculatedPrice != item.price) {
        this.cartStore.updateProductItem(item.product.id, item.category, {
          price: calculatedPrice,
        });
      }
    });
  }

  private getCalculatedPrice(category: Category, item: ProductItem): number {
    const newPrice = this.getExactPrice(category, item);

    if (!newPrice) {
      return 0;
    }

    const calculatedNewPrice = this.productUtil.calculatePrice(
      item.product,
      newPrice,
      item.quantity,
      'BRUT',
      category,
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
        newPrice,
        item.quantity,
        'BRUT',
        newCategory,
      ).price;

      this.cartStore.updateProductItem(item.product.id, item.category, {
        category: newCategory,
        price: actualNewPrice,
      });

      this.getUsedPrices();
    }
  }

  private getExactPrice(newCategory: Category, item: ProductItem): number {
    const prices = this.productStore.pricesEntities();
    const isTva: boolean = this.clientStore.client()
      ? this.clientStore.client().tva
      : false;

    const unicPrice = prices.find(
      (price) => price.product_id === item.product.id,
    );

    let exactPrice = unicPrice
      ? prices.find(
          (price) =>
            price.category_id === newCategory &&
            price.unit_id === item.product.unit_id &&
            price.product_id === item.product.id,
        )?.price
      : prices.find(
          (price) =>
            price.category_id === newCategory &&
            price.size_id === item.product.size_id &&
            price.unit_id === item.product.unit_id,
        )?.price;

    if (isTva && exactPrice) {
      if (item.product.unit_id === Unit_id.M3) {
        exactPrice = exactPrice - 100;
      }
      if (item.product.unit_id === Unit_id.BOUNDLE) {
        exactPrice = exactPrice - 5;
      }
    }

    if (this.discounts.length) {
      let discount = this.discounts.find(
        (d) =>
          (d.category === newCategory &&
            d.unit === item.product.unit_id &&
            d.size === item.product.size_id &&
            !d.productId) ||
          (d.category === newCategory &&
            d.unit === item.product.unit_id &&
            d.size === item.product.size_id &&
            d.productId === item.product.id),
      )?.discount;
      if (discount) {
        exactPrice! += discount;
      }
    }

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
