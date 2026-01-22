import { Component, computed, effect, inject, signal } from '@angular/core';
import { StocksService } from '../../services/query-services/stocks.service';
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

@Component({
  selector: 'app-products',
  imports: [
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
  private stocksService = inject(StocksService);
  private filterUtil = inject(FilterUtil);
  private productUtil = inject(ProductUtil);

  products = signal<ProductWithStock[]>([]);

  editOnIndex = signal<number | undefined>(undefined);
  searchValue = signal('');
  sortDirection = signal<'asc' | 'desc'>('asc');

  visibleProducts = signal<ProductWithStock[]>([]);
  filteredProducts = computed(() => {
    return this.filterUtil.productFilter(
      this.searchValue(),
      this.products(),
    ) as ProductWithStock[];
  });

  constructor() {
    this.fetchStocks();

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

    this.stocksService.updateStock(product.stock.id, newStock).then((ok) => {
      if (ok) {
        this.fetchStocks();
        this.editOnIndex.set(undefined);
      }
    });
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

  private fetchStocks(): void {
    this.stocksService.getStocksWithProductNames().then((response) => {
      if (response) {
        this.products.set(response);
      }
    });
  }
}
