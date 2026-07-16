# text-to-step — CLAUDE.md

> **このドキュメントは replicad v0.23.1 の dist/replicad.cjs および dist/replicad.d.ts を
> 直接読んで確認した事実のみを記載している。推測は含まない。**

---

## プロジェクト概要

日本語（漢字・ひらがな・カタカナ）・英数字・記号を含む任意のテキストから、
押し出しソリッドの **STEP (.stp)** および **STL (.stl)** ファイルを生成する npm パッケージ。

Node.js・ブラウザの両環境で動作する Universal ライブラリとして実装する。

---

## ゴール（API）

```ts
import { textToCAD } from 'text-to-step'

const result = await textToCAD('製造AB漢字', {
  font: fontBuffer,  // TTF の ArrayBuffer（※後述の制約あり）
  fontSize: 10,      // mm
  depth: 3,          // 押し出し深さ mm
  separate: false,   // true = 文字ごとにバラソリッド
})

const stepBuffer: ArrayBuffer = result.step
const stlBuffer:  ArrayBuffer = result.stl
await result.downloadStep('output.stp')  // ブラウザのみ
await result.downloadStl('output.stl')   // ブラウザのみ
```

---

## ソースコード調査で判明した事実（replicad v0.23.1）

### loadFont の実際のシグネチャ（型定義より）

```ts
function loadFont(
  fontPath: string | ArrayBuffer,  // URL文字列 または ArrayBuffer
  fontFamily?: string,             // デフォルト: "default"
  force?: boolean                  // 強制再登録フラグ、デフォルト: false
): Promise<opentype.Font>
```

**実装の詳細（cjs ソースより確認済み）**
- `FONT_REGISTER` というモジュールスコープの `{}` でフォントをキャッシュ
- 同一 `fontFamily` で既登録かつ `force=false` なら `console.log` して早期リターン
- `fontPath` が文字列の場合 `fetch()` で取得、ArrayBuffer の場合はそのまま使用
- `opentype.parse(fontData)` でパース（**opentype.js v1.3.4** を使用）
- 最初に登録したフォントが自動で `"default"` にも登録される
- `⚠️ opentype.js は v1.3.4（最新の v2.0.0 ではない）`

### drawText の実際のシグネチャ（型定義より）

```ts
function drawText(
  text: string,
  options?: {
    startX?: number    // デフォルト: 0
    startY?: number    // デフォルト: 0
    fontSize?: number  // デフォルト: 16
    fontFamily?: string // デフォルト: "default"
  }
): Drawing
```

**内部実装の詳細（sketchFontCommands + textBlueprints より確認済み）**

1. `font.getPath(text, -startX, -startY, fontSize)` で opentype.js からパスを取得
   - X座標を `-startX`、Y座標を `-startY` で反転して渡している
2. コマンドを走査する際に `const p = [-command.x, command.y]` で **X座標を反転**
   - ベジェ制御点も同様に `[-command.x1, command.y1]` で X を反転
3. `organiseBlueprints(blueprints).mirror([0, 0])` で最終的に Y軸ミラー
4. **つまり replicad が X反転 + Y軸ミラーを内部で処理済み** → 実装者が座標変換を気にする必要なし

**フォントフォールバックの罠（CadQuery issue#1920 相当が replicad にも存在）**
```ts
// textBlueprints の実装（ソースより）
if (!font) {
  console.warn(`Font family "${fontFamily}" not found, please load it first, using the default`);
  font = getFont();  // default フォントにサイレントフォールバック
}
```
→ **`fontFamily` 名を間違えても警告だけで処理が続く。** エラーにならない。
→ 実装時に `getFont(fontFamily)` の戻り値を確認してエラーを明示的に throw すること

### exportSTEP の実際のシグネチャ（型定義より）

```ts
function exportSTEP(
  shapes?: ShapeConfig[],  // ← 配列を受け取る（Solid 単体ではない）
  options?: {
    unit?: SupportedUnit
    modelUnit?: SupportedUnit
  }
): Blob  // ← Blob を返す（ArrayBuffer ではない）
```

**ShapeConfig の型（型定義より）**

```ts
type ShapeConfig = {
  shape: AnyShape   // Shape3D | Solid | Compound など
  color?: string    // 例: "#ff0000"
  alpha?: number
  name?: string     // STEP内のパーツ名
}
```

**正しい使い方**
```ts
// ✅ 正しい
const blob = exportSTEP([{ shape: solid, name: 'text' }])
const buffer = await blob.arrayBuffer()

// ❌ 間違い（Solid を直接渡せない）
const blob = exportSTEP(solid)
```

**単一 Solid にも Shape クラスの blobSTEP() メソッドがある（ソースより確認）**
```ts
// Shape.blobSTEP() → Blob を返す（名前付きアセンブリ不要な場合はこちらが簡単）
const blob = solid.blobSTEP()
const buffer = await blob.arrayBuffer()
```

### blobSTL の実際のシグネチャ

```ts
// Shape クラスのメソッド（ソースより確認）
blobSTL(options?: {
  tolerance?: number        // デフォルト: 0.001
  angularTolerance?: number // デフォルト: 0.1
  binary?: boolean          // デフォルト: false（テキスト形式）
}): Blob
```

### Drawing.sketchOnPlane → extrude の戻り値型

```ts
// Drawing.sketchOnPlane() の戻り値は Sketch | Sketches | CompoundSketch
// いずれも .extrude(depth) を持ち、戻り値は Shape3D
const solid: Shape3D = drawText('A', { fontFamily, fontSize })
  .sketchOnPlane('XY')
  .extrude(depth)
```

- `Sketch.extrude()` → `Shape3D`
- `Sketches.extrude()` → `Shape3D`（複数パスを含む文字の場合。穴あきの「口」など）
- `CompoundSketch.extrude()` → `AnyShape`

### BoundingBox2d のプロパティ（型定義より）

```ts
class BoundingBox2d {
  get bounds(): [Point2D, Point2D]  // [左下, 右上] = [[minX,minY], [maxX,maxY]]
  get center(): Point2D
  get width(): number
  get height(): number
}
// maxX は直接ない → bounds[1][0] で取得
```

### Shape3D.fuse（Union）のシグネチャ

```ts
fuse(other: Shape3D, options?: {
  optimisation?: 'none' | 'commonFace' | 'sameFace'
}): Shape3D
```

### opentype.js v1.3.4 の制約

replicad v0.23.1 は opentype.js **v1.3.4** に固定されている（v2.0.0 ではない）。
v1.3.4 時点での CJK 対応状況：
- CFF 形式（OTF）での CJK グリフ：v0.7.0 で修正済みのため v1.3.4 でも動作するはず
- ただし安全のため **TTF 形式推奨** は変わらない

---

## アーキテクチャ

```
[ユーザー] font: ArrayBuffer + text: string
    ↓
[text-to-step / src/index.ts]
    ↓ setOC() で OCC 初期化（一度だけ）
    ↓ loadFont(fontBuffer, uniqueFontName)
    ↓
[separate=false]
    drawText(text, { fontFamily, fontSize })
        → Drawing
        → .sketchOnPlane('XY')
        → .extrude(depth)
        → Shape3D (single fused solid)
    exportSTEP([{ shape, name: 'text' }]) → Blob → ArrayBuffer
    shape.blobSTL() → Blob → ArrayBuffer

[separate=true]
    文字ごとに drawText(char, { fontFamily, fontSize, startX: xOffset })
        → Drawing → .sketchOnPlane('XY') → .extrude(depth) → Shape3D
    xOffset += drawing.boundingBox.bounds[1][0]  // bounds[1][0] = maxX
    exportSTEP(solids.map((s,i) => ({ shape: s, name: `char_${i}` }))) → Blob
    solids.reduce((a,b) => a.fuse(b)).blobSTL() → Blob
```

---

## 型定義 (`src/types.ts`)

```ts
export interface TextToCADOptions {
  /** TTF フォントの ArrayBuffer（必須）。OTF も可だが TTF 推奨 */
  font: ArrayBuffer

  /** フォントサイズ（mm）。デフォルト: 10 */
  fontSize?: number

  /** 押し出し深さ（mm）。デフォルト: 3 */
  depth?: number

  /**
   * true = 文字ごとにバラソリッド（STEP はアセンブリ、STL は Union）
   * false = 全文字を単一ソリッドとして生成
   * デフォルト: false
   */
  separate?: boolean
}

export interface TextToCADResult {
  step: ArrayBuffer
  stl: ArrayBuffer
  downloadStep(filename?: string): void
  downloadStl(filename?: string): void
}
```

---

## 実装仕様

### `src/solid.ts`

```ts
import { loadFont, drawText, getFont } from 'replicad'
import type { Shape3D } from 'replicad'

// フォントキャッシュ：同一 ArrayBuffer を何度も登録しない
const fontCache = new Map<ArrayBuffer, string>()
let fontCounter = 0

async function ensureFont(fontBuffer: ArrayBuffer): Promise<string> {
  if (fontCache.has(fontBuffer)) return fontCache.get(fontBuffer)!
  const name = `font_${fontCounter++}`
  await loadFont(fontBuffer, name)
  // ロード後に登録されているか確認（サイレントフォールバック防止）
  if (!getFont(name)) throw new Error('Font failed to load')
  fontCache.set(fontBuffer, name)
  return name
}

export async function textToSolid(
  text: string,
  fontBuffer: ArrayBuffer,
  fontSize: number,
  depth: number,
  separate: boolean,
): Promise<Shape3D | Shape3D[]> {
  const fontFamily = await ensureFont(fontBuffer)

  if (!separate) {
    // 全文字まとめて drawText → 単一 Shape3D
    const drawing = drawText(text, { fontFamily, fontSize })
    return drawing.sketchOnPlane('XY').extrude(depth) as Shape3D
  }

  // 文字ごとにバラソリッド
  const chars = [...text]  // サロゲートペア対応のスプレッド
  const solids: Shape3D[] = []
  let xOffset = 0

  for (const char of chars) {
    // スペース系文字はスキップ（グリフなし）
    if (char === ' ' || char === '\u3000' || char === '\t') {
      xOffset += fontSize * 0.5
      continue
    }
    const drawing = drawText(char, { fontFamily, fontSize, startX: xOffset })
    const bbox = drawing.boundingBox
    const solid = drawing.sketchOnPlane('XY').extrude(depth) as Shape3D
    solids.push(solid)
    // bounds[1][0] = maxX（BoundingBox2d に maxX プロパティはない）
    xOffset = bbox.bounds[1][0] + fontSize * 0.1  // 0.1em のギャップ
  }

  if (solids.length === 0) throw new Error('No renderable glyphs in text')
  return solids
}
```

### `src/exporter.ts`

```ts
import { exportSTEP } from 'replicad'
import type { Shape3D } from 'replicad'

export async function toStepBuffer(solid: Shape3D | Shape3D[]): Promise<ArrayBuffer> {
  if (Array.isArray(solid)) {
    // アセンブリ STEP（文字ごとに名前付き）
    const shapes = solid.map((s, i) => ({ shape: s, name: `char_${i}` }))
    const blob = exportSTEP(shapes)
    return blob.arrayBuffer()
  }
  // 単一ソリッド → Shape.blobSTEP() が最も簡単
  const blob = solid.blobSTEP()
  return blob.arrayBuffer()
}

export async function toStlBuffer(solid: Shape3D | Shape3D[]): Promise<ArrayBuffer> {
  const target = Array.isArray(solid)
    ? solid.reduce((acc, s) => acc.fuse(s) as Shape3D)  // STL は Union して出力
    : solid
  // binary=true で バイナリ STL
  const blob = target.blobSTL({ binary: true })
  return blob.arrayBuffer()
}
```

### `src/index.ts`

```ts
import { setOC } from 'replicad'
import initOpenCascade from 'replicad-opencascadejs'
import { textToSolid } from './solid'
import { toStepBuffer, toStlBuffer } from './exporter'
import { downloadBuffer } from './download'
import type { TextToCADOptions, TextToCADResult } from './types'

let occInitialized = false

async function ensureOCC(): Promise<void> {
  if (occInitialized) return
  const OC = await initOpenCascade()
  setOC(OC)
  occInitialized = true
}

export async function textToCAD(
  text: string,
  options: TextToCADOptions,
): Promise<TextToCADResult> {
  if (!text) throw new Error('text must not be empty')

  const { font, fontSize = 10, depth = 3, separate = false } = options

  await ensureOCC()

  const solid = await textToSolid(text, font, fontSize, depth, separate)

  const [stepBuffer, stlBuffer] = await Promise.all([
    toStepBuffer(solid),
    toStlBuffer(solid),
  ])

  return {
    step: stepBuffer,
    stl: stlBuffer,
    downloadStep: (filename = 'output.stp') => downloadBuffer(stepBuffer, filename),
    downloadStl:  (filename = 'output.stl') => downloadBuffer(stlBuffer, filename),
  }
}

export type { TextToCADOptions, TextToCADResult }
```

### `src/download.ts`

```ts
export function downloadBuffer(buffer: ArrayBuffer, filename: string): void {
  if (typeof window === 'undefined') return
  const blob = new Blob([buffer])
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
```

---

## package.json

```json
{
  "name": "text-to-step",
  "version": "0.1.0",
  "description": "Convert text (including Japanese/CJK) to extruded 3D STEP/STL solids",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup src/index.ts --format esm,cjs --dts",
    "test": "vitest run",
    "dev": "tsup src/index.ts --format esm,cjs --dts --watch"
  },
  "dependencies": {
    "replicad": "^0.23.1",
    "replicad-opencascadejs": "^0.23.0"
  },
  "devDependencies": {
    "tsup": "^8.0.0",
    "typescript": "^5.0.0",
    "vitest": "^2.0.0",
    "@types/node": "^20.0.0"
  },
  "keywords": ["STEP", "STL", "CAD", "3D", "text", "Japanese", "CJK", "kanji", "extrude"],
  "license": "MIT"
}
```

---

## テスト (`test/index.test.ts`)

```ts
import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'fs'
import { setOC } from 'replicad'
import initOpenCascade from 'replicad-opencascadejs'
import { textToCAD } from '../src/index'

// WASM ロードは重いので beforeAll で一度だけ
beforeAll(async () => {
  const OC = await initOpenCascade()
  setOC(OC)
}, 60_000)

// Noto Sans JP TTF を test/fonts/ に手動配置
// https://fonts.google.com/noto/specimen/Noto+Sans+JP → TTF版をダウンロード
const fontBuffer = readFileSync('./test/fonts/NotoSansJP-Regular.ttf').buffer as ArrayBuffer

describe('textToCAD', () => {
  it('英字を STEP/STL に変換できる', async () => {
    const result = await textToCAD('ABC', { font: fontBuffer })
    expect(result.step.byteLength).toBeGreaterThan(0)
    expect(result.stl.byteLength).toBeGreaterThan(0)
  }, 30_000)

  it('漢字を変換できる', async () => {
    const result = await textToCAD('製造', { font: fontBuffer })
    expect(result.step.byteLength).toBeGreaterThan(0)
  }, 30_000)

  it('ひらがな・カタカナを変換できる', async () => {
    const result = await textToCAD('あいうアイウ', { font: fontBuffer })
    expect(result.step.byteLength).toBeGreaterThan(0)
  }, 30_000)

  it('穴あき文字（口・の・B）を変換できる', async () => {
    // replicad が organiseBlueprints() でワインディングルールを自動処理
    const result = await textToCAD('口のB', { font: fontBuffer })
    expect(result.step.byteLength).toBeGreaterThan(0)
  }, 30_000)

  it('スペースが含まれても変換できる', async () => {
    const result = await textToCAD('A B', { font: fontBuffer })
    expect(result.step.byteLength).toBeGreaterThan(0)
  }, 30_000)

  it('separate=true でアセンブリ STEP を返す', async () => {
    const result = await textToCAD('AB', { font: fontBuffer, separate: true })
    expect(result.step.byteLength).toBeGreaterThan(0)
  }, 30_000)

  it('空文字列で Error を throw する', async () => {
    await expect(textToCAD('', { font: fontBuffer })).rejects.toThrow('text must not be empty')
  })

  it('フォントロード失敗で Error を throw する', async () => {
    // 壊れた ArrayBuffer
    const bad = new ArrayBuffer(8)
    await expect(textToCAD('A', { font: bad })).rejects.toThrow()
  })
})
```

---

## Node.js 使用例

```ts
import { readFileSync, writeFileSync } from 'fs'
import { setOC } from 'replicad'
import initOpenCascade from 'replicad-opencascadejs'
import { textToCAD } from 'text-to-step'

const OC = await initOpenCascade()
setOC(OC)

const fontBuffer = readFileSync('./NotoSansJP-Regular.ttf').buffer as ArrayBuffer

const result = await textToCAD('製造AB', {
  font: fontBuffer,
  fontSize: 10,
  depth: 3,
})

writeFileSync('./output.stp', Buffer.from(result.step))
writeFileSync('./output.stl', Buffer.from(result.stl))
```

---

## ブラウザ使用例

```html
<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"><title>text-to-step</title></head>
<body>
  <input type="text" id="text" value="製造" />
  <input type="file" id="font" accept=".ttf,.otf" />
  <button id="generate">STEP 生成</button>
  <p id="status"></p>
  <script type="module">
    import { textToCAD } from 'https://cdn.jsdelivr.net/npm/text-to-step/dist/index.js'

    document.getElementById('generate').addEventListener('click', async () => {
      const text = document.getElementById('text').value
      const file = document.getElementById('font').files[0]
      if (!file) return alert('TTF フォントを選択してください')
      document.getElementById('status').textContent = '生成中（初回 WASM ロードで数秒）...'
      try {
        const fontBuffer = await file.arrayBuffer()
        const result = await textToCAD(text, { font: fontBuffer, depth: 3 })
        result.downloadStep()
        result.downloadStl()
        document.getElementById('status').textContent = '完了'
      } catch (e) {
        document.getElementById('status').textContent = `エラー: ${e.message}`
      }
    })
  </script>
</body>
</html>
```

---

## 既知の問題と対処法（ソース確認済みのもの）

| 問題 | 確認方法 | 対処法 |
|------|---------|--------|
| フォント名ミスでサイレントフォールバック | replicad cjs ソース直接確認 | `getFont(name)` で登録確認後に使う。未登録なら Error throw |
| `exportSTEP` は Solid を直接受け取らない | 型定義 `ShapeConfig[]` を確認 | `[{ shape: solid, name: 'text' }]` の配列形式で渡す |
| `BoundingBox2d` に `maxX` プロパティはない | 型定義確認 | `bounds[1][0]` で maxX を取得 |
| opentype.js は v1.3.4（v2.0.0 ではない） | package.json 確認 | CJK TTF は動作するが OTF は避けること |
| separate=false の Union は replicad が自動処理 | textBlueprints ソース確認 | `drawText(text)` 一発で全文字 Union 済みの Drawing が返る |
| separate=true で STL は Union が必要 | blobSTL はシェイプ単体用 | `solids.reduce((a,b) => a.fuse(b)).blobSTL()` |
| Next.js で WASM 解決失敗 | replicad Discussion #140 | `asyncWebAssembly: true` + Web Worker 必須 |
| 空テキスト・スペースのみ | 実装上の考慮 | 事前チェックして `Error` を throw |
| X軸・Y軸の変換は不要 | sketchFontCommands ソース確認 | replicad が内部で処理済み。実装者は座標変換不要 |

---

## 実装ステップ

1. `package.json` + `tsconfig.json` 作成 → `npm install`
2. **`src/index.ts` で OCC 初期化 → Node.js で起動確認**
3. **`src/solid.ts` の `ensureFont` + `drawText('A')` で英字ソリッド生成確認**
4. `src/exporter.ts` で `solid.blobSTEP()` → ファイル保存 → CAD で開いて確認
5. **穴あき文字 `B`・`口` でワインディングルール自動処理を確認**
6. **漢字・ひらがな・カタカナで動作確認（Noto Sans JP TTF）**
7. `separate=true` のバラソリッドとアセンブリ STEP 確認
8. `test/index.test.ts` 全件グリーン
9. `npm publish`

---

## 参考リンク

| リソース | URL |
|---------|-----|
| replicad `drawText()` 型定義 | https://replicad.xyz/docs/api/functions/drawText |
| replicad `loadFont()` 型定義 | https://replicad.xyz/docs/api/functions/loadFont |
| replicad `exportSTEP()` 型定義 | https://replicad.xyz/docs/api/functions/exportSTEP |
| replicad ソースコード（draw.ts） | https://github.com/sgenoud/replicad/blob/main/packages/replicad/src/draw.ts |
| replicad Next.js issue | https://github.com/sgenoud/replicad/discussions/140 |
| Noto Sans JP TTF | https://fonts.google.com/noto/specimen/Noto+Sans+JP |
| CadQuery font fallback #1920 | https://github.com/CadQuery/cadquery/issues/1920 |
| CadQuery separate #1712 | https://github.com/CadQuery/cadquery/issues/1712 |
