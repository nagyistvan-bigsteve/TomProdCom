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
import {
  ENTER_AND_LEAVE_ANIMATION,
  ENTER_ANIMATION,
} from '../../../models/animations';
import { MatButtonModule } from '@angular/material/button';
import { Category } from '../../../models/enums';
import { MatChipsModule } from '@angular/material/chips';

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
  ],
  templateUrl: './update-products.component.html',
  styleUrl: './update-products.component.scss',
  animations: [ENTER_AND_LEAVE_ANIMATION],
})
export class UpdateProductsComponent implements OnInit {
  @ViewChild('input') input: ElementRef<HTMLInputElement> | null = null;
  @Input() updateStock: boolean = false;

  private readonly productService = inject(ProductsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
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
    width: [this.selectedProduct.width, Validators.required],
    m2_brut: [this.selectedProduct.m2_brut],
    m2_util: [this.selectedProduct.m2_util],
    piece_per_pack: [this.selectedProduct.piece_per_pack],
  });

  currentStock: Stock | null = null;

  stockForm = this.fb.group({
    id: [this.currentStock?.id],
    product_id: [this.currentStock?.product_id],
    category_id: [this.currentStock?.category],
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
      this.currentStock = stock;
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
    if (this.currentStock) {
      this.productService.updateStock(
        this.currentStock.id,
        this.currentStock.stock
      );
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
    if (!this.input) return;

    const rawValue = this.input.nativeElement.value.toLowerCase();

    if (!rawValue) {
      this.filteredOptions = this.products;
      return;
    }

    const isNumeric = /^\d+$/.test(rawValue);

    this.filteredOptions = this.products.filter((o) => {
      const name = o.name.toLowerCase();

      if (isNumeric) {
        const nameDigits = name.replace(/\D+/g, '');
        return nameDigits.includes(rawValue);
      } else {
        return name.includes(rawValue);
      }
    });
  }

  displayProductLabel(product: Product): string {
    return product ? product.name : '';
  }
}
