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
import { Category } from '@core/models/enums';
import { Product } from '@core/models/models';
import { ProductStore } from '@features/products/store/product.store';
import { SortingsService } from '@features/products/services/sortings.service';
import { NotificationService } from '@shared/utils/notification.service';
import { sortingLimit, sortingTotal, validateSorting } from '@shared/utils/stock.util';

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
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
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

  readonly a = signal(0);
  readonly b = signal(0);
  readonly waste = signal(0);
  readonly comment = signal('');
  readonly saving = signal(false);

  readonly abStock = computed(
    () =>
      this.productStore.stocksByProduct()[this.data.product.id]?.[Category.AB]
        ?.stock ?? 0,
  );

  /** Set when sorting from a truck: the dialog then counts against that truck, not all AB. */
  readonly truckRemaining: number | null =
    this.data.shipmentId != null && this.data.truckRemaining != null
      ? this.data.truckRemaining
      : null;

  readonly fromTruck = this.truckRemaining !== null;

  /** The number shown at the top and counted down: truck remainder or AB stock. */
  readonly available = computed(() => this.truckRemaining ?? this.abStock());

  readonly total = computed(() =>
    sortingTotal({ a: this.a(), b: this.b(), waste: this.waste() }),
  );

  readonly remaining = computed(() => this.available() - this.total());

  readonly error = computed(() =>
    validateSorting(
      this.abStock(),
      { a: this.a(), b: this.b(), waste: this.waste() },
      this.truckRemaining,
    ),
  );

  /** Input value as a number; an emptied field counts as 0. */
  toNumber(value: string | number | null): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  /** Puts all remaining pieces into A (the usual case: most of a bale is A). */
  restToA(): void {
    const limit = sortingLimit(this.abStock(), this.truckRemaining);
    this.a.set(Math.max(0, limit - this.b() - this.waste()));
  }

  async save(): Promise<void> {
    if (this.error() || this.saving()) return;

    this.saving.set(true);
    const ok = await this.sortingsService.recordSorting({
      productId: this.data.product.id,
      a: this.a(),
      b: this.b(),
      waste: this.waste(),
      shipmentId: this.data.shipmentId ?? null,
      comment: this.comment().trim(),
    });
    this.saving.set(false);

    // reload either way: on failure the AB count may simply be out of date
    this.productStore.fetchStocks();

    if (ok) {
      this.notify.success('SORTING.SUCCESS');
      this.dialogRef.close(true);
    }
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
