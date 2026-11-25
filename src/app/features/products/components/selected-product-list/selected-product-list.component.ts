import {
  Component,
  computed,
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
  ChangeDetectionStrategy
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
import { CartStore } from '@features/orders/store/cart/cart.store';
import { Price2, ProductItem, UsedPricesInOrder } from '@core/models/models';
import { Category, Unit_id } from '@core/models/enums';
import {
  effectiveUnitPrice,
  findBasePrice,
  firstPricedCategory,
  lineVolumeM3,
  m2BrutQuantity,
  m2FromM3,
  m2NetArea,
  rowAdjustment,
  nextCategory,
  ProductUtil,
} from '@shared/utils/product.util';
import { FormsModule } from '@angular/forms';
import { ENTER_ANIMATION } from '@core/models/animations';
import { ClientStore } from '@features/clients/store/client.store';
import { ProductStore } from '@features/products/store/product.store';
import { DecimalInputDirective } from '@shared/directives/decimal-input.directive';
import { MoneyPipe } from '@shared/pipes/money.pipe';
import { NotificationService } from '@shared/utils/notification.service';

@Component({
  selector: 'app-selected-product-list',
  imports: [
    MoneyPipe,
    DecimalInputDirective,
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
  changeDetection: ChangeDetectionStrategy.Eager,
  animations: [ENTER_ANIMATION],
})
export class SelectedProductListComponent implements OnChanges {
  @ViewChild('confirmDeleteDialog') confirmDeleteDialog!: TemplateRef<any>;
  @Output() isLoaded = new EventEmitter<void>();
  @Output() pricesOutput = new EventEmitter<Price2[]>();
  @Input() isInOverview: boolean = false;
  @Input() discounts: UsedPricesInOrder = [];

  readonly totalPriceInB = computed(() => {
    const prices = this.productStore.pricesEntities();
    if (!prices.length) return 0;
    return this.cartStore.productItems().reduce((sum, item) => {
      const priceInB = this.getCalculatedPrice(Category.B, item);
      return sum + (priceInB ? priceInB : item.price);
    }, 0);
  });

  readonly totalPriceInA = computed(() => {
    const prices = this.productStore.pricesEntities();
    if (!prices.length) return 0;
    return this.cartStore.productItems().reduce((sum, item) => {
      const priceInA = this.getCalculatedPrice(Category.A, item);
      return sum + (priceInA ? priceInA : item.price);
    }, 0);
  });

  /** Cart lines with no B (A) price: "Total B" ("Total A") counts them at their own price. */
  readonly linesWithoutB = computed(() =>
    this.productStore.pricesEntities().length
      ? this.cartStore.productItems().filter((item) => !this.getCalculatedPrice(Category.B, item)).length
      : 0,
  );
  readonly linesWithoutA = computed(() =>
    this.productStore.pricesEntities().length
      ? this.cartStore.productItems().filter((item) => !this.getCalculatedPrice(Category.A, item)).length
      : 0,
  );

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
  readonly lineVolumeM3 = lineVolumeM3;
  readonly m2FromM3 = m2FromM3;
  readonly m2NetArea = m2NetArea;
  private notify = inject(NotificationService);

  private initialized = false;

  constructor() {
    effect(() => {
      const prices = this.productStore.pricesEntities();
      this.clientStore.client(); // track full client object — re-fires when switching between clients

      if (!prices.length) return;

      untracked(() => {
        this.compareSavedPrice();
        this.getUsedPrices();
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

  changeCategory(event: any, item: ProductItem): void {
    event.stopPropagation();

    this.updateCategory(nextCategory(item.category), item);
  }

  enableEdit(event: any, item: ProductItem): void {
    event.stopPropagation();

    this.editingItem = item;
    this.editableQuantity = item.quantity;
  }

  saveQuantity(item: ProductItem): void {
    if (this.editableQuantity != null) {
      // 0 or less is not a line (and would leave a 0/0 unit price behind)
      if (!(+this.editableQuantity > 0)) {
        this.notify.error('SNACKBAR.PRODUCT.QUANTITY_REQUIRED');
        return;
      }

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
          quantity: m2BrutQuantity(item.product, totalPiecesNeeded),
        };

        this.cartStore.updateProductItem(
          item.product.id,
          item.category,
          updates,
        );

        this.editingItem = null;
        this.editableQuantity = null;
      } else {
        // Same unit price at the new quantity; the store builds a new line
        // (never write into a line from productItems())
        const unitPrice = item.quantity ? item.price / item.quantity : 0;

        this.cartStore.updateQuantity(
          item.product.id,
          item.category,
          this.editableQuantity,
          unitPrice * this.editableQuantity,
        );

        this.editingItem = null;
        this.editableQuantity = null;
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
      width: '90%',
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
        }
      });
  }

  private getUsedPrices(): void {
    const prices = this.productStore.pricesEntities();
    this.usedPrices = [];

    this.cartStore.productItems().forEach((item) => {
      const exactPrice = findBasePrice(item.product, item.category, prices);

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
      if (item.manualPrice) return;

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
    ).price;

    return calculatedNewPrice;
  }

  /** Moves the line to the first grade from `start` on that has a price; none → unchanged. */
  private updateCategory(start: Category, item: ProductItem): void {
    const newCategory = firstPricedCategory(
      start,
      (category) => !!this.getExactPrice(category, item),
    );

    // Back at its own grade (the only priced one): leave the line, and a
    // hand-set price on it, as it is
    if (newCategory !== null && newCategory !== item.category) {
      const newPrice = this.getExactPrice(newCategory, item);
      const actualNewPrice = this.productUtil.calculatePrice(
        item.product,
        newPrice,
        item.quantity,
        'BRUT',
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
    const isTva: boolean = this.clientStore.client()?.tva ?? false;

    const listPrice = findBasePrice(item.product, newCategory, prices)?.price;
    // No list price → no price (0), whatever adjustment the overview holds
    if (!listPrice) return 0;

    return (
      effectiveUnitPrice(listPrice, item.product, newCategory, isTva) +
      rowAdjustment(this.discounts, item.product, newCategory)
    );
  }

}
