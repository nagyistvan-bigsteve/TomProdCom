import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule } from '@ngx-translate/core';
import { Unit_id } from '@core/models/enums';
import { Product, StockSorting } from '@core/models/models';
import { ConfirmDeleteDialogComponent } from '@shared/components/dialogs/confirm-delete-dialog.component';
import { FilterUtil } from '@shared/utils/filter.util';
import { NotificationService } from '@shared/utils/notification.service';
import { isGradable, shipmentTotalM3 } from '@shared/utils/stock.util';
import { ProductStore } from '@features/products/store/product.store';
import {
  SortingDialogComponent,
  SortingDialogData,
} from '@features/products/components/sorting-dialog/sorting-dialog.component';
import { ShipmentStore } from '@features/shipments/store/shipment.store';
import {
  DraftLine,
  invalidLines,
  shipmentProgress,
  toShipmentItems,
  withTrailingEmptyLine,
} from '@features/shipments/shipment.util';

const MAX_OPTIONS = 30;

/** Local date as YYYY-MM-DD (toISOString would give the UTC date after midnight). */
function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

@Component({
  selector: 'app-shipment-detail',
  imports: [
    CommonModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    TranslateModule,
  ],
  templateUrl: './shipment-detail.component.html',
  styleUrl: './shipment-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShipmentDetailComponent {
  /** Route parameter: a shipment id, or `new`. */
  readonly id = input.required<string>();

  readonly store = inject(ShipmentStore);
  readonly productStore = inject(ProductStore);
  private readonly filterUtil = inject(FilterUtil);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly notify = inject(NotificationService);

  private lineKey = 0;
  private filledFor: unknown = null;
  private readonly nextKey = () => ++this.lineKey;

  readonly shipmentId = computed(() => {
    const n = Number(this.id());
    return Number.isInteger(n) && n > 0 ? n : null;
  });

  readonly isNew = computed(() => this.shipmentId() === null);

  /** Loaded shipment, only once it is the one in the URL. */
  readonly shipment = computed(() => {
    const current = this.store.current();
    return current && current.id === this.shipmentId() ? current : null;
  });

  readonly isDraft = computed(() => this.isNew() || this.shipment()?.status === 'draft');

  // draft form
  readonly arrivedOn = signal(today());
  readonly name = signal('');
  readonly comment = signal('');
  readonly lines = signal<DraftLine[]>(withTrailingEmptyLine([], this.nextKey));
  readonly query = signal<{ key: number; text: string } | null>(null);

  private readonly gradeableProducts = computed(() =>
    this.productStore.productsEntities().filter((p) => p.unit_id !== Unit_id.M2),
  );

  readonly options = computed(() => {
    const q = this.query();
    if (!q) return [];
    return this.filterUtil.productFilter(q.text, this.gradeableProducts()).slice(0, MAX_OPTIONS);
  });

  readonly draftItems = computed(() => toShipmentItems(this.lines()));

  readonly draftM3 = computed(() =>
    shipmentTotalM3(this.draftItems(), this.productStore.productsEntityMap()),
  );

  readonly draftPieces = computed(() => this.draftItems().reduce((s, i) => s + i.quantity, 0));

  readonly canSave = computed(
    () =>
      this.name().trim().length > 0 &&
      !!this.arrivedOn() &&
      this.draftItems().length > 0 &&
      invalidLines(this.lines()).length === 0,
  );

  // validated view
  readonly progress = computed(() => {
    const shipment = this.shipment();
    if (!shipment) return [];
    const products = this.productStore.productsEntityMap();
    return shipmentProgress(shipment.shipment_items, this.store.sortings()).map((line) => {
      const product = products[line.product_id];
      return { ...line, product, gradable: !!product && isGradable(product) };
    });
  });

  readonly shipmentM3 = computed(() => {
    const shipment = this.shipment();
    return shipment
      ? shipmentTotalM3(shipment.shipment_items, this.productStore.productsEntityMap())
      : 0;
  });

  constructor() {
    effect(() => {
      const id = this.shipmentId();
      untracked(() => {
        if (id === null) {
          this.store.clearCurrent();
        } else {
          this.store.loadShipment(id);
          this.store.loadSortings(id);
        }
      });
    });

    // fill the form once per loaded draft; later product reloads must not
    // overwrite what the user is typing
    effect(() => {
      const shipment = this.shipment();
      if (!shipment || shipment.status !== 'draft' || this.filledFor === shipment) return;
      // wait for the products, or the lines would lose them on a direct page load
      if (shipment.shipment_items.length && !this.productStore.productsEntities().length) return;
      this.filledFor = shipment;
      untracked(() => {
        const products = this.productStore.productsEntityMap();
        this.arrivedOn.set(shipment.arrived_on);
        this.name.set(shipment.name);
        this.comment.set(shipment.comment ?? '');
        this.lines.set(
          withTrailingEmptyLine(
            shipment.shipment_items.map((i) => ({
              key: this.nextKey(),
              product: products[i.product_id] ?? null,
              quantity: i.quantity,
            })),
            this.nextKey,
          ),
        );
      });
    });
  }

  productName(product: Product | null | undefined): string {
    return product?.name ?? '';
  }

  setQuery(key: number, text: string): void {
    this.query.set({ key, text });
  }

  selectProduct(key: number, product: Product): void {
    this.updateLine(key, { product, quantity: this.lineOf(key)?.quantity || 1 });
    this.query.set(null);
  }

  clearProduct(key: number): void {
    this.updateLine(key, { product: null });
  }

  setQuantity(key: number, value: string): void {
    this.updateLine(key, { quantity: Number(value) });
  }

  removeLine(key: number): void {
    this.lines.update((lines) =>
      withTrailingEmptyLine(lines.filter((l) => l.key !== key), this.nextKey),
    );
  }

  isLineInvalid(line: DraftLine): boolean {
    return !!line.product && !(line.quantity > 0 && Number.isInteger(line.quantity));
  }

  async saveDraft(): Promise<number | null> {
    if (!this.canSave()) {
      this.notify.error('SHIPMENTS.FORM_INVALID');
      return null;
    }
    const id = await this.store.save(
      {
        ...(this.shipmentId() ? { id: this.shipmentId()! } : {}),
        arrived_on: this.arrivedOn(),
        name: this.name().trim(),
        comment: this.comment().trim(),
      },
      this.draftItems(),
    );
    if (id !== null && this.isNew()) {
      await this.router.navigate(['/shipments', id], { replaceUrl: true });
    }
    return id;
  }

  async validate(): Promise<void> {
    if (!this.canSave()) {
      this.notify.error('SHIPMENTS.FORM_INVALID');
      return;
    }
    const confirmed = await this.confirm('SHIPMENTS.VALIDATE', 'SHIPMENTS.VALIDATE_CONFIRM', false);
    if (!confirmed) return;

    // validate exactly what is on screen
    const id = await this.saveDraft();
    if (id !== null) await this.store.validate(id);
  }

  async deleteDraft(): Promise<void> {
    const id = this.shipmentId();
    if (id === null) {
      this.router.navigate(['/shipments']);
      return;
    }
    const confirmed = await this.confirm('SHIPMENTS.DELETE', 'SHIPMENTS.DELETE_CONFIRM', true);
    if (confirmed && (await this.store.remove(id))) {
      this.router.navigate(['/shipments']);
    }
  }

  openSorting(product: Product, truckRemaining: number): void {
    const shipmentId = this.shipmentId();
    this.dialog
      .open<SortingDialogComponent, SortingDialogData, boolean>(SortingDialogComponent, {
        data: { product, shipmentId, truckRemaining },
        width: '420px',
        maxWidth: '95vw',
      })
      .afterClosed()
      .subscribe((saved) => {
        if (saved && shipmentId !== null) this.store.loadSortings(shipmentId);
      });
  }

  async undoSorting(sorting: StockSorting): Promise<void> {
    const shipmentId = this.shipmentId();
    if (shipmentId === null) return;
    const confirmed = await this.confirm('SORTING.UNDO', 'SORTING.UNDO_CONFIRM', false);
    if (confirmed) await this.store.undoSorting(sorting.id, shipmentId);
  }

  private lineOf(key: number): DraftLine | undefined {
    return this.lines().find((l) => l.key === key);
  }

  private updateLine(key: number, changes: Partial<DraftLine>): void {
    this.lines.update((lines) =>
      withTrailingEmptyLine(
        lines.map((l) => (l.key === key ? { ...l, ...changes } : l)),
        this.nextKey,
      ),
    );
  }

  private confirm(title: string, message: string, isDangerous: boolean): Promise<boolean> {
    return firstValueFrom(
      this.dialog
        .open(ConfirmDeleteDialogComponent, { data: { title, message, isDangerous } })
        .afterClosed(),
    ).then((result) => result === true);
  }
}
