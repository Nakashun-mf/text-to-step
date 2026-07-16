import type { OpenCascadeInstance } from 'replicad-opencascadejs'

type OCCFactory = (overrides?: { locateFile?: (path: string) => string }) => Promise<OpenCascadeInstance>

function isNode(): boolean {
  return typeof process !== 'undefined' && !!process.versions?.node
}

function unwrapDefault(mod: unknown): OCCFactory {
  const candidate = (mod as { default?: unknown } | undefined)?.default ?? mod
  if (typeof candidate !== 'function') {
    throw new Error('Failed to load replicad-opencascadejs: expected a factory function')
  }
  return candidate as OCCFactory
}

// replicad-opencascadejs (v0.23.0) の生成物 replicad_single.js は末尾に
// `export default Module` を持つため Node の ESM ローダーに ESM と判定
// されるが、内部コードは CJS 専用グローバル（__dirname, require）に
// 無条件で依存しており、バンドラーを介さない素の Node.js 実行では
// `ReferenceError: __dirname is not defined` で必ず失敗する（既知の
// upstream バグ）。また Node の require(esm) 合成により
// `{ __esModule, default }` 形のオブジェクトが返るため、esbuild が
// 静的 import に対して行う CJS 相互運用変換（__toESM）を通すと二重に
// ラップされて `.default` が関数でなくなる。そのため import ではなく
// 実行時に動的解決し、globalThis へ __dirname/require を一時的に
// 補ってから呼び出す。
//
// 補完している間（factory() の await 完了まで）は同一プロセス内の他の
// コードが globalThis.require/__dirname を参照すると、この glue ファイル
// 用の値を観測してしまう可能性がある。ensureOCC 側でプロセスにつき一度
// だけ実行されるようメモ化しているためウィンドウは初回呼び出し時のみに
// 限定されるが、根本的な解決には upstream の修正が必要。
export async function initOCC(): Promise<OpenCascadeInstance> {
  if (!isNode()) {
    // replicad-opencascadejs の glue コードはブラウザ実行時、
    // document.currentScript.src からアセット(.wasm)の場所を推測するが、
    // 動的 import() されたモジュールには currentScript が存在しないため
    // 空文字列にフォールバックし、サイトのルート相対で .wasm を fetch
    // してしまう（開発サーバの SPA フォールバックが 200 で HTML を返し
    // "invalid wasm magic number" になる）。バンドラー（Vite/webpack 等）が
    // 認識する `new URL(specifier, import.meta.url)` パターンで解決した
    // URL を locateFile 経由で明示的に渡す。
    const wasmUrl = new URL('replicad-opencascadejs/src/replicad_single.wasm', import.meta.url).href
    const mod = await import('replicad-opencascadejs')
    const factory = unwrapDefault(mod)
    return factory({ locateFile: () => wasmUrl })
  }

  // node:module / node:path は Node 判定後に動的 import する。
  // トップレベルで静的 import すると、ブラウザ向け ESM バンドル
  // (dist/index.js) にも埋め込まれ、Node 組み込みモジュールを解決
  // できないバンドラーでビルドが壊れるため。
  const [{ createRequire }, { dirname }] = await Promise.all([
    import('node:module'),
    import('node:path'),
  ])

  // CJS 出力では `require` がそのまま使え、ESM 出力では存在しないため
  // import.meta.url から生成する。esbuild は ESM 出力時に `require` への
  // 参照を検出すると常に truthy なダミー `__require` に置き換えてしまうため
  // `typeof require` では判定できない。`module`/`module.exports` は
  // esbuild が書き換えないため、こちらで CJS/ESM を判定する。
  const nodeRequire: NodeJS.Require =
    typeof module !== 'undefined' && module.exports ? require : createRequire(import.meta.url)

  const glueDir = dirname(nodeRequire.resolve('replicad-opencascadejs'))

  const g = globalThis as Record<string, unknown>
  const hadDirname = Object.prototype.hasOwnProperty.call(g, '__dirname')
  const hadRequire = Object.prototype.hasOwnProperty.call(g, 'require')
  const prevDirname = g.__dirname
  const prevRequire = g.require
  g.__dirname = glueDir
  g.require = nodeRequire

  try {
    const mod = nodeRequire('replicad-opencascadejs')
    const factory = unwrapDefault(mod)
    return await factory()
  } finally {
    if (hadDirname) g.__dirname = prevDirname
    else Reflect.deleteProperty(g, '__dirname')
    if (hadRequire) g.require = prevRequire
    else Reflect.deleteProperty(g, 'require')
  }
}
