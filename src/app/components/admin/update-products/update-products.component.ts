import {
  Component,
  ElementRef,
  inject,
  OnInit,
  ViewChild,
} from '@angular/core';
import { Product, Products, Stock } from '../../../models/models';
import { CommonModule } from '@angular/common';
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
import { ENTER_AND_LEAVE_ANIMATION } from '../../../models/animations';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { FilterUtil } from '../../../services/utils/filter.util';
import { ProductStore } from '../../../services/store/product/product.store';
import { DecimalInputDirective } from '../../../shared/directives/decimal-input.directive';

@Component({
  selector: 'app-update-products',
  imports: [
    DecimalInputDirective,
    CommonModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatAutocompleteModule,
    ReactiveFormsModule,
    FormsModule,
    TranslateModule,
    MatButtonModule,
    MatChipsModule,
    MatButtonToggleModule,
  ],
  templateUrl: './update-products.component.html',
  styleUrl: './update-products.component.scss',
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

  currentStock: Stock = {
    id: 0,
    product_id: 0,
    stock: 0,
    booked_stock: 0,
  };

  stockForm = this.fb.group({
    id: [this.currentStock?.id],
    product_id: [this.currentStock?.product_id],
    stock: [this.currentStock?.stock],
  });

  ngOnInit(): void {}

  fetchProductStock(productId: number): void {
    this.currentStock =
      this.productStore.stocksEntityMap()[productId] ?? {
        id: 0,
        product_id: productId,
        stock: 0,
        booked_stock: 0,
      };
  }

  optionSelected(product: Product): void {
    this.isProductSelectet = true;
    this.selectedProduct = product;

    if (this.updateStock) {
      this.fetchProductStock(product.id);
    }
  }

  onStockSave() {
    if (this.currentStock.id) {
      this.productStore.updateStock({
        id: this.currentStock.id,
        stock: this.currentStock.stock,
        product_id: this.currentStock.product_id,
      });
    } else {
      this.productStore
        .addStockAndReturn({
          stock: this.currentStock.stock,
          product_id: this.currentStock.product_id,
        })
        .subscribe((newStock) => {
          this.currentStock = newStock;
        });
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
