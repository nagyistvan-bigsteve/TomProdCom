import {
  Component,
  DestroyRef,
  EventEmitter,
  inject,
  OnInit,
  Output,
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
  ],
  providers: [provideNativeDateAdapter()],
  templateUrl: './order-table.component.html',
  styleUrl: './order-table.component.scss',
  animations: [LEAVE_ANIMATION],
})
export class OrderTableComponent implements OnInit {
  @Output() orderOutput = new EventEmitter<OrderResponse>();

  public readonly authStore = inject(useAuthStore);
  private readonly destroyRef = inject(DestroyRef);
  private ordersService = inject(OrdersService);
  orders: OrderResponse[] = [];
  dataSource = new MatTableDataSource<OrderResponse>([]);
  columnsToDisplay = [
    { name: 'Client', value: 'client' },
    { name: 'Order date', value: 'dateOrderPlaced' },
    { name: 'Delivery date', value: 'dateOrderDelivered' },
    { name: 'final amount', value: 'totalAmountFinal' },
    { name: 'operator', value: 'operator' },
  ];
  columnsToDisplayStrings = this.columnsToDisplay.map((c) => c.value);
  expandedElement: OrderResponse | null = null;

  tableFilter: 'all' | 'open' | 'closed' = 'all';
  readonly dateRange = new FormGroup({
    start: new FormControl<Date | null>(null),
    end: new FormControl<Date | null>(null),
  });

  ngOnInit(): void {
    this.fetchOrders();

    this.dateRange.valueChanges.subscribe((range) => {
      this.filterByDate(range.start, range.end, this.orders);
    });
  }

  fetchOrders(): void {
    this.ordersService
      .getOrders()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((orders) => {
        this.orders = orders;
        this.filterItems(false);
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
    } else {
      this.dataSource.data = data;
      this.filterItems(true);
    }
  }

  filterItems(restore: boolean) {
    if (this.tableFilter === 'all') {
      this.dataSource.data = this.orders;
    } else if (this.tableFilter === 'open') {
      this.dataSource.data = this.orders.filter(
        (item) => item.dateOrderDelivered == null
      );
    } else if (this.tableFilter === 'closed') {
      this.dataSource.data = this.orders.filter(
        (item) => item.dateOrderDelivered != null
      );
    }
    if (!restore) {
      this.filterByDate(
        this.dateRange.value.start,
        this.dateRange.value.end,
        this.dataSource.data
      );
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
    this.ordersService.deleteOrder(order.id).then(() => {
      this.fetchOrders();
    });
  }

  isExpectedDeliveryInFuture(expectedDelivery: Date): boolean {
    return Date.now() < Date.parse(expectedDelivery.toString());
  }

  isPercentageVoucher(voucher: string): boolean {
    return voucher.includes('%');
  }

  // setFilterPredicate() {
  //   this.dataSource.filterPredicate = (
  //     data: OrderResponse,
  //     filter: string
  //   ) => {
  //     const { search, status } = JSON.parse(filter);

  //     const matchesSearch = data.name
  //       ?.toLowerCase()
  //       .includes(search.toLowerCase());
  //     const matchesStatus =
  //       status === 'all' ||
  //       (status === 'open' && !data.date) ||
  //       (status === 'closed' && data.date);

  //     return matchesSearch && matchesStatus;
  //   };
  // }
}
