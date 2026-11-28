---
name: e2e-spec
description: Use when about to write or modify a Playwright e2e spec under `packages/danmaku-anywhere/e2e/`. Points at the canonical doctrine.
---

# e2e-spec

Read `packages/danmaku-anywhere/e2e/AGENTS.md` end to end before writing the first `test()`. It owns the rules (user-visible signal, network and console baselines, POMs, migration specs) and wins over an AI reviewer that disagrees (see `reviewing-ai-feedback`).

## Authoring loop

1. Copy the closest existing spec under `e2e/specs/`.
2. If you do not know what to assert yet, explore with `browser-verify` and lift selectors with `generate-locator`.
3. Write it under `e2e/specs/.scratch/` (gitignored, exempt from the spec lint).
4. Watch it go red without your change, then green with it (`verifying-changes` has the mechanics).
5. Move it into `e2e/specs/<area>/` and run the tiers in `verifying-changes`.
