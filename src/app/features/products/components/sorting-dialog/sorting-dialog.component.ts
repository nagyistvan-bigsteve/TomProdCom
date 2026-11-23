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
import { sortingTotal, validateSorting } from '@shared/utils/stock.util';

export interface SortingDialogData {
  product: Product;
  /** The validated truck the pieces came from, if sorted from its page. */
  shipmentId?: number | null;
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

  readonly total = computed(() =>
    sortingTotal({ a: this.a(), b: this.b(), waste: this.waste() }),
  );

  readonly remainingAb = computed(() => this.abStock() - this.total());

  readonly error = computed(() =>
    validateSorting(this.abStock(), {
      a: this.a(),
      b: this.b(),
      waste: this.waste(),
    }),
  );

  /** Input value as a number; an emptied field counts as 0. */
  toNumber(value: string | number | null): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  /** Puts all remaining AB pieces into A (the usual case: most of a bale is A). */
  restToA(): void {
    this.a.set(Math.max(0, this.abStock() - this.b() - this.waste()));
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
