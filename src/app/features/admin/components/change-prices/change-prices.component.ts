import { Component, effect, inject, OnInit, untracked } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatChipsModule } from '@angular/material/chips';
import { MatOptionModule } from '@angular/material/core';
import { TranslateModule } from '@ngx-translate/core';
import { Category, Size_id, Unit_id } from '@core/models/enums';
import { MatDividerModule } from '@angular/material/divider';
import { Price2, PriceResponse2, Product, Products } from '@core/models/models';
import {
  ENTER_AND_LEAVE_ANIMATION,
  ENTER_ANIMATION,
  LEAVE_ANIMATION,
} from '@core/models/animations';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { CommonModule } from '@angular/common';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { ProductStore } from '@features/products/store/product.store';
import { DecimalInputDirective } from '@shared/directives/decimal-input.directive';

@Component({
  selector: 'app-change-prices',
  imports: [
    DecimalInputDirective,
    TranslateModule,
    FormsModule,
    MatChipsModule,
    MatOptionModule,
    MatDividerModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    CommonModule,
    MatAutocompleteModule,
    ReactiveFormsModule,
    MatButtonToggleModule,
  ],
  templateUrl: './change-prices.component.html',
  styleUrl: './change-prices.component.scss',
  animations: [ENTER_AND_LEAVE_ANIMATION, ENTER_ANIMATION, LEAVE_ANIMATION],
})
export class ChangePricesComponent implements OnInit {
  sizeOptions = this.enumToArray(Size_id, ['UNDEFINED']);
  categoryOptions = this.enumToArray(Category);
  categoryArray = this.enumToArray(Category);

  searchControl = new FormControl('');
  overrideSearch = new FormControl('');

  actualPrice: number = 0;

  selectedPriceType: 'unic' | 'm3' | 'new' = 'm3';
  selectedUnicItem: { id: number; price: number } = { id: 0, price: 0 };
  selectedCurrentPrice: Price2 | null = null;
  selectedNewProduct: Product | null = null;
  existingUnicPriceId: number | null = null;

  selectedSize: Size_id = Size_id.NORMAL;
  selectedCategory: Category = Category.A;

  productsInFilterRange: Products = [];
  unicPriceList: PriceResponse2[] = [];
  displayedList: PriceResponse2[] = [];
  productsWithoutPrices: Products = [];
  allProductsSorted: Products = [];
  filteredOverrideProducts: Products = [];

  isNewPrice: boolean = false;

  readonly productStore = inject(ProductStore);

  constructor() {
    effect(() => {
      const prices = this.productStore.pricesEntities();
      const products = this.productStore.productsEntities();
      if (!prices.length || !products.length) return;

      untracked(() => {
        this.refreshUnicPriceList();
        this.refreshProductsWithoutPrices();
      });
    });
  }

  ngOnInit(): void {
    this.onFilterChange();

    this.searchControl.valueChanges.subscribe((value) => {
      const filterValue = (value ?? '').toLowerCase();
      this.displayedList = this.unicPriceList.filter((item) =>
        item.product.name.toLowerCase().includes(filterValue),
      );
    });

    this.overrideSearch.valueChanges.subscribe(() => {
      this.applyOverrideSearch();
    });
  }

  priceTypeChange(priceType: 'unic' | 'm3' | 'new'): void {
    this.actualPrice = 0;
    this.selectedPriceType = priceType;

    if (this.selectedPriceType === 'm3') {
      this.onFilterChange();
    }

    if (this.selectedPriceType === 'new') {
      this.selectedNewProduct = null;
      this.existingUnicPriceId = null;
      this.isNewPrice = false;
      this.overrideSearch.setValue('', { emitEvent: false });
      this.applyOverrideSearch();
    }
  }

  onFilterChange(): void {
    if (this.selectedSize !== undefined && this.selectedCategory) {
      const prices = this.productStore.pricesEntities();
      const products = this.productStore.productsEntities();

      const price =
        prices.find(
          (p) =>
            p.unit_id === Unit_id.M3 &&
            p.category_id === this.selectedCategory &&
            p.size_id === this.selectedSize &&
            p.product_id == null,
        ) ?? null;

      this.isNewPrice = false;
      this.selectedCurrentPrice = price;
      this.actualPrice = price ? price.price : 0;

      if (price) {
        const unicProductIds = new Set(
          this.unicPriceList.map((u) => u.product.id),
        );
        this.productsInFilterRange = products.filter(
          (p) =>
            p.unit_id === Unit_id.M3 &&
            p.size_id === this.selectedSize &&
            !unicProductIds.has(p.id),
        );
      }
    }
  }

  priceInputChange(event: any): void {
    const currentPrice =
      this.selectedPriceType === 'unic'
        ? this.selectedUnicItem.price
        : this.selectedCurrentPrice
          ? this.selectedCurrentPrice!.id
          : 0;
    if (event !== currentPrice) {
      this.isNewPrice = true;
      this.actualPrice = event;
    } else {
      this.isNewPrice = false;
    }
  }

  updateNewPrice(): void {
    if (this.isNewPrice && this.actualPrice) {
      // Override mode: existing unic price found for this product+category
      if (this.selectedPriceType === 'new' && this.existingUnicPriceId != null) {
        this.productStore.changePrice({ id: this.existingUnicPriceId, new_price: this.actualPrice });
        this.existingUnicPriceId = null;
        this.isNewPrice = false;
        return;
      }

      if (this.selectedPriceType !== 'unic' && !this.selectedCurrentPrice) {
        this.addNewPrice();
      } else {
        const id =
          this.selectedPriceType === 'unic'
            ? this.selectedUnicItem.id
            : this.selectedCurrentPrice!.id;

        this.productStore.changePrice({ id, new_price: this.actualPrice });

        if (this.selectedCurrentPrice) {
          this.selectedCurrentPrice.price = this.actualPrice;
        }
        this.isNewPrice = false;

        if (this.selectedPriceType === 'unic') {
          this.selectedUnicItem = {
            id: this.selectedUnicItem.id,
            price: this.actualPrice,
          };
        }
      }
    }
  }

  addNewPrice(): void {
    const price: Partial<Price2> = {
      unit_id:
        this.selectedPriceType === 'new'
          ? this.selectedNewProduct?.unit_id
          : Unit_id.M3,
      size_id:
        this.selectedPriceType === 'new'
          ? this.selectedNewProduct?.size_id
          : this.selectedSize,
      category_id: this.selectedCategory,
      price: this.actualPrice,
      product_id:
        this.selectedPriceType === 'new'
          ? this.selectedNewProduct?.id
          : undefined,
    };

    this.productStore.addPrice(price);

    if (this.selectedPriceType !== 'new') {
      this.onFilterChange();
    }
  }

  selectItemFromUnicPrice(price: number, id: number): void {
    this.actualPrice = price;
    this.selectedUnicItem = { id, price };
  }

  selectNewItemForUnicPrice(product: Product): void {
    this.actualPrice = 0;
    this.selectedCurrentPrice = null;
    this.selectedNewProduct = product;
    this.checkExistingUnicPrice();
  }

  onOverrideCategoryChange(): void {
    if (this.selectedNewProduct) {
      this.checkExistingUnicPrice();
    }
  }

  private checkExistingUnicPrice(): void {
    if (!this.selectedNewProduct) {
      this.existingUnicPriceId = null;
      return;
    }

    const existing = this.unicPriceList.find(
      (p) =>
        p.product.id === this.selectedNewProduct!.id &&
        p.category_id === this.selectedCategory,
    );

    if (existing) {
      this.existingUnicPriceId = existing.id;
      this.actualPrice = existing.price;
    } else {
      this.existingUnicPriceId = null;
      this.actualPrice = 0;
    }
    this.isNewPrice = false;
  }

  private applyOverrideSearch(): void {
    const query = (this.overrideSearch.value ?? '').toLowerCase();
    this.filteredOverrideProducts = query
      ? this.allProductsSorted.filter((p) =>
          p.name.toLowerCase().includes(query),
        )
      : [...this.allProductsSorted];
  }

  private refreshUnicPriceList(): void {
    const prices = this.productStore.pricesEntities();
    const productsMap = this.productStore.productsEntityMap();

    this.unicPriceList = prices
      .filter((p) => p.product_id != null)
      .map((p) => ({
        id: p.id,
        unit_id: p.unit_id,
        category_id: p.category_id,
        size_id: p.size_id,
        price: p.price,
        product: productsMap[p.product_id!] ?? { id: 0, name: '' },
      }))
      .sort((a, b) =>
        a.product.name.localeCompare(b.product.name, undefined, {
          sensitivity: 'base',
        }),
      );

    const filterValue = (this.searchControl.value ?? '').toLowerCase();
    this.displayedList = filterValue
      ? this.unicPriceList.filter((item) =>
          item.product.name.toLowerCase().includes(filterValue),
        )
      : [...this.unicPriceList];

    if (this.selectedUnicItem.id) {
      this.selectedUnicItem = {
        id: this.selectedUnicItem.id,
        price: this.selectedUnicItem.price,
      };
    }

    // Re-check override pre-fill after unic list updates (e.g. after save)
    if (this.selectedPriceType === 'new' && this.selectedNewProduct) {
      this.checkExistingUnicPrice();
    }
  }

  private refreshProductsWithoutPrices(): void {
    const prices = this.productStore.pricesEntities();
    const products = this.productStore.productsEntities();

    const unicProductIds = new Set(
      prices.filter((p) => p.product_id != null).map((p) => p.product_id!),
    );

    // A matrix price (product_id = null) covers every product with the same unit_id + size_id
    const matrixCoveredKeys = new Set(
      prices
        .filter((p) => p.product_id == null)
        .map((p) => `${p.unit_id}_${p.size_id}`),
    );

    const sortByName = (arr: Products): Products =>
      [...arr].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
      );

    this.productsWithoutPrices = sortByName(
      products.filter(
        (p) =>
          !unicProductIds.has(p.id) &&
          !matrixCoveredKeys.has(`${p.unit_id}_${p.size_id}`),
      ),
    );

    this.allProductsSorted = sortByName(products);
    this.applyOverrideSearch();
  }

  private enumToArray(
    enumObj: any,
    excludeKeys: string[] = [],
  ): { key: string; value: number }[] {
    return Object.keys(enumObj)
      .filter((key) => isNaN(Number(key)) && !excludeKeys.includes(key))
      .map((key) => ({ key, value: enumObj[key] }));
  }
}
