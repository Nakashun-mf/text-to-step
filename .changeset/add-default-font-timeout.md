---
"text-to-step": patch
---

Add a 20s timeout to the default-font CDN fetch (`defaultFont.ts`) so `textToCAD()` fails with a clear error instead of hanging indefinitely when the network is unreachable or the CDN doesn't respond.
