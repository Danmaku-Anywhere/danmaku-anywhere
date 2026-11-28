# @danmaku-anywhere/danmaku-provider

Danmaku data providers and API client configuration. Supplies danmaku from multiple backends (DDP, Bilibili, Tencent, MacCMS, etc.) and shared store for API base URL.

## Exports

- **`.`** — Core exports: exceptions, `configureApiStore`
- **`./ddp`**, **`./bilibili`**, **`./tencent`**, **`./maccms`**, **`./genAi`** — Provider-specific APIs
- **`./config`**, **`./files`** — Config and file-based providers
