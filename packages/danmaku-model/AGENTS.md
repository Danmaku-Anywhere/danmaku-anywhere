# Agent context: packages/danmaku-model

## Gotchas

- The canonical schemas in `src/canonical/` are the data contract between packages. Changes affect all downstream consumers (engine, provider, extension, web app).
- Published packages (`danmaku-model`, `extension-protocol`, `integration-policy`) share one setup so outside repos can install them: `main`/`types` point at `src/index.ts` in this repo, `publishConfig` points the packed package at `dist`, and `zod` is a peer dependency because the exported schemas are zod objects, so it must resolve to the consumer's copy. Run `pnpm pack` and check the packed `package.json` after changing either entry. Add a changeset (`pnpm changeset`) for changes consumers will see.
