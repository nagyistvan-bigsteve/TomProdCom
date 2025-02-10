import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SupabaseService } from './services/supabase.service';
import { JsonPipe } from '@angular/common';
import { Products } from './models/models';
import { ProductSelectComponent } from './components/product-list/product-list.component';
import { TranslateService } from '@ngx-translate/core';

@Component({
  standalone: true,
  selector: 'app-root',
  imports: [ProductSelectComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  constructor(private translate: TranslateService) {
    this.translate.setDefaultLang('ro'); // Default language
  }
  // title = 'tom-prod-com';
  // products: Products = [];
  // constructor(private supabaseService: SupabaseService) {}
  // async ngOnInit() {
  //   const { data, error }: { data: Products | null; error: any } =
  //     await this.supabaseService.client.from('products').select('*');
  //   if (error) console.error('Error fetching data:', error);
  //   else data ? (this.products = data) : (this.products = []);
  // }
}
