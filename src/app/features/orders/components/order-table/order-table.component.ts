import {
  Component,
  DestroyRef,
  effect,
  EventEmitter,
  inject,
  Input,
  OnInit,
  Output,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import { OrderResponse } from '@core/models/models';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  MatTableModule,
} from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { LEAVE_ANIMATION } from '@core/models/animations';
import { useAuthStore } from '@core/store/auth-store';
import { MatChipsModule } from '@angular/material/chips';
import {
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
} from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { provideNativeDateAdapter } from '@angular/material/core';
import { TranslateModule } from '@ngx-translate/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatMenuModule } from '@angular/material/menu';
import {
  CdkDragDrop,
  CdkDropList,
  CdkDrag,
} from '@angular/cdk/drag-drop';
import { ClientStore } from '@features/clients/store/client.store';
import { OrderStore } from '@features/orders/store/order/order.store';
import { DecimalInputDirective } from '@shared/directives/decimal-input.directive';

@Component({
  selector: 'app-order-table',
  imports: [
    DecimalInputDirective,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    CommonModule,
    MatChipsModule,
    FormsModule,
    MatFormFieldModule,
    MatDatepickerModule,
    ReactiveFormsModule,
    TranslateModule,
    MatDialogModule,
    MatTooltipModule,
    MatInputModule,
    MatSelectModule,
    MatButtonToggleModule,
    MatMenuModule,
    CdkDropList,
    CdkDrag,
  ],
  providers: [provideNativeDateAdapter()],
  templateUrl: './order-table.component.html',
  styleUrl: './order-table.component.scss',
  animations: [LEAVE_ANIMATION],
})
export class OrderTableComponent implements OnInit {
  @ViewChild('confirmDeleteDialog') confirmDeleteDialog!: TemplateRef<any>;
  @ViewChild('paidAmountDialog') paidAmountDialog!: TemplateRef<any>;
  @Output() orderOutput = new EventEmitter<OrderResponse>();
  @Output() isLoading = new EventEmitter<boolean>();
  @Input() justOffers: boolean = false;

  readonly authStore = inject(useAuthStore);
  readonly clientStore = inject(ClientStore);
  readonly store = inject(OrderStore);
  private readonly destroyRef = inject(DestroyRef);
  private _dialog = inject(MatDialog);

  readonly dateRange = new FormGroup({
    start: new FormControl<Date | null>(null),
    end: new FormControl<Date | null>(null),
  });
  searchFilter = new FormControl<string>('');
  paidAmount: number | null = null;
  expandedOrderId: number | null = null;

  displayedColumns: string[] = [
    'CLIENT',
    'DELIVERY_PLACE',
    this.justOffers ? 'OFFER_PLACED' : 'EXPECTED_DELIVERY',
    'QUANTITY',
    'TOTAL_AMOUND_FINAL',
  ];

  constructor() {
    effect(() => this.isLoading.emit(this.store.isBusy()));
  }

  ngOnInit(): void {
    this.store.init(this.justOffers);

    this.dateRange.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((range) => {
        this.store.setDateRange(range.start ?? null, range.end ?? null);
      });

    this.searchFilter.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((search) => this.store.setSearchText(search ?? ''));
  }

  payOrder(
    event: any,
    orderId: number,
    totalAmount: number,
    alreadyPaidAmount: number,
    deliveryFee: number,
  ): void {
    event.stopPropagation();

    this.paidAmount = null;

    const dialogRef = this._dialog.open(this.paidAmountDialog, {
      width: '90%',
      data: { maxAmount: totalAmount + deliveryFee - alreadyPaidAmount },
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (result === true && this.paidAmount) {
          this.store.pay(orderId, this.paidAmount + alreadyPaidAmount);
        }
      });
  }

  trackById(_index: number, order: OrderResponse): number {
    return order.id;
  }

  isExpanded(element: OrderResponse) {
    return this.expandedOrderId === element.id;
  }

  toggle(element: OrderResponse) {
    this.expandedOrderId = this.isExpanded(element) ? null : element.id;
  }

  showOrderDetails(order: OrderResponse): void {
    this.orderOutput.emit(order);
  }

  deleteOrder(order: OrderResponse): void {
    const dialogRef = this._dialog.open(this.confirmDeleteDialog, {
      width: '90%',
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (result === true) {
          this.store.delete(order.id);
        }
      });
  }

  isExpectedDeliveryInFuture(
    expectedDelivery: Date,
    dateOrderDelivered: Date,
  ): boolean {
    if (dateOrderDelivered) {
      return true;
    }

    return Date.now() < Date.parse(expectedDelivery.toString());
  }

  isPercentageVoucher(voucher: string): boolean {
    return voucher.includes('%');
  }

  // Check if drag and drop should be enabled
  isDragDropEnabled(): boolean {
    return (
      this.authStore.role() === 'admin' &&
      this.store.tableSortType() === 'admin'
    );
  }

  // Handle drag and drop event
  drop(event: CdkDragDrop<any>): void {
    if (!this.isDragDropEnabled()) {
      return;
    }

    this.store.reorder(event.previousIndex, event.currentIndex);
  }
}
