import { Routes } from '@angular/router';
import { OfferPageComponent } from './pages/offer-page/offer-page.component';
import { CreateOfferPageComponent } from './pages/create-offer-page/create-offer-page.component';
import { SelectClientPageComponent } from './pages/select-client-page/select-client-page.component';
import { OfferOverviewPageComponent } from './pages/offer-overview-page/offer-overview-page.component';

export const routes: Routes = [
  {
    path: 'offer',
    component: OfferPageComponent,
  },
  {
    path: 'offer/create',
    component: CreateOfferPageComponent,
  },
  {
    path: 'offer/client',
    component: SelectClientPageComponent,
  },
  {
    path: 'offer/overview',
    component: OfferOverviewPageComponent,
  },
  { path: '', redirectTo: 'offer', pathMatch: 'full' },
];
