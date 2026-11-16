# Agent context: app/web

## Purpose

Angular SPA for video discovery and playback using Kazumi rules. Requires the Danmaku Anywhere browser extension for scraping and danmaku features.

## Tech stack

- Angular 21+ with standalone components
- PrimeNG + Tailwind CSS for UI
- TanStack Angular Query for data fetching
- Signals + NgRx Signals for state management
- Artplayer for video playback
- Dexie for client-side storage
- openapi-fetch for Bangumi API

## Conventions

- Standalone components only (no NgModules, `standalone: true` is implied)
- Use `input()`/`output()` functions, not decorators
- Use signals and `computed()` for state
- `ChangeDetectionStrategy.OnPush` always
- Native control flow (`@if`, `@for`, `@switch`), not structural directives
- `injectQuery`/`injectMutation` from TanStack Query
- `inject()` function, not constructor injection
- Reactive forms, not template-driven
- Do NOT use `ngClass`/`ngStyle` — use `class`/`style` bindings
- Use `providedIn: 'root'` for singleton services

## Gotchas

- Requires the browser extension to be installed for scraping features
- Uses Vitest + jsdom via the `@angular/build:unit-test` builder (`pnpm test:ng`). Specs import from `vitest`, not Jasmine
- Bangumi image variants mean different widths per API. The next API (`/p1`, used by details tabs and trending) returns `small` 100px, `medium` 200px, `common` 400px, `grid` a 100x100 crop; the v0 API (search) returns `grid` 100px, `small` 200px, `common` 400px, `medium` 800px. Pick thumbnails with the `daThumbnail` pipe (`images | daThumbnail: slotWidth`, backed by `preferredThumbnail` in `features/bangumi/utils/subject-images.ts`), which reads the width from the URL, instead of by variant name. A cover slot passes `[fallback]="coverFallback"` to `da-image` so a subject without a cover shows `assets/cover_fallback.webp` instead of the generic placeholder
- See `package.json` for available scripts and dependencies
