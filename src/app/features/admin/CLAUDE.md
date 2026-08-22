# features/admin/

Admin-only functionality: user approval, product management, price management. All routes protected by `authGuard` with `requiredRole: 'admin'`.

## components/
- `add-product/` — form to create a new product with unit, category, and size fields
- `approve-user/` — toggles a pending user's approved status
- `change-prices/` — bulk price editor for ClientType × Category combinations
- `update-products/` — edit existing product details
- `users-list/` — table of all registered users with approve/block actions

## pages/
- `settings/` — shell page that hosts `ChangePricesComponent`, `UpdateProductsComponent`, and `AddProductComponent` in tabs/sections

## Pricing rules
Price changes here feed into the cart calculation. Always consult `SPEC.md` before modifying price logic — PF (individual) and PJ (company) clients use different price tiers.
