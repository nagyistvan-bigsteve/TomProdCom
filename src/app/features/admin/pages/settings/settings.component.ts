import { Component } from '@angular/core';
import { ChangePricesComponent } from '@features/admin/components/change-prices/change-prices.component';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { UpdateProductsComponent } from '@features/admin/components/update-products/update-products.component';
import { ENTER_ANIMATION } from '@core/models/animations';
import { AddProductComponent } from '@features/admin/components/add-product/add-product.component';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-settings',
  imports: [
    ChangePricesComponent,
    MatButtonToggleModule,
    ReactiveFormsModule,
    UpdateProductsComponent,
    AddProductComponent,
    TranslateModule,
  ],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
  animations: [ENTER_ANIMATION],
})
export class SettingsComponent {
  settingControl = new FormControl('');
}
