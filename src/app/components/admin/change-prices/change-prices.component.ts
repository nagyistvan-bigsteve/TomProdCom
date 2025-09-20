import { Component, inject, OnInit } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatChipsModule } from '@angular/material/chips';
import { MatOptionModule } from '@angular/material/core';
import { TranslateModule } from '@ngx-translate/core';
import { Category, Size_id, Unit_id } from '../../../models/enums';
import { MatDividerModule } from '@angular/material/divider';
import { ProductsService } from '../../../services/query-services/products.service';
import {
  Price2,
  PriceResponse2,
  Product,
  Products,
} from '../../../models/models';
import {
  ENTER_AND_LEAVE_ANIMATION,
  ENTER_ANIMATION,
  LEAVE_ANIMATION,
} from '../../../models/animations';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { CommonModule } from '@angular/common';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonToggleModule } from '@angular/material/button-toggle';

@Component({
  selector: 'app-change-prices',
  imports: [
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
  categoryOptions = this.enumToArray(Category, ['AB']);
  categoryArray = this.enumToArray(Category);

  searchControl = new FormControl('');
  priceTypeControl = new FormControl('');

  actualPrice: number = 0;

  selectedPriceType: 'unic' | 'm3' | 'new' = 'm3';
  selectedUnicItem: { id: number; price: number } = { id: 0, price: 0 };
  selectedCurrentPrice: Price2 | null = null;
  selectedNewProduct: Product | null = null;

  selectedSize: Size_id = Size_id.NORMAL;
  selectedCategory: Category = Category.A;

  productsInFilterRange: Products = [];
  unicPriceList: PriceResponse2[] = [];
  displayedList: PriceResponse2[] = [];
  productsWithoutPrices: Products = [];

  isNewPrice: boolean = false;

  private readonly productService = inject(ProductsService);

  ngOnInit(): void {
    this.setUpPrices();

    this.onFilterChange();
  }

  setUpPrices(): void {
    this.actualPrice = 0;

    this.setUnicPriceList();
    this.setProductsWithoutPricesList();
  }

  priceTypeChange(priceType: 'unic' | 'm3' | 'new'): void {
    this.actualPrice = 0;
    this.selectedPriceType = priceType;
    if (this.selectedPriceType === 'm3') {
      this.onFilterChange();
    }
  }

  setUnicPriceFilter(): void {
    this.displayedList = [...this.unicPriceList];

    this.searchControl.valueChanges.subscribe((value) => {
      const filterValue = (value ?? '').toLowerCase();
      this.displayedList = this.unicPriceList.filter((item) =>
        item.product.name.toLowerCase().includes(filterValue)
      );
    });
  }

  onFilterChange(): void {
    if (this.selectedSize !== undefined && this.selectedCategory) {
      this.productService
        .getPrice(Unit_id.M3, this.selectedCategory, this.selectedSize)
        .then((price) => {
          this.isNewPrice = false;
          this.selectedCurrentPrice = price;

          this.actualPrice = price ? this.selectedCurrentPrice?.price! : 0;

          if (price) {
            this.productService
              .getProductsByFilter(Unit_id.M3, this.selectedSize)
              .then((products) => {
                if (products) {
                  this.productsInFilterRange = products.filter(
                    (product) =>
                      !this.unicPriceList.some(
                        (ex) => ex.product.id === product.id
                      )
                  );
                }
              });
          }
        });
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
      if (this.selectedPriceType !== 'unic' && !this.selectedCurrentPrice) {
        this.addNewPrice();
      } else {
        this.productService
          .changePrice(
            this.selectedPriceType === 'unic'
              ? this.selectedUnicItem.id
              : this.selectedCurrentPrice!.id,
            this.actualPrice
          )
          .then(() => {
            this.selectedCurrentPrice!.price = this.actualPrice;
            this.isNewPrice = false;

            if (this.selectedPriceType === 'unic') {
              this.productService.getUnicPriceList().then((prices) => {
                this.unicPriceList = prices;
                this.selectedUnicItem = {
                  id: this.selectedUnicItem.id,
                  price: this.actualPrice,
                };
              });
            }
          });
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

    this.productService.addPrice(price as Price2).then(() => {
      this.selectedPriceType === 'new'
        ? this.setUpPrices()
        : this.onFilterChange();
    });
  }

  selectItemFromUnicPrice(price: number, id: number): void {
    this.actualPrice = price;
    this.selectedUnicItem = { id, price };
  }

  selectNewItemForUnicPrice(product: Product): void {
    this.actualPrice = 0;
    this.selectedCurrentPrice = null;
    this.selectedNewProduct = product;
  }

  private setUnicPriceList(): void {
    this.productService.getUnicPriceList().then((prices) => {
      this.unicPriceList = prices;
      this.unicPriceList.sort((a, b) =>
        a.product.name.localeCompare(b.product.name, undefined, {
          sensitivity: 'base',
        })
      );

      if (this.selectedUnicItem) {
        this.selectedUnicItem = {
          id: this.selectedUnicItem.id,
          price: this.actualPrice,
        };
      }

      this.setUnicPriceFilter();
    });
  }

  private setProductsWithoutPricesList(): void {
    this.selectedNewProduct = null;

    this.productService.getProductsWithoutPrice().then((products) => {
      this.productsWithoutPrices = products;
      this.productsWithoutPrices.sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      );

      if (
        !this.productsWithoutPrices.length &&
        this.selectedPriceType === 'new'
      ) {
        this.priceTypeChange('m3');
      }
    });
  }

  private enumToArray(
    enumObj: any,
    excludeKeys: string[] = []
  ): { key: string; value: number }[] {
    return Object.keys(enumObj)
      .filter((key) => isNaN(Number(key)) && !excludeKeys.includes(key))
      .map((key) => ({ key, value: enumObj[key] }));
  }
}
