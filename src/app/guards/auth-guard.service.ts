import { inject } from '@angular/core';
import { Router, ActivatedRouteSnapshot } from '@angular/router';
import { useAuthStore } from '../services/store/auth-store';

export const authGuard = (route: ActivatedRouteSnapshot) => {
  const authStore = inject(useAuthStore);
  const router = inject(Router);
  const requiredRole = route.data['requiredRole'];
  const requiresApproval = route.data['requiresApproval'];

  // Check if user is authenticated
  if (authStore.isAuthenticated()) {
    if (requiredRole && authStore.role() !== requiredRole) {
      router.navigate(['/offer']);
      return false;
    }

    // If approval is required
    if (!authStore.approved()) {
      router.navigate(['/wait-to-approve']);
      return false;
    }

    if (!requiresApproval) {
      router.navigate(['/offer']);
      return false;
    }

    return true;
  }

  router.navigate(['/auth']);
  return false;
};
