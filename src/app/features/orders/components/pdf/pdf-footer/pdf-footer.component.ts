import { Component, ChangeDetectionStrategy } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-pdf-footer',
  imports: [TranslateModule],
  templateUrl: './pdf-footer.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './pdf-footer.component.scss',
})
export class PDFFooterComponent {}
