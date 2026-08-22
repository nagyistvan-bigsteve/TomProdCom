import { CommonModule } from '@angular/common';
import { Component, input, Input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-pdf-header',
  imports: [TranslateModule, CommonModule],
  templateUrl: './pdf-header.component.html',
  styleUrl: './pdf-header.component.scss',
})
export class PDFHeaderComponent {
  justOffer = input.required<boolean>();
  id = input.required<number>();
  deliveryDate = input.required<Date | null>();
  orderDate = input.required<Date>();
  firstHour = input<boolean>(false);
}
