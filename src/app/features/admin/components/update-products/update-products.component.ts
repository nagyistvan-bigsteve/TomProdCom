import {
  Component,
  ElementRef,
  inject,
  OnInit,
  ViewChild,
  ChangeDetectionStrategy
} from '@angular/core';
import { Product, Products, Stock } from '@core/models/models';

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
import { ProductStore } from '@features/products/store/product.store';
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

  readonly categoryName = (category: Category) => Category[category];

  ngOnInit(): void {}

  fetchProductStock(productId: number): void {
    const graded = this.productStore.stocksByProduct()[productId] ?? {};
    this.gradeStocks = STOCK_CATEGORIES.map((c) => graded[c])
      .filter((s): s is Stock => !!s)
      .map((s) => ({ ...s }));
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

  onStockSave() {
    const saved = this.productStore.stocksEntityMap();
    for (const row of this.gradeStocks) {
      // an emptied number field gives null: leave that grade unchanged
      if (row.stock === null || (row.stock as unknown) === '') continue;
      const stock = Number(row.stock);
      if (Number.isFinite(stock) && stock >= 0 && stock !== saved[row.id]?.stock) {
        this.productStore.updateStock({ id: row.id, stock });
      }
    }
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
