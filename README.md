# text-to-step

日本語（漢字・ひらがな・カタカナ）・英数字・記号を含む任意のテキストから、押し出しソリッドの **STEP (.stp)** および **STL (.stl)** ファイルを生成する npm パッケージです。[replicad](https://replicad.xyz/)（OpenCascade の WASM ビルド）を利用しており、Node.js・ブラウザの両方で動作します。

## 特徴

- 漢字・ひらがな・カタカナを含む CJK テキストに対応
- 単一ソリッド（`separate: false`）と、文字ごとのバラソリッド + アセンブリ STEP（`separate: true`）の両方に対応
- Node.js（ESM / CJS）とブラウザの両方で同じ API が使える Universal ライブラリ
- OpenCascade (WASM) の初期化はライブラリ内部で自動的に行われる（呼び出し側での `setOC` 等のセットアップ不要）
- `font` は省略可能。省略時は CDN からデフォルトフォント（Noto Sans JP）を自動取得

## インストール

```bash
npm install text-to-step
```

## クイックスタート

### Node.js

```ts
import { readFileSync, writeFileSync } from 'fs'
import { textToCAD } from 'text-to-step'

const fontBuffer = readFileSync('./NotoSansJP-Regular.ttf').buffer as ArrayBuffer

const result = await textToCAD('製造AB', {
  font: fontBuffer,
  fontSize: 10, // mm
  depth: 3,     // mm
})

writeFileSync('./output.stp', Buffer.from(result.step))
writeFileSync('./output.stl', Buffer.from(result.stl))
```

### ブラウザ

```html
<input type="text" id="text" value="製造" />
<input type="file" id="font" accept=".ttf,.otf" />
<button id="generate">STEP 生成</button>

<script type="module">
  import { textToCAD } from 'text-to-step'

  document.getElementById('generate').addEventListener('click', async () => {
    const text = document.getElementById('text').value
    const file = document.getElementById('font').files[0]
    if (!file) return alert('TTF フォントを選択してください')

    const fontBuffer = await file.arrayBuffer()
    const result = await textToCAD(text, { font: fontBuffer, depth: 3 })

    result.downloadStep('output.stp')
    result.downloadStl('output.stl')
  })
</script>
```

動作するデモは [`examples/browser`](examples/browser) にあります（後述の「サンプルアプリ」参照）。

## API

### `textToCAD(text, options): Promise<TextToCADResult>`

| 引数 | 型 | 説明 |
|------|-----|------|
| `text` | `string` | 変換するテキスト。空文字・スペースのみの文字列は Error を throw |
| `options.font` | `ArrayBuffer` | TTF フォントの ArrayBuffer（OTF も可だが CJK は TTF 推奨）。省略時は CDN からデフォルトフォント（Noto Sans JP）を取得する（要ネットワークアクセス） |
| `options.fontSize` | `number` | フォントサイズ (mm)。デフォルト `10` |
| `options.depth` | `number` | 押し出し深さ (mm)。デフォルト `3` |
| `options.separate` | `boolean` | `true` = 文字ごとにバラソリッド（STEP はアセンブリ、STL は Union）。`false` = 全文字を単一ソリッドとして生成。デフォルト `false` |

戻り値 `TextToCADResult`:

| プロパティ | 型 | 説明 |
|-----------|-----|------|
| `step` | `ArrayBuffer` | STEP ファイルのバイナリ |
| `stl` | `ArrayBuffer` | STL ファイルのバイナリ（バイナリ形式） |
| `downloadStep(filename?)` | `(filename?: string) => void` | ブラウザ環境でのみ動作。STEP をダウンロード（デフォルトファイル名 `output.stp`） |
| `downloadStl(filename?)` | `(filename?: string) => void` | ブラウザ環境でのみ動作。STL をダウンロード（デフォルトファイル名 `output.stl`） |

## フォントについて

- `font` を省略すると、初回呼び出し時に [jsDelivr](https://www.jsdelivr.com/)（GitHub `google/fonts` リポジトリのミラー）から Noto Sans JP（可変フォント、約10MB）を取得し、プロセス/ページ内でキャッシュします。ネットワークアクセスができない環境や、起動を高速化したい場合、独自フォントを使いたい場合は `font` を明示的に指定してください。
- **TTF 形式を推奨**します。OTF（CFF）の CJK グリフも動作しますが、内部で使われている opentype.js が v1.3.4 に固定されているため TTF の方が安全です。
- 存在しないフォントファミリー名を指定してのフォールバック（サイレントに `default` フォントへ切り替わる挙動）は本ライブラリ側で検知し、ロード失敗時は明示的に Error を throw します。
- 同一の `ArrayBuffer` インスタンスを複数回 `textToCAD` に渡した場合はフォントの再登録をスキップしますが、内容が同じでも別インスタンスの `ArrayBuffer`（例: 毎回 `readFileSync` し直す等）は別フォントとして再登録されます。大量に繰り返し呼び出すサーバー用途では、読み込んだ `ArrayBuffer` を使い回すことを推奨します。

## サンプルアプリ

ブラウザで動作を確認できるデモが [`examples/browser`](examples/browser) にあります。

```bash
npm run build     # dist/ をビルド（デモは dist/index.js を直接 import します）
npm run example   # http://localhost:5173 で Vite dev server が起動
```

テキスト入力・フォントファイルのアップロード・`fontSize` / `depth` / `separate` の指定・STEP/STL のダウンロードができます。

## 開発

```bash
npm install
npm run build   # tsup で ESM/CJS/型定義をビルド
npm test        # vitest でテスト実行（要 test/fonts/NotoSansJP-Regular.ttf）
npm run dev     # tsup --watch
```

テストの実行には日本語フォントが必要です。[Noto Sans JP](https://fonts.google.com/noto/specimen/Noto+Sans+JP) の TTF を `test/fonts/NotoSansJP-Regular.ttf` に配置してください（`.gitignore` 済みでリポジトリには含まれません）。

## 既知の制約

- `replicad-opencascadejs@0.23.0` の生成物には、バンドラーを介さない素の Node.js 実行時や、動的 `import()` 経由でのブラウザ実行時に WASM の場所を正しく解決できない upstream の不具合があります。本ライブラリの [`src/occLoader.ts`](src/occLoader.ts) で回避策を実装済みですが、Vite / webpack など標準的なバンドラー以外の特殊な環境（例: Next.js の一部バンドル設定）では追加の設定が必要になる場合があります。
- ブラウザの `downloadStep` / `downloadStl` は `window`/`document` に依存するため Node.js 環境では何もしません（`result.step` / `result.stl` の `ArrayBuffer` を直接ファイルに書き出してください）。

## ライセンス

MIT
