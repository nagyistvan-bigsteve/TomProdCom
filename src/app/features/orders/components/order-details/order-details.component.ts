import {
  ChangeDetectorRef,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  EventEmitter,
  inject,
  Input,
  OnInit,
  Output,
  signal,
  TemplateRef,
  ViewChild,
  ChangeDetectionStrategy
} from '@angular/core';
import {
  M2_QUANTITIES,
  M2Quantities,
  OrderItemsResponse,
  OrderResponse,
  Price2,
  Product,
  ProductItems,
} from '@core/models/models';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { MatDividerModule } from '@angular/material/divider';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatCheckboxModule } from '@angular/material/checkbox';
import {
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CartStore } from '@features/orders/store/cart/cart.store';
import { Category, ClientType, Unit_id } from '@core/models/enums';
import { Router } from '@angular/router';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { effectiveUnitPrice, ProductUtil } from '@shared/utils/product.util';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { FilterUtil } from '@shared/utils/filter.util';
import { OrderPdfComponent } from '@features/orders/components/pdf/order-pdf/order-pdf.component';
import { OrderPdfGeneratorUtil } from '@shared/utils/order-pdf-generator.util';
import { ClientStore } from '@features/clients/store/client.store';
import { ProductStore } from '@features/products/store/product.store';
import { computePricesForProduct } from '@features/products/store/product.computed';
import { DecimalInputDirective } from '@shared/directives/decimal-input.directive';
import { OrderDetailsStore } from '@features/orders/store/order-details/order-details.store';
import { itemVolumeM3 } from '@features/orders/store/order-details/order-details.computed';
import {
  buildOrderPriceRows,
  PriceRow,
  PricingContext,
  repriceItems,
  unitPriceFromLine,
} from '@features/orders/store/order-details/order-price-rows';
import { PriceAdjustPanelComponent } from '@features/orders/components/price-adjust-panel/price-adjust-panel.component';

@Component({
  selector: 'app-order-details',
  imports: [
    DecimalInputDirective,
    MatIconModule,
    MatButtonModule,
    CommonModule,
    MatDividerModule,
    TranslateModule,
    MatSnackBarModule,
    MatCheckboxModule,
    MatDialogModule,
    FormsModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatAutocompleteModule,
    OrderPdfComponent,
    MatTooltipModule,
    PriceAdjustPanelComponent,
  ],
  providers: [OrderDetailsStore],
  templateUrl: './order-details.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './order-details.component.scss',
})
export class OrderDetailsComponent implements OnInit {
  @ViewChild('input') input: ElementRef<HTMLInputElement> | null = null;
  @ViewChild('confirmDeliveredDialog')
  confirmDeliveredDialog!: TemplateRef<unknown>;
  @ViewChild('confirmTransformOfferDialog')
  confirmTransformOfferDialog!: TemplateRef<unknown>;
  @ViewChild('confirmTransformExactOfferDialog')
  confirmTransformExactOfferDialog!: TemplateRef<unknown>;
  @ViewChild('editOfferDialog')
  editOfferDialog!: TemplateRef<unknown>;
  @ViewChild('priceDialog')
  priceDialog!: TemplateRef<unknown>;

  @Output() closeDetails = new EventEmitter<void>();

  @Input({ required: true }) orderId!: number;
  @Input() justOffers: boolean = false;

  readonly detailsStore = inject(OrderDetailsStore);

  get order(): OrderResponse | undefined {
    return this.detailsStore.order() ?? undefined;
  }

  get orderItems(): OrderItemsResponse[] {
    return this.detailsStore.items();
  }

  deleteOffer: boolean = false;
  selectedOffer: OrderItemsResponse | null = null;

  selectedCategory: Category = Category.A;
  categoryEnum = Category;
  myControl = new FormControl('');

  selectedProduct: Product | null = null;
  customUnitPrice: number | null = null;
  filteredOptions: Product[] = [];
  selectedProductQuantity: number = 1;
  selectedM2Quantity = signal<M2Quantities>('BRUT');
  selectedProductPrice: Price2[] | undefined;
  enableCategory: { enable: boolean; category: Category }[] = [
    { enable: false, category: Category.A },
    { enable: false, category: Category.AB },
    { enable: false, category: Category.B },
    { enable: false, category: Category.T },
  ];
  isPrinting = signal(false);
  isLoading = signal(false);

  showAddForm = signal(false);
  editingItemId = signal<number | null>(null);
  editingItemQuantity: number = 1;
  editingItemCategory: Category = Category.A;
  editingItemEnabledCategories: { enable: boolean; category: Category }[] = [
    { enable: false, category: Category.A },
    { enable: false, category: Category.AB },
    { enable: false, category: Category.B },
    { enable: false, category: Category.T },
  ];

  orderComment: string = '';
  orderVoucher: string = '';

  // Price dialog: typed prices go into a draft of the line totals, which is
  // saved only on Save; the rows are rebuilt from it when "per product" flips
  priceRows = signal<PriceRow[]>([]);
  pricePerProduct = signal(false);
  isSavingPrices = signal(false);
  private draftItems: OrderItemsResponse[] = [];
  private priceDialogRef: MatDialogRef<unknown> | null = null;

  readonly productNames = computed(() =>
    Object.fromEntries(
      this.detailsStore.items().map((item) => [item.product.id, item.product.name]),
    ),
  );
  readonly hasM2Items = computed(() =>
    this.detailsStore.items().some((item) => item.product.unit_id === Unit_id.M2),
  );

  private readonly cartStore = inject(CartStore);
  readonly catalogStore = inject(ProductStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly productUtil = inject(ProductUtil);
  private readonly router = inject(Router);
  private readonly changeDetection = inject(ChangeDetectorRef);
  private readonly orderPdfGenerator = inject(OrderPdfGeneratorUtil);
  readonly clientStore = inject(ClientStore);
  private filterUtil = inject(FilterUtil);
  private snackBar = inject(MatSnackBar);
  private translateService = inject(TranslateService);
  private _dialog = inject(MatDialog);

  client = computed(
    () => this.clientStore.clientsEntityMap()[this.order?.clientId!],
  );

  isClientPJ = computed(() => this.client()?.type === ClientType.PJ);

  ngOnInit(): void {
    this.detailsStore.load(this.orderId);
  }

  callNumber(phone: string) {
    window.location.href = `tel:${phone}`;
  }

  openInMapsApp(address: string) {
    window.location.href = `geo:0,0?q=${encodeURIComponent(address)}`;
  }

  async print() {
    this.isLoading.set(true);
    this.isPrinting.set(true);
    this.changeDetection.detectChanges();

    this.orderPdfGenerator
      .print(this.orderItems!, this.order!, this.justOffers)
      .then(() => {
        this.isLoading.set(false);
        this.isPrinting.set(false);
        this.changeDetection.detectChanges();
      });
  }

  closeDetailsComponent() {
    this.closeDetails.emit();
  }

  openEditDialog(): void {
    this.orderComment = this.order?.comment ?? '';
    this.orderVoucher = this.order?.voucher ?? '';

    const dialogRef = this._dialog.open(this.editOfferDialog, {
      width: '90%',
      maxHeight: '95vh',
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (result) {
          this.detailsStore.saveCommentAndVoucher(
            this.orderComment,
            this.orderVoucher,
          );
        }
      });
  }

  openPriceDialog(): void {
    this.pricePerProduct.set(false);
    this.draftItems = [...this.orderItems];
    this.priceRows.set(this.buildPriceRows());

    this.priceDialogRef = this._dialog.open(this.priceDialog, {
      width: '90%',
      maxWidth: '640px',
      maxHeight: '95vh',
    });
  }

  togglePricePerProduct(): void {
    this.pricePerProduct.update((v) => !v);
    this.priceRows.set(this.buildPriceRows());
  }

  setDraftPrice(index: number, price: number | null): void {
    if (price === null || isNaN(price)) return;

    const rows = this.priceRows().map((row, i) =>
      i === index ? { ...row, mixed: false, discount: price - row.price } : row,
    );
    // Rows are not rebuilt here, so the field being typed in keeps its value
    this.priceRows.set(rows);

    const newPrices = new Map(
      repriceItems(
        this.draftItems,
        rows,
        [index],
        this.pricingContext(),
        this.linePrice,
      ).map((c) => [c.id, c.price]),
    );
    this.draftItems = this.draftItems.map((item) =>
      newPrices.has(item.id) ? { ...item, price: newPrices.get(item.id)! } : item,
    );
  }

  savePrices(): void {
    const saved = new Map(this.orderItems.map((item) => [item.id, item.price]));
    const changes = this.draftItems
      .filter((item) => saved.get(item.id) !== item.price)
      .map(({ id, price }) => ({ id, price }));

    if (!changes.length) {
      this.priceDialogRef?.close();
      return;
    }

    const dialogRef = this.priceDialogRef;
    this.isSavingPrices.set(true);
    if (dialogRef) dialogRef.disableClose = true;

    this.detailsStore.updatePrices(changes).then((ok) => {
      this.isSavingPrices.set(false);
      if (dialogRef) dialogRef.disableClose = false;
      // On failure the dialog stays open with the typed prices
      if (ok) dialogRef?.close();
    });
  }

  private readonly linePrice = (product: Product, unitPrice: number, quantity: number) =>
    this.productUtil.calculatePrice(product, unitPrice, quantity).price;

  private pricingContext(): PricingContext {
    return {
      productsMap: this.catalogStore.productsEntityMap(),
      prices: this.catalogStore.pricesEntities(),
      isTva: this.client()?.tva ?? false,
    };
  }

  private buildPriceRows(): PriceRow[] {
    return buildOrderPriceRows(
      this.draftItems,
      this.pricingContext(),
      this.pricePerProduct(),
    );
  }

  addOrderItem(): void {
    const product = this.selectedProduct;
    if (!product) return;

    const newUnitPrice = this.customUnitPrice ?? this.findExistingCategories();

    const { price, packsNeeded, extraPiecesNeeded, totalPiecesNeeded } =
      this.productUtil.calculatePrice(
        product,
        newUnitPrice!,
        this.selectedProductQuantity,
        this.selectedM2Quantity(),
      );

    let packsPieces = '';

    if (totalPiecesNeeded) {
      packsPieces =
        packsNeeded || extraPiecesNeeded
          ? (packsNeeded ? packsNeeded + 'p' : '0p') +
            (extraPiecesNeeded ? ' + ' + extraPiecesNeeded + 'b' : '')
          : '';

      this.selectedProductQuantity =
        totalPiecesNeeded * product.m2_brut;
    }

    const existingItem =
      newUnitPrice != null ? this.findMergableItem(product, newUnitPrice) : undefined;

    if (existingItem) {
      // Same product, category and unit price: merge into the existing line
      this.detailsStore.updateItem(existingItem.id, {
        quantity: existingItem.quantity + this.selectedProductQuantity,
        price: existingItem.price + price,
      });
      return;
    }

    this.detailsStore.addItem(
      {
        product_id: product.id,
        quantity: +this.selectedProductQuantity,
        category_id: this.selectedCategory,
        price,
        packs_pieces: packsPieces,
      },
      product,
    );
  }

  private findMergableItem(
    product: Product,
    newUnitPrice: number,
  ): OrderItemsResponse | undefined {
    if (!this.orderItems || product.unit_id === Unit_id.M2) {
      return undefined;
    }
    return this.orderItems.find((item) => {
      if (item.product.id !== product.id) return false;
      if (
        Category[item.category.name as keyof typeof Category] !==
        this.selectedCategory
      )
        return false;

      return Math.abs(unitPriceFromLine(item) - newUnitPrice) < 0.01;
    });
  }

  startEditItem(item: OrderItemsResponse): void {
    this.editingItemId.set(item.id);
    this.editingItemQuantity = item.quantity;
    this.editingItemCategory =
      Category[item.category.name as keyof typeof Category];
    this.showAddForm.set(false);

    const prices = computePricesForProduct(
      item.product.id,
      this.catalogStore.productsEntityMap(),
      this.catalogStore.pricesEntities(),
    );
    const available = prices.map((p) => p.category_id as Category);
    this.editingItemEnabledCategories = this.editingItemEnabledCategories.map(
      (cat) => ({ ...cat, enable: available.includes(cat.category) }),
    );
  }

  cancelEditItem(): void {
    this.editingItemId.set(null);
  }

  saveEditItem(item: OrderItemsResponse): void {
    const newCategory = this.editingItemCategory;
    const newQuantity = this.editingItemQuantity;

    const prices = computePricesForProduct(
      item.product.id,
      this.catalogStore.productsEntityMap(),
      this.catalogStore.pricesEntities(),
    );

    const priceEntry = prices.find((p) => p.category_id === newCategory);
    const isTva = this.client()?.tva ?? false;

    const sameCategory =
      newCategory === Category[item.category.name as keyof typeof Category];

    let unitPrice: number;
    if (sameCategory && item.product.unit_id !== Unit_id.M2) {
      // Only the quantity changed: keep the line's unit price, which may
      // have been set by hand (price dialog, custom price)
      unitPrice = unitPriceFromLine(item);
    } else if (priceEntry) {
      unitPrice = effectiveUnitPrice(
        priceEntry.price,
        { unit_id: priceEntry.unit_id, thickness: item.product.thickness },
        newCategory,
        isTva,
      );
    } else {
      unitPrice = unitPriceFromLine(item);
    }

    const fullProduct =
      this.catalogStore.productsEntityMap()[item.product.id] ??
      (item.product as any);
    const { price } = this.productUtil.calculatePrice(
      fullProduct,
      unitPrice,
      newQuantity,
      item.product.unit_id === Unit_id.M2 ? 'BRUT' : undefined,
    );

    this.detailsStore
      .updateItem(item.id, { category_id: newCategory, quantity: newQuantity, price })
      .then((saved) => {
        if (saved) this.editingItemId.set(null);
      });
  }

  deleteOrderItem(item: OrderItemsResponse): void {
    this.detailsStore.deleteItem(item.id);
  }

  optionSelected(product: Product): void {
    this.selectedProduct = product;
    this.selectedM2Quantity.set('BRUT');
    this.customUnitPrice = null;
    this.catalogStore.setSelectedProduct(product.id);
    this.selectedProductPrice = this.catalogStore.pricesForSelectedProduct();
    this.findExistingCategories();

    const currentIsValid = this.enableCategory.some(
      (c) => c.category === this.selectedCategory && c.enable,
    );
    if (!currentIsValid) {
      const first = this.enableCategory.find((c) => c.enable);
      if (first) this.selectedCategory = first.category;
    }
  }

  m2SetUnit(): void {
    this.selectedM2Quantity.update((current) => {
      const index = M2_QUANTITIES.indexOf(current);
      return M2_QUANTITIES[(index + 1) % M2_QUANTITIES.length];
    });
  }

  findExistingCategories(): undefined | number {
    const isTva: boolean = this.client() ? this.client().tva : false;

    if (!this.selectedProductPrice || !this.selectedProductPrice!.length) {
      return;
    }

    const available = this.catalogStore.availableCategoriesForSelectedProduct();
    this.enableCategory.forEach((cat) => {
      cat.enable = available.includes(cat.category);
    });

    const price = this.selectedProductPrice!.find(
      (price) => price.category_id === this.selectedCategory,
    );

    if (price) {
      const unitPrice = effectiveUnitPrice(
        price.price,
        { unit_id: price.unit_id, thickness: this.selectedProduct?.thickness ?? 0 },
        this.selectedCategory,
        isTva,
      );
      return unitPrice || undefined;
    }
    return undefined;
  }

  filter(): void {
    this.filteredOptions = this.filterUtil.productFilter(
      this.input,
      this.catalogStore.productsEntities(),
    );
  }

  displayProductLabel(product: Product): string {
    return product ? product.name : '';
  }

  updateItemStatus(id: number, status: boolean, _index: number) {
    this.detailsStore.setItemStatus(id, status);
  }

  transformExactOfferToOrder(order: OrderResponse): void {
    const dialogRef = this._dialog.open(this.confirmTransformExactOfferDialog, {
      width: '90%',
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (result === true) {
          this.detailsStore.transformToOrder().then((transformed) => {
            if (transformed) this.router.navigate(['orders']);
          });
        }
      });
  }

  transformOfferToOrder(order: OrderResponse): void {
    const dialogRef = this._dialog.open(this.confirmTransformOfferDialog, {
      width: '90%',
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (result === true) {
          const entityMap = this.catalogStore.productsEntityMap();
          const productItems: ProductItems = this.orderItems.map((item) => ({
            product: entityMap[item.product.id]!,
            quantity: item.quantity,
            price: item.price,
            category: Category[item.category.name as keyof typeof Category],
            manualPrice: true,
          }));
          this.clientStore.setClientId(
            this.clientStore.clientsEntityMap()[order.clientId].id,
          );
          this.cartStore.setProductItems(productItems);
          this.cartStore.setPricingClientId(order.clientId);
          if (this.deleteOffer) {
            this.detailsStore.moveToDeleted();
          }
          this.router.navigate(['offer/overview']);
        }
      });
  }

  confirmDelivered(id: number): void {
    const dialogRef = this._dialog.open(this.confirmDeliveredDialog, {
      width: '90%',
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (result === true) {
          this.orderIsDelivered(id);
        }
      });
  }

  orderIsDelivered(_id: number) {
    this.detailsStore.markDelivered().then((status) => {
      if (status) {
        this.translateService
          .get(['SNACKBAR.ORDER.UPDATE_SUCCESS', 'SNACKBAR.BUTTONS.CLOSE'])
          .subscribe((translations) => {
            this.snackBar.open(
              translations['SNACKBAR.ORDER.UPDATE_SUCCESS'],
              translations['SNACKBAR.BUTTONS.CLOSE'],
              { duration: 3000 },
            );
          });
        this.closeDetails.emit();
      }
    });
  }

  isPercentageVoucher(voucher: string): boolean {
    return voucher.includes('%');
  }

  getCategoryId(name: string): number {
    return Category[name as keyof typeof Category];
  }

  getTotalMQ(item: OrderItemsResponse): number {
    return itemVolumeM3(item);
  }
}
