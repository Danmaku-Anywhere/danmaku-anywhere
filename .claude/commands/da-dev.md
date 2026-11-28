---
name: da-dev
description: Use when implementing features, fixing bugs, or making any code/config changes that need a PR — orchestrates the full dev workflow from ClickUp task to PR with review monitoring
---

# da-dev — Development Workflow

Task: $ARGUMENTS

Orchestrates: ClickUp task → branch → implement → verify → self-review → PR → review monitoring → human handoff.

## Step Details

### 1. ClickUp Task

This is the ClickUp-integrated workflow and is opt-in; contributors who don't use it never need ClickUp configured. The workspace IDs come from environment variables (inherited across worktrees): `CLICKUP_DA_LIST_ID` (Extension Tasks list), `CLICKUP_DA_SPACE_ID`, and `CLICKUP_DA_TYPE_FIELD_ID`. If any are unset, stop and ask the user to export them (e.g. in `~/.zshenv`). Resolve the Type *option* ID for the chosen type (extension/app/proxy/chore/docs) by name via `clickup_get_custom_fields`, so the option IDs need no separate config.

Explore for an existing match: `clickup_search` with nouns from the request, scoped to the Extension Tasks list. Scan recent activity if the search is too narrow. Multiple plausible hits → list and ask. None → create one and pick the Type based on the scope of the change. Grab the custom ID (`DA-XXX`).

### 2. Branch & worktree

Pick a `hint` — 2-4 kebab-case words describing the task (e.g. `dev-workflow`, `bilibili-cookie-fix`, `theme-redesign`). For features/fixes, run:

```bash
node scripts/da-bootstrap.mjs --task DA-XXX --hint <hint> --type <extension|app|proxy|chore|docs>
```

That handles `git fetch`, `git worktree add`, env copy, `pnpm install`, `pnpm build:packages`, and writes task notes to `~/.claude/da-tasks/DA-XXX.md` (outside the repo, survives `/da-cleanup`). It ends with a machine-readable `READY` block (`worktree=...`, `branch=...`, `task_file=...`, `title=...`). Parse those.

The task file `da-bootstrap` writes is a bare stub. Before handing off, fetch the ClickUp task (`clickup_get_task DA-XXX`) and append its description to the task file as a brief (the implementation notes, scope, acceptance criteria), so the new session starts with full context instead of re-deriving it. A bare stub is the single biggest cause of a dispatched session going off-track.

Then use the `worktree-tab` skill to open a fresh Claude session in the worktree, passing the model you chose for implementation. The new session reads `<task_file>` and starts from step 3. **Stop the current session here.**

For trivial changes (CLAUDE.md / docs / config-only): branch directly without a worktree:

```bash
git fetch origin master && git checkout -b DA-XXX_<hint> origin/master
```

Reuse an existing worktree if its previous work is done.

### 3. Implement

Make the changes. Apply these:

- **CLAUDE.md conventions** are non-negotiable.
- **KISS and YAGNI**: the simplest thing that solves the actual task. No fallback for inputs that cannot happen, no helper or constant used once, no knob or parameter this PR does not need.
- **Library idioms**: check whether the framework already exposes the primitive before writing a helper. For unfamiliar APIs or recent versions, fetch current docs via the `context7` MCP. Match the project's existing usage.
- **e2e coverage**: every feature/fix lands with e2e coverage under `packages/danmaku-anywhere/e2e/` unless coverage is genuinely infeasible. State *why* in the PR body when skipping. Use `browser-verify` while authoring the spec.
- **Committed agent docs stay portable.** Files under `.claude/`, `CLAUDE.md`, `AGENTS.md` must not contain absolute paths into a developer's machine, OS-specific commands without an alternative, or project-specific magic values. Workspace-specific values (ClickUp IDs, browser executable paths, etc.) live in environment variables (e.g. `CLICKUP_DA_*`) that the developer sets in their shell, not in committed files; env vars are inherited across worktrees, unlike per-project agent memory. If a workflow depends on an MCP or local tool that may not be present, declare the prerequisite so the agent can stop and tell the human on a miss.

### 4. Verify

`pnpm lint` already runs `tsc`, so it covers type-check and biome. Tests default to changed-package scope (`pnpm --filter '...[origin/master]' test`). For extension changes, the `verifying-changes` skill owns which tier to run, the red-before-green rule and the summary to paste into the PR Test plan.

#### Extension: open dev browser (for the human)

For extension changes, launch the human's dev browser with HMR at the start of implementation:

```bash
cd <worktree-path>/packages/danmaku-anywhere && pnpm dev:browser
```

Run it in a new terminal so the Vite server keeps streaming. Skip it for config-only, types-only and docs changes.

#### Extension: agentic verification (for the agent)

For runtime behavior, the verification that counts is a spec that went red before it went green (`verifying-changes`, `e2e-spec`). Explore first with `browser-verify` when you do not yet know what to assert.

### 5. Commit and Self-Review

```bash
git add <specific files>
git commit -m "<descriptive message>"
```

Before pushing, run reviews using **clean subagents** (no prior context). They have no sunk-cost bias toward the lines you just wrote, which matters most for the KISS pass:

- Always run `/review`
- Always run `/simplify` for a KISS / YAGNI pass, then re-read the diff yourself with the same lens. It catches obvious dead code but misses subtler bloat, so treat its silence as a starting point, not a clean bill.
- Always run a **comment sweep**: have a clean subagent read the diff and delete every comment that doesn't earn its place under CLAUDE.md's `## Comments` policy. A fresh subagent has no attachment to the lines you just wrote, which is exactly why the author is the wrong one to prune them.
- Run `/security-review` when the change touches user input, auth, APIs, or data storage
- When the change carries runtime behavior, data contracts, migrations, non-trivial logic, or new-or-changed tests, also do a manual pass on two axes the commands above don't cover (skip for config-only, docs-only, or types-only changes). Each axis must end in a named failure; "the structure looks fine" is not a finding.
  - **Architecture / pattern fit**: does the change sit at the right seam, consistent with how the codebase already solves this? Look for a new coupling that other code now silently depends on, an invariant the types don't enforce (so a future caller can break it unnoticed), or an abstraction that duplicates one already in the tree. Name the specific seam or invariant at risk.
  - **Test gaps & theatre**: red-before-green already proves each new spec fails without the change, so spend this pass on what it does not cover: find the behavior this PR changed that no test would catch if it regressed, and name it.

Fix any issues found, then add a commit. Never include Co-Authored-By or AI attribution.

This pass is not just a pre-first-push gate. Re-run the relevant axis after any **substantial** change made later in the PR's life: a rebase across a large sibling branch, a behavior change, a refactor, or a fix that is more than a line or two. A one-line review-feedback tweak does not need it; a reworked code path does. The post-push commits are exactly the ones that escape review otherwise.

### 6. Push and Create PR

The PR itself is the human gate — push and open it without waiting.

```bash
git push -u origin DA-XXX_<hint>
gh pr create --title "(type) description [DA-XXX]" --body "$(cat <<'EOF'
## Summary
- <one short bullet per major change; "what" + "why" if non-obvious>

## Screenshots
| Before | After |
|---|---|
| ![<what master shows>](https://raw.githubusercontent.com/Danmaku-Anywhere/danmaku-anywhere/pr-media/pr-<N>/01-before-<name>.png) | ![<what the branch shows>](https://raw.githubusercontent.com/Danmaku-Anywhere/danmaku-anywhere/pr-media/pr-<N>/01-after-<name>.png) |

## Test plan
- Verified: the `verifying-changes` summary (lint, tests, e2e, red before green)
- [ ] <commands or e2e spec(s) the reviewer should run; reference paths under `packages/danmaku-anywhere/e2e/specs/...`>
- <if e2e coverage is infeasible for this change, state why here>

## Notes
- <known edge cases, perf implications, follow-ups, anything that helps the reviewer>
EOF
)"
```

Title rules are in CLAUDE.md, "Before opening a pull request".
- Do NOT include ClickUp links in the PR body — they are posted automatically
- Do NOT mention other DA-XXX in the body / commits; ClickUp auto-link will silently reopen those tasks
- Drop sections that don't apply (e.g. no `Notes` if there's nothing real to say) rather than padding

**Visual changes need before and after screenshots, and a clip where behaviour is involved** (what counts is in CLAUDE.md). Capture both with the same profile, size and steps; the popup is `chrome-extension://<id>/pages/popup.html` at 500x600. Clips: Playwright `recordVideo`, then `ffmpeg -i in.webm -vf "fps=12,scale=800:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse" out.gif` (3-10 s, at most 3 MB; GitHub only plays video uploaded through its web UI). Host files on the `pr-media` orphan branch under `pr-<N>/` (`git worktree add ../da-pr-media pr-media`, commit, push) and embed `raw.githubusercontent.com/Danmaku-Anywhere/danmaku-anywhere/pr-media/pr-<N>/<file>` URLs. Say in the PR when a capture uses anything injected into the page.

**Keep the PR body in sync as the branch evolves.** Use `gh pr edit <N> --body ...` (same HEREDOC pattern as creation) whenever new commits change scope, add/remove behavior, or invalidate a claim in the original body. Stale bodies mislead reviewers.

### 7. Review Monitoring

Once the PR is open, hand monitoring to the `babysit-pr` skill:

```
babysit PR #N
```

It owns the loop: status polling (`scripts/pr-status.sh <N>`), per-thread evaluation via `reviewing-ai-feedback`, the GraphQL resolve mechanics, the duration budget, and the stop conditions. When it stops, it alerts the human. **NEVER merge PRs** — merging is always a human action.

### 8. Worktree Cleanup

After the PR is merged, run `/da-cleanup` to remove completed worktrees. This also cleans up stale `additionalDirectories` and `Read(...)` allow rules from `~/.claude/settings.json`.

## Recovery

- **Lint / type-check fails mid-way:** fix and commit on top. Don't amend.
- **i18n keys touched but extraction not run:** `cd packages/danmaku-anywhere && pnpm i18n extract`, then stage the regenerated JSON.
- **New Claude tab closed:** the worktree is still valid. `cd <worktree> && claude --model <model> --add-dir . "Read ~/.claude/da-tasks/DA-XXX.md and continue"` to resume.
- **Session worktree deleted under you** (e.g. `/da-cleanup` ran during the session): the shell cwd becomes invalid. Find the main checkout with `git worktree list` (the entry on `master`). For a trivial change, branch off `origin/master` there; for non-trivial work, bootstrap a fresh worktree. The task notes in `~/.claude/da-tasks/DA-XXX.md` survive the cleanup.
- **CI flake (unrelated failure):** retry the workflow once via `gh run rerun <id>`. If it fails again, comment on the PR and stop the loop.
