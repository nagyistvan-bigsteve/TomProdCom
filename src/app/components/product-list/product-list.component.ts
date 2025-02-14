import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable, startWith, map, take } from 'rxjs';
import { ProductsService } from '../../services/query-services/products.service';
import { Products } from '../../models/models';
import { Language, Unit_id } from '../../models/enums';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { ReactiveFormsModule, FormControl, FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { _isTestEnvironment } from '@angular/cdk/platform';

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
  ],
  styleUrls: ['./product-list.component.scss'],
})
export class ProductSelectComponent implements OnInit {
  productControl = new FormControl('');
  productGroups: { unit: Unit_id; products: Products }[] = [];
  selectedUnit: Unit_id = Unit_id.UNDEFINED;
  products: Products = [];
  filteredProducts: Observable<Products> | undefined;

  readonly #productService = inject(ProductsService);
  readonly #translate = inject(TranslateService);

  ngOnInit() {
    const savedLang =
      (localStorage.getItem('selectedLanguage') as Language) || Language.RO;
    this.#translate.use(savedLang);
    this.fetchProducts();
    this.filteredProducts = this.productControl.valueChanges.pipe(
      startWith(''),
      map((value) => this._filter(value || ''))
    );
  }

  fetchProducts() {
    this.#productService
      .getProducts()
      .pipe(take(1))
      .subscribe((products) => {
        this.products = products;
        this.fetchProductGroups(products);
      });
  }

  fetchProductGroups(products: Products) {
    this.productGroups = this.groupProductsByUnit(products);
    this.productGroups.unshift({ unit: Unit_id.UNDEFINED, products: products });

    this.selectedUnit = this.productGroups.length
      ? this.productGroups[0].unit
      : 1;
    this.onUnitChange();
  }

  groupProductsByUnit(
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

  onUnitChange() {
    if (this.selectedUnit) {
      this.productControl.setValue('');
    }
  }

  private _filter(value: string): Products {
    const filterValue = value.toLowerCase();

    if (this.selectedUnit === Unit_id.UNDEFINED) {
      return this.products.filter((product) =>
        product.name.toLowerCase().includes(filterValue)
      );
    }

    return this.selectedUnit
      ? this.productGroups
          .find((group) => group.unit === this.selectedUnit)
          ?.products.filter((product) =>
            product.name.toLowerCase().includes(filterValue)
          ) || []
      : [];
  }
}
