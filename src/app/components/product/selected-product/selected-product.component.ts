import {
  Component,
  DestroyRef,
  EventEmitter,
  inject,
  Input,
  OnChanges,
  Output,
} from '@angular/core';
import { Price, Product, ProductItem } from '../../../models/models';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule } from '@angular/forms';
import { Category, Unit_id } from '../../../models/enums';
import { TranslateModule } from '@ngx-translate/core';
import { ProductsService } from '../../../services/query-services/products.service';
import { take } from 'rxjs';
import { ENTER_ANIMATION } from '../../../models/animations';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-selected-product',
  imports: [
    MatChipsModule,
    MatDividerModule,
    MatIconModule,
    MatButtonModule,
    FormsModule,
    TranslateModule,
    CommonModule,
  ],
  templateUrl: './selected-product.component.html',
  styleUrl: './selected-product.component.scss',
  animations: [ENTER_ANIMATION],
})
export class SelectedProductComponent implements OnChanges {
  @Input({ required: true }) selectedProduct: Product | undefined;
  @Output() addProduct = new EventEmitter<ProductItem>();

  prices: Price[] = [];
  selectedCategory: Category = Category.A;
  selectedPrice: Price | undefined;
  calculatedPrice: number = 0;
  quantity: number = 1;
  m2_isBrut: boolean = false;
  packsNeeded: number = 0;
  extraPiecesNeeded: number = 0;
  totalPiecesNeeded: number = 0;

  readonly #productService = inject(ProductsService);
  readonly #destroyRef = inject(DestroyRef);

  ngOnChanges(): void {
    this.selectedCategory = Category.A;
    if (this.selectedProduct) {
      this.fetchPrices(this.selectedProduct);
      if (this.selectedProduct.unit_id === Unit_id.M2) {
        this.quantity = 0.5;
      } else {
        this.quantity = 1;
      }
    }
  }

  addNewProduct() {
    if (this.selectedProduct) {
      if (this.selectedProduct.unit_id !== Unit_id.M2) {
        this.addProduct.emit({
          product: this.selectedProduct,
          quantity: this.quantity,
          price: this.calculatedPrice,
          category: this.selectedCategory,
        });
      } else {
        this.addProduct.emit({
          product: this.selectedProduct,
          quantity:
            this.totalPiecesNeeded * (this.selectedProduct.m2_brut / 10),
          price: this.calculatedPrice,
          packsNeeded: this.packsNeeded,
          extraPiecesNeeded: this.extraPiecesNeeded,
          category: this.selectedCategory,
        });
      }
    }
  }

  fetchPrices(product: Product): void {
    this.#productService
      .getPrices(product)
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe(
        (prices) => {
          this.prices = prices;
          this.selectedPrice = this.prices.find(
            (price) => price.category_id === this.selectedCategory
          );
          this.calculatePrice();
        },
        () => {
          this.fetchPrices(product);
        }
      );
  }

  increaseQuantity(): void {
    if (this.selectedProduct && this.selectedProduct.unit_id === Unit_id.M2) {
      this.quantity = this.quantity + 0.5;
    } else {
      this.quantity++;
    }
    this.calculatePrice();
  }

  decreaseQuantity(): void {
    if (this.selectedProduct && this.selectedProduct.unit_id === Unit_id.M2) {
      if (this.quantity > 0.5) this.quantity = this.quantity - 0.5;
    } else {
      if (this.quantity > 1) this.quantity--;
    }
    this.calculatePrice();
  }

  validateInput() {
    if (this.selectedProduct && this.selectedProduct.unit_id === Unit_id.M2) {
      if (this.quantity < 0.5 || isNaN(this.quantity)) {
        setTimeout(() => (this.quantity = 0.5));
      }
    } else {
      if (this.quantity < 1 || isNaN(this.quantity)) {
        setTimeout(() => (this.quantity = 1));
      }
    }
    this.calculatePrice();
  }

  onCategoryChange(): void {
    this.selectedPrice = this.prices.find(
      (price) => price.category_id === this.selectedCategory
    );

    this.calculatePrice();
  }

  calculatePrice(): void {
    this.packsNeeded = 0;
    this.extraPiecesNeeded = 0;
    this.totalPiecesNeeded = 0;

    if (!this.selectedProduct || !this.selectedPrice) return;
    if (
      this.selectedProduct.unit_id === Unit_id.BUC ||
      this.selectedProduct.unit_id === Unit_id.BOUNDLE
    ) {
      this.calculatedPrice = this.quantity * this.selectedPrice.price;
    }

    if (this.selectedProduct.unit_id === Unit_id.M3) {
      this.calculatedPrice =
        ((this.selectedProduct.width *
          this.selectedProduct.length *
          this.selectedProduct.thickness) /
          1000000) *
        this.selectedPrice.price *
        this.quantity;
    }

    if (this.selectedProduct.unit_id === Unit_id.M2) {
      let m2_unit = this.m2_isBrut
        ? this.selectedProduct.m2_brut
        : this.selectedProduct.m2_util;

      this.totalPiecesNeeded = Math.ceil(this.quantity / (m2_unit / 10));
      this.packsNeeded = Math.floor(
        this.totalPiecesNeeded / this.selectedProduct.piece_per_pack
      );

      this.extraPiecesNeeded =
        this.totalPiecesNeeded % this.selectedProduct.piece_per_pack;

      this.calculatedPrice =
        this.totalPiecesNeeded *
        (this.selectedProduct.m2_brut / 10) *
        this.selectedPrice.price;
    }
  }

  m2_setUnit() {
    this.m2_isBrut = !this.m2_isBrut;
    this.calculatePrice();
  }
}
