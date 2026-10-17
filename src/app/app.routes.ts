import { Routes } from '@angular/router';
import { authGuard } from '@core/guards/auth-guard.service';
import { staleCartGuard } from '@features/orders/store/cart/stale-cart.guard';

export const routes: Routes = [
  {
    path: 'offer',
    loadComponent: () =>
      import('@features/orders/pages/start-page/start-page.component').then((m) => m.StartPageComponent),
    canActivate: [authGuard],
    data: {
      requiresApproval: true,
    },
  },
  {
    path: 'offer/create',
    loadComponent: () =>
      import('@features/orders/pages/create-offer/create-offer-page.component').then((m) => m.CreateOfferPageComponent),
    canActivate: [authGuard, staleCartGuard],
    data: {
      requiresApproval: true,
    },
  },
  {
    path: 'offer/client',
    loadComponent: () =>
      import('@features/orders/pages/select-client/select-client-page.component').then((m) => m.SelectClientPageComponent),
    canActivate: [authGuard, staleCartGuard],
    data: {
      requiresApproval: true,
    },
  },
  {
    path: 'offer/overview',
    loadComponent: () =>
      import('@features/orders/pages/offer-overview/offer-overview-page.component').then((m) => m.OfferOverviewPageComponent),
    canActivate: [authGuard, staleCartGuard],
    data: {
      requiresApproval: true,
    },
  },
  {
    path: 'user',
    loadComponent: () =>
      import('@features/auth/pages/user/user.component').then((m) => m.UserComponent),
    canActivate: [authGuard],
    data: {
      requiresApproval: true,
    },
  },
  {
    path: 'orders',
    loadComponent: () =>
      import('@features/orders/pages/orders/orders.component').then((m) => m.OrdersComponent),
    canActivate: [authGuard],
    data: {
      requiresApproval: true,
    },
  },
  {
    path: 'offers',
    loadComponent: () =>
      import('@features/orders/pages/offers/offers.component').then((m) => m.OffersComponent),
    canActivate: [authGuard],
    data: {
      requiresApproval: true,
    },
  },
  {
    path: 'clients',
    loadComponent: () =>
      import('@features/clients/pages/clients/clients.component').then((m) => m.ClientsComponent),
    canActivate: [authGuard],
    data: {
      requiresApproval: true,
    },
  },
  {
    path: 'products',
    loadComponent: () =>
      import('@features/products/pages/products/products.component').then((m) => m.ProductsComponent),
    canActivate: [authGuard],
    data: {
      requiresApproval: true,
    },
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('@features/admin/pages/settings/settings.component').then((m) => m.SettingsComponent),
    canActivate: [authGuard],
    data: {
      requiresApproval: true,
      requiredRole: 'admin',
    },
  },
  {
    path: 'deleted',
    loadComponent: () =>
      import('@features/orders/pages/deleted-orders/deleted-orders.component').then((m) => m.DeletedOrdersComponent),
    canActivate: [authGuard],
    data: {
      requiresApproval: true,
      requiredRole: 'admin',
    },
  },
  {
    path: 'coming-wares',
    loadComponent: () =>
      import('@features/coming-wares/pages/coming-wares.component').then((m) => m.ComingWaresComponent),
    canActivate: [authGuard],
    data: {
      requiresApproval: true,
    },
  },
  {
    path: 'coming-wares/:id/:verified',
    loadComponent: () =>
      import('@features/coming-wares/components/coming-wares-details/coming-wares-details.component').then((m) => m.ComingWaresDetailsComponent),
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
    loadComponent: () =>
      import('@features/auth/pages/auth/auth-page.component').then((m) => m.AuthPageComponent),
  },
  {
    path: 'reset-password',
    canActivate: [authGuard],
    data: {
      requiresApproval: false,
    },
    loadComponent: () =>
      import('@features/auth/pages/reset-password/reset-password.component').then((m) => m.ResetPasswordComponent),
  },
  {
    path: 'wait-to-approve',
    canActivate: [authGuard],
    data: {
      requiresApproval: false,
    },
    loadComponent: () =>
      import('@features/auth/pages/wait-to-approve/wait-to-approve.component').then((m) => m.WaitToApproveComponent),
  },
  { path: '', redirectTo: 'auth', pathMatch: 'full' },
  { path: '**', redirectTo: 'auth' },
];
