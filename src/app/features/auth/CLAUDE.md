# features/auth/

Authentication and account management. Supabase Auth handles sessions; the auth guard in `core/guards/` enforces access rules based on `auth-store` signals.

## components/

- `login/` — email + password sign-in; on success redirects based on approval state (see flow below)
- `signup/` — new account registration; email + password (min 6 chars) required, name is optional; newly registered users land on `/wait-to-approve`

## pages/

### `auth/` — container page

Renders `LoginComponent` or `SignupComponent` based on an `isSignupMode` signal. Tab-like toggle between modes.

### `reset-password/` — password recovery

Handles the Supabase magic-link callback for password reset.

- Password reset email is triggered from `LoginComponent` via `supabaseService.client.auth.resetPasswordForEmail()`.
- Redirect URL is hardcoded to `https://tom-prod-com.web.app/reset-password`.
- On load, listens to `onAuthStateChange`; the form only becomes active when the event is `PASSWORD_RECOVERY` and a valid session exists.
- Validates that new password and confirm-password match (min 6 chars each), then calls `supabaseService.auth.updateUser({ password })`.
- On success navigates to `/auth`.

### `user/` — profile and admin panel

Accessible to **all authenticated and approved users**, but content is conditional:

- **All users** see their own profile information (name, email).
- **Admins additionally** see `ApproveUserComponent` (pending users) and `UsersListComponent` (all approved users with role management).

This page fetches unapproved users on init via `authStore.fetchUnapprovedUsers()`. The count badge on the user-page navigation link reflects pending approvals.

### `wait-to-approve/` — approval pending

Shown to authenticated but not-yet-approved users.

- **No automatic polling.** The page has a manual `tryRefresh()` button that calls `authStore.refreshUserData()` and then tries to navigate to `/offer`. If the user has been approved since their last check, navigation succeeds; otherwise the guard keeps them on this page.

## Auth flow

```
Unauthenticated
    → authGuard redirects to /auth

Login succeeds
    → authStore.approved() is false   → /wait-to-approve
    → authStore.approved() is true    → /offer

Signup succeeds
    → always → /wait-to-approve

Admin approves user
    → profiles.approved = true
    → user can now access protected routes

Admin denies user
    → user record permanently hard-deleted from Supabase (no recovery)

/wait-to-approve
    → manual refresh button → tries /offer (guard redirects back if still unapproved)

Admin routes (/settings, /deleted)
    → authGuard checks role = 'admin'; non-admins redirected to /offer
```

State lives in `@core/store/auth-store`. Role (`'user' | 'admin'`) and approval status are persisted to `localStorage`.
