# features/auth/

Authentication and account management. Supabase Auth handles sessions; the auth guard in `core/guards/` enforces access rules.

## components/
- `login/` — email + password sign-in form; on success the guard redirects based on role/approval state
- `signup/` — new account registration; newly registered users land on `/wait-to-approve`

## pages/
- `auth/` — container that renders login and signup tabs
- `reset-password/` — Supabase password-reset flow (handles the magic-link callback)
- `user/` — account profile page; change display name, language preference
- `wait-to-approve/` — shown to authenticated but unapproved users; polls for approval status

## Auth flow
1. Unauthenticated → `authGuard` redirects to `/auth`
2. Login succeeds → guard checks `approved` flag in `auth-store`
3. Not approved → `/wait-to-approve`
4. Approved, role `admin` → can access `/settings`, `/deleted`
5. Approved, role `user` → redirected away from admin routes

State lives in `@core/store/auth-store`.
