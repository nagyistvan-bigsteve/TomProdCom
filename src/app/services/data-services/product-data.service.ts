import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ProductItems } from '../../models/models';

@Injectable({
  providedIn: 'root',
})
export class ProductDataService {
  private productItemsSource = new BehaviorSubject<ProductItems | null>(null);
  productItems$ = this.productItemsSource.asObservable();

  setProductItems(productItems: ProductItems) {
    console.log(productItems);
    this.productItemsSource.next(productItems);
  }
}
