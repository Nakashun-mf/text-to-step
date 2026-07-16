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
