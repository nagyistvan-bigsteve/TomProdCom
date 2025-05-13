import {
  Component,
  DestroyRef,
  inject,
  Input,
  OnInit,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { MatDividerModule } from '@angular/material/divider';
import { MatAccordion, MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { useProductStore } from '../../../services/store/product-store';
import { ProductItem } from '../../../models/models';

@Component({
  selector: 'app-selected-product-list',
  imports: [
    CommonModule,
    TranslateModule,
    MatDividerModule,
    MatAccordion,
    MatExpansionModule,
    MatIconModule,
    MatDialogModule,
    MatButtonModule,
  ],
  templateUrl: './selected-product-list.component.html',
  styleUrl: './selected-product-list.component.scss',
})
export class SelectedProductListComponent implements OnInit {
  @ViewChild('confirmDeleteDialog') confirmDeleteDialog!: TemplateRef<any>;
  @Input() isInOverview: boolean = false;

  totalPrice: number = 0;

  private router = inject(Router);
  private _dialog = inject(MatDialog);
  private location = inject(Location);
  private destroyRef = inject(DestroyRef);
  readonly productStore = inject(useProductStore);

  ngOnInit(): void {
    this.getTotalPrice();
  }

  getTotalPrice(): void {
    if (this.productStore.productItems()) {
      this.totalPrice = 0;
      this.productStore.productItems()?.forEach((item) => {
        this.totalPrice = this.totalPrice + item.price;
      });
    }
  }

  goBack(): void {
    this.location.back();
  }

  goToCreateOfferPage(): void {
    this.router.navigate(['/offer/create']);
  }

  goToClientPage(): void {
    if (!localStorage.getItem('client_data')) {
      this.router.navigate(['/offer/client']);
    } else {
      this.router.navigate(['/offer/overview']);
    }
  }

  confirmDelete(item: ProductItem): void {
    const dialogRef = this._dialog.open(this.confirmDeleteDialog, {
      width: '300px',
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (result === true) {
          this.productStore.deleteProductById(item.product.id, item.category);
          this.getTotalPrice();
        }
      });
  }
}
