import {
  Component,
  DestroyRef,
  EventEmitter,
  inject,
  Input,
  OnInit,
  Output,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import { OrdersService } from '../../../services/query-services/orders.service';
import { OrderResponse } from '../../../models/models';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { LEAVE_ANIMATION } from '../../../models/animations';
import { useAuthStore } from '../../../services/store/auth-store';
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

@Component({
  selector: 'app-order-table',
  imports: [
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
  @Input() justOffers: boolean = false;

  public readonly authStore = inject(useAuthStore);
  private readonly destroyRef = inject(DestroyRef);
  private _dialog = inject(MatDialog);
  private ordersService = inject(OrdersService);
  readonly dateRange = new FormGroup({
    start: new FormControl<Date | null>(null),
    end: new FormControl<Date | null>(null),
  });

  orders: OrderResponse[] = [];
  dataSource = new MatTableDataSource<OrderResponse>([]);
  paidAmount: number | null = null;

  columnsToDisplay: { name: string; value: string }[] = [];
  columnsToDisplayStrings: string[] = [];
  tableFilter: 'all' | 'open' | 'closed' | 'expectedToday' = 'open';
  expandedElement: OrderResponse | null = null;

  displayedOrdersStat: {
    numberOfOrders: number;
    totalPrice: number;
  } = { numberOfOrders: 0, totalPrice: 0 };

  ngOnInit(): void {
    this.setTable();
    this.fetchOrders();

    this.dateRange.valueChanges.subscribe((range) => {
      this.filterByDate(range.start, range.end, this.orders);
    });
  }

  fetchOrders(): void {
    this.ordersService
      .getOrders(this.justOffers)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((orders) => {
        this.orders = this.sortTheOrders(orders);
        this.filterItems(false);
      });
  }

  setTable(): void {
    this.columnsToDisplay = [
      { name: 'CLIENT', value: 'client' },
      { name: 'DELIVERY_PLACE', value: 'clientDelivery' },
      {
        name: this.justOffers ? 'OFFER_PLACED' : 'EXPECTED_DELIVERY',
        value: 'expectedDelivery',
      },
      { name: 'QUANTITY', value: 'quantity' },
      { name: 'TOTAL_AMOUND_FINAL', value: 'totalAmountFinal' },
    ];

    this.columnsToDisplayStrings = this.columnsToDisplay.map((c) => c.value);
  }

  payOrder(
    event: any,
    orderId: number,
    totalAmount: number,
    alreadyPaidAmount: number
  ): void {
    event.stopPropagation();

    this.paidAmount = null;

    const dialogRef = this._dialog.open(this.paidAmountDialog, {
      width: '300px',
      data: { maxAmount: totalAmount - alreadyPaidAmount },
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (result === true && this.paidAmount) {
          this.ordersService
            .orderIsPaid(orderId, this.paidAmount + alreadyPaidAmount)
            .then(() => {
              this.fetchOrders();
            });
        }
      });
  }

  sortTheOrders(orders: OrderResponse[]): OrderResponse[] {
    return orders.sort((a, b) => {
      const dateA = new Date(a.expectedDelivery).getTime();
      const dateB = new Date(b.expectedDelivery).getTime();

      if (dateA !== dateB) {
        return dateA - dateB;
      }

      const firstHourDiff = Number(b.forFirstHour) - Number(a.forFirstHour);
      if (firstHourDiff !== 0) {
        return firstHourDiff;
      }

      return Number(a.untilDeliveryDate) - Number(b.untilDeliveryDate);
    });
  }

  filterByDate(
    start: Date | null | undefined,
    end: Date | null | undefined,
    data: OrderResponse[]
  ) {
    if (start && end) {
      end.setHours(23, 59, 59, 999);
      this.dataSource.data = data.filter((item) => {
        return (
          Date.parse(item.dateOrderPlaced.toString()) >=
            Date.parse(start.toString()) &&
          Date.parse(item.dateOrderPlaced.toString()) <=
            Date.parse(end.toString())
        );
      });
      this.setDisplayedOrdersStats(this.dataSource.data);
    } else {
      this.dataSource.data = data;
      this.filterItems(true);
    }
  }

  filterItems(restore: boolean) {
    switch (this.tableFilter) {
      case 'all': {
        this.dataSource.data = this.orders;
        this.setDisplayedOrdersStats(this.dataSource.data);
        break;
      }
      case 'open': {
        this.dataSource.data = this.orders.filter(
          (item) => item.dateOrderDelivered == null
        );
        this.setDisplayedOrdersStats(this.dataSource.data);
        break;
      }
      case 'closed': {
        this.dataSource.data = this.orders.filter(
          (item) => item.dateOrderDelivered != null
        );
        this.setDisplayedOrdersStats(this.dataSource.data);
        break;
      }
      case 'expectedToday': {
        const currentDate = new Date();
        this.dataSource.data = this.orders.filter(
          (item) =>
            new Date(item.expectedDelivery).getDay() === currentDate.getDay() &&
            new Date(item.expectedDelivery).getMonth() ===
              currentDate.getMonth() &&
            new Date(item.expectedDelivery).getFullYear() ===
              currentDate.getFullYear() &&
            !item.dateOrderDelivered
        );
        this.setDisplayedOrdersStats(this.dataSource.data);
        break;
      }
    }
    if (!restore) {
      this.filterByDate(
        this.dateRange.value.start,
        this.dateRange.value.end,
        this.dataSource.data
      );
    }
  }

  setDisplayedOrdersStats(data: OrderResponse[]): void {
    this.displayedOrdersStat.numberOfOrders = data.length;
    if (data.length) {
      this.displayedOrdersStat.totalPrice = data
        .map((item) => item.totalAmountFinal)
        .reduce((prev, next) => prev + next);
    }
  }

  isExpanded(element: OrderResponse) {
    return this.expandedElement === element;
  }

  toggle(element: OrderResponse) {
    this.expandedElement = this.isExpanded(element) ? null : element;
  }

  showOrderDetails(order: OrderResponse): void {
    this.orderOutput.emit(order);
  }

  deleteOrder(order: OrderResponse): void {
    const dialogRef = this._dialog.open(this.confirmDeleteDialog, {
      width: '300px',
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (result === true) {
          this.ordersService.deleteOrder(order.id).then(() => {
            setTimeout(() => {
              this.fetchOrders();
            }, 500);
          });
        }
      });
  }

  isExpectedDeliveryInFuture(
    expectedDelivery: Date,
    dateOrderDelivered: Date
  ): boolean {
    if (dateOrderDelivered) {
      return true;
    }

    return Date.now() < Date.parse(expectedDelivery.toString());
  }

  isPercentageVoucher(voucher: string): boolean {
    return voucher.includes('%');
  }
}
