# Agent context: packages/extension-protocol

## Gotchas

- Published the way `danmaku-model/AGENTS.md` describes.
- Keep it free of `chrome.*` and of extension-only code; that belongs in `web-scraper` or the extension.
- Message shapes, action names, source strings and the `da-ext-version`/`da-ext-id` attribute names are a wire format. Installed extensions can be older or newer than the web app, so change them only in a backward compatible way.
