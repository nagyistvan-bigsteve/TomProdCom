import { Directive, ElementRef, HostListener, inject, OnInit } from '@angular/core';

@Directive({
  selector: 'input[type=number]',
  standalone: true,
})
export class DecimalInputDirective implements OnInit {
  private el = inject(ElementRef<HTMLInputElement>);

  ngOnInit(): void {
    const input = this.el.nativeElement;
    input.type = 'text';
    input.inputMode = 'decimal';
  }

  @HostListener('keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (event.key !== ',') return;
    event.preventDefault();

    const input = this.el.nativeElement;
    if (input.value.includes('.')) return;

    const pos = input.selectionStart ?? input.value.length;
    const val = input.value;
    input.value = val.slice(0, pos) + '.' + val.slice(pos);
    input.setSelectionRange(pos + 1, pos + 1);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  @HostListener('input', ['$event.target'])
  onInput(input: HTMLInputElement): void {
    let value = input.value.replace(/,/g, '.');
    value = value.replace(/[^\d.]/g, '');

    const dotIdx = value.indexOf('.');
    if (dotIdx !== -1) {
      value = value.slice(0, dotIdx + 1) + value.slice(dotIdx + 1).replace(/\./g, '');
    }

    if (input.value !== value) {
      const cursor = input.selectionStart ?? value.length;
      input.value = value;
      input.setSelectionRange(cursor, cursor);
    }
  }
}
