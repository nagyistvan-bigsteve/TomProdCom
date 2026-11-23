import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Product, Stock, StockCategory } from '@core/models/models';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { FilterUtil } from '@shared/utils/filter.util';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatChipListboxChange, MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { ENTER_AND_LEAVE_ANIMATION } from '@core/models/animations';
import { ProductUtil } from '@shared/utils/product.util';
import { ProductStore } from '@features/products/store/product.store';
import { Category, Unit_id } from '@core/models/enums';
import {
  availableStock,
  isGradable,
  stockCategoriesOf,
  totalStock,
} from '@shared/utils/stock.util';
import {
  SortingDialogComponent,
  SortingDialogData,
} from '@features/products/components/sorting-dialog/sorting-dialog.component';

export type StockFilter = 'all' | 'to-sort' | 'negative';

type GradeRow = {
  category: StockCategory;
  stock: Stock;
  available: number;
  m3: number | null;
};

export type ProductStockCard = {
  id: number;
  name: string;
  product: Product;
  gradable: boolean;
  grades: GradeRow[];
  total: number;
  totalM3: number | null;
  ab: number;
  hasNegative: boolean;
};

@Component({
  selector: 'app-products',
  imports: [
    MatProgressSpinnerModule,
    TranslateModule,
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatChipsModule,
    FormsModule,
    MatFormFieldModule,
  ],
  templateUrl: './products.component.html',
  styleUrl: './products.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  animations: ENTER_AND_LEAVE_ANIMATION,
})
export class ProductsComponent {
  readonly productStore = inject(ProductStore);
  private filterUtil = inject(FilterUtil);
  private productUtil = inject(ProductUtil);
  private dialog = inject(MatDialog);

  readonly Category = Category;

  editingId = signal<number | null>(null);
  /** New values typed in the edit row, by stocks row id. */
  draft = signal<Record<number, number>>({});
  searchValue = signal('');
  stockFilter = signal<StockFilter>('all');
  sortDirection = signal<'none' | 'asc' | 'desc'>('none');

  cards = computed<ProductStockCard[]>(() => {
    const byProduct = this.productStore.stocksByProduct();
    return this.productStore
      .productsEntities()
      .filter((p) => p.unit_id !== Unit_id.M2)
      .map((product) => this.toCard(product, byProduct[product.id] ?? {}))
      .filter((card) => card.grades.length > 0);
  });

  counts = computed(() => {
    const cards = this.cards();
    return {
      toSort: cards.filter(isToSort).length,
      negative: cards.filter((c) => c.hasNegative).length,
    };
  });

  visibleCards = computed(() => {
    const filter = this.stockFilter();
    let cards = this.filterUtil.productFilter(this.searchValue(), this.cards());
    if (filter === 'to-sort') cards = cards.filter(isToSort);
    if (filter === 'negative') cards = cards.filter((c) => c.hasNegative);

    const direction = this.sortDirection();
    if (direction !== 'none') {
      const sign = direction === 'asc' ? 1 : -1;
      cards = [...cards].sort((a, b) => sign * (a.total - b.total));
    }
    return cards;
  });

  constructor() {
    // no realtime: show the latest numbers whenever the page is opened
    this.productStore.fetchStocks();
  }

  sortByStock(): void {
    this.sortDirection.update((d) => (d === 'asc' ? 'desc' : 'asc'));
  }

  toggleEdit(card: ProductStockCard): void {
    if (this.editingId() === card.id) {
      this.editingId.set(null);
      return;
    }
    this.draft.set({});
    this.editingId.set(card.id);
  }

  /** An emptied field is not a 0: it leaves that grade unchanged. */
  setDraft(stockId: number, value: string): void {
    this.draft.update((d) => {
      const { [stockId]: _, ...rest } = d;
      return value.trim() === '' ? rest : { ...rest, [stockId]: Number(value) };
    });
  }

  /** Chips are single-choice: tapping the selected one again keeps it selected. */
  onFilterChange(event: MatChipListboxChange): void {
    if (event.value == null) {
      event.source.value = this.stockFilter();
      return;
    }
    this.stockFilter.set(event.value);
  }

  saveEdit(card: ProductStockCard): void {
    const draft = this.draft();
    for (const row of card.grades) {
      const value = draft[row.stock.id];
      if (value === undefined || !Number.isFinite(value) || value < 0) continue;
      if (value !== row.stock.stock) {
        this.productStore.updateStock({ id: row.stock.id, stock: value });
      }
    }
    this.editingId.set(null);
  }

  openSorting(card: ProductStockCard): void {
    this.dialog.open<SortingDialogComponent, SortingDialogData>(
      SortingDialogComponent,
      { data: { product: card.product }, width: '420px', maxWidth: '95vw' },
    );
  }

  private toCard(
    product: Product,
    graded: Partial<Record<StockCategory, Stock>>,
  ): ProductStockCard {
    const withM3 =
      product.unit_id === Unit_id.M3 || product.unit_id === Unit_id.BOUNDLE;
    const m3 = (pieces: number) =>
      withM3 ? this.productUtil.calculateM3Quantity(product, pieces) : null;

    const grades = stockCategoriesOf(product)
      .map((category) => graded[category] && { category, stock: graded[category]! })
      .filter((g): g is { category: StockCategory; stock: Stock } => !!g)
      .map((g) => ({
        ...g,
        available: availableStock(g.stock),
        m3: m3(g.stock.stock),
      }));

    const total = totalStock(graded);

    return {
      id: product.id,
      name: product.name,
      product,
      gradable: isGradable(product),
      grades,
      total,
      totalM3: m3(total),
      ab: graded[Category.AB]?.stock ?? 0,
      hasNegative: grades.some((g) => g.available < 0),
    };
  }
}

/** Gradable product with unsorted AB pieces. */
function isToSort(card: ProductStockCard): boolean {
  return card.gradable && card.ab > 0;
}
