import { Component, computed, inject, input, ChangeDetectionStrategy } from '@angular/core';
import { PDFFooterComponent } from '../pdf-footer/pdf-footer.component';
import { PDFHeaderComponent } from '../pdf-header/pdf-header.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { OrderItemsResponse, OrderResponse } from '@core/models/models';
import { CommonModule } from '@angular/common';
import { MatDivider } from '@angular/material/divider';
import { ClientStore } from '@features/clients/store/client.store';
import { countedVolumeM3 } from '@features/orders/store/order-details/order-details.computed';
import { MoneyPipe } from '@shared/pipes/money.pipe';
import { m2FromM3 } from '@shared/utils/product.util';
import { ClientType, Unit_id } from '@core/models/enums';

@Component({
  selector: 'app-order-pdf',
  imports: [
    MoneyPipe,
    PDFFooterComponent,
    PDFHeaderComponent,
    TranslateModule,
    CommonModule,
    MatDivider,
  ],
  templateUrl: './order-pdf.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './order-pdf.component.scss',
})
export class OrderPdfComponent {
  readonly ClientType = ClientType;

  readonly Unit_id = Unit_id;

  isPrinting = input.required<boolean>();
  order = input.required<OrderResponse>();
  orderItems = input.required<OrderItemsResponse[]>();
  justOffer = input.required<boolean>();

  private readonly translateService = inject(TranslateService);
  readonly clientStore = inject(ClientStore);
  readonly m2FromM3 = m2FromM3;

  client = computed(
    () => this.clientStore.clientsEntityMap()[this.order().clientId],
  );

  translate(key: string, params?: any): string {
    return this.translateService.instant(key, params);
  }

  isPercentageVoucher(voucher: string): boolean {
    return voucher.includes('%');
  }

  /** m³ of one line as the order total counts it: 0 (shown as "–") for M2 and BUC lines. */
  getTotalMQ(item: OrderItemsResponse): number {
    return countedVolumeM3(item);
  }

  /** Sum of the lines' m³; the m³ column is left out of the PDF when it is 0. */
  readonly totalM3 = computed(() =>
    this.orderItems().reduce((sum, item) => sum + countedVolumeM3(item), 0),
  );
}
