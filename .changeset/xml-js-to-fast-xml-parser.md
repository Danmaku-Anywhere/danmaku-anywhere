---
'@danmaku-anywhere/danmaku-model': patch
---

Parse and write danmaku XML with `fast-xml-parser` instead of `xml-js`. Exported XML now escapes `"` and `'` and no longer drops the escaping of text that already looks like an entity, and imports accept named entities such as `&nbsp;` as literal text instead of failing.
