---
name: angular-material-design
description: Layout and styling rules for this app's Angular Material 22 + Bootstrap 5 UI - page shell, spacing tokens, breakpoints, form fields, buttons, icons and typography on the dark green background. Use whenever a task creates or edits a *.component.html, *.component.scss or styles.scss, or asks about spacing, responsiveness, colours, or why a page scrolls wrongly.
when-to-use: When creating or editing any component template, SCSS, or layout
user-invocable: true
paths: ["**/*.component.html", "**/*.component.scss", "**/styles.scss"]
effort: medium
---

# Angular Material Design Skill

**Purpose:** Build UI that matches this app: Angular Material 22 (M3 theme with the Azure primary palette, Roboto, density 0), Bootstrap 5 utilities for layout, mobile-first, on a dark green background.

The root `CLAUDE.md` section "Layout & Styling System" is the source of truth for layout. If this skill and `CLAUDE.md` disagree, follow `CLAUDE.md` and say so in your report, with one exception: **CSS token names**. `CLAUDE.md`'s snippets still show `--mdc-outlined-text-field-*` and `--mdc-filled-button-*`, which Material 22 ignores; use the `--mat-*` names in this skill.

If the task is to review existing code rather than write new code, skip to "When asked to review existing code" at the end.

## Steps

Do these in order.

1. **Decide what you are styling** and write it down as one of these three:
   - **Page**: a component routed in `app.routes.ts` (folder `pages/`).
   - **Child component**: used inside a page (folder `components/`).
   - **White surface**: a dialog, a `mat-card` with white background, or an auth card.

   *Why: the `:host` rules, the field style and the icon colour all depend on this choice.*

2. **Open one existing file of the same kind before writing.** Page → `features/clients/pages/clients/clients.component.scss`. Dark-background field → the `.search-field` block in that same file. White surface with icon buttons → `features/auth/components/login/login.component.scss`. Copy its structure, but not its custom `font-size`/`font-weight` lines (see step 10).
   *Why: the app already has working patterns, and a second way of doing the same thing makes the next change harder.*

3. **Write the `:host` block.**
   - Page:
     ```scss
     :host {
       flex: 1;
       min-height: 0;
       display: flex;
       flex-direction: column;
       overflow-y: auto;            // or overflow: hidden if an inner element scrolls
       background-color: rgb(57, 72, 60);
       color: white;
     }
     ```
   - Child component: `:host { display: block; }`, plus the flex column rules only if it must fill its parent's height.

   *Why: without `min-height: 0` a flex child grows to its content, and the whole page scrolls instead of the list inside it (the "flex scroll trap" in CLAUDE.md).*

   If an element inside the page scrolls, give it `flex: 1; min-height: 0; overflow-y: auto;` as well.

4. **Write mobile styles first, then add breakpoint blocks.** Put `@use 'breakpoints' as *;` on line 1 of the SCSS file. Use only `@include sm` (600px), `@include md` (960px) and `@include lg` (1280px). Each block must change the layout (columns, alignment, max-width), not only the padding.
   *Why: an unchanged mobile layout stretched across a desktop screen is the most common design bug here.*

5. **Do not add sidebar offsets.** The shell (`app.component.scss`) already adds `margin-left: 280px` to `.app-content.sidebar-open` at 960px and up. A page never sets its own `margin-left` for the sidebar.
   *Why: a second offset pushes content 560px to the right on desktop.*

6. **Use only the spacing tokens:** `var(--space-1)` 4px, `--space-2` 8px, `--space-3` 12px, `--space-4` 16px, `--space-6` 24px, `--space-8` 32px, `--space-12` 48px in SCSS. In templates, Bootstrap `p-*`, `m-*` and `gap-*` are fine (`p-2` 8px, `p-3` 12px, `p-4` 16px). Defaults: page content padding `var(--space-4) var(--space-3)` on mobile; gap between stacked blocks `var(--space-3)`.
   *Why: values outside the scale break the visual rhythm and cannot be changed in one place.*

7. **Pick the form field appearance with this table:**

   | Where the field is | Appearance | Styling |
   |---|---|---|
   | On the dark green page (default) | `appearance="outline"` | add the 8 `--mat-form-field-outlined-*` tokens from the example below to the field's class |
   | A field that should look like a white box (existing examples: client search, product picker, quantity inputs, the pay amount in the order-table dialog) | `appearance="fill"` | nothing; the global `mat.form-field-overrides` in `styles.scss` makes it white with green text |
   | Dialog or white card | `appearance="outline"` | nothing; Material's default dark text is correct on white |

   When you add a field next to existing ones, use the same appearance as its neighbours in that file.

   Field width: `w-100` on mobile. For several fields in a row on tablet and up: a `d-flex flex-wrap gap-3` wrapper, with `flex: 1 1 220px` on each field. Never set a height on a form field.
   *Why: Material's default outline colours are dark and become invisible on the green page, and a fixed height breaks the 56px touch target.*

8. **Pick buttons with this list:**
   - Main action: `mat-flat-button`. Add class `submit-button` for its disabled style.
   - Brand dark-green submit button (auth and white cards): `mat-flat-button` with the `--mat-button-filled-*` tokens shown in `login.component.scss`, `height: 48px`.
   - Main step action on the dark page (Continue / next step in the offer flow): the dark-red 48px button, as `.continue-btn` in `select-client-page.component.scss` and `.action-btn` in `start-page.component.scss`. Full width on mobile, `width: 200px` from `md`. In new code set its colour with `--mat-button-filled-container-color: rgba(95, 1, 1, 0.75)` instead of `background-color`.
   - Secondary or cancel: `mat-stroked-button`.
   - Destructive: `mat-flat-button` + class `submit-delete-button` (red, from `styles.scss`).
   - Full width on mobile: class `w-100`.

   Only these two kinds of 48px action button may set `height`, `font-size` or `font-weight`. Do not size any other button.
   *Why: Material sizes buttons from the density setting, and manual sizes drift from the rest of the app.*

9. **Set icon colour only on white surfaces.** Icons are white everywhere through the global `mat.icon-overrides`. White surfaces include dialogs, white cards **and the inside of every `appearance="fill"` field** (prefix and suffix icons, e.g. `.search-icon-prefix` in `order-table.component.scss`). On a white surface, put a class directly on `<mat-icon>`: `color: rgba(0, 0, 0, 0.54)` for neutral, `color: rgb(134, 2, 2)` for delete. For a `mat-icon-button`, set `--mat-icon-button-icon-color: rgba(0, 0, 0, 0.45)` on the button instead.
   *Why: a white icon on a white dialog is invisible, and an icon colour on the green page overrides the theme for no reason.*

10. **Use Material type classes for text:** `mat-headline-small` for the brand name on auth pages, `mat-title-large` for a page title (as in `start-page.component.html`), `mat-title-medium` for card, dialog and section headers, `mat-title-small` for subsections, `mat-body-medium` for normal text, `mat-body-small` for captions. Never use Bootstrap `fs-*` or `fw-*` in new code.
    *Why: the type classes follow the theme; Bootstrap sizes ignore it.*

11. **Use colours from this list only.** Do not invent new ones.

    | Value | Use |
    |---|---|
    | `rgb(57, 72, 60)` | page background, brand button |
    | `rgba(73, 92, 76, 0.98)` | sidebar background |
    | `white`, `rgba(255,255,255,0.65)`, `rgba(255,255,255,0.35)` | text, secondary text, borders on the dark page |
    | `rgba(255, 255, 255, 0.12)` | divider lines on the dark page |
    | `rgba(95, 1, 1, 1)` | selected chip and selected button toggle |
    | `rgba(95, 1, 1, 0.75)` to `0.85`, hover `0.9` to `1` | dark-red action button (step 8); match the value in the file you are in |
    | `#216e25` / `#b11111` / `#0c56ac` | success / error / info snackbars (already global) |
    | `rgb(141, 216, 27)` / `rgb(251, 255, 17)` | stock OK / stock warning |

    *Why: one fixed palette keeps every page looking like the same app.*

12. **Check the result** at 375px, 600px and 960px wide (Chrome DevTools device toolbar, with the sidebar open at 960px), then report in the format of the example below.

## Rules

- **Apply these rules to the code you write or change, not to the whole file.** The repo already has `!important` in about 10 component files and some custom font sizes (for example `.header-title` in the clients page). Mention them in the report as "noticed", and do not clean them up unasked. *Why: an unrequested restyle is a change nobody reviewed.*
- **No `!important` in new component SCSS.** Use a `mat.*-overrides()` mixin or a `--mat-*` token instead. *Why: `!important` also overrides Material's hover, focus and disabled states.*
- **No `height: 92vh`, `100vh` or `max-width: 96vw` on pages.** Use `flex: 1; min-height: 0`, and `max-width` with `margin: 0 auto`. *Why: viewport units ignore the 56px topbar and the mobile keyboard.*
- **Use `--mat-*` token names, never `--mdc-*`.** *Why: Material 22 reads `--mat-form-field-*` and `--mat-button-*`; `--mdc-*` names are silently ignored.*
- **For Material table rows, use `::ng-deep tr.detail-row { height: 0 }`**, not a component-scoped selector. *Why: rows rendered by Material's own view container do not get the component's scoping attribute.*
- **Prefer `d-flex flex-wrap` with `flex: 1 1 <min-width>` over Bootstrap `row`/`col-*`** around Material fields. *Why: `col-*` padding fights Material field widths.*
- **Use Bootstrap for layout utilities only:** `d-flex`, `flex-*`, `align-items-*`, `justify-content-*`, `gap-*`, `p-*`, `m-*`, `w-100`, `d-none`/`d-md-block`. Never Bootstrap `btn`, `form-control`, `fs-*`, `fw-*`, `text-primary` or `bg-*`. *Why: those duplicate Material components and theme colours and look different from them.*
- **Cards:** the only `mat-card` (`add-client.component.scss`) is `width: 100%` with text colour `rgb(57, 72, 60)`; its parent decides the width. Newer pages use a plain white `<div>` card instead (`order-details`, `deleted-orders`; see `features/orders/CLAUDE.md`). Match the page you are in. *Why: the orders feature removed `mat-card` on purpose; re-adding it there undoes that decision.*
- **All interactive elements are at least 44×44px.** Do not lower density below 0 without checking. *Why: the app is mobile-first and used on phones; smaller targets cause mis-taps.*

## Example of a finished output

Task: "Add a search field to a new page on the dark background."

`example-page.component.html`:

```html
<div class="page-content">
  <mat-form-field appearance="outline" class="search-field">
    <mat-label>{{ "SELECT_CLIENT.TITLE" | translate }}</mat-label>
    <input type="text" matInput />
  </mat-form-field>
</div>
```

`example-page.component.scss`:

```scss
@use "breakpoints" as *;

:host {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background-color: rgb(57, 72, 60);
  color: white;
  overflow-y: auto;
}

.page-content {
  display: flex;
  flex-direction: column;
  padding: var(--space-4) var(--space-3);
  gap: var(--space-3);
  width: 100%;

  @include md {
    max-width: 960px;
    margin: 0 auto;
    padding: var(--space-6);
  }
}

.search-field {
  width: 100%;

  --mat-form-field-outlined-label-text-color: rgba(255, 255, 255, 0.65);
  --mat-form-field-outlined-hover-label-text-color: rgba(255, 255, 255, 0.85);
  --mat-form-field-outlined-focus-label-text-color: white;
  --mat-form-field-outlined-input-text-color: white;
  --mat-form-field-outlined-outline-color: rgba(255, 255, 255, 0.35);
  --mat-form-field-outlined-hover-outline-color: rgba(255, 255, 255, 0.65);
  --mat-form-field-outlined-focus-outline-color: white;
  --mat-form-field-outlined-caret-color: white;
}
```

Report:

```
Kind:        page (routed), dark background
Pattern:     copied from clients.component.scss
Field:       outline + 8 --mat-form-field-outlined-* tokens
Breakpoints: mobile default; md centres content at 960px max width
Checked:     375px, 600px, 960px with sidebar open: no horizontal scroll, only .page-content scrolls
Noticed:     nothing
```

## Checklist: run before saying it's done

- [ ] I named the kind (page / child / white surface) and copied an existing file of that kind
- [ ] A page `:host` has `flex: 1` and `min-height: 0`; no `height: 100%` or `vh` heights
- [ ] No `margin-left` for the sidebar anywhere in my change
- [ ] Every spacing value is a `var(--space-N)` or a Bootstrap spacing utility
- [ ] Every breakpoint block changes the layout, not only the padding
- [ ] Each form field follows the step 7 table, and none has a fixed height
- [ ] Token names are `--mat-*`, not `--mdc-*`
- [ ] Icons on white surfaces (dialogs, cards, inside `fill` fields) have a dark colour; icons on the green page have none
- [ ] No `!important`, `fs-*` or new colours in the lines I wrote
- [ ] I checked 375px, 600px and 960px, or said plainly that I could not
- [ ] Existing violations I saw are listed under "noticed", not fixed

## When asked to review existing code

1. Read the whole `.html` and `.scss` of the component, not a search of them.
   *Why: a grep misses context, such as a field that sits inside a dialog.*
2. Compare each part against steps 3 to 11 above.
3. Label every finding **bug** (you can name the visible effect and how to reproduce it) or **convention** (it breaks a rule here but you have not seen it cause a problem). Do not claim a visible effect you have not reproduced.
   *Why: a convention gap reported as a bug sends someone chasing a problem that does not exist.*
4. Do not edit any file unless the user asked for fixes.
5. Report in this format:

```
Component:   <path>, kind: page / child / white surface
Bugs:        <n>. <file>:<line>, rule step <N>, visible effect, how reproduced   (or "none")
Conventions: <n>. <file>:<line>, rule step <N>, one line                          (or "none")
OK:          the rules it follows, one line
Not checked: <e.g. viewports 375/600/960px: no browser available>                 (or "nothing")
```
