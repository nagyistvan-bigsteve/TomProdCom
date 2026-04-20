import { Component, computed, effect, inject, signal } from '@angular/core';
import { Product, ProductWithStock } from '../../models/models';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDivider } from '@angular/material/divider';
import { TranslateModule } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { FilterUtil } from '../../services/utils/filter.util';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { ENTER_AND_LEAVE_ANIMATION } from '../../models/animations';
import { ProductUtil } from '../../services/utils/product.util';
import { ProductStore } from '../../services/store/product/product.store';
import { Unit_id } from '../../models/enums';
import { DecimalInputDirective } from '../../shared/directives/decimal-input.directive';

@Component({
  selector: 'app-products',
  imports: [
    DecimalInputDirective,
    MatProgressSpinnerModule,
    MatDivider,
    TranslateModule,
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    FormsModule,
    MatFormFieldModule,
  ],
  templateUrl: './products.component.html',
  styleUrl: './products.component.scss',
  animations: ENTER_AND_LEAVE_ANIMATION,
})
export class ProductsComponent {
  private readonly productStore = inject(ProductStore);
  private filterUtil = inject(FilterUtil);
  private productUtil = inject(ProductUtil);

  editOnIndex = signal<number | undefined>(undefined);
  searchValue = signal('');
  sortDirection = signal<'asc' | 'desc'>('asc');

  products = computed<ProductWithStock[]>(() => {
    const stockMap = this.productStore.stocksEntityMap();
    return this.productStore
      .productsEntities()
      .filter((p) => p.unit_id !== Unit_id.M2)
      .map((p) => ({ ...p, stock: stockMap[p.id] }))
      .filter((p): p is ProductWithStock => p.stock != null);
  });

  filteredProducts = computed(() => {
    return this.filterUtil.productFilter(
      this.searchValue(),
      this.products(),
    ) as ProductWithStock[];
  });

  visibleProducts = signal<ProductWithStock[]>([]);

  constructor() {
    effect(() => {
      this.visibleProducts.set(this.filteredProducts());
    });
  }

  sortByStock(): void {
    const sorted = [...this.visibleProducts()].sort((a, b) => {
      const diff = a.stock.stock - b.stock.stock;
      return this.sortDirection() === 'asc' ? diff : -diff;
    });

    this.sortDirection.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    this.visibleProducts.set(sorted);
  }

  setStock(product: ProductWithStock, newStock: number): void {
    if (newStock < 0) return;

    this.productStore.updateStock({
      id: product.stock.id,
      stock: newStock,
      product_id: product.id,
    });
    this.editOnIndex.set(undefined);
  }

  showEditStock(index: number): void {
    if (index === this.editOnIndex()) {
      this.editOnIndex.set(undefined);
      return;
    }
    this.editOnIndex.set(index);
  }

  calculateM3Qunatity(product: ProductWithStock): number {
    return this.productUtil.calculateM3Quantity(
      product as Product,
      product.stock.stock,
    );
  }
}
