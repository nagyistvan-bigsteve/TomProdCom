---
name: pwa-development
description: Build or change Progressive Web App features - web app manifest, service worker, caching strategy, offline fallback, install prompt, push notifications, share target, service worker updates, Lighthouse PWA audit. Use when a task adds, edits or debugs any of these, or when the app shows stale content after a deploy, fails to install, or fails to load offline.
when-to-use: When a task touches the manifest, the service worker or its config, caching, offline support, the install prompt, push notifications, or a PWA audit
user-invocable: false
paths: ["**/sw.*", "**/service-worker.*", "**/workbox-config.*", "**/manifest.json", "**/*.webmanifest", "**/ngsw-config.json"]
effort: medium
---

# PWA Development Skill

**Purpose:** Build Progressive Web Apps that work offline, install like native apps, and load fast on every device.

All code and configuration snippets live in [references/pwa-reference.md](references/pwa-reference.md). Read only the section a step names.

## Steps

Do these in order. Do not skip a step; write "not applicable" and the reason if one does not apply.

1. **Find the service worker system the project already uses.** Search the repository for these, and stop at the first match:

   | You find | The project uses | Where caching is configured |
   |---|---|---|
   | `ngsw-config.json` or `@angular/service-worker` in `package.json` | Angular service worker | `ngsw-config.json` only |
   | `vite-plugin-pwa`, `next-pwa` or `workbox-*` in `package.json` | Workbox | the plugin config or the Workbox `sw.js` |
   | a hand-written `sw.js` / `service-worker.js` with `addEventListener('fetch'` | Hand-written service worker | that file |
   | none of the above | No service worker yet | ask the user which to add before writing any |

   Stay inside the system you found. Never add a second one, and never hand-write `sw.js` in a project that generates its worker.
   *Why: two service workers on one scope fight over the cache and users get stale or broken pages.*

2. **Read the existing configuration before editing.** Open the file from step 1's third column and the manifest (`manifest.json` or `*.webmanifest`). List the cache groups or routes that already exist.
   *Why: a new rule that overlaps an old one is ignored or overrides it without warning.*

3. **Pick one caching strategy for each kind of resource the task touches**, using this table. Write the choice down before you code it.

   | Resource | Strategy | Angular `ngsw-config.json` equivalent |
   |---|---|---|
   | Static assets (CSS, JS, images, fonts) | Cache First | `assetGroups` (`installMode: prefetch` for the app shell, `lazy` for images and fonts) |
   | API responses, data that must be current | Network First | `dataGroups` with `strategy: freshness` |
   | Content that may be slightly old (avatars, articles) | Stale While Revalidate | `dataGroups` with `strategy: performance` |
   | Analytics, requests that must never be cached | Network Only | leave it out of every group |
   | Offline-only assets | Cache Only | `assetGroups` with `installMode: prefetch` |

   *Why: the wrong strategy is the usual cause of both "app shows old data" and "app is slow".*

4. **Give every runtime cache two limits: a maximum number of entries and a maximum age.** Defaults when the task gives none: API data 100 entries and 24 hours; images 50 entries and 30 days.
   *Why: a cache without limits grows until the browser evicts the whole origin, including the app shell.*

5. **Make the change.** Take the snippet from the matching section of the reference file and adapt names and URLs to this project:
   - Manifest → "Web App Manifest"
   - Hand-written worker, registration → "Service Worker Patterns", "Caching Strategies"
   - Workbox → "Workbox (Recommended)", "Framework-Specific Guides"
   - Offline page, offline detection, background sync → "Offline Experience"
   - Install prompt, standalone detection, push, share target → "App-Like Features"
   - Preload, images, code splitting → "Performance Optimization"

6. **If you edited the manifest, confirm these 5 fields:** `name` and `short_name`; `start_url`; `display` set to `standalone` or `fullscreen`; icons of 192x192 and 512x512; one more 512x512 icon with `"purpose": "maskable"`.
   *Why: Chrome refuses to offer installation if any of the first four is missing, and Android crops icons that have no maskable version.*

7. **If you changed what is cached, make sure users get the new version.** Confirm the project has an update path (a version check and reload, `skipWaiting()` with a reload prompt, or `registerType: 'autoUpdate'`) and that your change does not bypass it. Do not add a second update mechanism.
   *Why: without an update path, users stay on the old cached build until they clear site data by hand.*

8. **Test on a production build, never the dev server.** Run the project's build command, serve the output folder over `localhost`, then in Chrome DevTools:
   1. Application → Service workers: the worker is "activated and is running".
   2. Application → Manifest: no errors or warnings listed.
   3. Network → set "Offline" → reload: the app loads.
   4. Run `npx lighthouse http://localhost:<port> --view` and read the PWA and Performance sections. Targets: First Contentful Paint under 1.8 s, Largest Contentful Paint under 2.5 s, Cumulative Layout Shift under 0.1.

   If you cannot open a browser, say so in the report and list these 4 checks for the user to run.
   *Why: most frameworks disable the service worker in development, so a dev-server test proves nothing.*

9. **Report** in the format shown in the example below.

## Rules

- **HTTPS only in production; `localhost` is the only exception.** *Why: browsers refuse to register a service worker on plain HTTP.*
- **Never cache responses to POST, PUT or DELETE, and never cache auth endpoints.** *Why: a cached auth or write response shows one user's result to the next request.*
- **Never precache more than the app shell (HTML, CSS, JS, icons).** Load everything else lazily. *Why: every precached byte is downloaded on first visit, on mobile data.*
- **Do not rename or delete an existing cache group without saying so in the report.** *Why: renaming drops every user's existing cache on the next deploy.*
- **Ask before adding push notifications.** *Why: they need a server key and a permission prompt, which are product decisions and not code decisions.*

## Example of a finished output

Task: "Translation files must always be current, even in the installed app."

Change to `ngsw-config.json` (the project uses the Angular service worker, so this is the only file edited):

```json
"dataGroups": [
  {
    "name": "i18n-fresh",
    "urls": ["/assets/i18n/*.json"],
    "cacheConfig": {
      "maxSize": 0,
      "maxAge": "0u",
      "timeout": "0u",
      "strategy": "freshness"
    }
  }
]
```

Report:

```
Service worker system: Angular service worker (ngsw-config.json)
Resource and strategy: /assets/i18n/*.json → Network First (dataGroups, freshness)
Cache limits:          maxSize 0, maxAge 0 (never stored; always fetched)
Files changed:         ngsw-config.json
Update path:           unchanged (existing version check and reload)
Tested:                production build served on localhost:8080
                       worker activated: yes | manifest errors: none
                       offline reload: app shell loads, translations fail as intended
                       Lighthouse: not run (no browser available) → for the user to run
Not done:              nothing
```

## Checklist: run before saying it's done

- [ ] I named the service worker system in use, and I edited only that system's files
- [ ] I read the existing cache config before changing it, and no new rule overlaps an old one
- [ ] Every resource I touched has one strategy from the step 3 table
- [ ] Every runtime cache I added has a maximum entry count and a maximum age
- [ ] If the manifest changed: all 5 fields from step 6 are present
- [ ] The update path still works, and there is exactly one
- [ ] I tested a production build, or I stated plainly that I could not and listed the 4 checks
- [ ] No POST/PUT/DELETE or auth response is cached
- [ ] My report follows the example format and lists anything I did not do
