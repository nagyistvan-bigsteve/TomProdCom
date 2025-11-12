import {
  Component,
  DestroyRef,
  ElementRef,
  inject,
  Input,
  OnInit,
  ViewChild,
} from '@angular/core';
import { ProductsService } from '../../../services/query-services/products.service';
import { Product, Products, Stock } from '../../../models/models';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
import { Category } from '../../../models/enums';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { FilterUtil } from '../../../services/utils/filter.util';

@Component({
  selector: 'app-update-products',
  imports: [
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

  private readonly productService = inject(ProductsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private filterUtil = inject(FilterUtil);

  products: Products = [];
  filteredOptions: Products = [];

  categoryEnum = Category;
  selectedCategory: Category = Category.A;
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
    category_id: Category.A,
    stock: 0,
  };

  stockForm = this.fb.group({
    id: [this.currentStock?.id],
    product_id: [this.currentStock?.product_id],
    category_id: [this.currentStock?.category_id],
    stock: [this.currentStock?.stock],
  });

  ngOnInit(): void {
    this.fetchProducts();
  }

  fetchProducts(): void {
    this.productService
      .getProducts()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((products) => {
        this.products = products;
      });
  }

  fetchProductStock(productId: number, category: Category): void {
    this.productService.getProductStock(productId, category).then((stock) => {
      if (stock) {
        this.currentStock = stock;
      } else {
        this.currentStock = {
          id: 0,
          product_id: productId,
          category_id: category,
          stock: 0,
        };
      }
    });
  }

  optionSelected(product: Product): void {
    this.isProductSelectet = true;
    this.selectedProduct = product;

    if (this.updateStock) {
      this.fetchProductStock(product.id, this.selectedCategory);
    }
  }

  onCategoryChange(): void {
    if (!this.isProductSelectet) {
      return;
    }

    this.fetchProductStock(this.selectedProduct.id, this.selectedCategory);
  }

  onStockSave() {
    if (this.currentStock.id) {
      this.productService.updateStock(
        this.currentStock.id,
        this.currentStock.stock
      );
    } else {
      this.productService
        .addStock({
          stock: this.currentStock.stock,
          product_id: this.currentStock.product_id,
          category_id: this.currentStock.category_id,
        })
        .then((response) => {
          if (response) {
            this.currentStock = response;
          }
        });
    }
  }

  onSave() {
    if (this.productForm.valid) {
      this.productService.updateProduct(this.selectedProduct).then(() => {
        this.isProductSelectet = false;
        this.selectedProduct.name = '';
        this.fetchProducts();
      });
    }
  }

  filter(): void {
    this.filteredOptions = this.filterUtil.productFilter(
      this.input,
      this.products
    );
  }

  displayProductLabel(product: Product): string {
    return product ? product.name : '';
  }
}
