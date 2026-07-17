// font 未指定時に使うデフォルトフォント。CJK を含む幅広い文字をカバーできる
// Noto Sans JP を、jsDelivr 経由（GitHub google/fonts リポジトリのミラー、
// CORS 許可・CDN キャッシュあり）で遅延取得する。可変フォント(variable font)
// だが opentype.js はデフォルトインスタンスのアウトラインとして解釈できる。
const DEFAULT_FONT_URL =
  'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/notosansjp/NotoSansJP%5Bwght%5D.ttf'

let cachedFontPromise: Promise<ArrayBuffer> | null = null

export function loadDefaultFont(): Promise<ArrayBuffer> {
  if (!cachedFontPromise) {
    cachedFontPromise = fetch(DEFAULT_FONT_URL)
      .then((res) => {
        if (!res.ok) {
          throw new Error(
            `Failed to fetch default font (${res.status} ${res.statusText}). ` +
              'Pass `font` explicitly to avoid relying on network access.',
          )
        }
        return res.arrayBuffer()
      })
      .catch((err) => {
        cachedFontPromise = null // 失敗時は次回呼び出しで再試行できるようにする
        throw err
      })
  }
  return cachedFontPromise
}
