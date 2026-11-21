---
'@danmaku-anywhere/extension-protocol': minor
---

`setRequestHeaders` now answers with the id of the header rule it installed, and the new `removeRequestHeaders` action removes that rule again. Extensions from before this change answer `setRequestHeaders` with no id.
