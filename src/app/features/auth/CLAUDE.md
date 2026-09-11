# features/auth/

Authentication and account management. Supabase Auth handles sessions; the auth guard in `core/guards/` enforces access rules based on `auth-store` signals.

## components/

- `login/` — email + password sign-in; on success redirects based on approval state (see flow below)
- `signup/` — new account registration; email + password (min 6 chars) required, name is optional; newly registered users land on `/wait-to-approve`

Both components own **only their form content** — no card or container styling. The white card wrapping them lives in `auth-page`. Each component follows this field pattern:
- `matPrefix` `mat-icon` for field type cue (colors overridden to `rgba(0,0,0,0.45)` via `.field-icon` class — required because the global theme sets all icons to white)
- `mat-icon-button matSuffix` for password visibility toggle, driven by a `showPassword = signal(false)` and `togglePassword()` method
- `mat-flat-button` submit, styled dark-green via `--mdc-filled-button-container-color: rgb(57, 72, 60)` and `--mdc-filled-button-label-text-color: white`

## pages/

### `auth/` — container page

**Layout:** brand header (forest icon + "TomProdCom" name) above a white card. The card has two native `<button class="auth-tab">` tabs at the top that call `setMode(bool)` — the active tab gets an underline via `box-shadow: inset 0 -2px 0 rgb(57, 72, 60)`. Below the tabs, `@if (isSignup())` renders either `<app-signup>` or `<app-login>`.

- `:host` is a flex column, centered both axes, dark-green background, `overflow-y: auto`
- `.auth-wrapper` is `max-width: 420px` (440px on `@include md`), contains brand + card stacked with `gap: var(--space-6)`
- The card uses `border-radius: 16px` and `box-shadow: 0 8px 40px rgba(0,0,0,0.28)`
- The `@Output() toggleAuth` on `LoginComponent` is preserved for backward compatibility but the tab buttons in the page are the primary toggle mechanism

### `reset-password/` — password recovery

Handles the Supabase magic-link callback for password reset.

- Password reset email is triggered from `LoginComponent` via `supabaseService.client.auth.resetPasswordForEmail()`.
- Redirect URL is hardcoded to `https://tom-prod-com.web.app/reset-password`.
- On load, listens to `onAuthStateChange`; the form only becomes active when the event is `PASSWORD_RECOVERY` and a valid session exists.
- Validates that new password and confirm-password match (min 6 chars each), then calls `supabaseService.auth.updateUser({ password })`.
- On success navigates to `/auth`.

**Layout:** mirrors the auth page — same brand header above a white card. The card has a `.card-header` section (lock_reset icon + title, separated by a `border-bottom`) and then the form or a loading state below.
- Both password fields use the same prefix icon + visibility toggle pattern as the login/signup components
- Loading state (while waiting for `PASSWORD_RECOVERY` event): centered spinner + `RESET_PASSWORD.VERIFYING` translation key
- "Back to login" is a `mat-button` (text variant) with `arrow_back` icon, centered below the submit button

### `user/` — profile and admin panel

Accessible to **all authenticated and approved users**, but content is conditional:

- **All users** see their own profile information (name, email, role).
- **Admins additionally** see `ApproveUserComponent` (pending users) and `UsersListComponent` (all approved users with role management).

This page fetches unapproved users on init via `authStore.fetchUnapprovedUsers()`. The count badge on the user-page navigation link reflects pending approvals.

**Layout:**
- Standard `.page-header` strip (matches settings/clients) with the `NAVBAR.ACCOUNT` title.
- `:host` uses `flex: 1; min-height: 0; overflow-y: auto` — the whole page scrolls.
- `.page-content` is centered at `max-width: 720px` on desktop (`@include md`).
- **Profile card** (`.profile-card`): frosted dark card (`rgba(255,255,255,0.08)`), centered column layout — 72px avatar circle → name in `mat-title-large` → email + role rows with icons → full-width logout button. Role is displayed as a pill chip (`.role-chip`). The logout button uses `--mdc-outlined-button-*` CSS custom properties for dark-background styling.
- **Admin section** (`.admin-section`): stacks `ApproveUserComponent` (only when pending users exist) and `UsersListComponent` below the profile card with `gap: var(--space-4)`. Both components receive no inputs — they self-fetch from `authStore`.

### `wait-to-approve/` — approval pending

Shown to authenticated but not-yet-approved users.

- **No automatic polling.** The page has a manual `tryRefresh()` button that calls `authStore.refreshUserData()` and then tries to navigate to `/offer`. If the user has been approved since their last check, navigation succeeds; otherwise the guard keeps them on this page.

**Layout:** single frosted dark card centered on the dark-green background (same glass style as the user profile card).
- 80px circle icon wrapper with `pending_actions` icon
- `AUTH.WAIT_TO_APPROVE.HEADING` as the card title (`mat-title-large`), body text from `AUTH.WAIT_TO_APPROVE.TITLE`
- `mat-stroked-button` with refresh icon, styled for dark background via `--mdc-outlined-button-*` properties
- Card: `max-width: 400px` (460px + more padding on `@include md`)

## i18n keys added to auth

| Key | ro | hu |
|-----|----|----|
| `AUTH.WAIT_TO_APPROVE.HEADING` | "Cont în așteptare" | "Fiók jóváhagyásra vár" |
| `RESET_PASSWORD.VERIFYING` | "Se verifică sesiunea..." | "Munkamenet ellenőrzése..." |

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
