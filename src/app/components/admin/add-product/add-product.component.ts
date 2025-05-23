import {
  Component,
  DestroyRef,
  ElementRef,
  inject,
  ViewChild,
} from '@angular/core';
import { Product, Products } from '../../../models/models';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormBuilder,
  FormControl,
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
  ],
  templateUrl: './add-product.component.html',
  styleUrl: './add-product.component.scss',
  animations: [ENTER_AND_LEAVE_ANIMATION],
})
export class AddProductComponent {
  private readonly productService = inject(ProductsService);
  private readonly fb = inject(FormBuilder);

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
  isProductSelectet: boolean = false;

  productForm = this.fb.group({
    id: [this.selectedProduct?.id],
    name: [this.selectedProduct?.name, Validators.required],
    unit_id: [this.selectedProduct.unit_id, Validators.required],
    size_id: [this.selectedProduct.size_id, Validators.required],
    length: [this.selectedProduct.length, Validators.required],
    thickness: [this.selectedProduct.thickness, Validators.required],
    width: [this.selectedProduct.width, Validators.required],
    m2_brut: [this.selectedProduct.m2_brut],
    m2_util: [this.selectedProduct.m2_util],
    piece_per_pack: [this.selectedProduct.piece_per_pack],
  });

  onSave() {
    if (this.productForm.valid) {
      this.productService.addProduct(this.selectedProduct).then(() => {
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
}
