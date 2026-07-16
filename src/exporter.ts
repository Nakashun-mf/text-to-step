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
    ? solid.reduce((acc, s) => acc.fuse(s) as Shape3D) // STL は Union して出力
    : solid
  // binary=true で バイナリ STL
  const blob = target.blobSTL({ binary: true })
  return blob.arrayBuffer()
}
