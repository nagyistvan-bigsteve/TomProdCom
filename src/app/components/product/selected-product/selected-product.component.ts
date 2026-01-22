import {
  Component,
  DestroyRef,
  EventEmitter,
  inject,
  Input,
  OnChanges,
  Output,
} from '@angular/core';
import { Price2, Product, ProductItem, Stock } from '../../../models/models';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule } from '@angular/forms';
import { Category, Unit_id } from '../../../models/enums';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ProductsService } from '../../../services/query-services/products.service';
import { ENTER_ANIMATION } from '../../../models/animations';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ProductUtil } from '../../../services/utils/product.util';
import { StocksService } from '../../../services/query-services/stocks.service';
import { PricesService } from '../../../services/query-services/prices.service';

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
    MatSnackBarModule,
  ],
  templateUrl: './selected-product.component.html',
  styleUrl: './selected-product.component.scss',
  animations: [ENTER_ANIMATION],
})
export class SelectedProductComponent implements OnChanges {
  @Input({ required: true }) selectedProduct: Product | undefined;
  @Output() addProduct = new EventEmitter<ProductItem>();

  prices: Price2[] = [];
  selectedCategory: Category = Category.A;
  selectedPrice: Price2 | undefined;
  calculatedPrice: number = 0;
  quantity: string = '1';
  m2_isBrut: boolean = true;
  packsNeeded: number = 0;
  extraPiecesNeeded: number = 0;
  totalPiecesNeeded: number = 0;

  private productService = inject(ProductsService);
  private pricesService = inject(PricesService);
  private stocksService = inject(StocksService);
  private destroyRef = inject(DestroyRef);
  private snackBar = inject(MatSnackBar);
  private translateService = inject(TranslateService);
  private productUtil = inject(ProductUtil);
  private hasFocused = false;

  currentStock: Stock | null = null;

  ngOnChanges(): void {
    this.selectedCategory = Category.A;
    this.quantity = '';
    this.hasFocused = false;
    if (this.selectedProduct) {
      this.fetchPrices(this.selectedProduct);
      if (this.selectedProduct.unit_id === Unit_id.M2) {
        this.quantity = '0.5';
      } else {
        this.quantity = '1';
      }
    }
  }

  addNewProduct() {
    setTimeout(() => {
      if (this.selectedProduct) {
        if (this.selectedProduct.unit_id !== Unit_id.M2) {
          this.addProduct.emit({
            product: this.selectedProduct,
            quantity: +this.quantity,
            price: this.calculatedPrice,
            category: this.selectedCategory,
          });
        } else {
          this.addProduct.emit({
            product: this.selectedProduct,
            quantity:
              this.totalPiecesNeeded *
              (this.selectedProduct.m2_brut /
                this.selectedProduct.piece_per_pack),
            price: this.calculatedPrice,
            packsNeeded: this.packsNeeded,
            extraPiecesNeeded: this.extraPiecesNeeded,
            category: this.selectedCategory,
          });
        }
      }
    });
  }

  fetchPrices(product: Product): void {
    this.pricesService.getPricesForProduct(product).then(
      (prices) => {
        if (prices) {
          this.prices = prices;

          this.selectedCategory = prices.find(
            (price) => price.category_id === Category.A,
          )
            ? Category.A
            : prices[0].category_id;
          this.selectedPrice = this.prices.find(
            (price) => price.category_id === this.selectedCategory,
          );
          this.calculatePrice();
          this.fetchStock(this.selectedProduct!);
        }
      },
      () => {
        this.fetchPrices(product);
      },
    );
  }

  fetchStock(product: Product): void {
    this.stocksService.getProductStock(product.id).then((stock) => {
      this.currentStock = stock;

      if (this.currentStock!.stock <= 0) {
        this.translateService
          .get(['SNACKBAR.PRODUCT.OUT_OF_STOCK', 'SNACKBAR.BUTTONS.CLOSE'])
          .subscribe((translations) => {
            this.snackBar.open(
              translations['SNACKBAR.PRODUCT.OUT_OF_STOCK'],
              translations['SNACKBAR.BUTTONS.CLOSE'],
              { duration: 4500, panelClass: 'danger-snackbar' },
            );
          });
      }
    });
  }

  validateInput() {
    if (
      this.selectedProduct &&
      (this.selectedProduct.unit_id === Unit_id.M2 ||
        !this.selectedProduct?.width)
    ) {
      if (+this.quantity < 0 || isNaN(+this.quantity)) {
        setTimeout(() => (this.quantity = '0.5'), 500);
      }
    } else {
      if (+this.quantity < 1 || isNaN(+this.quantity)) {
        setTimeout(() => (this.quantity = '1'), 500);
      }
    }

    setTimeout(() => {
      this.verifyStock();
      this.calculatePrice();
    });
  }

  clearOnFirstFocus(event: FocusEvent): void {
    if (!this.hasFocused) {
      (event.target as HTMLInputElement).value = '';
      this.hasFocused = true;
    }
  }

  onCategoryChange(): void {
    this.selectedPrice = this.prices.find(
      (price) => price.category_id === this.selectedCategory,
    );

    this.fetchStock(this.selectedProduct!);

    this.calculatePrice();
  }

  verifyStock(): void {
    if (+this.quantity > this.currentStock!.stock) {
      this.translateService
        .get(['SNACKBAR.PRODUCT.OUT_OF_STOCK', 'SNACKBAR.BUTTONS.CLOSE'])
        .subscribe((translations) => {
          this.snackBar.open(
            translations['SNACKBAR.PRODUCT.OUT_OF_STOCK'],
            translations['SNACKBAR.BUTTONS.CLOSE'],
            { duration: 3000, panelClass: 'danger-snackbar' },
          );
        });
    }
  }

  m2_setUnit() {
    this.m2_isBrut = !this.m2_isBrut;
    this.calculatePrice();
  }

  private calculatePrice(): void {
    const { price, packsNeeded, extraPiecesNeeded, totalPiecesNeeded } =
      this.productUtil.calculatePrice(
        this.selectedProduct!,
        this.selectedPrice?.price!,
        +this.quantity,
        this.m2_isBrut,
      );

    this.calculatedPrice = price;
    this.packsNeeded = packsNeeded;
    this.extraPiecesNeeded = extraPiecesNeeded;
    this.totalPiecesNeeded = totalPiecesNeeded;
  }
}
