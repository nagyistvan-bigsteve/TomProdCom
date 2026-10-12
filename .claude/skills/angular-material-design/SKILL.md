---
name: angular-material-design
description: Angular Material UI/UX — spacing, typography, responsive layouts for this project
when-to-use: When creating or editing any component template, SCSS, or layout
user-invocable: true
paths: ["**/*.component.html", "**/*.component.scss", "**/styles.scss"]
effort: medium
---

# Angular Material Design Skill

**Purpose:** Produce consistent, genuinely responsive UI using Angular Material 19, Bootstrap 5 utilities, and this project's established design tokens. Mobile-first always — tablet and desktop layouts must be explicitly designed, not just scaled-up mobile.

---

## Project Design Tokens

These are the fixed values for this project. Do not invent new colors or override these without a strong reason.

### Colors

| Token / Value | Role |
|---|---|
| `rgb(57, 72, 60)` | Page/sidebar background (dark sage green) |
| `rgba(73, 92, 76, 0.98)` | Sidebar background |
| `white` | Text on dark backgrounds, form field backgrounds |
| Azure palette (Material primary) | Primary action color (buttons, focus rings) |
| `#216e25` | Success (snackbar) |
| `#b11111` | Error / delete actions (snackbar, delete buttons) |
| `#0c56ac` | Info (snackbar) |
| `rgba(95, 1, 1, 1)` | Chip selected state, button-toggle selected state |
| `rgb(141, 216, 27)` | Stock OK indicator |
| `rgb(251, 255, 17)` | Stock warning indicator |

**Rule:** Icons on the dark green background are white (global `mat.icon-overrides` in styles.scss). Do not set icon color on individual components unless you're overriding on a light background.

### Typography

Font: **Roboto** (300 light / 400 regular / 500 medium). Loaded from Google Fonts in index.html.

Use **Material type classes** — never Bootstrap `fs-*` — so that density and theme scaling work correctly.

| Class | Use for | Approx size |
|---|---|---|
| `mat-headline-large` | Page titles | 32sp |
| `mat-headline-medium` | Section headers | 28sp |
| `mat-title-large` | Card / panel headers | 22sp |
| `mat-title-medium` | Subsections, dialog titles | 16sp |
| `mat-body-large` | Primary content text | 16sp |
| `mat-body-medium` | Secondary content, labels | 14sp |
| `mat-label-large` | Button text, form labels | 14sp |
| `mat-label-small` | Captions, chips, helper text | 11sp |

```html
<!-- Good -->
<h1 class="mat-headline-large">Orders</h1>
<p class="mat-body-medium">Select a client to continue.</p>

<!-- Bad: Bootstrap fs-* bypasses Material type scale -->
<h1 class="fs-2">Orders</h1>
```

### Spacing Tokens

CSS custom properties defined in `src/styles.scss` `:root` — available in all component SCSS files and inline styles without importing anything:

```scss
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;   // default component padding
--space-6: 24px;   // tablet+ component padding
--space-8: 32px;
--space-12: 48px;
```

Bootstrap utility equivalents for quick use in templates:
- `p-2` = 8px, `p-3` = 12px, `p-4` = 16px
- `gap-2` = 8px, `gap-3` = 12px, `gap-4` = 16px

Prefer `var(--space-N)` in `.scss` files for maintainability. Bootstrap utility classes in templates are fine for layout spacing.

---

## Breakpoints

This project defines three breakpoints (mobile-first). The mixin file is `src/_breakpoints.scss`.

```
Mobile:  < 600px   (default — design for this first)
Tablet:  ≥ 600px   ($bp-sm)
Desktop: ≥ 960px   ($bp-md)
Large:   ≥ 1280px  ($bp-lg)
```

### Using breakpoint mixins in component SCSS

```scss
// At the top of your component .scss file:
@use 'breakpoints' as *;

:host {
  display: block;
  width: 100%;
}

.container {
  padding: var(--space-2);      // mobile: 8px

  @include sm {
    padding: var(--space-4);    // tablet: 16px
  }

  @include md {
    padding: var(--space-6);    // desktop: 24px
    max-width: 960px;
    margin: 0 auto;
  }
}
```

The `@use 'breakpoints' as *;` import works because `angular.json` has `stylePreprocessorOptions.includePaths: ["src"]`.

---

## Component Size Standards

### mat-form-field

- Always use `appearance="fill"` — the global override in `styles.scss` applies the white-background, sage-text style to this appearance.
- Default density 0 = 56px touch target height. **Never set a custom height on form fields.**
- Width: `width: 100%` on mobile. On tablet+ use `flex: 1 1 260px` inside a flex-wrap container.

```html
<!-- Good: fills available width, responsive via flex -->
<div class="d-flex flex-wrap gap-3">
  <mat-form-field appearance="fill" style="flex: 1 1 220px">
    <mat-label>Name</mat-label>
    <input matInput />
  </mat-form-field>
  <mat-form-field appearance="fill" style="flex: 1 1 220px">
    <mat-label>Code</mat-label>
    <input matInput />
  </mat-form-field>
</div>
```

### Buttons

- Primary action: `mat-flat-button` (filled, Azure background)
- Secondary / cancel: `mat-stroked-button`
- Destructive: `mat-flat-button` + `.submit-delete-button` class (red override from styles.scss)
- **Never set custom `height`, `font-size`, or `padding` on buttons** — Material handles sizing.
- Full-width on mobile is fine: `class="w-100"` on the button.

```html
<button mat-flat-button class="submit-button w-100" [class.w-auto]="isTablet">
  Save
</button>
```

### mat-card

- Mobile: `mx-2` (8px side margins), full-width minus margins
- Tablet+: `max-width: 560px; margin: 0 auto`
- Content padding: use `class="p-4"` (16px) as default; `class="p-3"` (12px) only for dense list cards

```html
<mat-card class="mx-2 p-4">
  <!-- content -->
</mat-card>
```

### Touch targets

All interactive elements (buttons, list items, icon buttons, chips) must be **≥ 44×44px**. Material's default density 0 meets this for most components. If you reduce density (`density: -1` or lower), verify touch targets manually.

---

## Responsive Layout Patterns

The app has a **fixed sidebar at 280px** (visible when open on all screen sizes). Page content must account for this on desktop.

### Mobile (< 600px) — default, always write this first

```
┌────────────────────────┐
│  topbar (56px)         │
├────────────────────────┤
│  page content          │
│  single column         │
│  full width            │
└────────────────────────┘
```

- No margin-left (sidebar is off-screen)
- `padding: 8px` on page container
- Cards: `mx-2`, full width
- Forms: single column, `d-flex flex-column gap-3`

```scss
.page-wrapper {
  padding: var(--space-2);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
```

### Tablet (≥ 600px)

```
┌────────────────────────────────┐
│  topbar                        │
├────────────────────────────────┤
│  page content (centered)       │
│  max-width: 720px              │
│  2-column form layouts         │
└────────────────────────────────┘
```

- Sidebar still off-screen by default (user opens it temporarily)
- `padding: 16px`
- Cards: `max-width: 640px`, `margin: 0 auto`
- Forms: 2-column with `d-flex flex-wrap gap-3` + `flex: 1 1 260px`

```scss
@include sm {
  .page-wrapper {
    padding: var(--space-4);
    align-items: center;
  }

  mat-card {
    max-width: 640px;
    width: 100%;
  }
}
```

### Desktop (≥ 960px)

```
┌──────────┬─────────────────────────────────┐
│  sidebar │  page content                   │
│  280px   │  margin-left: 280px             │
│  fixed   │  max-width: ~1200px             │
└──────────┴─────────────────────────────────┘
```

- Content must have `margin-left: 280px` when sidebar is open (or always on desktop)
- `padding: 24px`
- 3-column grids possible for list pages
- Max content width: `1200px`

```scss
@include md {
  .page-wrapper {
    padding: var(--space-6);
    max-width: 1200px;
    margin: 0 auto;
  }
}
```

> Note: The sidebar's visibility is controlled by `SidebarComponent`. On desktop you can assume it is always open; on mobile it overlays content. The app shell in `app.component` handles this — check how it applies body classes or layout shifts when implementing page-level margin-left.

---

## Bootstrap + Material Coexistence Rules

| Use Bootstrap for | Do NOT use Bootstrap for |
|---|---|
| `d-flex`, `flex-wrap`, `flex-column` | `fs-*` (use Material type classes) |
| `gap-*`, `p-*`, `m-*` spacing utilities | `col-*` grid mixed with flexbox gaps |
| `align-items-*`, `justify-content-*` | `btn`, `form-control`, `input-group` (use Material instead) |
| `w-100`, `h-100`, `d-none`, `d-md-block` | `text-primary`, `bg-*` color utilities (use Material theming) |
| `border`, `rounded` utilities | Custom font sizes (`fs-2`, `fw-bold` etc.) |

For responsive columns, prefer `d-flex flex-wrap` + `flex: 1 1 <min-width>` over Bootstrap `col-*` grid — it integrates better with Material components and doesn't require a `row` wrapper.

```html
<!-- Good: flex-wrap responsive, works with Material form fields -->
<div class="d-flex flex-wrap gap-3">
  <mat-form-field appearance="fill" style="flex: 1 1 220px">...</mat-form-field>
  <mat-form-field appearance="fill" style="flex: 1 1 220px">...</mat-form-field>
</div>

<!-- Avoid: Bootstrap grid cols with Material components -->
<div class="row g-3">
  <div class="col-md-6"><mat-form-field>...</mat-form-field></div>
  <div class="col-md-6"><mat-form-field>...</mat-form-field></div>
</div>
```

---

## Anti-Patterns

| Anti-pattern | Why it's wrong | Fix |
|---|---|---|
| `height: 92vh` on page container | Fragile — ignores topbar, breaks on keyboard-open mobile | Use `flex: 1; min-height: 0` inside a flex-column parent |
| `max-width: 96vw` | Viewport-relative max-width ignores real layout bounds | `width: 100%; max-width: 480px; margin: 0 auto` |
| No media queries at all | Desktop just shows stretched mobile UI | Add `@include sm` and `@include md` blocks with layout changes |
| Random `px` padding values | Hard to maintain, breaks spacing rhythm | Use `var(--space-N)` or Bootstrap `p-*`/`gap-*` |
| `!important` on component styles | Overrides Material's own state styles (hover, focus, disabled) | Use `mat.*-overrides()` mixin in global styles.scss instead |
| Bootstrap `fs-*` for headings | Bypasses Material type scale and density system | Use `mat-headline-*`, `mat-title-*`, `mat-body-*` classes |
| Hardcoding `height`/`font-size` on Material components | Breaks Material's own sizing system | Let Material handle sizing via density; only override via `mat.*-overrides()` |

---

## Standard Component SCSS Template

Copy-paste starting point for every new component `.scss` file:

```scss
@use 'breakpoints' as *;

:host {
  display: block;
  width: 100%;
}

.container {
  padding: var(--space-2);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);

  @include sm {
    padding: var(--space-4);
    align-items: center;
  }

  @include md {
    padding: var(--space-6);
    max-width: 960px;
    margin: 0 auto;
  }
}
```

---

## Checklist Before Marking a Component Done

- [ ] Mobile layout works at 375px viewport width (no horizontal scroll, no clipping)
- [ ] `@include sm` block adjusts layout at 600px (not just bigger spacing)
- [ ] `@include md` block adjusts layout at 960px (accounts for 280px sidebar if relevant)
- [ ] All interactive elements meet 44×44px touch target
- [ ] Text uses Material type classes (`mat-body-*`, `mat-title-*`) — no `fs-*`
- [ ] Spacing uses `var(--space-N)` or Bootstrap utilities — no arbitrary `px` values
- [ ] No `!important` in component SCSS (use `mat.*-overrides()` in global styles instead)
- [ ] Form fields use `appearance="fill"` (not `outline` unless intentionally overriding)
