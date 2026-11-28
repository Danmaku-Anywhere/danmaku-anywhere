# CLAUDE.md

Agent guide for Danmaku Anywhere, a browser extension that overlays danmaku (bullet comments) on video sites. Each package has its own `AGENTS.md` with conventions and gotchas: read it before working there, and keep it current.

Related repos: the web app (Angular, `Danmaku-Anywhere/web`) installs `danmaku-model` and `extension-protocol` from npm; the backend (Cloudflare Workers, Hono, `Danmaku-Anywhere/backend`) installs `integration-policy` from npm.

## Commands

- Prefer scripts in `package.json` over ad-hoc commands: `pnpm type-check` not `tsc`, `pnpm lint` not `biome check`. For a CLI that has no script, use `pnpx`, never `npx`.
- Translation keys: `cd packages/danmaku-anywhere && pnpm i18n extract`.
- Run `pnpm build:packages` before running the extension in dev mode.
- Never run the extension's full e2e suite locally; CI does. Which specs to run is in `packages/danmaku-anywhere/e2e/AGENTS.md`.

## Code style

Biome enforces formatting and imports (`pnpm lint`). Beyond that:

- Always put an `if` body in a block on the next line, even for early returns.
- Use `function` declarations for named and exported functions; arrow functions for callbacks.
- No syntax soup: no dense ternary chains, nested ternaries, chained optional calls, `{ ...base, ...(cond && { x }) }`, or inline `&&` for non-trivial JSX branches. Use early returns, a lookup, or a named variable.
- Expected failures return `{ success: true, data } | { success: false, error }`, the shape `danmaku-provider` already uses.

## Comments

- Default to no comments. Write one only for a hidden constraint, a subtle invariant, or a workaround, in plain full sentences.
- No narration of what the next lines do, no history or review notes (`Previously`, `Per review`, `As discussed`), and no defensive justification: if the code looks unreasonable, fix the code. Inside tests too.
- Never put a ClickUp id (`DA-XXX`) in source, tests, strings or comments. Ids live in commit messages and PR bodies.
- No em dashes (U+2014) in anything new, including code, commits, PR bodies and every locale file.
- Every e2e spec has a 3-6 line JSDoc header after the imports, before the first `test()` or `describe()`, saying what it exercises and asserts. For unit tests it is optional.

## Checking a change in a browser

The extension is checked in a real Chromium with `build/` loaded, never `dev/chrome` (the human's `pnpm dev:browser` profile).

- Start with the `verifying-changes` skill; `browser-verify` explores, `e2e-spec` writes the spec, `preview-build` exercises a published build.
- `cd packages/danmaku-anywhere && pnpm run verify:explore` rebuilds a stale `build/` and prints how to drive it.
- Reload a rebuilt extension in a running browser with CDP `Extensions.loadUnpacked` (see `e2e/setup/swapExtension.ts`); `chrome.runtime.reload()` does not bring it back under `--load-extension`.

## Before opening a pull request

1. `pnpm lint`. It also runs `lint:specs`, which fails locally on `as unknown as` in unit tests, tests that only assert `toHaveBeenCalled*`, and `vi.mock` of modules nobody imports.
2. `pnpm --filter '...[origin/master]' test`. CI runs the extension tests with `DA_DOCS_DIR` pointing at a `Danmaku-Anywhere/docs` checkout; locally, set it to any docs checkout or the `docsPaths` test skips (it throws when `CI` is set and the variable is missing).
3. Changed translation keys: run `pnpm i18n extract`, translate new `zh` entries, commit the JSON.
4. Runtime behaviour in the extension: the spec from `verifying-changes` (red before green), plus the affected e2e specs by path.
5. `pnpm -s fallow audit --base origin/master --skip health`, the audit CI runs. Read the CI log and PR comment too: the check can pass with warnings.
6. Title `(type) description [DA-XXX]`, type one of `extension`, `app`, `proxy`, `chore`, `docs`. If the branch name has a DA id, it must match the title's. When `CLICKUP_API_TOKEN` and `CLICKUP_TEAM_ID` are both set, CI also compares the type with the task's Type field in ClickUp. `changeset-release/` branches skip all title checks.
7. A change a user can see gets before and after screenshots in the PR body, and a short clip when it involves motion. Capture steps are in `.claude/commands/da-dev.md`.

Fix failing CI checks on your PR without waiting to be asked.

## Pitfalls

- Danmaku Builds (the release manager) lives in `Danmaku-Anywhere/release-manager`. Never delete the `release-manager-latest` release or its tag here: copies older than 0.5.0 still update through it.
- The documentation site lives in `Danmaku-Anywhere/docs`. Its changelog page is regenerated daily from this repo's published releases, so fix changelog text in the release notes.
