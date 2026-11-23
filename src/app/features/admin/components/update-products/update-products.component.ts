import {
  Component,
  effect,
  ElementRef,
  inject,
  OnInit,
  signal,
  untracked,
  ViewChild,
  ChangeDetectionStrategy
} from '@angular/core';
import { Product, Products, Stock, StockCategory } from '@core/models/models';

import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import {
  FormBuilder,
  FormControl,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { ENTER_AND_LEAVE_ANIMATION } from '@core/models/animations';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { FilterUtil } from '@shared/utils/filter.util';
import { ProductStore, StockChange } from '@features/products/store/product.store';
import { DecimalInputDirective } from '@shared/directives/decimal-input.directive';
import { Category } from '@core/models/enums';
import { STOCK_CATEGORIES } from '@shared/utils/stock.util';

@Component({
  selector: 'app-update-products',
  imports: [
    DecimalInputDirective,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatAutocompleteModule,
    ReactiveFormsModule,
    FormsModule,
    TranslateModule,
    MatButtonModule,
    MatChipsModule,
    MatButtonToggleModule
],
  templateUrl: './update-products.component.html',
  styleUrl: './update-products.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  animations: [ENTER_AND_LEAVE_ANIMATION],
})
export class UpdateProductsComponent implements OnInit {
  @ViewChild('input') input: ElementRef<HTMLInputElement> | null = null;
  updateStock: boolean = false;

  private readonly fb = inject(FormBuilder);
  private filterUtil = inject(FilterUtil);
  readonly productStore = inject(ProductStore);

  filteredOptions: Products = [];

  selectedProduct: any = {
    id: null,
    name: '',
    unit_id: null,
    size_id: null,
    length: null,
    thickness: null,
    width: null,
    m2_brut: null,
    m2_util: null,
    piece_per_pack: null,
  };
  isProductSelectet: boolean = false;

  myControl = new FormControl('');

  productForm = this.fb.group({
    id: [this.selectedProduct?.id],
    name: [this.selectedProduct?.name, Validators.required],
    unit_id: [this.selectedProduct.unit_id, Validators.required],
    size_id: [this.selectedProduct.size_id, Validators.required],
    length: [this.selectedProduct.length, Validators.required],
    thickness: [this.selectedProduct.thickness, Validators.required],
    width: [this.selectedProduct.width],
    m2_brut: [this.selectedProduct.m2_brut],
    m2_util: [this.selectedProduct.m2_util],
    piece_per_pack: [this.selectedProduct.piece_per_pack],
  });

  /** Editable copies of the selected product's stock rows, one per grade. */
  gradeStocks: Stock[] = [];
  /** Stock of each grade when the rows were filled: the expected value for `set_stock`. */
  private stockBaseline: Partial<Record<StockCategory, number>> = {};
  /** After a "changed meanwhile" refusal: refill the rows once the reload arrives. */
  private readonly refillOnReload = signal<number | null>(null);
  savingStock = false;

  readonly categoryName = (category: Category) => Category[category];

  constructor() {
    effect(() => {
      const productId = this.refillOnReload();
      const graded = this.productStore.stocksByProduct();
      if (productId === null || this.productStore.isBusy()) return;
      untracked(() => {
        this.refillOnReload.set(null);
        if (graded[productId]) this.fetchProductStock(productId);
      });
    });
  }

  ngOnInit(): void {}

  fetchProductStock(productId: number): void {
    const graded = this.productStore.stocksByProduct()[productId] ?? {};
    this.gradeStocks = STOCK_CATEGORIES.map((c) => graded[c])
      .filter((s): s is Stock => !!s)
      .map((s) => ({ ...s }));
    this.stockBaseline = Object.fromEntries(
      this.gradeStocks.map((s) => [s.category_id, s.stock]),
    );
  }

  onModeChange(updateStock: boolean): void {
    this.updateStock = updateStock;
    if (updateStock && this.isProductSelectet) {
      this.fetchProductStock(this.selectedProduct.id);
    }
  }

  optionSelected(product: Product): void {
    this.isProductSelectet = true;
    this.selectedProduct = product;

    if (this.updateStock) {
      this.fetchProductStock(product.id);
    }
  }

  /**
   * Saves the changed grades. The rows are matched to the product's stock
   * rows as they are now (by grade), so a length change that merged A/B into
   * AB cannot make a save "succeed" on a row that no longer exists.
   */
  async onStockSave(): Promise<void> {
    if (this.savingStock || !this.selectedProduct?.id) return;
    const productId: number = this.selectedProduct.id;
    const current = this.productStore.stocksByProduct()[productId] ?? {};
    const changes: StockChange[] = [];
    for (const row of this.gradeStocks) {
      // an emptied number field gives null: leave that grade unchanged
      if (row.stock === null || (row.stock as unknown) === '') continue;
      const stock = Number(row.stock);
      const live = current[row.category_id];
      if (!live || !Number.isFinite(stock) || stock < 0) continue;
      // "changed" means changed by the admin (vs. the value shown when the
      // rows were filled), not vs. a stock reload that happened meanwhile
      const baseline = this.stockBaseline[row.category_id] ?? live.stock;
      if (stock === baseline) continue;
      changes.push({ id: live.id, expected: baseline, stock });
    }

    this.savingStock = true;
    const result = await this.productStore.setStocks(changes);
    this.savingStock = false;

    if (result === 'saved') this.fetchProductStock(productId);
    else if (result === 'conflict') this.refillOnReload.set(productId);
  }

  onSave() {
    if (this.productForm.valid) {
      this.productStore.updateProduct(this.selectedProduct);
      this.isProductSelectet = false;
      this.selectedProduct.name = '';
    }
  }

  filter(): void {
    this.filteredOptions = this.filterUtil.productFilter(
      this.input,
      this.productStore.productsEntities(),
    );
  }

  displayProductLabel(product: Product): string {
    return product ? product.name : '';
  }
}
