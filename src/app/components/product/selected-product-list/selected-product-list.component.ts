import {
  Component,
  DestroyRef,
  effect,
  EventEmitter,
  inject,
  Input,
  OnChanges,
  OnInit,
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
import { useProductStore } from '../../../services/store/product-store';
import { Price2, ProductItem } from '../../../models/models';
import { Category, ClientType, Unit_id } from '../../../models/enums';
import { ProductUtil } from '../../../services/utils/product.util';
import { FormsModule } from '@angular/forms';
import { ENTER_ANIMATION } from '../../../models/animations';
import { PricesService } from '../../../services/query-services/prices.service';
import { ClientStore } from '../../../services/store/client/client.store';

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
export class SelectedProductListComponent implements OnInit, OnChanges {
  @ViewChild('confirmDeleteDialog') confirmDeleteDialog!: TemplateRef<any>;
  @Output() isLoaded = new EventEmitter<void>();
  @Output() pricesOutput = new EventEmitter<Price2[]>();
  @Input() isInOverview: boolean = false;
  @Input() discount: {
    unit: Unit_id;
    category: Category;
    price: number[];
    discount: number;
  }[] = [];

  totalPrice: number = 0;

  totalPriceInA: number = 0;
  totalPriceInB: number = 0;

  editingItem: ProductItem | null = null;
  editableQuantity: number | null = null;

  prices: Price2[] = [];
  usedPrices: Price2[] = [];

  private router = inject(Router);
  private _dialog = inject(MatDialog);
  private location = inject(Location);
  private destroyRef = inject(DestroyRef);
  private pricesService = inject(PricesService);
  private productUtil = inject(ProductUtil);
  readonly productStore = inject(useProductStore);
  readonly clientStore = inject(ClientStore);

  ngOnInit(): void {
    this.fetchPrices();
  }

  ngOnChanges(): void {
    this.compareSavedPrice();
  }

  constructor() {
    effect(() => {
      if (this.clientStore.client() && this.prices.length) {
        untracked(() => {
          this.compareSavedPrice();
          this.getUsedPrices();
        });
      }
    });
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
            newPrice,
            this.editableQuantity!,
            true,
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
          updates,
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
          price,
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
    this.router.navigate(['/offer/client']);
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

    this.router.navigate(['/offer/client']);
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

    this.router.navigate(['/offer/client']);
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
          this.compareSavedPrice();
          this.getUsedPrices();
          this.getTotalPrice();
          this.getTotalPriceInB();
          this.getTotalPriceInA();
        }
      });
  }

  private getUsedPrices(): void {
    this.usedPrices = [];

    this.productStore.productItems().forEach((item) => {
      const unicPrice = this.prices.find(
        (price) => price.product_id === item.product.id,
      );

      let exactPrice = unicPrice
        ? this.prices.find(
            (price) =>
              price.category_id === item.category &&
              price.unit_id === item.product.unit_id &&
              price.product_id === item.product.id,
          )
        : this.prices.find(
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
    this.productStore.productItems().forEach((item) => {
      let calculatedPrice = this.getCalculatedPrice(item.category, item);

      if (calculatedPrice != item.price) {
        this.productStore.updateProductItem(item.product.id, item.category, {
          price: calculatedPrice,
        });
      }
    });
  }

  private fetchPrices(): void {
    this.pricesService.getAllPrices().then((prices) => {
      if (!prices) {
        return;
      }

      this.prices = prices;

      this.compareSavedPrice();
      this.getUsedPrices();

      this.getTotalPrice();
      this.getTotalPriceInB();
      this.getTotalPriceInA();

      this.isLoaded.emit();
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
      true,
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
        true,
      ).price;

      this.productStore.updateProductItem(item.product.id, item.category, {
        category: newCategory,
        price: actualNewPrice,
      });

      this.getTotalPrice();
      this.getUsedPrices();
    }
  }

  private getExactPrice(newCategory: Category, item: ProductItem): number {
    const isClientPJ: boolean = this.clientStore.client()
      ? this.clientStore.client().type === ClientType.PJ
      : false;

    const unicPrice = this.prices.find(
      (price) => price.product_id === item.product.id,
    );

    let exactPrice = unicPrice
      ? this.prices.find(
          (price) =>
            price.category_id === newCategory &&
            price.unit_id === item.product.unit_id &&
            price.product_id === item.product.id,
        )?.price
      : this.prices.find(
          (price) =>
            price.category_id === newCategory &&
            price.size_id === item.product.size_id &&
            price.unit_id === item.product.unit_id,
        )?.price;

    if (isClientPJ && exactPrice) {
      if (item.product.unit_id === Unit_id.M3) {
        exactPrice = exactPrice - 100;
      }
      if (item.product.unit_id === Unit_id.BOUNDLE) {
        exactPrice = exactPrice - 5;
      }
    }

    if (this.discount.length) {
      let discount = this.discount.find(
        (d) => d.category === newCategory && d.unit === item.product.unit_id,
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
