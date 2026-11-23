import { ElementRef, Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class FilterUtil {
  productFilter<T extends { name: string }>(
    input: ElementRef<HTMLInputElement> | string | null,
    products: T[],
  ): T[] {
    if (!input) return products;

    let rawValue =
      input instanceof ElementRef
        ? input.nativeElement.value.toLowerCase()
        : input.toLowerCase();

    if (!rawValue) {
      return products;
    }

    rawValue = rawValue.replace(/,/g, '.');

    const isNumeric = /^\d+$/.test(rawValue);

    let filteredOptions = products
      .filter((o) => {
        const name = o.name.toLowerCase().replace(/,/g, '.');

        if (isNumeric) {
          const segments = name.split('x').map((seg) => seg.replace(/\D+/g, ''));
          let combined = '';
          const boundaries: number[] = [];
          for (const seg of segments) {
            boundaries.push(combined.length);
            combined += seg;
          }
          return boundaries.some((pos) => combined.startsWith(rawValue, pos));
        } else {
          return name.includes(rawValue);
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    return filteredOptions;
  }
}
