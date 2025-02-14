import { Routes } from '@angular/router';
import { OfferPageComponent } from './pages/offer-page/offer-page.component';
import { CreateOfferPageComponent } from './pages/create-offer-page/create-offer-page.component';

export const routes: Routes = [
  {
    path: 'offer',
    component: OfferPageComponent,
  },
  {
    path: 'offer/create',
    component: CreateOfferPageComponent,
  },
  { path: '', redirectTo: 'offer', pathMatch: 'full' },
];
