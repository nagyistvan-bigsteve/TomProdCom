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
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatChipListboxChange, MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { ENTER_AND_LEAVE_ANIMATION } from '@core/models/animations';
import { ProductUtil } from '@shared/utils/product.util';
import { ProductStore, StockChange } from '@features/products/store/product.store';
import { Category, Unit_id } from '@core/models/enums';
import {
  availableStock,
  countsWholePieces,
  hasVolume,
  isGradable,
  formatM3Input,
  m3InputAllowed,
  parseM3,
  piecesFromM3,
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
    MatButtonToggleModule,
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
  /**
   * Stock of each grade when the edit was opened, by stocks row id. Sent as
   * the expected value, so a change made meanwhile by someone else is not
   * overwritten (`set_stock` raises SA006).
   */
  private editBaseline: Record<number, number> = {};
  readonly saving = signal(false);
  /**
   * The edit fields take m³ (`m3InputAllowed` products only). The typed m³
   * is turned into the nearest whole pieces right away; stock stays in pieces.
   */
  readonly editInM3 = signal(false);
  /** Stock rows whose typed value was refused on save; shown under the field. */
  readonly invalidStockIds = signal<number[]>([]);
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
    this.invalidStockIds.set([]);
    this.editInM3.set(false);
    this.editBaseline = Object.fromEntries(card.grades.map((g) => [g.stock.id, g.stock.stock]));
    this.editingId.set(card.id);
  }

  wholePieces(card: ProductStockCard): boolean {
    return countsWholePieces(card.product);
  }

  canTypeM3(card: ProductStockCard): boolean {
    return m3InputAllowed(card.product);
  }

  /** Switches the edit fields between pieces and m³; typed values are dropped. */
  setEditInM3(inM3: boolean): void {
    if (inM3 === this.editInM3()) return;
    this.editInM3.set(inM3);
    this.draft.set({});
    this.invalidStockIds.set([]);
  }

  /**
   * Value shown in an m³ edit field: the stock in m³ with a decimal comma
   * (RO/HU read "6.997" as six thousand). `parseM3` reads it back.
   */
  editValue(row: GradeRow): string {
    return row.m3 !== null ? formatM3Input(row.m3) : String(row.stock.stock);
  }

  /**
   * Pieces an m³ field stands for: what was typed, or the stock while the
   * field is untouched; `null` when the typed value is not valid. Wrapped so
   * 0 pieces still shows.
   */
  editPieces(row: GradeRow): { value: number } | null {
    const typed = this.draft()[row.stock.id];
    const value = typed === undefined ? row.stock.stock : typed;
    return Number.isFinite(value) && value >= 0 ? { value } : null;
  }

  /** Reloads products and stock after a failed load. */
  retry(): void {
    this.productStore.fetchProducts();
    this.productStore.fetchStocks();
  }

  /**
   * An emptied field is not a 0: it leaves that grade unchanged. In m³ the
   * draft holds the pieces the m³ converts to (`m3DraftPieces`).
   */
  setDraft(card: ProductStockCard, stockId: number, value: string): void {
    this.invalidStockIds.update((ids) => ids.filter((id) => id !== stockId));
    const pieces =
      this.editInM3() && this.canTypeM3(card)
        ? m3DraftPieces(card.product, value)
        : Number(value);
    this.draft.update((d) => {
      const { [stockId]: _, ...rest } = d;
      return value.trim() === '' ? rest : { ...rest, [stockId]: pieces };
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

  async saveEdit(card: ProductStockCard): Promise<void> {
    if (this.saving()) return;
    const invalid = invalidStockDrafts(card.grades, this.draft(), countsWholePieces(card.product));
    this.invalidStockIds.set(invalid);
    if (invalid.length) return;

    const changes = stockChanges(card.grades, this.draft(), this.editBaseline);
    if (!changes.length) {
      this.editingId.set(null);
      return;
    }

    this.saving.set(true);
    const result = await this.productStore.setStocks(changes);
    this.saving.set(false);

    if (result === 'saved') {
      this.editingId.set(null);
    } else if (result === 'conflict') {
      // the stock is being reloaded: show the new values and start from them
      this.draft.set({});
      this.editBaseline = {};
    }
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
    const withM3 = hasVolume(product);
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

/**
 * Pieces to save for an m³ typed in the stock edit: the nearest whole pieces.
 * NaN (refused on save) when it is not a number, or when a positive m³ rounds
 * to 0 pieces: that would wipe the grade's stock although something was meant.
 */
export function m3DraftPieces(product: Product, text: string): number {
  const m3 = parseM3(text);
  const pieces = piecesFromM3(product, m3);
  return m3 > 0 && pieces === 0 ? NaN : pieces;
}

/**
 * Stock rows whose typed value cannot be saved: not a number, below 0, or a
 * fraction for a product counted in whole pieces (`countsWholePieces`).
 * Untouched (or emptied) fields are not checked.
 */
export function invalidStockDrafts(
  grades: Pick<GradeRow, 'stock'>[],
  draft: Record<number, number>,
  wholePieces: boolean,
): number[] {
  return grades
    .map(({ stock }) => ({ id: stock.id, value: draft[stock.id] }))
    .filter(
      ({ value }) =>
        value !== undefined &&
        (!Number.isFinite(value) || value < 0 || (wholePieces && !Number.isInteger(value))),
    )
    .map(({ id }) => id);
}

/**
 * The grades whose typed value differs from the stock, with the value the
 * edit started from (`baseline`, falling back to the current stock). Empty,
 * negative or non-numeric values leave a grade unchanged.
 */
export function stockChanges(
  grades: Pick<GradeRow, 'stock'>[],
  draft: Record<number, number>,
  baseline: Record<number, number>,
): StockChange[] {
  const changes: StockChange[] = [];
  for (const { stock } of grades) {
    const value = draft[stock.id];
    if (value === undefined || !Number.isFinite(value) || value < 0) continue;
    if (value === stock.stock) continue;
    changes.push({ id: stock.id, expected: baseline[stock.id] ?? stock.stock, stock: value });
  }
  return changes;
}
