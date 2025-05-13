import { Routes } from '@angular/router';
import { OfferPageComponent } from './pages/offer-page/offer-page.component';
import { CreateOfferPageComponent } from './pages/create-offer-page/create-offer-page.component';
import { SelectClientPageComponent } from './pages/select-client-page/select-client-page.component';
import { OfferOverviewPageComponent } from './pages/offer-overview-page/offer-overview-page.component';
import { ResetPasswordComponent } from './pages/reset-password/reset-password.component';
import { authGuard } from './guards/auth-guard.service';
import { AuthPageComponent } from './pages/auth/auth-page.component';
import { WaitToApproveComponent } from './pages/wait-to-approve/wait-to-approve.component';
import { UserComponent } from './pages/user/user.component';
import { OrdersComponent } from './pages/orders/orders.component';
import { SettingsComponent } from './pages/settings/settings.component';

export const routes: Routes = [
  {
    path: 'offer',
    component: OfferPageComponent,
    canActivate: [authGuard],
    data: {
      requiresApproval: true,
    },
  },
  {
    path: 'offer/create',
    component: CreateOfferPageComponent,
    canActivate: [authGuard],
    data: {
      requiresApproval: true,
    },
  },
  {
    path: 'offer/client',
    component: SelectClientPageComponent,
    canActivate: [authGuard],
    data: {
      requiresApproval: true,
    },
  },
  {
    path: 'offer/overview',
    component: OfferOverviewPageComponent,
    canActivate: [authGuard],
    data: {
      requiresApproval: true,
    },
  },
  {
    path: 'user',
    component: UserComponent,
    canActivate: [authGuard],
    data: {
      requiresApproval: true,
    },
  },
  {
    path: 'orders',
    component: OrdersComponent,
    canActivate: [authGuard],
    data: {
      requiresApproval: true,
    },
  },
  {
    path: 'settings',
    component: SettingsComponent,
    canActivate: [authGuard],
    data: {
      requiresApproval: true,
      requiredRole: 'admin',
    },
  },
  {
    path: 'auth',
    canActivate: [authGuard],
    data: {
      requiresApproval: false,
    },
    component: AuthPageComponent,
  },
  {
    path: 'reset-password',
    component: ResetPasswordComponent,
  },
  {
    path: 'wait-to-approve',
    canActivate: [authGuard],
    data: {
      requiresApproval: false,
    },
    component: WaitToApproveComponent,
  },
  { path: '', redirectTo: 'auth', pathMatch: 'full' },
];
