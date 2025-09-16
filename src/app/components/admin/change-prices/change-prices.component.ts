import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatChipsModule } from '@angular/material/chips';
import { MatOptionModule } from '@angular/material/core';
import { TranslateModule } from '@ngx-translate/core';
import { Category, Size_id, Unit_id } from '../../../models/enums';
import { MatDividerModule } from '@angular/material/divider';
import { ProductsService } from '../../../services/query-services/products.service';
import { Price2, PriceResponse2, Products } from '../../../models/models';
import {
  ENTER_AND_LEAVE_ANIMATION,
  ENTER_ANIMATION,
} from '../../../models/animations';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { CommonModule } from '@angular/common';

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
  ],
  templateUrl: './change-prices.component.html',
  styleUrl: './change-prices.component.scss',
  animations: [ENTER_AND_LEAVE_ANIMATION, ENTER_ANIMATION],
})
export class ChangePricesComponent implements OnInit {
  unitOptions = this.enumToArray(Unit_id, ['UNDEFINED']);
  sizeOptions = this.enumToArray(Size_id, ['UNDEFINED']);
  categoryOptions = this.enumToArray(Category);

  selectedUnit: Unit_id = Unit_id.M3;
  selectedSize: Size_id = Size_id.NORMAL;
  selectedCategory: Category = Category.A;
  selectedCurrentPrice: Price2 | null = null;
  actualPrice: number = 0;
  isNewPrice: boolean = false;
  unicItemSelected: boolean = false;
  selectedUnicItem: { id: number; price: number } = { id: 0, price: 0 };

  productsInFilterRange: Products = [];
  unicPriceList: PriceResponse2[] = [];

  private readonly productService = inject(ProductsService);

  ngOnInit(): void {
    this.productService.getUnicPriceList().then((prices) => {
      this.unicPriceList = prices;
    });

    this.onFilterChange();
  }

  enumToArray(
    enumObj: any,
    excludeKeys: string[] = []
  ): { key: string; value: number }[] {
    return Object.keys(enumObj)
      .filter((key) => isNaN(Number(key)) && !excludeKeys.includes(key))
      .map((key) => ({ key, value: enumObj[key] }));
  }

  onFilterChange(): void {
    if (
      this.selectedUnit &&
      this.selectedSize !== undefined &&
      this.selectedCategory
    ) {
      this.unicItemSelected = false;
      this.productService
        .getPrice(this.selectedUnit, this.selectedCategory, this.selectedSize)
        .then((price) => {
          this.isNewPrice = false;
          this.selectedCurrentPrice = price;

          this.actualPrice = price ? this.selectedCurrentPrice?.price! : 0;

          if (price) {
            this.productService
              .getProductsByFilter(this.selectedUnit, this.selectedSize)
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
    const currentPrice = this.unicItemSelected
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
      if (!this.unicItemSelected && !this.selectedCurrentPrice) {
        this.addNewPrice();
      } else {
        this.productService
          .changePrice(
            this.unicItemSelected
              ? this.selectedUnicItem.id
              : this.selectedCurrentPrice!.id,
            this.actualPrice
          )
          .then(() => {
            this.selectedCurrentPrice!.price = this.actualPrice;
            this.isNewPrice = false;

            if (this.unicItemSelected) {
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
      unit_id: this.selectedUnit,
      size_id: this.selectedSize,
      category_id: this.selectedCategory,
      price: this.actualPrice,
    };
    this.productService.addPrice(price as Price2).then(() => {
      this.onFilterChange();
    });
  }

  selectItemFromUnicPrice(price: number, id: number): void {
    this.unicItemSelected = true;
    this.actualPrice = price;
    this.selectedUnicItem = { id, price };
  }

  findSelectedUnitItem(selectedId: number): string {
    return this.unicPriceList.find((product) => product.id === selectedId)
      ?.product.name!;
  }
}
