import {
  Component,
  DestroyRef,
  ElementRef,
  EventEmitter,
  inject,
  Output,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import { ProductsService } from '../../services/query-services/products.service';
import { Product, Products } from '../../models/models';
import { Size_id, Unit_id } from '../../models/enums';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { ReactiveFormsModule, FormControl, FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { _isTestEnvironment } from '@angular/cdk/platform';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-product-list',
  templateUrl: './product-list.component.html',
  imports: [
    CommonModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatAutocompleteModule,
    ReactiveFormsModule,
    FormsModule,
    TranslateModule,
    MatChipsModule,
    MatDividerModule,
  ],
  styleUrls: ['./product-list.component.scss'],
})
export class ProductSelectComponent {
  @ViewChild('input') input: ElementRef<HTMLInputElement> | null = null;
  @Output() selectedProduct = new EventEmitter<Product>();

  //variables for storing the products
  products: Products = [];
  filteredProducts: Observable<Products> | undefined;

  //Variables for the unit mapping
  productsByUnits: { unit: Unit_id; products: Products }[] = [];
  selectedUnit: Unit_id = Unit_id.UNDEFINED;

  //variables for the size mapping
  productsBySizes: { size: Size_id; products: Products }[] = [];
  selectedSize: Size_id = Size_id.UNDEFINED;

  //variables for the product select
  myControl = new FormControl('');
  filteredOptions: Product[] = [];
  productsByFilter: Products = [];

  readonly #productService = inject(ProductsService);
  readonly #destroyRef = inject(DestroyRef);

  constructor() {
    this.fetchProducts();
  }

  fetchProducts() {
    this.#productService
      .getProducts()
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe((products) => {
        this.products = products;
        this.fetchProductGroups(products);
      });
  }

  fetchProductGroups(products: Products) {
    this.productsByUnits = this.groupProductsByUnit(products);
    this.productsByUnits.unshift({
      unit: Unit_id.UNDEFINED,
      products: products,
    });

    this.productsBySizes = this.groupProductsBySize(products);
    this.productsBySizes.unshift({
      size: Size_id.UNDEFINED,
      products: products,
    });

    this.productsByFilter = this.fetchProductsByFilters();
  }

  fetchProductsByFilters(): Products {
    if (
      this.selectedSize === Size_id.UNDEFINED &&
      this.selectedUnit === Unit_id.UNDEFINED
    ) {
      return this.products;
    }

    if (this.selectedUnit === Unit_id.UNDEFINED) {
      return this.products.filter(
        (product) => product.size_id === this.selectedSize
      );
    }

    if (this.selectedSize === Size_id.UNDEFINED) {
      return this.products.filter(
        (product) => product.unit_id === this.selectedUnit
      );
    }

    return this.products.filter(
      (product) =>
        product.unit_id === this.selectedUnit &&
        product.size_id === this.selectedSize
    );
  }

  optionSelected(product: Product) {
    this.selectedProduct.emit(product);
  }

  displayProductLabel(product: Product): string {
    return product ? product.name : '';
  }

  onFilterChange() {
    this.myControl.setValue('');
    this.productsByFilter = this.fetchProductsByFilters();
  }

  filter(): void {
    if (this.input) {
      const filterValue = this.input.nativeElement.value.toLowerCase();
      this.filteredOptions = this.productsByFilter.filter((o) =>
        o.name.toLowerCase().includes(filterValue)
      );
    }
  }

  private groupProductsByUnit(
    products: Products
  ): { unit: Unit_id; products: Products }[] {
    const grouped = products.reduce((acc, product) => {
      if (!acc[product.unit_id]) {
        acc[product.unit_id] = [];
      }
      acc[product.unit_id].push(product);
      return acc;
    }, {} as Record<Unit_id, Products>);

    return Object.entries(grouped).map(([unit, products]) => ({
      unit: parseInt(unit) as Unit_id,
      products,
    }));
  }

  private groupProductsBySize(
    products: Products
  ): { size: Size_id; products: Products }[] {
    const grouped = products.reduce((acc, product) => {
      if (!acc[product.size_id]) {
        acc[product.size_id] = [];
      }
      acc[product.size_id].push(product);
      return acc;
    }, {} as Record<Size_id, Products>);

    return Object.entries(grouped).map(([size, products]) => ({
      size: parseInt(size) as Size_id,
      products,
    }));
  }
}
