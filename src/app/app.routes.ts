import { Routes } from '@angular/router';
import { StartPageComponent } from '@features/orders/pages/start-page/start-page.component';
import { CreateOfferPageComponent } from '@features/orders/pages/create-offer/create-offer-page.component';
import { SelectClientPageComponent } from '@features/orders/pages/select-client/select-client-page.component';
import { OfferOverviewPageComponent } from '@features/orders/pages/offer-overview/offer-overview-page.component';
import { ResetPasswordComponent } from '@features/auth/pages/reset-password/reset-password.component';
import { authGuard } from '@core/guards/auth-guard.service';
import { AuthPageComponent } from '@features/auth/pages/auth/auth-page.component';
import { WaitToApproveComponent } from '@features/auth/pages/wait-to-approve/wait-to-approve.component';
import { UserComponent } from '@features/auth/pages/user/user.component';
import { OrdersComponent } from '@features/orders/pages/orders/orders.component';
import { SettingsComponent } from '@features/admin/pages/settings/settings.component';
import { OffersComponent } from '@features/orders/pages/offers/offers.component';
import { ComingWaresComponent } from '@features/coming-wares/pages/coming-wares.component';
import { ComingWaresDetailsComponent } from '@features/coming-wares/components/coming-wares-details/coming-wares-details.component';
import { ClientsComponent } from '@features/clients/pages/clients/clients.component';
import { ProductsComponent } from '@features/products/pages/products/products.component';
import { DeletedOrdersComponent } from '@features/orders/pages/deleted-orders/deleted-orders.component';

export const routes: Routes = [
  {
    path: 'offer',
    component: StartPageComponent,
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
    path: 'offers',
    component: OffersComponent,
    canActivate: [authGuard],
    data: {
      requiresApproval: true,
    },
  },
  {
    path: 'clients',
    component: ClientsComponent,
    canActivate: [authGuard],
    data: {
      requiresApproval: true,
    },
  },
  {
    path: 'products',
    component: ProductsComponent,
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
    path: 'deleted',
    component: DeletedOrdersComponent,
    canActivate: [authGuard],
    data: {
      requiresApproval: true,
      requiredRole: 'admin',
    },
  },
  {
    path: 'coming-wares',
    component: ComingWaresComponent,
    canActivate: [authGuard],
    data: {
      requiresApproval: true,
    },
  },
  {
    path: 'coming-wares/:id/:verified',
    component: ComingWaresDetailsComponent,
    canActivate: [authGuard],
    data: {
      requiresApproval: true,
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
    canActivate: [authGuard],
    data: {
      requiresApproval: false,
    },
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
  { path: '**', redirectTo: 'auth' },
];
