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
import { Product, ShipmentWithItems, StockSorting } from '@core/models/models';
import { ConfirmDeleteDialogComponent } from '@shared/components/dialogs/confirm-delete-dialog.component';
import { ConfirmRestoreDialogComponent } from '@shared/components/dialogs/confirm-restore-dialog.component';
import { FilterUtil } from '@shared/utils/filter.util';
import { NotificationService } from '@shared/utils/notification.service';
import { pieceVolumeM3 } from '@shared/utils/product.util';
import {
  formatM3Input,
  isGradable,
  m3InputAllowed,
  parseM3,
  piecesFromM3,
  shipmentTotalM3,
} from '@shared/utils/stock.util';
import { ProductStore } from '@features/products/store/product.store';
import {
  SortingDialogComponent,
  SortingDialogData,
} from '@features/products/components/sorting-dialog/sorting-dialog.component';
import { ShipmentStore } from '@features/shipments/store/shipment.store';
import {
  DraftHeader,
  DraftLine,
  draftFingerprint,
  missingForSave,
  parseDraftBackup,
  shipmentProgress,
  toDraftBackup,
  toShipmentItems,
  withTrailingEmptyLine,
} from '@features/shipments/shipment.util';
import { AppDatePipe } from '@shared/pipes/app-date.pipe';

const MAX_OPTIONS = 30;

/** localStorage key of the unsaved new truck (per device, survives a reload). */
const BACKUP_KEY = 'shipment_draft_new';

function readBackup(): string | null {
  try {
    return localStorage.getItem(BACKUP_KEY);
  } catch {
    return null;
  }
}

function writeBackup(value: object | null): void {
  try {
    if (value === null) localStorage.removeItem(BACKUP_KEY);
    else localStorage.setItem(BACKUP_KEY, JSON.stringify(value));
  } catch {
    // storage blocked (private mode): the backup is only a convenience
  }
}

/** Local date as YYYY-MM-DD (toISOString would give the UTC date after midnight). */
function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

@Component({
  selector: 'app-shipment-detail',
  imports: [
    AppDatePipe,
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
  /** The loaded draft the form was last filled from. */
  private filledFor: ShipmentWithItems | null = null;
  /**
   * The user chose to load the other person's version after a conflict: fill
   * the form from the next loaded draft even though it holds unsaved edits.
   */
  private readonly takeTheirs = signal(false);
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
  /**
   * Lines typed in m³, by line key, with the text as typed. The line itself
   * keeps the pieces it converts to (`piecesFromM3`), so saving, the
   * fingerprint and the backup only ever see pieces.
   */
  readonly m3Text = signal<Record<number, string>>({});

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

  private readonly header = computed<DraftHeader>(() => ({
    arrivedOn: this.arrivedOn(),
    name: this.name(),
    comment: this.comment(),
  }));

  /** What stops a save, shown under the form instead of a silently disabled button. */
  readonly missing = computed(() => missingForSave(this.header(), this.lines()));

  readonly canSave = computed(() => this.missing().length === 0);

  /** Fingerprint of the form as last loaded or saved; differing = unsaved changes. */
  private readonly baseline = signal(draftFingerprint(this.header(), this.lines()));

  readonly dirty = computed(
    () => this.isDraft() && draftFingerprint(this.header(), this.lines()) !== this.baseline(),
  );

  /** Set once leaving is decided (deleted, confirmed): the guard then lets it go. */
  private leaving = false;
  /** New truck: the restore offer has been made; only then may the backup be overwritten. */
  private readonly backupChecked = signal(false);

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

    // fill the form from each loaded draft; later product reloads must not
    // overwrite what the user is typing
    effect(() => {
      const shipment = this.shipment();
      const takeTheirs = this.takeTheirs();
      if (!shipment || shipment.status !== 'draft' || this.filledFor === shipment) return;
      // wait for the products, or the lines would lose them on a direct page load
      if (shipment.shipment_items.length && !this.productStore.productsEntities().length) return;
      // a reload of the same draft (e.g. after someone else saved it) never
      // replaces unsaved edits, unless the user chose to load that version
      const reload = this.filledFor?.id === shipment.id;
      if (reload && untracked(this.dirty) && !takeTheirs) return;
      this.filledFor = shipment;
      untracked(() => {
        this.takeTheirs.set(false);
        this.fillForm(
          { arrivedOn: shipment.arrived_on, name: shipment.name, comment: shipment.comment ?? '' },
          shipment.shipment_items,
        );
        this.baseline.set(draftFingerprint(this.header(), this.lines()));
      });
    });

    // a new truck: offer to restore one typed before a reload (once products are there)
    effect(() => {
      if (this.backupChecked() || !this.isNew() || !this.productStore.productsEntities().length) return;
      untracked(() => this.offerBackupRestore());
    });

    // a new truck: keep what is typed in localStorage until it is saved; not
    // before the restore offer, or typing early would overwrite the old backup
    effect(() => {
      if (!this.isNew() || !this.backupChecked()) return;
      if (this.dirty()) {
        writeBackup(toDraftBackup(this.header(), this.lines(), new Date()));
      } else {
        writeBackup(null);
      }
    });
  }

  /** Asked by `unsavedDraftGuard` before leaving the page. */
  async confirmLeave(): Promise<boolean> {
    if (this.leaving || !this.dirty()) return true;
    const confirmed = await this.confirm('SHIPMENTS.LEAVE', 'SHIPMENTS.LEAVE_CONFIRM', true);
    if (confirmed) {
      this.leaving = true;
      if (this.isNew()) writeBackup(null);
    }
    return confirmed;
  }

  selectAll(event: FocusEvent): void {
    (event.target as HTMLInputElement | null)?.select();
  }

  /** Reloads the sortings after a failed load. */
  retrySortings(): void {
    const id = this.shipmentId();
    if (id !== null) this.store.loadSortings(id);
  }

  private fillForm(header: DraftHeader, items: { product_id: number; quantity: number }[]): void {
    const products = this.productStore.productsEntityMap();
    this.arrivedOn.set(header.arrivedOn);
    this.name.set(header.name);
    this.comment.set(header.comment);
    this.m3Text.set({});
    this.lines.set(
      withTrailingEmptyLine(
        items.map((i) => ({
          key: this.nextKey(),
          product: products[i.product_id] ?? null,
          quantity: i.quantity,
        })),
        this.nextKey,
      ),
    );
  }

  private async offerBackupRestore(): Promise<void> {
    const backup = parseDraftBackup(readBackup());
    if (!backup) {
      this.backupChecked.set(true);
      return;
    }
    const keep = await firstValueFrom(
      this.dialog
        .open(ConfirmRestoreDialogComponent, { data: { lastUpdated: new Date(backup.savedAt) } })
        .afterClosed(),
    );
    if (keep === true) {
      this.fillForm(backup, backup.lines);
    } else {
      writeBackup(null);
    }
    this.backupChecked.set(true);
  }

  /**
   * Someone else saved the draft meanwhile (SA007). The store is already
   * loading their version; the user decides whether it replaces the form.
   * Keeping their own edits means the next save (with the new version)
   * replaces the other person's changes.
   */
  private async resolveConflict(): Promise<void> {
    const loadTheirs = await this.confirm('SHIPMENTS.CONFLICT', 'SHIPMENTS.CONFLICT_CONFIRM', true);
    if (loadTheirs) this.takeTheirs.set(true);
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
    this.dropM3(key);
    this.updateLine(key, { product: null });
  }

  setQuantity(key: number, value: string): void {
    this.updateLine(key, { quantity: Number(value) });
  }

  /** The line's product can be typed in m³ (M3 / bundle counted in pieces). */
  canTypeM3(line: DraftLine): boolean {
    return !!line.product && m3InputAllowed(line.product);
  }

  isM3(line: DraftLine): boolean {
    return line.key in this.m3Text();
  }

  /**
   * Switches the line between pieces and m³. m³ starts from the current
   * pieces when they are valid, otherwise empty (and 0 pieces), so the text
   * and the pieces always agree.
   */
  toggleM3(line: DraftLine): void {
    if (this.isM3(line)) {
      this.dropM3(line.key);
      return;
    }
    const valid = line.quantity > 0 && Number.isInteger(line.quantity);
    const text = valid ? formatM3Input(this.lineM3(line)) : '';
    if (!valid) this.updateLine(line.key, { quantity: 0 });
    this.m3Text.update((t) => ({ ...t, [line.key]: text }));
  }

  /** m³ typed: the line gets the nearest whole number of pieces; empty = 0. */
  setM3(key: number, value: string): void {
    this.m3Text.update((t) => ({ ...t, [key]: value }));
    const product = this.lineOf(key)?.product;
    if (!product) return;
    const quantity = value.trim() === '' ? 0 : piecesFromM3(product, parseM3(value));
    this.updateLine(key, { quantity });
  }

  /** Volume of the line's pieces, as saved. */
  lineM3(line: DraftLine): number {
    return line.product ? pieceVolumeM3(line.product) * (line.quantity || 0) : 0;
  }

  private dropM3(key: number): void {
    this.m3Text.update(({ [key]: _, ...rest }) => rest);
  }

  removeLine(key: number): void {
    this.dropM3(key);
    this.lines.update((lines) =>
      withTrailingEmptyLine(lines.filter((l) => l.key !== key), this.nextKey),
    );
  }

  isLineInvalid(line: DraftLine): boolean {
    return !!line.product && !(line.quantity > 0 && Number.isInteger(line.quantity));
  }

  async saveDraft(options: { quiet?: boolean } = {}): Promise<number | null> {
    if (!this.canSave()) {
      this.notify.error('SHIPMENTS.FORM_INVALID');
      return null;
    }
    const wasNew = this.isNew();
    const outcome = await this.store.save(
      {
        ...(this.shipmentId() ? { id: this.shipmentId()! } : {}),
        ...(this.shipment()?.updated_at ? { updated_at: this.shipment()!.updated_at } : {}),
        arrived_on: this.arrivedOn(),
        name: this.name().trim(),
        comment: this.comment().trim(),
      },
      this.draftItems(),
      options,
    );
    if (!('id' in outcome)) {
      if (outcome.failed === 'conflict') await this.resolveConflict();
      return null;
    }

    // saved: the form now matches the database
    this.baseline.set(draftFingerprint(this.header(), this.lines()));
    if (wasNew) {
      writeBackup(null);
      await this.router.navigate(['/shipments', outcome.id], { replaceUrl: true });
    }
    return outcome.id;
  }

  async validate(): Promise<void> {
    if (!this.canSave()) {
      this.notify.error('SHIPMENTS.FORM_INVALID');
      return;
    }
    const confirmed = await this.confirm('SHIPMENTS.VALIDATE', 'SHIPMENTS.VALIDATE_CONFIRM', false);
    if (!confirmed) return;

    // validate exactly what is on screen; one message ("validated") instead of two
    const id = await this.saveDraft({ quiet: true });
    if (id !== null) await this.store.validate(id);
  }

  /** New truck: back to the list (the guard asks if something was typed). Draft: delete it. */
  async deleteDraft(): Promise<void> {
    const id = this.shipmentId();
    if (id === null) {
      this.router.navigate(['/shipments']);
      return;
    }
    const confirmed = await this.confirm('SHIPMENTS.DELETE', 'SHIPMENTS.DELETE_CONFIRM', true);
    if (confirmed && (await this.store.remove(id))) {
      this.leaving = true;
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
      // reload on every close: the remaining numbers must never stay stale
      .subscribe(() => {
        if (shipmentId !== null) this.store.loadSortings(shipmentId);
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
