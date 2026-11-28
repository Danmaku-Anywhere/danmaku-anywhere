# Agent context: packages/danmaku-anywhere/e2e

This is the **baseline doctrine** for end-to-end tests. Future e2e PRs are reviewed against it.

## Test taxonomy

Three layers, in increasing cost and fragility:

- **unit** — `*.test.ts` next to the source. In-process, no browser. Pure logic, single class/function.
- **package-integration** — `__tests__/*.test.ts`. Still in-process. Multi-class flows inside one package (service + repo + store).
- **e2e** — `e2e/specs/**`, Playwright, real extension loaded into Chromium. Answers exactly one question: **"did the user see X in the UI?"**

The deciding question for any spec: **if you removed every UI assertion, would the test still pass on data alone?** If yes, it isn't e2e — move it down a layer. State-only assertions wearing a Playwright costume cost ~100× a unit test and catch less.

## Red before green

A spec that has never failed has not been tested. Before a spec counts as verification, watch it fail against the build _without_ the change and pass _with_ it. A spec that passes both ways asserts something other than what changed.

Write the spec first where you can, so the "without" build is the current tree. When the change is already written, build the merge base in a throwaway worktree (commands in the `verifying-changes` skill).

Refactors are the exception: behavior deliberately did not change, so the spec goes green immediately. Do not weaken an assertion to manufacture a red.

Scratch specs live in `e2e/specs/.scratch/`, which is gitignored and skipped by the spec lint. Moving the file into `e2e/specs/<area>/` makes it real coverage.

## The spec lint

`pnpm run lint:specs` (part of `pnpm lint`) fails any spec that asserts only on state with no user-visible signal. It hard-fails locally and only warns under `CI`.

Behavior with genuinely no UI surface opts out by naming the reason in a comment, held to the same standard as an `expectedConsoleErrors` entry:

```
lint-specs-allow-state-only: OPFS scope has no DOM signal, so it asserts storage state.
```

## Build before you run

The suite loads `build/`, not your source. Global setup refuses to run against a stale or wrong-env build and prints the command; otherwise `playwright test <spec>` would silently test the previous build.

```bash
VITE_DA_ENV=e2e pnpm run build
```

It does not build for you, because a build started inside the runner would surface its failures as test startup noise. `DA_E2E_ALLOW_STALE_BUILD=1` skips the check.

## Which tests to run

**Never run the full suite locally. That is CI's job.** Run the affected specs, and at most the smoke band on top.

- `pnpm test:e2e:changed` is the inner loop, but it only follows direct imports. A leaf POM reached through `Popup` selects one spec, and a content script no spec imports selects none, which reads exactly like passing. After touching a leaf POM or product code, name the covering specs by path.
- `pnpm test:e2e:smoke` runs the `@smoke` band (install, mount, search). The most to run before pushing.
- `pnpm test:e2e` is the full sweep, CI only. The `occlusion-cross-origin` specs are load-sensitive and flake locally under parallel workers.
- `pnpm test:e2e:ui` is Playwright UI mode for a human; it needs a display.
- `pnpm test:e2e:verify <spec>` is the evidence run: full trace and HTML report (`pnpm exec playwright show-report`). Use it on the spec a PR adds.

Specs run headless, always. Extensions and the CDP Extensions domain work in current headless Chromium. `DA_HEADED=1` is for a human watching a run; never set it in a spec, a script or CI.

## Every e2e spec asserts at least one user-visible signal

User-visible means observable from the rendered DOM, a download, or a navigation. Concretely:

- toast text + severity (via `popup.toast`)
- dialog title/body (via `popup.dialog`)
- rendered DOM: `commentElements()`, tree-item visibility, count text, list item presence
- download payload (`page.waitForEvent('download')`)
- URL / page transition

State assertions (`da.season.get(...)`, `da.episode.get(...)`, mount mirror) **complement** UI assertions — they pin down ground truth so a UI bug can't mask a data bug. They do not replace UI assertions. A regression that breaks the toast but leaves the DB correct should fail an e2e test, not pass it.

The standard shape:

```
1. Seed the DB / profile (via dev API)
2. Drive the UI (popup click, search submit, video event)
3. Assert UI: at least one user-visible signal
4. Assert state: ground truth in DB / chrome.storage (optional but encouraged)
```

## Comments

Header JSDoc and the default-to-no-comments rule are in the root `CLAUDE.md`. In test bodies, POMs and setup files a comment earns its place only for a known race, a library bug, a CDP delivery quirk or an envelope constraint (the eager watcher attach in `fixtures.ts` is an example), and it names what is broken.

## Hacks to avoid

- **Dev-API methods that exist only to paper over a production race.** Fix the chain instead. The current `da.mount.waitForRegistration` is grandfathered; new equivalents need an explicit justification in the PR.
- **Parallel test-only mirror state** (e.g. `__daMountMirror`) must justify itself against asserting on the UI signal directly. Prefer the UI signal. Mirrors are acceptable when the UI signal is genuinely unobservable from Playwright (e.g. cross-frame state not reflected in DOM), but the burden of proof is on the mirror.
- **`IS_DA_E2E` branches in source.** The flag stays — `e2e` is another runtime env alongside `dev`/`preview`/`prod`, and using it sparingly is fine. But every branch in source needs a one-line comment naming why the e2e path differs.

## Seeding determinism (boot races)

The fixture seeds the manifest store from the default catalog at boot (before the test body runs), and `applyProfile` clears storage. So a spec that seeds a _stale_ manifest via `rawStorage` races the boot seed: under load, boot can overwrite your stale seed with the real version, and the spec flakes (the "update available" never appears). Don't seed staleness into storage.

The deterministic pattern for an update-flow spec: seed the store at the manifest's _real_ version (`manifestStoreSeed`), and make the catalog advertise a newer one (`mockCatalog(ids, { id: '9.9.9' })`). The boot seed and your seed agree on the real version, so the race is benign; the "available update" comes from the catalog, whose request happens at popup time against the bumped mock. See `e2e/specs/sources/updates.spec.ts`.

## Baselines

These are enforced by `e2e/setup/fixtures.ts` and apply to every spec by default.

### Network strict-mode

Any HTTP request that isn't mocked by a per-spec route or covered by the project allow-list **fails the test**. Project allow-list covers `chrome-extension:`, `data:`, `blob:`, `about:`, and `*.invalid` hostnames.

To opt extra origins in:

```ts
test.use({ allowedNetworkOrigins: ['accounts.google.com'] }) // OAuth redirect — covered by separate auth test
```

One-line justification per entry. Prefer a per-spec mock over widening the allow-list.

### Console-error default-fail

Any `console.error` during the test body fails it. Patterns match by `includes` (string) or `.test` (RegExp) against the formatted line — the entry includes a `[sw]` / `[page <url>]` prefix and a trailing `(<url>:<line>:<col>)`, so patterns can target any of those parts.

To opt out:

```ts
test.use({
  expectedConsoleErrors: [/SchemaValidationError: known stale fixture/],
})
```

One-line justification per entry. Treat opt-outs as tech debt — leaving them unjustified means a real regression hides behind a "we always saw that one."

When passing two or more patterns, use strings, not RegExps. Playwright's `test.use` reads any array whose second element is `typeof 'object'` as a `[value, options]` fixture tuple, and a RegExp is an object: a multi-RegExp array silently collapses to its first pattern. The fixture throws a pointed error when this happens. A single-RegExp array is safe.

## Page Objects (POMs)

POMs live under `e2e/pom/`. The composed root is `Popup` (`e2e/pom/Popup.ts`); page-area POMs hang off it (`popup.mount`, `popup.search`, `popup.seasonDetails`, `popup.toast`, `popup.dialog`). `IntegrationPage` is standalone — it doesn't open via `chrome-extension://`.

Add methods to a POM rather than reaching into selectors from a spec. If a spec needs a one-off selector that isn't worth a POM method, add a one-line comment explaining why a method wasn't added.

### Locale-stable matchers

Toast text and dialog title/body are i18n-translated. Prefer `popup.toast.expectSuccess` / `expectError` (which scope by `data-severity`) over raw text matching. When asserting message text, use a regex that matches both locales: see `SeasonDetailsPage.expectCommentCountToBe` (matches `条弹幕` and `comments`).

Anchor such a regex and point it at the element that holds the text, not at an ancestor. Playwright matches a regex against an element's whole text content, and adjacent nodes concatenate with no separator: an episode row numbered 1 whose caption reads `0条弹幕` matches as `10条弹幕`, so a count assertion on the row passes on zero comments. That is why the count caption carries its own `comment-count` testid.

## Migration specs

Live under `e2e/specs/migration/`. They are slower than baseline specs (first run downloads the prior release) and only run when a change might affect persisted shape: chrome.storage option schemas, Dexie schema versions, provider config reshapes.

### The swap mechanism

Launch a persistent Chromium context with the prior released build via `--load-extension`. Let it boot and write defaults. Then call CDP `Extensions.loadUnpacked` with the current build's path inside the SAME context. Both manifests embed `MIGRATION_EXTENSION_KEY`, so Chrome resolves them to the same extension ID. The bumped current manifest version (+99 on the build component) triggers Chrome's real update install path, which re-evaluates the SW against the new files and runs the upgrade pipeline.

`--load-extension` close + relaunch with a different path is NOT a valid swap: Chrome keeps the prior compiled SW bytecode and silently no-ops every migration. The launch helper passes `--enable-unsafe-extension-debugging` to unlock the CDP Extensions domain.

### user_data_dir must be a short path

Chrome's IDB / LevelDB silently breaks on Windows paths over `MAX_PATH` (260 chars). `testInfo.outputPath('userDataDir')` is too deep once Chrome adds its own per-origin subdir. Use `os.tmpdir()` or migrations will appear to never run because IDB never opens.

### Sourcing the prior release

`ensurePriorRelease(tag)` uses `DA_PRIOR_EXTENSIONS_DIR` (a folder of unpacked extensions named by version, e.g. `1.5.0/`) when set, then the `.e2e-cache/prior-releases/<tag>/` cache, then a public download of the release asset. The baseline tag, repo and asset template live in `e2e/migration.config.json`; bumping the baseline is a JSON edit.

### Seed data

The smoke seeds state by driving v1.5.0's own popup UI through `e2e/poms/legacy/v1.5.0/MigrationLegacyPopup`. Two traps:

- `addTitleMapping(snapshot)` sends v1.5.0's `seasonMapAdd` RPC because v1.5.0 only creates a seasonMap row from the content script's floating panel.
- `backup.json.gz` (under `e2e/fixtures/migration/`) must be an export from v1.5.0 itself. An export from a later build is restored verbatim by v1.5.0, and the migration steps in between then never run.

Regenerate `backup.json.gz` with `pnpm exec playwright test --config e2e/fixture-gen/playwright.config.ts`; the migration specs assert on the values in `v150Backup.gen.ts`, so change both together. Regenerate `danmaku.zip` with `scripts/prepareMigrationFixtures.mjs <export-root>`. The script renames entries so filenames do not leak watch history; keep it that way, since the repo is public.

### Asserting post-swap

Read state through a popup page (`chrome-extension://<id>/pages/popup.html`), not the service worker. The popup wakes the new SW and exercises RPC handlers, surfacing latent errors in the upgrade path; the swapped SW reference from Playwright may go stale.

Combine three gates, since none alone is sufficient: an error gate (throwing migrations), a schema gate (`schemaViolations` in `e2e/setup/migrationState.ts` parses every upgraded options store against its current zod schema), and positive data assertions (a migration that returns `[]` or drops a field fires no error). Match seeded state by ID, not byte-equality, so a legitimate reshape still passes.

### Helpers

Use `upgradeToCurrentBuild(context, currentExt)` (`e2e/setup/priorInstall.ts`), not a bare `swapExtension`: it returns once the current popup gets past its upgrade screen, and a spec that reads storage right after a bare swap can catch a half-upgraded store.

Vendored POMs for the prior release's UI live under `e2e/poms/legacy/<version>/` and are frozen. Never share them with current POMs.
