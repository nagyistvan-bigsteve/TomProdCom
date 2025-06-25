import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import {
  MatDialogActions,
  MatDialogContent,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatDatepickerModule } from '@angular/material/datepicker';
import {
  MatNativeDateModule,
  provideNativeDateAdapter,
} from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { TranslateModule } from '@ngx-translate/core';
import { Category } from '../../../models/enums';
import { Product, Products } from '../../../models/models';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { ProductsService } from '../../../services/query-services/products.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-create-coming-wares-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    MatButtonModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatDatepickerModule,
    MatNativeDateModule,
    MatSelectModule,
    TranslateModule,
    MatAutocompleteModule,
  ],
  providers: [provideNativeDateAdapter()],
  templateUrl: './create-coming-wares-dialog.component.html',
  styleUrls: ['./create-coming-wares-dialog.component.scss'],
})
export class CreateComingWaresDialogComponent implements OnInit {
  fb = inject(FormBuilder);
  dialogRef = inject(MatDialogRef<CreateComingWaresDialogComponent>);
  private readonly productService = inject(ProductsService);
  private readonly destroyRef = inject(DestroyRef);

  comingWaresForm!: FormGroup;
  products: Products = [];
  filteredOptions: Products[] = [];

  categoryOptions = [
    { label: 'A', value: Category.A },
    { label: 'AB', value: Category.AB },
    { label: 'B', value: Category.B },
    { label: 'T', value: Category.T },
  ];

  ngOnInit(): void {
    this.fetchProducts();

    this.comingWaresForm = this.fb.group({
      expected_delivery: [null, Validators.required],
      name: [''],
      total_quantity: [0],
      all_for_order: [false],
      comment: [''],
      items: this.fb.array([this.createItemFormGroup()]),
    });

    this.items.valueChanges.subscribe(() => this.maybeAddNewItem());
  }

  fetchProducts(): void {
    this.productService
      .getProducts()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((products) => {
        this.products = products;
        this.filteredOptions[0] = products;
      });
  }

  get items(): FormArray {
    return this.comingWaresForm.get('items') as FormArray;
  }

  createItemFormGroup(): FormGroup {
    return this.fb.group({
      product: [null, Validators.required],
      category: [null, Validators.required],
      quantity: [null, Validators.required],
      for_order: [false],
    });
  }

  maybeAddNewItem(): void {
    const lastItem = this.items.at(this.items.length - 1);
    if (lastItem && lastItem.valid && !this.hasEmptyItem()) {
      this.items.push(this.createItemFormGroup());
      this.filteredOptions[this.items.length - 1] = this.products;
    }
  }

  hasEmptyItem(): boolean {
    return this.items.controls.some(
      (ctrl) =>
        !ctrl.get('product')?.value &&
        !ctrl.get('category')?.value &&
        !ctrl.get('quantity')?.value
    );
  }

  onSave(): void {
    const value = this.comingWaresForm.value;
    value.items = value.items.filter((item: any) => item.product !== null);

    this.dialogRef.close(value);
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  isFormValidExcludingLast(): boolean {
    const controls = this.items.controls;

    if (controls.length === 0) return false;

    const controlsToValidate = this.isLastItemEmpty()
      ? controls.slice(0, -1)
      : controls;

    const validItems = controlsToValidate.every((control) => control.valid);

    return this.comingWaresForm.get('expected_delivery')!.valid && validItems;
  }

  isLastItemEmpty(): boolean {
    const controls = this.items.controls;

    const last = controls[controls.length - 1];
    const isLastEmpty =
      !last.get('product')?.value &&
      !last.get('category')?.value &&
      !last.get('quantity')?.value;

    return isLastEmpty;
  }

  filter(index: number, event: Event): void {
    const input = (event.target as HTMLInputElement).value;

    if (!input) return;

    const rawValue = input.toLowerCase();

    if (!rawValue) {
      this.filteredOptions[index] = this.products;
      return;
    }

    const isNumeric = /^\d+$/.test(rawValue);

    this.filteredOptions[index] = this.products.filter((o) => {
      const name = o.name.toLowerCase();

      if (isNumeric) {
        const nameDigits = name.replace(/\D+/g, '');
        return nameDigits.includes(rawValue);
      } else {
        return name.includes(rawValue);
      }
    });
  }

  displayProductLabel = (product: Product): string => {
    return product ? product.name : '';
  };
}
