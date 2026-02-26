import {
  Component,
  EventEmitter,
  inject,
  Input,
  OnChanges,
  Output,
  signal,
} from '@angular/core';
import {
  M2_QUANTITIES,
  M2Quantities,
  Price2,
  Product,
  ProductItem,
  Stock,
} from '../../../models/models';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule } from '@angular/forms';
import { Category, Unit_id } from '../../../models/enums';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ENTER_ANIMATION } from '../../../models/animations';
import { CommonModule } from '@angular/common';
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
  m2_quantity = signal<M2Quantities>('BRUT');
  packsNeeded: number = 0;
  extraPiecesNeeded: number = 0;
  totalPiecesNeeded: number = 0;

  private pricesService = inject(PricesService);
  private stocksService = inject(StocksService);
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
      this.quantity = '1';
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

  handleQuantityInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const cursorPos = input.selectionStart || 0;
    let value = input.value;

    // Replace comma with dot
    value = value.replace(/,/g, '.');

    // Remove everything except digits and dots
    value = value.replace(/[^\d.]/g, '');

    // Ensure only one decimal point
    const parts = value.split('.');
    if (parts.length > 2) {
      // Keep first part and first decimal part only
      value = parts[0] + '.' + parts.slice(1).join('');
    }

    // Limit to 2 decimal places (optional)
    if (parts.length === 4 && parts[1].length > 4) {
      value = parts[0] + '.' + parts[1].substring(0, 4);
    }

    // Update the value
    this.quantity = value;
    input.value = value;

    // Restore cursor position
    requestAnimationFrame(() => {
      const newCursorPos = Math.min(cursorPos, value.length);
      input.setSelectionRange(newCursorPos, newCursorPos);
    });
  }

  validateInput(): void {
    const numValue = parseFloat(this.quantity);

    if (isNaN(numValue) || numValue < 0) {
      this.quantity = '0';
    } else {
      // Keep the string value to allow typing decimals like "2."
      // Only clean it up on blur
      this.quantity = String(numValue);
    }

    this.verifyStock();
    this.calculatePrice();
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
    this.m2_quantity.update((current) => {
      const index = M2_QUANTITIES.indexOf(current);
      return M2_QUANTITIES[(index + 1) % M2_QUANTITIES.length];
    });
    this.calculatePrice();
  }

  private calculatePrice(): void {
    const { price, packsNeeded, extraPiecesNeeded, totalPiecesNeeded } =
      this.productUtil.calculatePrice(
        this.selectedProduct!,
        this.selectedPrice?.price!,
        +this.quantity,
        this.m2_quantity(),
      );

    this.calculatedPrice = price;
    this.packsNeeded = packsNeeded;
    this.extraPiecesNeeded = extraPiecesNeeded;
    this.totalPiecesNeeded = totalPiecesNeeded;
  }
}
