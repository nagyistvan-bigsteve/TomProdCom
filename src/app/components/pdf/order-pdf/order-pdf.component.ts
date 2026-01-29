import { Component, inject, input } from '@angular/core';
import { PDFFooterComponent } from '../pdf-footer/pdf-footer.component';
import { PDFHeaderComponent } from '../pdf-header/pdf-header.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { OrderItemsResponse, OrderResponse } from '../../../models/models';
import { CommonModule } from '@angular/common';
import { MatDivider } from '@angular/material/divider';
import { Unit_id } from '../../../models/enums';

@Component({
  selector: 'app-order-pdf',
  imports: [
    PDFFooterComponent,
    PDFHeaderComponent,
    TranslateModule,
    CommonModule,
    MatDivider,
  ],
  templateUrl: './order-pdf.component.html',
  styleUrl: './order-pdf.component.scss',
})
export class OrderPdfComponent {
  isPrinting = input.required<boolean>();
  order = input.required<OrderResponse>();
  orderItems = input.required<OrderItemsResponse[]>();
  justOffer = input.required<boolean>();

  private readonly translateService = inject(TranslateService);

  translate(key: string, params?: any): string {
    return this.translateService.instant(key, params);
  }

  isPercentageVoucher(voucher: string): boolean {
    return voucher.includes('%');
  }

  getTotalMQ(item: OrderItemsResponse): number {
    if (item.packsPieces) {
      return 0;
    }

    if (item.product.width) {
      let quntity = +new Intl.NumberFormat('en-US', {
        minimumIntegerDigits: 1,
        minimumFractionDigits: 0,
        maximumFractionDigits: 3,
      }).format(
        ((item.product.width * item.product.thickness * item.product.length) /
          1000000) *
          item.quantity,
      );

      if (item.product.unit_id === Unit_id.BOUNDLE) {
        quntity = quntity * 10;
      }

      return quntity;
    } else {
      return item.quantity;
    }
  }
}
