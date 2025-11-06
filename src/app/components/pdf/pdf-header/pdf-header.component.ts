import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-pdf-header',
  imports: [TranslateModule, CommonModule],
  templateUrl: './pdf-header.component.html',
  styleUrl: './pdf-header.component.scss',
})
export class PDFHeaderComponent {
  @Input({ required: true }) justOffer: boolean = false;
  @Input({ required: true }) id: number | null = null;
  @Input({ required: true }) deliveryDate: Date | null = null;
  @Input({ required: true }) orderDate: Date | null = null;
}
