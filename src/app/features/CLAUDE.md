# features/

Each subdirectory is a self-contained feature slice. A feature owns its components, pages, services, and store slices. Features may import from `@core` and `@shared` but should avoid importing from sibling features.

## Feature layout convention
```
features/<name>/
  components/   UI building blocks used within this feature's pages
  pages/        Routed container components
  services/     Supabase query services (RxJS Observables)
  store/        NgRX Signals state slices for this feature
```

## Feature index

| Feature | Domain | Key routes |
|---|---|---|
| `admin/` | User approval, product/price admin | `/settings`, `/deleted` |
| `auth/` | Login, signup, password reset, account | `/auth`, `/reset-password`, `/user`, `/wait-to-approve` |
| `clients/` | Client CRUD, history | `/clients` |
| `coming-wares/` | Incoming stock tracking | `/coming-wares`, `/coming-wares/:id/:verified` |
| `orders/` | Order listing, offer creation workflow, PDF | `/offer/*`, `/orders`, `/offers`, `/deleted` |
| `products/` | Product catalog, stock, pricing | `/products` |
