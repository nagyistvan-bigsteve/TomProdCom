import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router } from '@angular/router';
import { useAuthStore, UserRole } from '@core/store/auth-store';
import { authGuard } from './auth-guard.service';

describe('authGuard', () => {
  const isAuthenticated = signal(false);
  const approved = signal(false);
  const role = signal<UserRole>(null);
  let navigate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    isAuthenticated.set(false);
    approved.set(false);
    role.set(null);
    navigate = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: useAuthStore, useValue: { isAuthenticated, approved, role } },
        { provide: Router, useValue: { navigate } },
      ],
    });
  });

  const run = (data: Record<string, unknown>) =>
    TestBed.runInInjectionContext(() =>
      authGuard({ data } as unknown as ActivatedRouteSnapshot),
    );

  const signedIn = (asRole: UserRole, isApproved = true) => {
    isAuthenticated.set(true);
    approved.set(isApproved);
    role.set(asRole);
  };

  describe('protected route', () => {
    it('sends a signed-out user to /auth', () => {
      expect(run({ requiresApproval: true })).toBe(false);
      expect(navigate).toHaveBeenCalledWith(['/auth']);
    });

    it('sends an unapproved user to /wait-to-approve', () => {
      signedIn('user', false);
      expect(run({ requiresApproval: true })).toBe(false);
      expect(navigate).toHaveBeenCalledWith(['/wait-to-approve']);
    });

    it('lets an approved user in', () => {
      signedIn('user');
      expect(run({ requiresApproval: true })).toBe(true);
      expect(navigate).not.toHaveBeenCalled();
    });
  });

  describe('admin route', () => {
    const adminRoute = { requiresApproval: true, requiredRole: 'admin' };

    it('sends an approved non-admin to /offer', () => {
      signedIn('user');
      expect(run(adminRoute)).toBe(false);
      expect(navigate).toHaveBeenCalledWith(['/offer']);
    });

    it('lets an approved admin in', () => {
      signedIn('admin');
      expect(run(adminRoute)).toBe(true);
    });

    it('does not let an unapproved admin in', () => {
      signedIn('admin', false);
      expect(run(adminRoute)).toBe(false);
      expect(navigate).toHaveBeenCalledWith(['/wait-to-approve']);
    });
  });

  describe('public route (auth pages)', () => {
    it('lets a signed-out user in', () => {
      expect(run({ requiresApproval: false })).toBe(true);
    });

    it('lets an unapproved user in (wait-to-approve page)', () => {
      signedIn('user', false);
      expect(run({ requiresApproval: false })).toBe(true);
    });

    it('sends an approved user on to /offer', () => {
      signedIn('user');
      expect(run({ requiresApproval: false })).toBe(false);
      expect(navigate).toHaveBeenCalledWith(['/offer']);
    });
  });
});
