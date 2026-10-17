import { Component, input, output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslateModule } from '@ngx-translate/core';
import { PriceRow } from '@features/orders/store/order-details/order-price-rows';

/**
 * Price rows (base / adjustment / final) with an input for the final unit
 * price, and the "different price for everything" toggle. Presentational:
 * the parent owns the rows and decides what a new price changes (the cart in
 * the offer overview, the saved lines in the order details price dialog).
 */
@Component({
  selector: 'app-price-adjust-panel',
  imports: [
    DecimalPipe,
    FormsModule,
    MatCheckboxModule,
    MatDividerModule,
    MatFormFieldModule,
    MatInputModule,
    TranslateModule,
  ],
  templateUrl: './price-adjust-panel.component.html',
  styleUrl: './price-adjust-panel.component.scss',
})
export class PriceAdjustPanelComponent {
  readonly rows = input.required<PriceRow[]>();
  readonly perProduct = input(false);
  /** Product names for product rows and M2 rows, by product id. */
  readonly productNames = input<Record<number, string | undefined>>({});

  readonly perProductChange = output<void>();
  /** `index` is the row's index in `rows`; `price` is null when the field is cleared. */
  readonly finalPriceChange = output<{ index: number; price: number | null }>();

  isVisible(row: PriceRow): boolean {
    return !this.perProduct() || !!row.productId;
  }
}
