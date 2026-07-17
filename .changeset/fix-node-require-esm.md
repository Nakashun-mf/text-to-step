---
"text-to-step": patch
---

Fix `SyntaxError: Unexpected token 'export'` when running on Node.js versions without `require(esm)` support (< 22.12), and a possible `esbuild` CJS interop double-wrap. The internal OpenCascade loader now loads `replicad-opencascadejs` via dynamic `import()` on all Node versions instead of `require()`, so it always goes through the real ESM loader.
