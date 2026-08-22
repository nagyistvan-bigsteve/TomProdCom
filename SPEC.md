# TomProdCom — Application Specification

> **Purpose:** This document is the source of truth for understanding, extending, refactoring, and maintaining the TomProdCom application.
>
> **Primary audience:** AI coding agents (especially Claude Code), developers, and maintainers.
>
> **Rule:** Read this file before making non-trivial changes to the application. When the existing implementation conflicts with this specification, do not silently choose one: identify the conflict, determine whether the specification or implementation is authoritative, and update the specification when the intended behavior changes.

---

## 1. Project Overview

TomProdCom is a business application for employees of a lumber/timber depot.

The application allows employees to manage:

- customers;
- products and inventory;
- offers;
- orders;
- pricing and special pricing;
- user accounts and approvals.

The application is primarily used from mobile phones in the depot and is implemented as a **mobile-first Progressive Web App (PWA)** but a tablet and desktop design is needed also.

The core workflow is:

```text
User authentication
        ↓
User approval
        ↓
Start / Offer
        ↓
Select products
        ↓
Set quantity + quality
        ↓
Select / create customer
        ↓
Review offer
        ↓
Save offer/order
        ↓
Offer can be transformed into an order
        ↓
Order management
        ↓
Delivery
```

The application must make it possible to create and manage an order quickly from a phone while still providing enough flexibility to modify products, quantities, customers, descriptions, and prices.

---

## 2. Product Goals

### 2.1 Primary goals

1. Make order creation fast and intuitive.
2. Make the application usable on a phone with minimal friction.
3. Make stock and order information easy to inspect.
4. Give administrators a clear overview of users, orders, and inventory.
5. Keep business rules centralized and predictable.
6. Support Romanian and Hungarian throughout the application.
7. Provide a foundation for multiple warehouses.
8. Make the codebase understandable and maintainable by both humans and AI agents.

### 2.2 UX principles

The application should be:

- modern;
- intuitive;
- fast;
- mobile-first;
- touch-friendly;
- visually consistent;
- forgiving of user mistakes;
- optimized for repetitive depot workflows.

Common actions should require as few interactions as reasonably possible.

The UI must not sacrifice usability for architectural purity.

---

## 3. Technology Stack

### Current stack

- Angular 19
- TypeScript
- Angular Material
- Supabase
- Supabase Authentication
- Supabase database/PostgreSQL
- Supabase Row Level Security (RLS)
- PWA / Angular Service Worker
- Signals
- SignalStore where appropriate
- Standalone Angular components
- `inject()` dependency injection
- Angular routing
- Angular internationalization through `TranslateService`, translation files, and the translate pipe

### Planned upgrades

- Angular 21 upgrade
- Improved desktop and tablet layout
- Multi-warehouse support
- New-stock / ordered-stock functionality
- Improve stock updates
- Improved delivery-status management

The Angular upgrade should be performed as a controlled migration. Do not combine a major framework upgrade with unrelated large-scale architectural changes unless explicitly requested.

---

# 4. Architectural Principles

## 4.1 General

Prefer simple, explicit, maintainable solutions over unnecessary abstractions.

Before introducing a new abstraction, inspect whether an equivalent pattern already exists.

Do not create multiple competing patterns for the same problem.

For example, if an existing feature uses a SignalStore for shared state, a new feature should not introduce an unrelated custom state-management pattern without a strong reason.

## 4.2 Angular

Use modern Angular conventions:

- standalone components;
- `inject()`;
- Signals where they improve local/reactive state;
- SignalStore for appropriate feature/application state;
- Angular Router;
- Angular Material where appropriate;
- typed forms;
- reusable components for genuinely reusable UI.

Avoid unnecessary:

- inheritance;
- global mutable state;
- deeply nested component communication;
- duplicated HTTP/database logic;
- duplicated business rules;
- large "god components".

## 4.3 Supabase

All backend/database communication goes through Supabase.

Supabase is responsible for:

- authentication;
- database access;
- authorization through RLS;
- persistence;
- database functions/RPCs where appropriate.

Do not introduce a separate backend service unless explicitly requested.

Do not trust frontend role checks as a security mechanism.

Frontend guards improve UX; **Supabase RLS is the actual security boundary**.

## 4.4 Business logic

Business rules should not be scattered across templates.

Prefer:

```text
UI
 ↓
Component / feature state
 ↓
Domain/service/store logic
 ↓
Supabase
```

Business rules that affect security, pricing, permissions, stock, or data integrity should be enforceable independently of the UI.

---

# 5. Authentication and Authorization

## 5.1 Roles

There are two application roles:

- `user`
- `admin`

### User

An approved user can perform normal depot operations:

- view/create/edit offers;
- view/create/edit orders where permitted;
- manage customers;
- view products and stock;
- use the application workflows.

### Admin

An admin has all user permissions plus administrative capabilities:

- approve new users;
- deny new users;
- upgrade a user to admin;
- downgrade an admin to user;
- delete/restore administrative records where permitted;
- manage administrative settings;
- manage product/pricing configuration.

Admins must not be able to accidentally remove their own ability to administer the application without an appropriate safeguard.

---

## 5.2 User approval

A newly registered account is not automatically an approved application user.

The lifecycle is:

```text
Sign up
   ↓
Account created
   ↓
approved = false
   ↓
Wait-to-approve page
   ↓
Admin approves
   ↓
User can access protected application
```

The user approval state is separate from authentication.

A user may be successfully authenticated by Supabase but still be unable to access protected application functionality.

---

## 5.3 Public routes

The following routes do **not** require application approval:

- `/auth`
- `/wait-to-approve`
- `/reset-password`

The reset-password route is special and should only be accessible through a valid password-reset flow.

---

## 5.4 Protected routes

All normal application functionality requires:

1. authenticated user;
2. approved user.

Admin-only operations additionally require:

3. admin role.

Route guards should reflect these requirements.

The frontend must never be considered the final authorization layer.

---

# 6. Core Domain Model

The exact database schema is defined by the Supabase project. The conceptual domain is described below.

## 6.1 User

A user should conceptually contain:

- authentication identity;
- display/profile information;
- role;
- approval status;
- creation/update information.

Relevant states include:

```text
authenticated + unapproved
authenticated + approved user
authenticated + approved admin
```

---

## 6.2 Customer

A customer can be either:

- PF — persoană fizică;
- PJ — persoană juridică.

A customer may contain information such as:

- name;
- phone;
- email;
- address;
- customer type;
- company/legal information where applicable;
- tax-related information;
- pricing classification.

The exact fields should follow the existing database model.

### PJ pricing rule

A PJ customer that pays taxes may qualify for special pricing.

This rule must be centralized rather than duplicated across offer/order components.

---

## 6.3 Product

A product represents an item sold by the depot.

A product may have:

- name;
- category;
- unit;
- dimensions/size;
- quality;
- standard price;
- special price(s);
- stock;
- warehouse-specific stock in the future.

Products may exist without a currently configured price.

The application must be able to identify products that require price configuration.

---

## 6.4 Category

Products belong to categories.

Categories may have:

- name;
- standard pricing;
- special pricing;
- category-level configuration.

Pricing can be configured at category level as well as product level.

---

## 6.5 Stock

Stock represents the currently available inventory.

The current application primarily manages stock directly.

Future versions should support:

```text
current stock
+
ordered stock / incoming stock
=
future availability
```

Do not implement future stock semantics by pretending incoming stock is already available.

---

## 6.6 Offer

An offer is a commercial proposal for a customer.

An offer contains:

- customer;
- products;
- quantities;
- product qualities;
- prices;
- possible special prices;
- description/additional information;
- creation metadata;
- relevant dates/status.

An offer is not necessarily an order.

---

## 6.7 Order

An order represents an accepted/active customer order.

An order contains:

- customer;
- products;
- quantities;
- quality;
- prices;
- description;
- creation date;
- delivery date;
- delivery status;
- ordering/admin priority where applicable.

An order can eventually be marked as delivered.

---

## 6.8 Deleted entities

Deleted records may be soft-deleted where appropriate.

Deleted orders should be recoverable from the Deleted page.

Deleted users follow a separate lifecycle and are permanently erased after 10 days.

Do not assume that "delete" always means immediate physical deletion.

---

# 7. Navigation

The application currently contains these conceptual routes/pages:

```text
/auth
/wait-to-approve
/reset-password

/user

/offer
/offer/create
/offer/client
/offer/overview

/orders
/offers

/clients
/products
/settings
/deleted
```

The `/offer` page may eventually be renamed to a more general start/dashboard page.

Avoid hard-coding the assumption that `/offer` must always be called "offer" in UI text.

---

# 8. Page Specifications

## 8.1 Auth Page

### Purpose

Entry point for authentication.

### Features

- sign up;
- log in;
- reset password.

### Rules

- does not require application approval;
- unauthenticated users can access it;
- after successful sign-up, redirect to `/wait-to-approve`;
- an already authenticated and approved user should not unnecessarily remain on the authentication page.

---

# 8.2 Wait-to-Approve Page

### Purpose

Inform newly registered users that their account requires administrator approval.

### Rules

- does not require application approval;
- requires the user to be authenticated;
- user remains here until approved;
- once approved, the user can enter the protected application.

The page should clearly communicate that the account exists but is awaiting administrator approval.

Avoid forcing users to repeatedly sign up.

---

# 8.3 Reset Password Page

### Purpose

Allow a user to set a new password after following the password-reset email.

### Rules

- does not require application approval;
- should only be reachable through the valid reset-password flow;
- invalid/expired reset links must be handled gracefully;
- after successful reset, redirect to the appropriate authentication/application flow.

---

# 8.4 User Page

### Purpose

Personal profile and user administration.

### Normal user

A user can:

- view their own information;
- manage permitted profile information.

### Admin

An admin can additionally:

- see unapproved users;
- approve users;
- deny users;
- upgrade a user to admin;
- downgrade an admin to user.

### Important rule

The user profile must be approved before protected application access is granted.

---

# 8.5 Start / Offer Page

Current conceptual route:

```text
/offer
```

This may become the application's main start page in the future.

### Features

- start creating an offer;
- navigate to products/inventory;
- provide quick access to common depot workflows.

### Access

Approved users only.

### UX

This page should prioritize the actions users perform most frequently.

---

# 8.6 Offer Create Page

Route:

```text
/offer/create
```

### Purpose

Create the product list for an offer.

### Features

Users can:

- browse/select products;
- set product quantity;
- set product quality;
- view selected products;
- edit selected products;
- remove selected products;
- continue to customer selection.

The selected products behave similarly to a shopping cart.

### UX requirements

The cart should remain easy to edit.

Users should not lose entered quantities or product selections when navigating between offer creation steps.

---

# 8.7 Offer Client Page

Route:

```text
/offer/client
```

### Features

- select an existing customer;
- create a new customer;
- edit a selected customer;
- continue to offer overview.

The customer-selection workflow should minimize unnecessary navigation.

If a customer is created during offer creation, the newly created customer should become available immediately for the current offer.

---

# 8.8 Offer Overview Page

Route:

```text
/offer/overview
```

### Purpose

Final review and pricing before saving an offer/order.

### Features

- view selected customer;
- change customer;
- view selected products;
- update product list;
- choose special price for a product;
- choose special price for a category;
- review customer information;
- add/edit additional offer information;
- save the offer/order.

After saving:

```text
offer/order created
        ↓
redirect to offer/order details
```

### Important

Pricing decisions should use a single consistent pricing model.

Avoid implementing special-price calculations independently in:

- offer create;
- offer overview;
- order details;
- print view.

---

# 8.9 Orders Page

Route:

```text
/orders
```

### Purpose

Manage existing orders.

### Table filters

The order list should support categories such as:

- all;
- open;
- closed;
- for today.

### Sorting

Users can sort by:

- delivery date;
- creation date.

Admins additionally have an order-priority sorting mechanism using drag and drop.

The priority/order position must be persisted reliably.

### Search

Provide a single search input that can search by:

- customer name;
- customer address.

The UI should avoid forcing users to choose which field they are searching.

### Date filtering

Users can select a period and see orders created during that period.

### Row actions

Selecting an order should allow the user to:

- open details;
- view more information.

Admins may additionally:

- delete the order.

### Order details

A user can:

- view all order details;
- close details and return to the table;
- call the customer by tapping the phone number;
- open the customer address in maps;
- edit the order description;
- add a product;
- edit a product;
- delete a product;
- print order details;
- mark the order as delivered.

### Delivery

"Delivered" should be represented as a meaningful domain state, not merely a visual flag.

Future delivery-status functionality should build on this model.

---

# 8.10 Offers Page

Route:

```text
/offers
```

### Purpose

Manage saved offers.

The offers page is similar to the orders page but intentionally simpler.

### List behavior

The table supports:

- search by customer name/address;
- date-period selection.

The current offers table does not need the same filtering/sorting system as orders.

### Offer details

Offer details should support behavior similar to order details.

Instead of "mark as delivered", the offer provides:

#### Create order command

Redirect to:

```text
/offer/overview
```

The existing offer data should populate the workflow.

The user can decide whether the original offer should:

- remain;
- be deleted.

#### Transform into order

Convert the offer directly into an order using its current data.

The transformation should preserve:

- customer;
- products;
- quantities;
- qualities;
- prices;
- special prices;
- relevant description/data.

The operation should not accidentally alter the original offer unless the intended business rule explicitly requires it.

---

# 8.11 Clients Page

Route:

```text
/clients
```

### Features

- list/search customers;
- select customer;
- create customer;
- view customer information;
- edit customer information;
- view order history.

Selecting a customer should provide a clear transition between:

```text
customer information
customer order history
```

---

# 8.12 Products Page

Route:

```text
/products
```

### Features

- list products;
- view stock;
- search products;
- sort by stock;
- edit stock.

### UX

The product list is an inventory tool, not merely a product catalogue.

Stock information must therefore be prominent.

The page should work well on a phone while still being suitable for a future desktop layout.

---

# 8.13 Settings Page

Route:

```text
/settings
```

### Features

Product management:

- add product;
- edit product;
- configure product special price;
- edit stock;
- add prices to products without prices.

Pricing management:

- edit category prices;
- edit special prices.

### Security

These are configuration operations and may require elevated permissions depending on the specific operation.

If an operation is admin-only, enforce this in Supabase authorization as well as the UI.

---

# 8.14 Deleted Page

Route:

```text
/deleted
```

### Features

- view deleted orders;
- restore deleted orders.

### Deleted users

Deleted users are permanently erased after 10 days.

This retention behavior should be implemented deliberately and safely.

The system should avoid accidental permanent deletion of active users.

---

# 9. Offer and Order Workflow

The canonical workflow is:

```text
Start
 ↓
Create offer
 ↓
Select products
 ↓
Set quantity + quality
 ↓
Select/create customer
 ↓
Review
 ↓
Apply pricing
 ↓
Save offer
 ↓
Offer details
 ↓
 ┌───────────────────────┐
 │                       │
 ↓                       ↓
Keep as offer       Transform to order
                         ↓
                       Order
                         ↓
                    Delivery
```

An offer may also be used as the starting point for creating an order while allowing the user to make changes.

---

# 10. Pricing Rules

Pricing is a core business domain and must be treated carefully.

Potential pricing sources include:

1. standard product price;
2. category price;
3. special product price;
4. special category price;
5. customer-specific/business classification rules.

The exact priority of pricing sources must be defined centrally in the pricing logic.

Do not calculate prices independently in multiple components.

If the pricing hierarchy changes, update the central pricing behavior and all dependent tests.

---

# 11. Customer Pricing

Customers may be:

```text
PF
PJ
```

A PJ customer may receive special pricing when the relevant tax/business condition applies.

The UI should expose only the pricing choices relevant to the selected customer.

Pricing must be reproducible: the saved order/offer should retain the actual commercial price used rather than relying exclusively on a future recalculation of today's product price.

This is especially important because product prices can change after an order has been created.

---

# 12. Inventory and Stock

Current functionality:

- view stock;
- edit stock;
- use stock information while creating orders.

Future functionality:

- ordered/incoming stock;
- stock per warehouse;
- warehouse-specific inventory;
- delivery-related stock changes.

The system should distinguish conceptually between:

```text
available stock
incoming/ordered stock
reserved stock
```

even if not all three are implemented yet.

Do not implement future inventory concepts prematurely unless the feature is explicitly requested.

---

# 13. Multi-Warehouse Support

A second warehouse is planned.

At application entry, the user should eventually be able to select the warehouse where they are currently working.

Future architecture should support:

```text
User
 ↓
Current warehouse
 ↓
Products / stock / orders
```

The warehouse should not be hard-coded into individual components.

When multi-warehouse support is introduced, warehouse context should be represented centrally and propagated to relevant queries/state.

Avoid creating a design where every component must independently determine the current warehouse.

---

# 14. Internationalization

The application supports:

- Hungarian (`hu`);
- Romanian (`ro`).

Users can switch language at any time through a language toggle.

Current implementation uses:

- `TranslateService`;
- translation files;
- translate pipe in templates.

## Rules

Every user-visible string must be translatable.

Do not introduce hard-coded user-facing text into components/templates unless there is a documented reason.

When adding a feature:

1. add Romanian translations;
2. add Hungarian translations;
3. use translation keys in the UI;
4. verify labels, errors, dialogs, empty states, buttons, and accessibility labels.

Translation keys should be descriptive and consistent.

Avoid keys such as:

```text
text1
button2
label3
```

Prefer domain-oriented keys such as:

```text
orders.details.markDelivered
orders.empty
customers.create
products.stock
```

---

# 15. PWA Requirements

The application is a Progressive Web App.

Mobile use is the primary target.

Important requirements:

- responsive layout;
- touch-friendly controls;
- fast navigation;
- usable forms on small screens;
- no unnecessary horizontal scrolling;
- appropriate loading states;
- appropriate offline/service-worker behavior;
- installable PWA behavior.

When changing caching or service-worker behavior, verify that updated:

- translations;
- application code;
- configuration;
- assets

become available correctly.

Do not introduce caching that can cause users to operate on stale business-critical data.

---

# 16. Mobile-First Design

Mobile is the primary interface.

### Requirements

Buttons and controls should be easy to tap.

Forms should:

- use appropriate input types;
- avoid unnecessary fields;
- preserve entered values;
- minimize typing;
- support fast repeated data entry.

Lists should be designed for narrow screens.

Complex tables may need:

- responsive cards;
- horizontal scrolling where appropriate;
- condensed columns;
- details views.

Do not simply shrink a desktop table until it becomes unusable.

---

# 17. Desktop Design

Desktop support is planned.

The current application should remain mobile-first, but new UI should avoid decisions that make desktop support unnecessarily difficult.

Future desktop layouts should take advantage of:

- wider tables;
- side-by-side panels;
- persistent navigation;
- larger overview dashboards.

Desktop implementation should preferably reuse the same feature components and business logic.

---

# 18. Accessibility

The application should aim for modern accessibility standards, with **WCAG 2.2 AA** as the target.

Pay particular attention to:

- keyboard accessibility;
- focus management;
- form labels;
- color contrast;
- semantic buttons/links;
- accessible dialogs;
- error messages;
- screen-reader labels;
- touch target size.

Do not rely solely on color to communicate status.

---

# 19. Loading, Error, and Empty States

Every data-driven page should consider:

### Loading

Show a clear loading state without causing layout instability.

### Error

Show a useful translated error message.

Do not expose raw database/Supabase errors to normal users.

### Empty

Explain what the empty state means and, where appropriate, provide an action.

Examples:

```text
No orders found.
No customers found.
No products found.
No deleted orders.
No users awaiting approval.
```

---

# 20. Data Integrity

The application deals with real commercial data.

Never silently discard:

- customer information;
- selected products;
- quantities;
- prices;
- offer/order descriptions.

When a user navigates through a multi-step workflow, state must remain consistent.

When saving an offer/order:

- validate required data;
- prevent invalid quantities;
- validate product/customer references;
- preserve the actual price used;
- handle failures without falsely displaying success.

---

# 21. Delete and Restore Behavior

Deletion must be intentional.

For destructive actions:

- use confirmation where appropriate;
- explain what will happen;
- prevent accidental taps;
- update the UI after successful deletion;
- handle failed deletion.

Deleted orders should be restorable.

A restore operation must not create duplicate records.

---

# 22. Printing

Offers/orders should have a print-friendly representation.

The printed document should prioritize:

- customer information;
- order/offer information;
- product list;
- quantities;
- qualities;
- prices where applicable;
- totals where applicable;
- relevant dates;
- additional description.

Printing should not depend on the visual mobile UI layout.

Prefer a dedicated print layout/CSS or dedicated print representation.

---

# 23. External Actions

The application should support common phone actions.

### Phone

Clicking a customer phone number should use an appropriate `tel:` link.

### Maps

Clicking a customer address should open a suitable maps application/service.

These actions should be progressively enhanced: the application should remain usable even if the device does not support the external action.

---

# 24. Security Requirements

Security is a first-class requirement.

### Never trust

Do not trust:

- hidden buttons;
- disabled buttons;
- route guards;
- frontend role values;
- client-side approval checks.

### Supabase

RLS policies must enforce access to protected data.

Admin-only database operations must be protected server-side/database-side.

Users must not be able to manipulate another user's data merely by modifying frontend requests.

### Sensitive operations

Pay particular attention to:

- user approval;
- role changes;
- deletion;
- restoration;
- pricing changes;
- stock changes.

---

# 25. State Management

Use the simplest state mechanism appropriate to the feature.

### Local component state

Use Signals/local state for:

- UI state;
- toggles;
- local form state;
- temporary selections.

### Shared feature state

Use SignalStore or the established project pattern for:

- multi-step offer creation;
- cart/product selection;
- order list state;
- shared application data.

Do not introduce a store merely because one could be used.

Do not put temporary UI state into global state without a reason.

---

# 26. Forms

Forms are central to TomProdCom.

Forms should:

- be strongly typed;
- validate required fields;
- show useful translated validation messages;
- preserve user input when possible;
- prevent invalid submissions;
- provide clear save/cancel actions.

Avoid excessive validation that makes fast depot workflows frustrating.

---

# 27. AI Agent Development Rules

This section is especially important.

## 27.1 Before changing code

Before implementing a feature, an AI agent should:

0. **Invoke the matching skill/plugin first:**
   - Use the `supabase` skill and Supabase MCP plugin before touching any database or auth code.
   - Use the `angular-developer` skill before writing Angular code (components, services, stores, routing).
   - Use `context7` to fetch current library docs before using any third-party API (Angular, Supabase, NgRx, Material, RxJS, etc.).
   - Use `supabase-postgres-best-practices` before writing or changing any Postgres schema, RLS, or functions.
1. Read this `SPEC.md`.
2. Identify the relevant domain/page.
3. Inspect the existing implementation.
4. Search for existing components/services/stores that solve similar problems.
5. Inspect relevant Supabase queries/RPCs/types.
6. Inspect existing tests.
7. Inspect translation files for relevant terminology.
8. Understand routing and authorization requirements.
9. Make the smallest coherent change that solves the requested problem.

Do not immediately start editing the first component whose name matches the task.

---

## 27.11 Keeping documentation in sync

When business logic changes (pricing, auth, stock, workflow, domain model, customer rules), update `SPEC.md` to reflect the new intended behavior before or immediately after implementing the change.

When architecture conventions change (new patterns, new layers, new conventions), update `CLAUDE.md`.

Do not leave the specification describing the old behavior after a deliberate change.

If uncertain whether a change is intentional or accidental, preserve the old behavior and ask.

---

## 27.2 Do not invent architecture unnecessarily

Before creating:

- a new service;
- a new store;
- a new utility;
- a new component;
- a new database function;
- a new abstraction;

search the existing codebase.

Reuse existing architecture where appropriate.

If existing architecture is clearly problematic, explain the issue and propose a refactor rather than silently creating a second architecture.

---

## 27.3 Avoid scope creep

If asked:

> "Improve the desktop view of the orders page"

do not automatically:

- rewrite the order architecture;
- upgrade Angular;
- replace state management;
- redesign the database;
- rewrite all components.

Implement the requested change while preserving existing behavior.

If a larger change is genuinely required, identify it separately.

---

## 27.4 Preserve business behavior

A refactor must not unintentionally change:

- pricing;
- authorization;
- approval;
- stock;
- order states;
- offer/order transformation;
- customer classification;
- deletion behavior.

If behavior changes intentionally, tests and this specification should be updated.

---

## 27.5 Database changes

Before changing Supabase schema:

1. inspect the existing schema;
2. identify dependencies;
3. inspect RLS policies;
4. inspect functions/RPCs;
5. inspect frontend types/queries;
6. consider existing data;
7. provide a migration when appropriate.

Never assume the database is disposable.

---

## 27.6 RLS

Any new table or protected operation should have an explicit authorization strategy.

Do not add a table and leave it publicly writable because the UI only exposes the operation to admins.

---

## 27.7 Translations

Every new user-facing string requires both:

- Hungarian;
- Romanian.

Do not leave English development text in production UI.

---

## 27.8 Tests

When modifying business logic:

- update existing tests;
- add tests for new behavior;
- test important edge cases.

High-priority test areas include:

- pricing;
- role/approval logic;
- offer → order transformation;
- stock;
- deletion/restoration;
- order filtering;
- customer classification.

Do not write tests merely to increase coverage. Tests should protect meaningful behavior.

---

## 27.9 Visual changes

When changing UI:

- preserve mobile usability;
- inspect existing design patterns;
- reuse existing Material components where appropriate;
- avoid introducing inconsistent spacing/typography;
- consider loading/error/empty states;
- consider both supported languages;
- consider accessibility.

A visual improvement is not successful if it breaks another screen size.

---

## 27.10 Angular upgrades

The planned Angular 19 → 21 migration should be treated as a dedicated project.

Before upgrading:

- inspect deprecated APIs;
- identify incompatible dependencies;
- identify test infrastructure issues;
- identify obsolete Angular patterns;
- clean up problematic architecture where useful.

During migration:

- keep changes reviewable;
- avoid unrelated feature changes;
- run tests/build/lint frequently;
- address migration warnings rather than suppressing them.

---

# 28. Recommended Feature Development Workflow

For a typical feature:

```text
1. Understand requirement
        ↓
1a. Invoke matching skills/plugins (angular-developer, supabase, context7, etc.)
        ↓
2. Read SPEC.md
        ↓
3. Inspect existing implementation
        ↓
4. Identify affected domain
        ↓
5. Inspect database/RLS
        ↓
6. Inspect state/services/components
        ↓
7. Plan minimal implementation
        ↓
8. Implement
        ↓
9. Add/update translations
        ↓
10. Add/update tests
        ↓
11. Run lint/typecheck/tests/build
        ↓
12. Review mobile UX
        ↓
13. Review authorization/security
        ↓
14. Update SPEC.md and CLAUDE.md if behavior or conventions changed
```

---

# 29. Definition of Done

A feature is not considered complete merely because the UI works in the happy path.

A feature is done when appropriate items below are satisfied:

- [ ] Requested functionality is implemented.
- [ ] Existing functionality remains intact.
- [ ] Authorization is correct.
- [ ] Supabase/RLS behavior is correct where applicable.
- [ ] Loading state exists.
- [ ] Error state exists.
- [ ] Empty state exists where applicable.
- [ ] Romanian translations exist.
- [ ] Hungarian translations exist.
- [ ] Mobile layout works.
- [ ] Accessibility has been considered.
- [ ] Existing relevant tests pass.
- [ ] New meaningful tests have been added where appropriate.
- [ ] TypeScript/build/lint checks pass where applicable.
- [ ] No unnecessary architecture was introduced.
- [ ] No unrelated refactoring was included.
- [ ] Documentation/specification has been updated if behavior changed.

---

# 30. Future Roadmap

The following features are planned or likely future work.

## High priority

### Angular 21 upgrade

Upgrade from Angular 19 to Angular 21 after appropriate refactoring and dependency preparation.

### Desktop UI

Introduce a dedicated desktop experience while retaining the mobile-first implementation.

### Multi-warehouse

Allow users to select their current warehouse and make stock/order data warehouse-aware.

### Ordered stock

Introduce incoming/ordered inventory.

### Delivery management

Expand order delivery status and provide administrators with an easy overview of delivery progress.

---

# 31. Future Architecture Direction

The application should gradually evolve toward a clear domain-oriented structure.

A possible conceptual organization is:

```text
src/
├── app/
│   ├── core/
│   │   ├── auth/
│   │   ├── guards/
│   │   ├── supabase/
│   │   └── ...
│   │
│   ├── shared/
│   │   ├── components/
│   │   ├── directives/
│   │   ├── pipes/
│   │   └── ...
│   │
│   ├── features/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── offers/
│   │   ├── orders/
│   │   ├── customers/
│   │   ├── products/
│   │   ├── settings/
│   │   └── deleted/
│   │
│   └── ...
│
└── ...
```

This is a direction, not a requirement to immediately reorganize the entire application.

Do not perform a large folder restructuring unless it provides a clear benefit.

---

# 32. Terminology

Use consistent terminology throughout the application.

| Concept   | Preferred English | Romanian      | Hungarian      |
| --------- | ----------------- | ------------- | -------------- |
| Customer  | Customer          | Client        | Ügyfél         |
| Product   | Product           | Produs        | Termék         |
| Offer     | Offer             | Ofertă        | Ajánlat        |
| Order     | Order             | Comandă       | Rendelés       |
| Stock     | Stock             | Stoc          | Készlet        |
| Delivered | Delivered         | Livrat        | Kiszállítva    |
| User      | User              | Utilizator    | Felhasználó    |
| Admin     | Admin             | Administrator | Adminisztrátor |
| Approval  | Approval          | Aprobare      | Jóváhagyás     |
| Warehouse | Warehouse         | Depozit       | Raktár         |
| Category  | Category          | Categorie     | Kategória      |

Use the project's existing translation terminology when it already differs from this table. Consistency is more important than literal translation.

---

# 33. Non-Goals

The following are not currently part of the core application unless explicitly requested:

- public customer-facing ordering;
- customer self-service accounts;
- online payments;
- accounting software replacement;
- full ERP functionality;
- CRM automation;
- delivery-driver application;
- automated logistics optimization.

The application is primarily an **internal depot sales, inventory, offer, and order management tool**.

---

# 34. Final Principles for AI Agents

When working on TomProdCom, follow these principles:

1. **Understand before editing.**
2. **Preserve existing business behavior.**
3. **Prefer existing patterns over new abstractions.**
4. **Keep business logic centralized.**
5. **Never rely on frontend security alone.**
6. **Treat Supabase RLS as a security boundary.**
7. **Keep mobile-first UX as the primary requirement.**
8. **Every user-facing feature must support Hungarian and Romanian.**
9. **Do not lose user-entered data during multi-step workflows.**
10. **Treat prices, stock, orders, and customer information as business-critical data.**
11. **Test meaningful business rules.**
12. **Avoid unrelated refactoring.**
13. **Make changes incrementally and keep them reviewable.**
14. **When behavior changes, update this specification.**
15. **When uncertain about an existing behavior, inspect the code and database before making assumptions.**

The goal is not simply to make the code compile.

The goal is to maintain a **reliable, secure, fast, intuitive, mobile-first business application that employees can use efficiently every day**.
