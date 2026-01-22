import {
  Component,
  DestroyRef,
  inject,
  signal,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import {
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ENTER_AND_LEAVE_ANIMATION } from '../../../models/animations';
import { ProductsService } from '../../../services/query-services/products.service';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { TranslateModule } from '@ngx-translate/core';
import {
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Category } from '../../../models/enums';
import { Product } from '../../../models/models';
import { PricesService } from '../../../services/query-services/prices.service';

@Component({
  selector: 'app-add-product',
  imports: [
    CommonModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatAutocompleteModule,
    ReactiveFormsModule,
    FormsModule,
    TranslateModule,
    MatButtonModule,
    MatDialogModule,
  ],
  templateUrl: './add-product.component.html',
  styleUrl: './add-product.component.scss',
  animations: [ENTER_AND_LEAVE_ANIMATION],
})
export class AddProductComponent {
  @ViewChild('addPriceDialog') addPriceDialogTemplate!: TemplateRef<any>;

  private readonly productService = inject(ProductsService);
  private readonly pricesService = inject(PricesService);
  private readonly fb = inject(FormBuilder);
  readonly #dialog = inject(MatDialog);
  readonly #destroyRef = inject(DestroyRef);

  newPriceA = signal(0);
  newPriceAB = signal(0);
  newPriceB = signal(0);
  newPriceT = signal(0);

  newProductId = signal(0);

  selectedProduct: any = {
    name: '',
    unit_id: null,
    size_id: null,
    length: null,
    thickness: null,
    width: null,
    m2_brut: null,
    m2_util: null,
    piece_per_pack: null,
  };

  productForm = this.fb.group({
    id: [this.selectedProduct?.id],
    name: [this.selectedProduct?.name, Validators.required],
    unit_id: [this.selectedProduct.unit_id, Validators.required],
    size_id: [this.selectedProduct.size_id, Validators.required],
    length: [this.selectedProduct.length, Validators.required],
    thickness: [this.selectedProduct.thickness, Validators.required],
    width: [this.selectedProduct.width],
    m2_brut: [this.selectedProduct.m2_brut],
    m2_util: [this.selectedProduct.m2_util],
    piece_per_pack: [this.selectedProduct.piece_per_pack],
  });

  onSave() {
    if (this.productForm.valid) {
      this.productService
        .addProduct(this.selectedProduct)
        .then((response: Product | null) => {
          if (response) {
            this.newProductId.set(response.id);
            this.openAddPriceDialog();
          }
        });
    }
  }

  addPrice(dialogRef: MatDialogRef<any>): void {
    if (this.newPriceA()) {
      this.pricesService.addPrice({
        unit_id: this.selectedProduct.unit_id,
        category_id: Category.A,
        size_id: this.selectedProduct.size_id,
        price: this.newPriceA(),
        product_id: this.newProductId(),
      });
    }

    if (this.newPriceAB()) {
      this.pricesService.addPrice({
        unit_id: this.selectedProduct.unit_id,
        category_id: Category.AB,
        size_id: this.selectedProduct.size_id,
        price: this.newPriceAB(),
        product_id: this.newProductId(),
      });
    }

    if (this.newPriceB()) {
      this.pricesService.addPrice({
        unit_id: this.selectedProduct.unit_id,
        category_id: Category.B,
        size_id: this.selectedProduct.size_id,
        price: this.newPriceB(),
        product_id: this.newProductId(),
      });
    }

    if (this.newPriceT()) {
      this.pricesService.addPrice({
        unit_id: this.selectedProduct.unit_id,
        category_id: Category.T,
        size_id: this.selectedProduct.size_id,
        price: this.newPriceT(),
        product_id: this.newProductId(),
      });
    }

    dialogRef.close();
  }

  private openAddPriceDialog(): void {
    this.#dialog
      .open(this.addPriceDialogTemplate, {
        data: {},
        disableClose: true,
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe(() => {
        this.selectedProduct = {
          name: '',
          unit_id: null,
          size_id: null,
          length: null,
          thickness: null,
          width: null,
          m2_brut: null,
          m2_util: null,
          piece_per_pack: null,
        };
        this.selectedProduct.name = '';
      });
  }
}
