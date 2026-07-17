import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { textToCAD } from '../src/index'

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

  it('スペースのみのテキストで Error を throw する', async () => {
    await expect(textToCAD('   ', { font: fontBuffer })).rejects.toThrow('No renderable glyphs in text')
  })

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

  // font 未指定時は CDN からデフォルトフォント(Noto Sans JP)を取得する。
  // ネットワークアクセスが必要なため他のテストより長めのタイムアウトを設定
  it('font を省略した場合デフォルトフォントで変換できる', async () => {
    const result = await textToCAD('AB')
    expect(result.step.byteLength).toBeGreaterThan(0)
    expect(result.stl.byteLength).toBeGreaterThan(0)
  }, 60_000)
})
