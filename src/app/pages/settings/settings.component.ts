import { Component } from '@angular/core';
import { ChangePricesComponent } from '../../components/admin/change-prices/change-prices.component';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { UpdateProductsComponent } from '../../components/admin/update-products/update-products.component';
import { ENTER_ANIMATION } from '../../models/animations';
import { AddProductComponent } from '../../components/admin/add-product/add-product.component';

@Component({
  selector: 'app-settings',
  imports: [
    ChangePricesComponent,
    MatButtonToggleModule,
    ReactiveFormsModule,
    UpdateProductsComponent,
    AddProductComponent,
  ],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
  animations: [ENTER_ANIMATION],
})
export class SettingsComponent {
  settingControl = new FormControl('');
}
