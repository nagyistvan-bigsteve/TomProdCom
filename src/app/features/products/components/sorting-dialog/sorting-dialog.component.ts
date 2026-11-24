import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslateModule } from '@ngx-translate/core';
import { MatSelectModule } from '@angular/material/select';
import { Category } from '@core/models/enums';
import { Product, TruckWithRemaining } from '@core/models/models';
import { ProductStore } from '@features/products/store/product.store';
import { SortingsService } from '@features/products/services/sortings.service';
import { NotificationService } from '@shared/utils/notification.service';
import {
  availableStock,
  bookedAbShortfall,
  sortingLimit,
  sortingTotal,
  validateSorting,
} from '@shared/utils/stock.util';
import { AppDatePipe } from '@shared/pipes/app-date.pipe';

export interface SortingDialogData {
  product: Product;
  /** The validated truck the pieces came from, if sorted from its page. */
  shipmentId?: number | null;
  /** Pieces of the product still unsorted on that truck (received − sorted). */
  truckRemaining?: number | null;
}

/**
 * Records a sorting at the ramp: AB pieces become A, B or waste.
 * Closes with `true` after a successful save.
 */
@Component({
  selector: 'app-sorting-dialog',
  imports: [
    AppDatePipe,
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    TranslateModule,
  ],
  templateUrl: './sorting-dialog.component.html',
  styleUrl: './sorting-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SortingDialogComponent {
  readonly data = inject<SortingDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<SortingDialogComponent>);
  private readonly productStore = inject(ProductStore);
  private readonly sortingsService = inject(SortingsService);
  private readonly notify = inject(NotificationService);

  /** Typed quantities; `null` = empty field, counted as 0. */
  readonly a = signal<number | null>(null);
  readonly b = signal<number | null>(null);
  readonly waste = signal<number | null>(null);
  readonly comment = signal('');
  readonly saving = signal(false);

  /** Opened from the products page: the user may pick the truck the pieces came from. */
  readonly canPickTruck = this.data.shipmentId == null;
  readonly trucks = signal<TruckWithRemaining[]>([]);
  readonly trucksLoaded = signal(false);
  readonly pickedTruckId = signal<number | null>(null);

  private readonly abRow = computed(
    () => this.productStore.stocksByProduct()[this.data.product.id]?.[Category.AB],
  );

  readonly abStock = computed(() => this.abRow()?.stock ?? 0);

  /** The truck the sorting counts against, if any. */
  readonly shipmentId = computed(() => this.data.shipmentId ?? this.pickedTruckId());

  /** Pieces of the product left on that truck, or null when not sorting from a truck. */
  readonly truckRemaining = computed<number | null>(() => {
    if (this.data.shipmentId != null) return this.data.truckRemaining ?? null;
    const picked = this.trucks().find((t) => t.id === this.pickedTruckId());
    return picked ? picked.remaining : null;
  });

  readonly fromTruck = computed(() => this.truckRemaining() !== null);

  /** The number shown at the top and counted down: truck remainder or AB stock. */
  readonly available = computed(() => this.truckRemaining() ?? this.abStock());

  private readonly input = computed(() => ({
    a: this.a() ?? 0,
    b: this.b() ?? 0,
    waste: this.waste() ?? 0,
  }));

  readonly total = computed(() => sortingTotal(this.input()));

  readonly remaining = computed(() => this.available() - this.total());

  /** AB pieces ordered by customers that this sorting takes away (allowed, but warned). */
  readonly bookedTaken = computed(() => bookedAbShortfall(this.abRow(), this.total()));

  /** AB free after the sorting (negative when it takes booked pieces). */
  readonly abFreeAfter = computed(() => availableStock(this.abRow()) - this.total());

  readonly error = computed(() =>
    validateSorting(this.abStock(), this.input(), this.truckRemaining()),
  );

  constructor() {
    if (this.canPickTruck) this.loadTrucks();
  }

  /** Input value as a number; an emptied field is `null` (counted as 0). */
  toQty(value: string | number | null): number | null {
    if (value === null || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  /** Selects the field's content on focus, so typing replaces it. */
  selectAll(event: FocusEvent): void {
    (event.target as HTMLInputElement | null)?.select();
  }

  /** Puts all remaining pieces into A (the usual case: most of a bale is A). */
  restToA(): void {
    const limit = sortingLimit(this.abStock(), this.truckRemaining());
    const { b, waste } = this.input();
    this.a.set(Math.max(0, limit - b - waste));
  }

  async save(): Promise<void> {
    if (this.error() || this.saving()) return;

    this.saving.set(true);
    // a backdrop click or Esc must not close the dialog while saving: the
    // truck page reloads its sortings when the dialog closes
    this.dialogRef.disableClose = true;
    const { a, b, waste } = this.input();
    const ok = await this.sortingsService.recordSorting({
      productId: this.data.product.id,
      a,
      b,
      waste,
      shipmentId: this.shipmentId() ?? null,
      comment: this.comment().trim(),
    });
    this.saving.set(false);
    this.dialogRef.disableClose = false;

    // reload either way: on failure the AB count may simply be out of date
    this.productStore.fetchStocks();

    if (ok) {
      this.notify.success('SORTING.SUCCESS');
      this.dialogRef.close(true);
    }
  }

  cancel(): void {
    if (this.saving()) return;
    this.dialogRef.close(false);
  }

  private async loadTrucks(): Promise<void> {
    const trucks = await this.sortingsService.trucksWithRemaining(this.data.product.id);
    this.trucks.set(trucks ?? []);
    this.trucksLoaded.set(true);
  }
}
