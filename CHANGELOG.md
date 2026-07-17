# text-to-step

## 0.1.0

### Added

- `textToCAD(text, options)`: テキスト（漢字・ひらがな・カタカナ・英数字対応）を STEP / STL の押し出しソリッドに変換する API。
- `separate: true` で文字ごとのバラソリッド（アセンブリ STEP + Union STL）に対応。
- `font` 省略時に CDN（jsDelivr 経由の Noto Sans JP）からデフォルトフォントを自動取得。
- Node.js（ESM / CJS）・ブラウザの両方で動作する Universal ビルド。
- `replicad-opencascadejs` の upstream バグ（素の Node.js / 動的 import 経由のブラウザ実行での WASM 解決失敗）を回避する内部ローダー (`occLoader.ts`)。
- ブラウザ向けサンプルアプリ（`examples/browser`）。
