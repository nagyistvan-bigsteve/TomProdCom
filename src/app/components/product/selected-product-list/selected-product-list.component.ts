import {
  Component,
  DestroyRef,
  inject,
  Input,
  OnInit,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import { ProductItems } from '../../../models/models';
import { CommonModule, Location } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { MatDividerModule } from '@angular/material/divider';
import { MatAccordion, MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

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

  productList: ProductItems = [];
  totalPrice: number = 0;

  readonly #router = inject(Router);
  private _dialog = inject(MatDialog);
  readonly #location = inject(Location);
  readonly #destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    if (sessionStorage.getItem('offer-products')) {
      this.productList = JSON.parse(sessionStorage.getItem('offer-products')!);

      this.totalPrice = 0;
      this.productList.forEach((item) => {
        this.totalPrice = this.totalPrice + item.price;
      });
    }
  }

  goBack(): void {
    this.#location.back();
  }

  goToCreateOfferPage(): void {
    this.#router.navigate(['/offer/create']);
  }

  goToClientPage(): void {
    sessionStorage.setItem('offer-products', JSON.stringify(this.productList));
    this.#router.navigate(['/offer/client']);
  }

  confirmDelete(index: number): void {
    const dialogRef = this._dialog.open(this.confirmDeleteDialog, {
      width: '300px',
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe((result) => {
        if (result === true) {
          this.deleteItem(index);
        }
      });
  }

  deleteItem(index: number): void {
    this.productList.splice(index, 1);
    sessionStorage.setItem('offer-products', JSON.stringify(this.productList));
  }
}
