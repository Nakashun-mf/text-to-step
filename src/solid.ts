import { loadFont, drawText, getFont } from 'replicad'
import type { Shape3D } from 'replicad'

// フォントキャッシュ：同一 ArrayBuffer を何度も登録しない
const fontCache = new Map<ArrayBuffer, string>()

// 全角スペース(　)は \s に含まれないため明示的に加える
const isSkippableChar = (char: string): boolean => /^[\s　]$/.test(char)

async function ensureFont(fontBuffer: ArrayBuffer): Promise<string> {
  if (fontCache.has(fontBuffer)) return fontCache.get(fontBuffer)!
  const name = `font_${fontCache.size}`
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
  // スペースのみのテキストはグリフを持たず、空ソリッドの生成や
  // OpenCascade 側の不明瞭なエラーにつながるため事前に弾く
  if ([...text].every(isSkippableChar)) {
    throw new Error('No renderable glyphs in text')
  }

  const fontFamily = await ensureFont(fontBuffer)

  if (!separate) {
    // 全文字まとめて drawText → 単一 Shape3D
    const drawing = drawText(text, { fontFamily, fontSize })
    return drawing.sketchOnPlane('XY').extrude(depth) as Shape3D
  }

  // 文字ごとにバラソリッド
  const chars = [...text] // サロゲートペア対応のスプレッド
  const solids: Shape3D[] = []
  let xOffset = 0

  for (const char of chars) {
    // スペース系文字はスキップ（グリフなし）
    if (isSkippableChar(char)) {
      xOffset += fontSize * 0.5
      continue
    }
    const drawing = drawText(char, { fontFamily, fontSize, startX: xOffset })
    const bbox = drawing.boundingBox
    const solid = drawing.sketchOnPlane('XY').extrude(depth) as Shape3D
    solids.push(solid)
    // bounds[1][0] = maxX（BoundingBox2d に maxX プロパティはない）
    xOffset = bbox.bounds[1][0] + fontSize * 0.1 // 0.1em のギャップ
  }

  return solids
}
