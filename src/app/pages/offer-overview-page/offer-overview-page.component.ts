import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule } from '@angular/forms';
import { ProductItems } from '../../models/models';
import { SelectedProductListComponent } from '../../components/selected-product-list/selected-product-list.component';
import { ClientDetailsComponent } from '../../components/client-details/client-details.component';

@Component({
  selector: 'app-offer-overview',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatListModule,
    MatTableModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    FormsModule,
    SelectedProductListComponent,
    ClientDetailsComponent,
  ],
  templateUrl: './offer-overview-page.component.html',
  styleUrls: ['./offer-overview-page.component.scss'],
})
export class OfferOverviewPageComponent implements OnInit {
  offerProducts: ProductItems = [];

  ngOnInit(): void {
    if (sessionStorage.getItem('offer-products')) {
      this.offerProducts = JSON.parse(
        sessionStorage.getItem('offer-products')!
      );
    }

    this.setProducts();
    this.fetchProducts();
  }

  setProducts(): void {
    if (this.offerProducts.length) {
      sessionStorage.setItem(
        'offer-products',
        JSON.stringify(this.offerProducts)
      );
    }
  }

  fetchProducts(): void {
    if (
      !this.offerProducts.length &&
      sessionStorage.getItem('offer-products')
    ) {
      this.offerProducts = JSON.parse(
        sessionStorage.getItem('offer-products')!
      );
    }
  }

  voucher: string = '';

  get totalPrice(): number {
    let total = this.offerProducts.reduce(
      (sum, product) => sum + product.price,
      0
    );
    if (this.voucher.includes('-')) {
      this.voucher = this.voucher.replace('-', '');
    }
    if (this.voucher.includes('%')) {
      const discountPercent = parseFloat(this.voucher.replace('%', '')) / 100;
      total -= total * discountPercent;
    } else {
      const discountValue = parseFloat(this.voucher);
      if (!isNaN(discountValue)) {
        total -= discountValue;
      }
    }
    return total > 0 ? total : 0;
  }

  confirmOffer() {
    sessionStorage.removeItem('offer-products');
    sessionStorage.removeItem('current-client');
  }
}
