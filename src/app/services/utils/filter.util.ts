import { ElementRef, Injectable } from '@angular/core';
import { Products } from '../../models/models';

@Injectable({
  providedIn: 'root',
})
export class FilterUtil {
  productFilter(
    input: ElementRef<HTMLInputElement> | null,
    products: Products
  ): Products {
    if (!input) return products;

    let rawValue = input.nativeElement.value.toLowerCase();

    if (!rawValue) {
      return products;
    }

    rawValue = rawValue.replace(/,/g, '.');

    const isNumeric = /^\d+$/.test(rawValue);

    let filteredOptions = products
      .filter((o) => {
        const name = o.name.toLowerCase().replace(/,/g, '.');

        if (isNumeric) {
          const nameDigits = name.replace(/\D+/g, '');
          return nameDigits.includes(rawValue);
        } else {
          return name.includes(rawValue);
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    return filteredOptions;
  }
}
