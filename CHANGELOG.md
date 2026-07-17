# text-to-step

## 0.1.1

### Patch Changes

- e3912bf: Add a 20s timeout to the default-font CDN fetch (`defaultFont.ts`) so `textToCAD()` fails with a clear error instead of hanging indefinitely when the network is unreachable or the CDN doesn't respond.
- fecff89: Fix `SyntaxError: Unexpected token 'export'` when running on Node.js versions without `require(esm)` support (< 22.12), and a possible `esbuild` CJS interop double-wrap. The internal OpenCascade loader now loads `replicad-opencascadejs` via dynamic `import()` on all Node versions instead of `require()`, so it always goes through the real ESM loader.

## 0.1.0

### Added

- `textToCAD(text, options)`: テキスト（漢字・ひらがな・カタカナ・英数字対応）を STEP / STL の押し出しソリッドに変換する API。
- `separate: true` で文字ごとのバラソリッド（アセンブリ STEP + Union STL）に対応。
- `font` 省略時に CDN（jsDelivr 経由の Noto Sans JP）からデフォルトフォントを自動取得。
- Node.js（ESM / CJS）・ブラウザの両方で動作する Universal ビルド。
- `replicad-opencascadejs` の upstream バグ（素の Node.js / 動的 import 経由のブラウザ実行での WASM 解決失敗）を回避する内部ローダー (`occLoader.ts`)。
- ブラウザ向けサンプルアプリ（`examples/browser`）。
